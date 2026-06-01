from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional, List, Any
from datetime import date, datetime
from decimal import Decimal



# ── Auth ──────────────────────────────────────────────────────────────────────

class StaffLoginRequest(BaseModel):
    identifier: str   # email or mobile
    password: str


class PatientLoginRequest(BaseModel):
    identifier: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user_type: str
    user_id: int
    role: Optional[str] = None
    full_name: str
    clinic_id: Optional[int] = None
    branch_id: Optional[int] = None


class OtpRequest(BaseModel):
    mobile: str


class OtpVerifyRequest(BaseModel):
    mobile: str
    otp: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


# ── Clinic ────────────────────────────────────────────────────────────────────

class ClinicCreate(BaseModel):
    name: str
    specialty: Optional[str] = None
    description: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    registration_number: Optional[str] = None


class ClinicUpdate(BaseModel):
    name: Optional[str] = None
    specialty: Optional[str] = None
    description: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None


class ClinicOut(BaseModel):
    id: int
    name: str
    slug: str
    specialty: Optional[str]
    description: Optional[str]
    logo_url: Optional[str]
    city: Optional[str]
    state: Optional[str]
    phone: Optional[str]
    email: Optional[str]
    is_active: bool
    is_verified: bool
    subscription_plan: str
    subscription_status: str
    created_at: datetime

    class Config:
        from_attributes = True


# ── Branch ────────────────────────────────────────────────────────────────────

class BranchCreate(BaseModel):
    name: str
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None


class BranchOut(BaseModel):
    id: int
    clinic_id: int
    name: str
    city: Optional[str]
    state: Optional[str]
    phone: Optional[str]
    is_active: bool

    class Config:
        from_attributes = True


# ── Staff ─────────────────────────────────────────────────────────────────────

class StaffCreate(BaseModel):
    full_name: str
    email: Optional[EmailStr] = None
    mobile: Optional[str] = None
    password: str
    role: str
    branch_id: Optional[int] = None


class StaffOut(BaseModel):
    id: int
    full_name: str
    email: Optional[str]
    mobile: Optional[str]
    role: str
    is_active: bool
    branch_id: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True


class DoctorProfileCreate(BaseModel):
    specialty: Optional[str] = None
    qualification: Optional[str] = None
    mci_number: Optional[str] = None
    experience_years: Optional[int] = 0
    consultation_fee: Optional[Decimal] = Decimal("500")
    bio: Optional[str] = None
    languages: Optional[str] = None
    telehealth_enabled: Optional[bool] = False
    telehealth_fee: Optional[Decimal] = None


class DoctorProfileOut(BaseModel):
    id: int
    staff_id: int
    specialty: Optional[str]
    qualification: Optional[str]
    mci_number: Optional[str]
    experience_years: int
    consultation_fee: Decimal
    bio: Optional[str]
    languages: Optional[str]
    telehealth_enabled: bool

    class Config:
        from_attributes = True


class DoctorScheduleCreate(BaseModel):
    branch_id: int
    day_of_week: str
    start_time: str
    end_time: str
    slot_minutes: int = 30
    max_patients: int = 20
    is_active: bool = True


# ── Patient ───────────────────────────────────────────────────────────────────

class PatientCreate(BaseModel):
    full_name: str
    mobile: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    email: Optional[EmailStr] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    blood_group: Optional[str] = None
    allergies: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    abha_id: Optional[str] = None


class PatientUpdate(BaseModel):
    full_name: Optional[str] = None
    mobile: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    email: Optional[EmailStr] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    blood_group: Optional[str] = None
    allergies: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    abha_id: Optional[str] = None


class PatientOut(BaseModel):
    id: int
    uhid: Optional[str]
    bh_id: Optional[str]
    full_name: str
    date_of_birth: Optional[date]
    gender: Optional[str]
    mobile: Optional[str]
    email: Optional[str]
    blood_group: Optional[str]
    allergies: Optional[str]
    address: Optional[str]
    city: Optional[str]
    state: Optional[str]
    abha_id: Optional[str]
    branch_id: Optional[int]
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ── Appointment ───────────────────────────────────────────────────────────────

class AppointmentCreate(BaseModel):
    patient_id: int
    doctor_id: int
    appointment_date: date
    appointment_time: str
    reason: Optional[str] = None
    mode: str = "offline"


