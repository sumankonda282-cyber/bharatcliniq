# DB columns from Supabase (verified earlier)
DB = {
    'clinics': ['id','name','slug','specialty','description','phone','email','address','city','state','pincode','google_maps_url','is_active','is_verified','logo_url','subscription_plan','subscription_status','subscription_expires_at','subscription_expiry','created_at'],
    'branches': ['id','clinic_id','name','address','city','phone','is_active','created_at'],
    'staff': ['id','clinic_id','branch_id','full_name','email','mobile','phone','hashed_password','role','is_active','avatar_url','created_at','updated_at'],
    'doctor_profiles': ['id','staff_id','clinic_id','specialty','qualification','mci_number','experience_years','consultation_fee','bio','is_active','telehealth_enabled','telehealth_fee','telehealth_slots','created_at'],
    'appointments': ['id','clinic_id','branch_id','patient_id','doctor_id','staff_id','appointment_date','appointment_time','status','mode','reason','notes','fee','online_booking_id','created_at','updated_at'],
}

import re
c = open('app/models/models.py', encoding='utf-8').read()

table_to_class = {
    'clinics': 'Clinic',
    'branches': 'Branch', 
    'staff': 'Staff',
    'doctor_profiles': 'DoctorProfile',
    'appointments': 'Appointment',
}

total_issues = 0
for table, db_cols in DB.items():
    cls = table_to_class[table]
    idx = c.find(f'class {cls}(Base):')
    end = c.find('\nclass ', idx+1)
    block = c[idx:end]
    model_cols = re.findall(r'    (\w+)\s*= Column\(', block)
    
    extra = [col for col in model_cols if col not in db_cols and col not in ['id']]
    missing = [col for col in db_cols if col not in model_cols and col != 'id']
    
    if extra or missing:
        print(f"\n{table}:")
        if extra: print(f"  EXTRA in model (will crash): {extra}")
        if missing: print(f"  MISSING in model: {missing}")
        total_issues += len(extra) + len(missing)
    else:
        print(f"{table}: OK")

print(f"\nTotal issues: {total_issues}")