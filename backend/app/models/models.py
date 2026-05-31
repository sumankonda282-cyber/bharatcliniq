"""
BharatCliniq v2 — SQLAlchemy models (22 tables)
"""
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime,
    Date, Time, ForeignKey, Numeric, JSON, UniqueConstraint
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.session import Base


class PlatformAdmin(Base):
    __tablename__ = "platform_admins"
    id              = Column(Integer, primary_key=True, index=True)
    full_name       = Column(String(200), nullable=False)
    email           = Column(String(150), unique=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    is_active       = Column(Boolean, default=True)
    created_at      = Column(DateTime, server_default=func.now())


class Clinic(Base):
    __tablename__ = "clinics"
    id                      = Column(Integer, primary_key=True, index=True)
    name                    = Column(String(200), nullable=False)
    slug                    = Column(String(100), unique=True, nullable=False)
    specialty               = Column(String(200))
    description             = Column(Text)
    phone                   = Column(String(20))
    email                   = Column(String(150))
    address                 = Column(Text)
    city                    = Column(String(100))
    state                   = Column(String(100))
    pincode                 = Column(String(10))
    google_maps_url         = Column(Text, nullable=True)
    logo_url                = Column(String(500), nullable=True)
    is_active               = Column(Boolean, default=True)
    is_verified             = Column(Boolean, default=False)
    subscription_plan       = Column(String(20), default="free")
    subscription_status     = Column(String(20), default="active")
    subscription_expires_at = Column(DateTime, nullable=True)
    subscription_expiry     = Column(DateTime, nullable=True)
    created_at              = Column(DateTime, server_default=func.now())

    branches        = relationship("Branch", back_populates="clinic", cascade="all, delete-orphan")
    staff           = relationship("Staff", back_populates="clinic")
    patients        = relationship("Patient", back_populates="clinic")
    online_bookings = relationship("OnlineBooking", back_populates="clinic")


class Branch(Base):
    __tablename__ = "branches"
    id         = Column(Integer, primary_key=True, index=True)
    clinic_id  = Column(Integer, ForeignKey("clinics.id"), nullable=False)
    name       = Column(String(200), nullable=False)
    address    = Column(Text)
    city       = Column(String(100))
    phone      = Column(String(20))
    is_active  = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())

    clinic       = relationship("Clinic", back_populates="branches")
    staff        = relationship("Staff", back_populates="branch")
    appointments = relationship("Appointment", back_populates="branch")


class Staff(Base):
    __tablename__ = "staff"
    id              = Column(Integer, primary_key=True, index=True)
    clinic_id       = Column(Integer, ForeignKey("clinics.id"), nullable=False)
    branch_id       = Column(Integer, ForeignKey("branches.id"), nullable=True)
    full_name       = Column(String(200), nullable=False)
    email           = Column(String(150), unique=True, nullable=True)
    mobile          = Column(String(20), unique=True, nullable=True)
    phone           = Column(String(20), nullable=True)
    hashed_password = Column(String(255), nullable=False)
    role            = Column(String(30), nullable=False)
    is_active       = Column(Boolean, default=True)
    avatar_url      = Column(String(500))
    created_at      = Column(DateTime, server_default=func.now())
    updated_at      = Column(DateTime, server_default=func.now(), onupdate=func.now())

    clinic         = relationship("Clinic", back_populates="staff")
    branch         = relationship("Branch", back_populates="staff")
    doctor_profile = relationship("DoctorProfile", back_populates="staff", uselist=False)


class DoctorProfile(Base):
    __tablename__ = "doctor_profiles"
    id                 = Column(Integer, primary_key=True, index=True)
    staff_id           = Column(Integer, ForeignKey("staff.id"), unique=True, nullable=False)
    clinic_id          = Column(Integer, ForeignKey("clinics.id"), nullable=False)
    specialty          = Column(String(200))
    qualification      = Column(Text)
    mci_number         = Column(String(100))
    experience_years   = Column(Integer, default=0)
    consultation_fee   = Column(Numeric(10, 2), default=500)
    bio                = Column(Text, nullable=True)
    languages          = Column(String(500), nullable=True)
    is_active          = Column(Boolean, default=True)
    telehealth_enabled = Column(Boolean, default=False)
    telehealth_fee     = Column(Numeric(10, 2), nullable=True)
    telehealth_slots   = Column(JSON, nullable=True)
    created_at         = Column(DateTime, server_default=func.now())

    staff        = relationship("Staff", back_populates="doctor_profile")
    schedules    = relationship("DoctorSchedule", back_populates="doctor")
    appointments = relationship("Appointment", back_populates="doctor")


