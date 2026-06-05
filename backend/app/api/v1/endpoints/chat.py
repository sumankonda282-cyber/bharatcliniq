"""
Internal clinic chat — long-polling transport.
Only staff of the same clinic can chat.
"""
import asyncio
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from app.db.session import get_db
from app.models.models import Staff, Branch, ChatRoom, ChatRoomMember, InternalMessage, MessageRead
from app.core.security import get_current_staff

router = APIRouter(prefix="/chat", tags=["chat"])

POLL_TIMEOUT = 25  # seconds


# ── Schemas ───────────────────────────────────────────────────────────────────

ONLINE_MINUTES  = 2
AWAY_MINUTES    = 10

def _presence(last_seen: datetime | None) -> str:
    if not last_seen:
        return "offline"
    delta = (datetime.utcnow() - last_seen).total_seconds() / 60
    if delta <= ONLINE_MINUTES:
        return "online"
    if delta <= AWAY_MINUTES:
        return "away"
    return "offline"


class ContactOut(BaseModel):
    staff_id: int
    full_name: str
    role: str
    branch_id: Optional[int]
    branch_name: Optional[str]
    presence: str
    unread: int

    class Config:
        from_attributes = True


class MessageOut(BaseModel):
    id: int
    sender_id: int
    sender_name: str
    body: str
    msg_type: str
    created_at: datetime

    class Config:
        from_attributes = True


class SendMessageIn(BaseModel):
    body: str
    msg_type: str = "text"


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_or_create_direct_room(clinic_id: int, a: int, b: int, db: Session) -> ChatRoom:
    """Find or create a direct room between two staff members."""
    # Find rooms where both a and b are members in the same clinic
    a_rooms = db.query(ChatRoomMember.room_id).filter(ChatRoomMember.staff_id == a)
    b_rooms = db.query(ChatRoomMember.room_id).filter(ChatRoomMember.staff_id == b)
    shared = a_rooms.intersect(b_rooms).all()

    for (room_id,) in shared:
        room = db.query(ChatRoom).filter(
            ChatRoom.id == room_id,
            ChatRoom.clinic_id == clinic_id,
            ChatRoom.room_type == "direct"
        ).first()
        if room:
            return room

    room = ChatRoom(clinic_id=clinic_id, room_type="direct")
    db.add(room)
    db.flush()
    db.add(ChatRoomMember(room_id=room.id, staff_id=a))
    db.add(ChatRoomMember(room_id=room.id, staff_id=b))
    db.commit()
    db.refresh(room)
    return room