class AppointmentUpdate(BaseModel):
    appointment_date: Optional[date] = None
    appointment_time: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class AppointmentOut(BaseModel):
    id: int
    patient_id: int
    doctor_id: int
    appointment_date: date
    appointment_time: str
    token_number: Optional[int] = None
    status: str
    mode: str
    reason: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    patient_name: Optional[str] = None
    doctor_name: Optional[str] = None

    class Config:
        from_attributes = True


class VitalsCreate(BaseModel):
    patient_id: int
    appointment_id: int
    blood_pressure_systolic: Optional[int] = None
    blood_pressure_diastolic: Optional[int] = None
    pulse_rate: Optional[int] = None
    temperature: Optional[Decimal] = None
    weight_kg: Optional[Decimal] = None
    height_cm: Optional[Decimal] = None
    oxygen_saturation: Optional[int] = None
    blood_sugar: Optional[Decimal] = None


class SoapNoteCreate(BaseModel):
    appointment_id: int
    subjective: Optional[str] = None
    objective: Optional[str] = None
    assessment: Optional[str] = None
    plan: Optional[str] = None
    diagnosis_codes: Optional[List[str]] = None
    follow_up_days: Optional[int] = None


# ── Online Booking (public website) ──────────────────────────────────────────

class OnlineBookingCreate(BaseModel):
    clinic_id: int
    branch_id: Optional[int] = None
    doctor_id: int
    patient_name: str
    patient_mobile: str
    patient_email: Optional[EmailStr] = None
    booking_date: date
    booking_time: str
    reason: Optional[str] = None


class OnlineBookingOut(BaseModel):
    id: int
    clinic_id: int
    branch_id: Optional[int] = None
    doctor_id: Optional[int] = None
    patient_name: str
    patient_mobile: str
    booking_date: date
    booking_time: str
    status: str
    confirmation_code: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ── Pharmacy ──────────────────────────────────────────────────────────────────

class MedicineCreate(BaseModel):
    name: str
    generic_name: Optional[str] = None
    category: Optional[str] = None
    form: Optional[str] = None
    strength: Optional[str] = None
    manufacturer: Optional[str] = None
    unit_price: Optional[Decimal] = Decimal("0")
    stock_quantity: Optional[int] = 0
    reorder_level: Optional[int] = 10
    expiry_date: Optional[date] = None
    batch_number: Optional[str] = None


class MedicineOut(BaseModel):
    id: int
    name: str
    generic_name: Optional[str]
    category: Optional[str]
    form: Optional[str]
    strength: Optional[str]
    unit_price: Decimal
    stock_quantity: int
    reorder_level: int
    is_active: bool

    class Config:
        from_attributes = True


class PrescriptionItemCreate(BaseModel):
    medicine_id: int
    dosage: str
    frequency: str
    duration: str
    instructions: Optional[str] = None
    quantity_prescribed: int = 1


class PrescriptionCreate(BaseModel):
    patient_id: int
    appointment_id: int
    notes: Optional[str] = None
    items: List[PrescriptionItemCreate]


# ── Lab ───────────────────────────────────────────────────────────────────────

class LabTestCreate(BaseModel):
    name: str
    code: Optional[str] = None
    category: Optional[str] = None
    price: Optional[Decimal] = Decimal("0")
    normal_range: Optional[str] = None
    unit: Optional[str] = None
    turnaround_hours: Optional[int] = 24


class LabOrderItemCreate(BaseModel):
    test_id: int


class LabOrderCreate(BaseModel):
    patient_id: int
    appointment_id: int
    notes: Optional[str] = None
    items: List[LabOrderItemCreate]


class LabResultUpdate(BaseModel):
    result_value: str
    result_notes: Optional[str] = None
    is_abnormal: bool = False


# ── Billing ───────────────────────────────────────────────────────────────────

class InvoiceItemCreate(BaseModel):
    description: str
    item_type: str
    quantity: int = 1
    unit_price: Decimal


class InvoiceCreate(BaseModel):
    patient_id: int
    appointment_id: Optional[int] = None
    discount: Optional[Decimal] = Decimal("0")
    tax: Optional[Decimal] = Decimal("0")
    payment_method: Optional[str] = None
    notes: Optional[str] = None
    items: List[InvoiceItemCreate]


class InvoiceOut(BaseModel):
    id: int
    invoice_number: str
    patient_id: int
    status: str
    subtotal: Decimal
    discount: Decimal
    tax: Decimal
    total: Decimal
    amount_paid: Decimal
    payment_method: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True