class DoctorSchedule(Base):
    __tablename__ = "doctor_schedules"
    id           = Column(Integer, primary_key=True, index=True)
    doctor_id    = Column(Integer, ForeignKey("doctor_profiles.id"), nullable=False)
    branch_id    = Column(Integer, ForeignKey("branches.id"), nullable=True)
    day_of_week  = Column(String(10), nullable=False)  # "monday", "tuesday", etc.
    start_time   = Column(String(8), nullable=False)   # "HH:MM"
    end_time     = Column(String(8), nullable=False)   # "HH:MM"
    slot_minutes = Column(Integer, default=15)
    max_patients = Column(Integer, default=20)
    is_active    = Column(Boolean, default=True)

    doctor = relationship("DoctorProfile", back_populates="schedules")


class Patient(Base):
    __tablename__ = "patients"
    id                      = Column(Integer, primary_key=True, index=True)
    clinic_id               = Column(Integer, ForeignKey("clinics.id"), nullable=False)
    branch_id               = Column(Integer, ForeignKey("branches.id"), nullable=True)
    portal_user_id          = Column(Integer, ForeignKey("patient_users.id"), nullable=True)
    uhid                    = Column(String(50), nullable=True)
    bh_id                   = Column(String(50), nullable=True)
    full_name               = Column(String(200), nullable=False)
    date_of_birth           = Column(Date, nullable=True)
    gender                  = Column(String(10), nullable=True)
    mobile                  = Column(String(20), nullable=True)
    email                   = Column(String(150), nullable=True)
    address                 = Column(Text, nullable=True)
    city                    = Column(String(100), nullable=True)
    state                   = Column(String(100), nullable=True)
    pincode                 = Column(String(10), nullable=True)
    blood_group             = Column(String(5), nullable=True)
    allergies               = Column(Text, nullable=True)
    emergency_contact_name  = Column(String(200), nullable=True)
    emergency_contact_phone = Column(String(20), nullable=True)
    abha_id                 = Column(String(20), nullable=True)
    abha_linked             = Column(Boolean, default=False)
    is_active               = Column(Boolean, default=True)
    created_at              = Column(DateTime, server_default=func.now())
    updated_at              = Column(DateTime, server_default=func.now(), onupdate=func.now())

    clinic        = relationship("Clinic", back_populates="patients")
    portal_user   = relationship("PatientUser", back_populates="patients")
    appointments  = relationship("Appointment", back_populates="patient")
    prescriptions = relationship("Prescription", back_populates="patient")
    lab_orders    = relationship("LabOrder", back_populates="patient")
    invoices      = relationship("Invoice", back_populates="patient")


class PatientUser(Base):
    __tablename__ = "patient_users"
    id                   = Column(Integer, primary_key=True, index=True)
    full_name            = Column(String(200), nullable=False)
    mobile               = Column(String(20), unique=True, nullable=False)
    email                = Column(String(150), unique=True, nullable=True)
    hashed_password      = Column(String(255), nullable=False)
    disclosure_pin       = Column(String(255), nullable=True)
    disclosure_pin_plain = Column(String(10), nullable=True)
    preferred_language   = Column(String(20), default="en")
    is_active            = Column(Boolean, default=True)
    is_verified          = Column(Boolean, default=False)
    created_at           = Column(DateTime, server_default=func.now())

    patients = relationship("Patient", back_populates="portal_user")