def _format_message(msg: InternalMessage, db: Session) -> dict:
    sender = db.query(Staff).filter(Staff.id == msg.sender_id).first()
    return {
        "id": msg.id,
        "sender_id": msg.sender_id,
        "sender_name": sender.full_name if sender else "Unknown",
        "body": msg.body,
        "msg_type": msg.msg_type,
        "created_at": msg.created_at.isoformat(),
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/contacts", response_model=List[ContactOut])
def get_contacts(
    db: Session = Depends(get_db),
    me: Staff = Depends(get_current_staff),
):
    """All active staff in the same clinic, with unread counts."""
    colleagues = db.query(Staff).filter(
        Staff.clinic_id == me.clinic_id,
        Staff.id != me.id,
        Staff.is_active == True,
    ).all()

    result = []
    for c in colleagues:
        # Find direct room
        a_rooms = db.query(ChatRoomMember.room_id).filter(ChatRoomMember.staff_id == me.id)
        b_rooms = db.query(ChatRoomMember.room_id).filter(ChatRoomMember.staff_id == c.id)
        shared = a_rooms.intersect(b_rooms).all()

        unread = 0
        for (room_id,) in shared:
            room = db.query(ChatRoom).filter(
                ChatRoom.id == room_id, ChatRoom.room_type == "direct"
            ).first()
            if room:
                unread_msgs = db.query(InternalMessage).filter(
                    InternalMessage.room_id == room_id,
                    InternalMessage.sender_id != me.id,
                ).all()
                read_ids = {
                    r.message_id for r in db.query(MessageRead).filter(
                        MessageRead.staff_id == me.id,
                        MessageRead.message_id.in_([m.id for m in unread_msgs])
                    ).all()
                }
                unread += sum(1 for m in unread_msgs if m.id not in read_ids)

        branch_name = None
        if c.branch_id:
            br = db.query(Branch).filter(Branch.id == c.branch_id).first()
            branch_name = br.name if br else None

        result.append(ContactOut(
            staff_id=c.id,
            full_name=c.full_name,
            role=c.role,
            branch_id=c.branch_id,
            branch_name=branch_name,
            presence=_presence(c.last_seen_at),
            unread=unread,
        ))

    result.sort(key=lambda x: (-x.unread, x.full_name))
    return result


@router.post("/rooms/direct")
def open_direct_room(
    other_staff_id: int,
    db: Session = Depends(get_db),
    me: Staff = Depends(get_current_staff),
):
    """Open (or return existing) direct room with another staff member."""
    other = db.query(Staff).filter(
        Staff.id == other_staff_id,
        Staff.clinic_id == me.clinic_id,
    ).first()
    if not other:
        raise HTTPException(404, "Staff not found in your clinic")

    room = _get_or_create_direct_room(me.clinic_id, me.id, other_staff_id, db)
    return {"room_id": room.id}


@router.get("/rooms/{room_id}/messages")
def get_messages(
    room_id: int,
    limit: int = 50,
    db: Session = Depends(get_db),
    me: Staff = Depends(get_current_staff),
):
    """Fetch recent messages and mark them as read."""
    # Verify membership
    member = db.query(ChatRoomMember).filter(
        ChatRoomMember.room_id == room_id,
        ChatRoomMember.staff_id == me.id,
    ).first()
    if not member:
        raise HTTPException(403, "Not a member of this room")

    msgs = db.query(InternalMessage).filter(
        InternalMessage.room_id == room_id
    ).order_by(InternalMessage.created_at.desc()).limit(limit).all()
    msgs.reverse()

    # Mark all unread as read
    for m in msgs:
        if m.sender_id != me.id:
            exists = db.query(MessageRead).filter(
                MessageRead.message_id == m.id,
                MessageRead.staff_id == me.id,
            ).first()
            if not exists:
                db.add(MessageRead(message_id=m.id, staff_id=me.id))
    db.commit()

    return [_format_message(m, db) for m in msgs]


@router.post("/rooms/{room_id}/messages")
def send_message(
    room_id: int,
    payload: SendMessageIn,
    db: Session = Depends(get_db),
    me: Staff = Depends(get_current_staff),
):
    """Send a message to a room."""
    member = db.query(ChatRoomMember).filter(
        ChatRoomMember.room_id == room_id,
        ChatRoomMember.staff_id == me.id,
    ).first()
    if not member:
        raise HTTPException(403, "Not a member of this room")

    if not payload.body.strip():
        raise HTTPException(400, "Empty message")

    msg = InternalMessage(
        room_id=room_id,
        sender_id=me.id,
        body=payload.body.strip(),
        msg_type=payload.msg_type,
    )
    db.add(msg)
    # Mark as read by sender
    db.flush()
    db.add(MessageRead(message_id=msg.id, staff_id=me.id))
    db.commit()
    db.refresh(msg)
    return _format_message(msg, db)


@router.get("/rooms/{room_id}/poll")
async def long_poll(
    room_id: int,
    after_id: int = 0,
    db: Session = Depends(get_db),
    me: Staff = Depends(get_current_staff),
):
    """
    Long-poll: holds up to 25 s, returns as soon as a new message arrives.
    Client should reconnect immediately with the last seen message id.
    """
    member = db.query(ChatRoomMember).filter(
        ChatRoomMember.room_id == room_id,
        ChatRoomMember.staff_id == me.id,
    ).first()
    if not member:
        raise HTTPException(403, "Not a member of this room")

    deadline = asyncio.get_event_loop().time() + POLL_TIMEOUT
    while True:
        new_msgs = db.query(InternalMessage).filter(
            InternalMessage.room_id == room_id,
            InternalMessage.id > after_id,
        ).order_by(InternalMessage.created_at.asc()).all()

        if new_msgs:
            # Mark as read
            for m in new_msgs:
                if m.sender_id != me.id:
                    exists = db.query(MessageRead).filter(
                        MessageRead.message_id == m.id,
                        MessageRead.staff_id == me.id,
                    ).first()
                    if not exists:
                        db.add(MessageRead(message_id=m.id, staff_id=me.id))
            db.commit()
            return [_format_message(m, db) for m in new_msgs]

        remaining = deadline - asyncio.get_event_loop().time()
        if remaining <= 0:
            return []

        await asyncio.sleep(min(1.0, remaining))
        # Expire session cache so we see fresh DB rows
        db.expire_all()


@router.get("/unread")
def get_unread_counts(
    db: Session = Depends(get_db),
    me: Staff = Depends(get_current_staff),
):
    """Total unread message count across all rooms."""
    my_rooms = db.query(ChatRoomMember.room_id).filter(
        ChatRoomMember.staff_id == me.id
    ).subquery()

    all_msgs = db.query(InternalMessage).filter(
        InternalMessage.room_id.in_(my_rooms),
        InternalMessage.sender_id != me.id,
    ).all()

    if not all_msgs:
        return {"total": 0}

    read_ids = {
        r.message_id for r in db.query(MessageRead).filter(
            MessageRead.staff_id == me.id,
            MessageRead.message_id.in_([m.id for m in all_msgs]),
        ).all()
    }
    total = sum(1 for m in all_msgs if m.id not in read_ids)
    return {"total": total}


@router.post("/heartbeat")
def heartbeat(
    db: Session = Depends(get_db),
    me: Staff = Depends(get_current_staff),
):
    """Update last_seen_at — called every 60s by the frontend."""
    me.last_seen_at = datetime.utcnow()
    db.commit()
    return {"ok": True}
