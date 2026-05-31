import os, re
bad = ['UserRole.','SubscriptionPlan.','AppointmentStatus.','PrescriptionStatus.','LabOrderStatus.','InvoiceStatus.','from slugify','from python_slugify','patient_service']
dirs = ['app/api/v1/endpoints','app/schemas','app/models']
issues = 0
for d in dirs:
    if not os.path.exists(d): continue
    for fname in os.listdir(d):
        if not fname.endswith('.py'): continue
        c = open(os.path.join(d,fname),encoding='utf-8').read()
        for p in bad:
            if p in c:
                print(f'ISSUE {fname}: {p}')
                issues += 1
print('Total issues:',issues)