class Appointment(Base):
    __tablename__ = "appointments"
    id                = Column(Integer, primary_key=True, index=True)
    clinic_id         = Column(Integer, ForeignKey("clinics.id"), nullable=False)
    branch_id         = Column(Integer, ForeignKey("branches.id"), nullable=True)
    patient_id        = Column(Integer, ForeignKey("patients.id"), nullable=False)
    doctor_id         = Column(Integer, ForeignKey("doctor_profiles.id"), nullable=False)
    staff_id          = Column(Integer, ForeignKey("staff.id"), nullable=True)
    appointment_date  = Column(Date, nullable=False)
    appointment_time  = Column(String(8), nullable=False)  # "HH:MM"
    status            = Column(String(50), default="pending")
    mode              = Column(String(50), default="offline")
    reason            = Column(Text, nullable=True)
    notes             = Column(Text, nullable=True)
    fee               = Column(Numeric(10, 2), nullable=True)
    online_booking_id = Column(Integer, ForeignKey("online_bookings.id"), nullable=True)
    created_at        = Column(DateTime, server_default=func.now())
    updated_at        = Column(DateTime, server_default=func.now(), onupdate=func.now())

    patient       = relationship("Patient", back_populates="appointments")
    doctor        = relationship("DoctorProfile", back_populates="appointments")
    branch        = relationship("Branch", back_populates="appointments")
    vitals        = relationship("Vitals", back_populates="appointment", uselist=False)
    soap_note     = relationship("SoapNote", back_populates="appointment", uselist=False)
    prescriptions = relationship("Prescription", back_populates="appointment")
    lab_orders    = relationship("LabOrder", back_populates="appointment")
    invoices      = relationship("Invoice", back_populates="appointment")


class OnlineBooking(Base):
    __tablename__ = "online_bookings"
    id                = Column(Integer, primary_key=True, index=True)
    clinic_id         = Column(Integer, ForeignKey("clinics.id"), nullable=False)
    branch_id         = Column(Integer, ForeignKey("branches.id"), nullable=True)
    doctor_id         = Column(Integer, ForeignKey("doctor_profiles.id"), nullable=True)
    patient_user_id   = Column(Integer, ForeignKey("patient_users.id"), nullable=True)
    patient_name      = Column(String(200), nullable=False)
    patient_mobile    = Column(String(20), nullable=False)
    patient_email     = Column(String(150), nullable=True)
    booking_date      = Column(Date, nullable=False)
    booking_time      = Column(String(8), nullable=False)  # "HH:MM"
    reason            = Column(Text, nullable=True)
    status            = Column(String(50), default="pending")
    confirmation_code = Column(String(20), nullable=True)
    notes             = Column(Text, nullable=True)
    created_at        = Column(DateTime, server_default=func.now())

    clinic = relationship("Clinic", back_populates="online_bookings")
    doctor = relationship("DoctorProfile")


class Vitals(Base):
    __tablename__ = "vitals"
    id                       = Column(Integer, primary_key=True, index=True)
    patient_id               = Column(Integer, ForeignKey("patients.id"), nullable=False)
    appointment_id           = Column(Integer, ForeignKey("appointments.id"), nullable=True)
    blood_pressure_systolic  = Column(Integer, nullable=True)
    blood_pressure_diastolic = Column(Integer, nullable=True)
    pulse_rate               = Column(Integer, nullable=True)
    temperature              = Column(Numeric(4, 1), nullable=True)
    weight_kg                = Column(Numeric(5, 2), nullable=True)
    height_cm                = Column(Numeric(5, 2), nullable=True)
    oxygen_saturation        = Column(Integer, nullable=True)
    blood_sugar              = Column(Numeric(6, 2), nullable=True)
    recorded_at              = Column(DateTime, server_default=func.now())

    appointment = relationship("Appointment", back_populates="vitals")


class SoapNote(Base):
    __tablename__ = "soap_notes"
    id              = Column(Integer, primary_key=True, index=True)
    appointment_id  = Column(Integer, ForeignKey("appointments.id"), nullable=False)
    subjective      = Column(Text, nullable=True)
    objective       = Column(Text, nullable=True)
    assessment      = Column(Text, nullable=True)
    plan            = Column(Text, nullable=True)
    diagnosis_codes = Column(JSON, nullable=True)
    follow_up_days  = Column(Integer, nullable=True)
    created_at      = Column(DateTime, server_default=func.now())
    updated_at      = Column(DateTime, server_default=func.now(), onupdate=func.now())

    appointment = relationship("Appointment", back_populates="soap_note")


class Medicine(Base):
    __tablename__ = "medicines"
    id             = Column(Integer, primary_key=True, index=True)
    branch_id      = Column(Integer, ForeignKey("branches.id"), nullable=True)
    name           = Column(String(200), nullable=False)
    generic_name   = Column(String(200), nullable=True)
    category       = Column(String(100), nullable=True)
    form           = Column(String(50), nullable=True)
    strength       = Column(String(50), nullable=True)
    manufacturer   = Column(String(200), nullable=True)
    unit_price     = Column(Numeric(10, 2), nullable=True)
    stock_quantity = Column(Integer, default=0)
    reorder_level  = Column(Integer, default=10)
    expiry_date    = Column(Date, nullable=True)
    batch_number   = Column(String(50), nullable=True)
    is_active      = Column(Boolean, default=True)
    created_at     = Column(DateTime, server_default=func.now())

    prescription_items = relationship("PrescriptionItem", back_populates="medicine")


