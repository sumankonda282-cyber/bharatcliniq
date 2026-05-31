c = open('app/models/models.py', encoding='utf-8').read()

# Remove languages from DoctorProfile
c = c.replace('    languages         = Column(String(200))\n', '')
c = c.replace('    languages         = Column(String(200), nullable=True)\n', '')
c = c.replace('    languages         = Column(JSON, nullable=True)\n', '')

# Remove token_number from Appointment
c = c.replace('    token_number      = Column(Integer)\n', '')
c = c.replace('    token_number      = Column(Integer, nullable=True)\n', '')

# Add telehealth_slots if missing
if 'telehealth_slots' not in c:
    c = c.replace(
        '    telehealth_fee     = Column(Numeric(10, 2), nullable=True)',
        '    telehealth_fee     = Column(Numeric(10, 2), nullable=True)\n    telehealth_slots   = Column(JSON, nullable=True)'
    )

open('app/models/models.py', 'w', encoding='utf-8').write(c)
print('Done')