class Prescription(Base):
    __tablename__ = "prescriptions"
    id             = Column(Integer, primary_key=True, index=True)
    clinic_id      = Column(Integer, ForeignKey("clinics.id"), nullable=False)
    patient_id     = Column(Integer, ForeignKey("patients.id"), nullable=False)
    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=True)
    prescribed_by  = Column(Integer, ForeignKey("staff.id"), nullable=True)
    status         = Column(String(50), default="pending")
    notes          = Column(Text, nullable=True)
    created_at     = Column(DateTime, server_default=func.now())
    dispensed_at   = Column(DateTime, nullable=True)

    patient     = relationship("Patient", back_populates="prescriptions")
    appointment = relationship("Appointment", back_populates="prescriptions")
    items       = relationship("PrescriptionItem", back_populates="prescription")


class PrescriptionItem(Base):
    __tablename__ = "prescription_items"
    id                  = Column(Integer, primary_key=True, index=True)
    prescription_id     = Column(Integer, ForeignKey("prescriptions.id"), nullable=False)
    medicine_id         = Column(Integer, ForeignKey("medicines.id"), nullable=True)
    medicine_name       = Column(String(200), nullable=True)
    dosage              = Column(String(100), nullable=True)
    frequency           = Column(String(100), nullable=True)
    duration            = Column(String(100), nullable=True)
    instructions        = Column(Text, nullable=True)
    quantity_prescribed = Column(Integer, nullable=True)
    quantity_dispensed  = Column(Integer, nullable=True)

    prescription = relationship("Prescription", back_populates="items")
    medicine     = relationship("Medicine", back_populates="prescription_items")


class LabTest(Base):
    __tablename__ = "lab_tests"
    id               = Column(Integer, primary_key=True, index=True)
    branch_id        = Column(Integer, ForeignKey("branches.id"), nullable=True)
    name             = Column(String(200), nullable=False)
    code             = Column(String(50), nullable=True)
    category         = Column(String(100), nullable=True)
    price            = Column(Numeric(10, 2), nullable=True)
    normal_range     = Column(String(200), nullable=True)
    unit             = Column(String(50), nullable=True)
    turnaround_hours = Column(Integer, nullable=True)
    is_active        = Column(Boolean, default=True)

    order_items = relationship("LabOrderItem", back_populates="test")


class LabOrder(Base):
    __tablename__ = "lab_orders"
    id                  = Column(Integer, primary_key=True, index=True)
    clinic_id           = Column(Integer, ForeignKey("clinics.id"), nullable=False)
    patient_id          = Column(Integer, ForeignKey("patients.id"), nullable=False)
    appointment_id      = Column(Integer, ForeignKey("appointments.id"), nullable=True)
    ordered_by          = Column(Integer, ForeignKey("staff.id"), nullable=True)
    status              = Column(String(50), default="ordered")
    sample_collected_at = Column(DateTime, nullable=True)
    notes               = Column(Text, nullable=True)
    created_at          = Column(DateTime, server_default=func.now())
    updated_at          = Column(DateTime, server_default=func.now(), onupdate=func.now())

    patient     = relationship("Patient", back_populates="lab_orders")
    appointment = relationship("Appointment", back_populates="lab_orders")
    items       = relationship("LabOrderItem", back_populates="order")


class LabOrderItem(Base):
    __tablename__ = "lab_order_items"
    id           = Column(Integer, primary_key=True, index=True)
    order_id     = Column(Integer, ForeignKey("lab_orders.id"), nullable=False)
    test_id      = Column(Integer, ForeignKey("lab_tests.id"), nullable=True)
    test_name    = Column(String(200), nullable=True)
    result_value = Column(Text, nullable=True)
    result_notes = Column(Text, nullable=True)
    is_abnormal  = Column(Boolean, default=False)
    completed_at = Column(DateTime, nullable=True)

    order = relationship("LabOrder", back_populates="items")
    test  = relationship("LabTest", back_populates="order_items")


class ImagingOrder(Base):
    __tablename__ = "imaging_orders"
    id             = Column(Integer, primary_key=True, index=True)
    clinic_id      = Column(Integer, ForeignKey("clinics.id"), nullable=False)
    patient_id     = Column(Integer, ForeignKey("patients.id"), nullable=False)
    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=True)
    ordered_by     = Column(Integer, ForeignKey("staff.id"), nullable=True)
    modality       = Column(String(50), nullable=True)
    body_part      = Column(String(200), nullable=True)
    clinical_notes = Column(Text, nullable=True)
    report         = Column(Text, nullable=True)
    report_url     = Column(String(500), nullable=True)
    status         = Column(String(50), default="ordered")
    created_at     = Column(DateTime, server_default=func.now())
    updated_at     = Column(DateTime, server_default=func.now(), onupdate=func.now())


class Invoice(Base):
    __tablename__ = "invoices"
    id             = Column(Integer, primary_key=True, index=True)
    clinic_id      = Column(Integer, ForeignKey("clinics.id"), nullable=False)
    branch_id      = Column(Integer, ForeignKey("branches.id"), nullable=True)
    patient_id     = Column(Integer, ForeignKey("patients.id"), nullable=False)
    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=True)
    invoice_number = Column(String(50), nullable=True)
    status         = Column(String(50), default="pending")
    subtotal       = Column(Numeric(10, 2), default=0)
    discount       = Column(Numeric(10, 2), default=0)
    tax            = Column(Numeric(10, 2), default=0)
    total          = Column(Numeric(10, 2), default=0)
    amount_paid    = Column(Numeric(10, 2), default=0)
    payment_method = Column(String(50), nullable=True)
    notes          = Column(Text, nullable=True)
    created_at     = Column(DateTime, server_default=func.now())
    paid_at        = Column(DateTime, nullable=True)

    patient     = relationship("Patient", back_populates="invoices")
    appointment = relationship("Appointment", back_populates="invoices")
    items       = relationship("InvoiceItem", back_populates="invoice")


class InvoiceItem(Base):
    __tablename__ = "invoice_items"
    id          = Column(Integer, primary_key=True, index=True)
    invoice_id  = Column(Integer, ForeignKey("invoices.id"), nullable=False)
    description = Column(String(500), nullable=True)
    item_type   = Column(String(50), nullable=True)
    quantity    = Column(Integer, default=1)
    unit_price  = Column(Numeric(10, 2), nullable=True)
    total       = Column(Numeric(10, 2), nullable=True)

    invoice = relationship("Invoice", back_populates="items")


class PatientReferral(Base):
    __tablename__ = "patient_referrals"
    id             = Column(Integer, primary_key=True, index=True)
    from_clinic_id = Column(Integer, ForeignKey("clinics.id"), nullable=False)
    from_doctor_id = Column(Integer, ForeignKey("doctor_profiles.id"), nullable=True)
    patient_id     = Column(Integer, ForeignKey("patients.id"), nullable=False)
    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=True)
    to_clinic_id   = Column(Integer, ForeignKey("clinics.id"), nullable=True)
    to_doctor_id   = Column(Integer, ForeignKey("doctor_profiles.id"), nullable=True)
    reason         = Column(Text, nullable=True)
    urgency        = Column(String(50), nullable=True)
    clinical_notes = Column(Text, nullable=True)
    status         = Column(String(50), default="pending")
    referral_code  = Column(String(50), nullable=True)
    response_notes = Column(Text, nullable=True)
    responded_at   = Column(DateTime, nullable=True)
    completed_at   = Column(DateTime, nullable=True)
    created_at     = Column(DateTime, server_default=func.now())
    updated_at     = Column(DateTime, server_default=func.now(), onupdate=func.now())

    patient     = relationship("Patient")
    from_clinic = relationship("Clinic", foreign_keys=[from_clinic_id])
    to_clinic   = relationship("Clinic", foreign_keys=[to_clinic_id])
    from_doctor = relationship("DoctorProfile", foreign_keys=[from_doctor_id])
    to_doctor   = relationship("DoctorProfile", foreign_keys=[to_doctor_id])


class DoctorRating(Base):
    __tablename__ = "doctor_ratings"
    id             = Column(Integer, primary_key=True, index=True)
    doctor_id      = Column(Integer, ForeignKey("doctor_profiles.id"), nullable=False)
    patient_id     = Column(Integer, ForeignKey("patients.id"), nullable=False)
    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=True)
    rating         = Column(Integer, nullable=False)
    review         = Column(Text, nullable=True)
    is_visible     = Column(Boolean, default=True)
    created_at     = Column(DateTime, server_default=func.now())
