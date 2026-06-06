/**
 * Client-side drug-drug interaction reference.
 * Each rule: { drugs: [a, b], severity: 'major'|'moderate'|'minor', message }
 * Matching is case-insensitive substring on generic/trade names.
 */
export const INTERACTIONS = [
  // Anticoagulants
  { drugs: ['warfarin', 'aspirin'],          severity: 'major',    message: 'Warfarin + Aspirin: Increased bleeding risk. Monitor INR closely.' },
  { drugs: ['warfarin', 'ibuprofen'],        severity: 'major',    message: 'Warfarin + NSAID: Significantly increased bleeding risk.' },
  { drugs: ['warfarin', 'naproxen'],         severity: 'major',    message: 'Warfarin + NSAID: Significantly increased bleeding risk.' },
  { drugs: ['warfarin', 'metronidazole'],    severity: 'major',    message: 'Warfarin + Metronidazole: Markedly increased anticoagulant effect. Reduce warfarin dose.' },
  { drugs: ['warfarin', 'ciprofloxacin'],    severity: 'moderate', message: 'Warfarin + Ciprofloxacin: Increased INR. Monitor anticoagulation.' },
  { drugs: ['warfarin', 'fluconazole'],      severity: 'major',    message: 'Warfarin + Fluconazole: Potent CYP2C9 inhibition — INR may double.' },
  { drugs: ['warfarin', 'omeprazole'],       severity: 'moderate', message: 'Warfarin + Omeprazole: Modest INR increase possible.' },

  // Cardiovascular
  { drugs: ['digoxin', 'amiodarone'],        severity: 'major',    message: 'Digoxin + Amiodarone: Digoxin toxicity risk. Reduce digoxin dose by 50%.' },
  { drugs: ['digoxin', 'furosemide'],        severity: 'moderate', message: 'Digoxin + Furosemide: Hypokalaemia increases digoxin toxicity risk.' },
  { drugs: ['digoxin', 'verapamil'],         severity: 'major',    message: 'Digoxin + Verapamil: Increased digoxin levels; bradycardia risk.' },
  { drugs: ['simvastatin', 'amiodarone'],    severity: 'major',    message: 'Simvastatin + Amiodarone: Myopathy/rhabdomyolysis risk. Max simvastatin 20mg.' },
  { drugs: ['atorvastatin', 'clarithromycin'], severity: 'major',  message: 'Statin + Clarithromycin: Rhabdomyolysis risk — consider holding statin.' },
  { drugs: ['simvastatin', 'erythromycin'],  severity: 'major',    message: 'Simvastatin + Erythromycin: Myopathy risk. Avoid combination.' },
  { drugs: ['metoprolol', 'verapamil'],      severity: 'major',    message: 'Beta-blocker + Verapamil: Risk of severe bradycardia and heart block.' },
  { drugs: ['atenolol', 'verapamil'],        severity: 'major',    message: 'Beta-blocker + Verapamil: Risk of severe bradycardia and heart block.' },
  { drugs: ['amlodipine', 'simvastatin'],    severity: 'moderate', message: 'Amlodipine + Simvastatin: Increased simvastatin exposure. Limit simvastatin to 20mg.' },

  // Antidiabetics
  { drugs: ['metformin', 'contrast'],        severity: 'major',    message: 'Metformin + Contrast Media: Lactic acidosis risk. Hold metformin 48h.' },
  { drugs: ['glibenclamide', 'ciprofloxacin'], severity: 'moderate', message: 'Sulphonylurea + Ciprofloxacin: Hypoglycaemia risk. Monitor glucose.' },
  { drugs: ['glipizide', 'fluconazole'],     severity: 'moderate', message: 'Sulphonylurea + Fluconazole: Hypoglycaemia. CYP2C9 inhibition.' },
  { drugs: ['insulin', 'metoprolol'],        severity: 'moderate', message: 'Insulin + Beta-blocker: Masks hypoglycaemia symptoms (except sweating).' },

  // CNS / Psychiatric
  { drugs: ['ssri', 'tramadol'],             severity: 'major',    message: 'SSRI + Tramadol: Serotonin syndrome risk.' },
  { drugs: ['fluoxetine', 'tramadol'],       severity: 'major',    message: 'Fluoxetine + Tramadol: Serotonin syndrome risk.' },
  { drugs: ['sertraline', 'tramadol'],       severity: 'major',    message: 'Sertraline + Tramadol: Serotonin syndrome risk.' },
  { drugs: ['escitalopram', 'tramadol'],     severity: 'major',    message: 'Escitalopram + Tramadol: Serotonin syndrome risk.' },
  { drugs: ['lithium', 'ibuprofen'],         severity: 'major',    message: 'Lithium + NSAID: NSAID increases lithium levels — toxicity risk.' },
  { drugs: ['lithium', 'diclofenac'],        severity: 'major',    message: 'Lithium + NSAID: NSAID increases lithium levels — toxicity risk.' },
  { drugs: ['clozapine', 'ciprofloxacin'],   severity: 'major',    message: 'Clozapine + Ciprofloxacin: Clozapine levels double — toxicity risk.' },
  { drugs: ['haloperidol', 'metronidazole'], severity: 'moderate', message: 'Haloperidol + Metronidazole: QTc prolongation risk.' },
  { drugs: ['amitriptyline', 'tramadol'],    severity: 'major',    message: 'TCA + Tramadol: Serotonin syndrome + seizure risk.' },

  // Antibiotics
  { drugs: ['metronidazole', 'alcohol'],     severity: 'major',    message: 'Metronidazole + Alcohol: Disulfiram-like reaction (avoid alcohol).' },
  { drugs: ['ciprofloxacin', 'antacid'],     severity: 'moderate', message: 'Ciprofloxacin + Antacid: Reduced antibiotic absorption. Space by 2h.' },
  { drugs: ['doxycycline', 'antacid'],       severity: 'moderate', message: 'Doxycycline + Antacid: Chelation — reduced absorption. Space by 2h.' },
  { drugs: ['rifampicin', 'oral contraceptive'], severity: 'major', message: 'Rifampicin + OCP: Enzyme induction reduces contraceptive efficacy.' },
  { drugs: ['rifampicin', 'warfarin'],       severity: 'major',    message: 'Rifampicin + Warfarin: CYP induction — warfarin dose may need to triple.' },

  // Pain / NSAIDs
  { drugs: ['aspirin', 'ibuprofen'],         severity: 'moderate', message: 'Aspirin + Ibuprofen: Ibuprofen may antagonise antiplatelet effect of aspirin.' },
  { drugs: ['ibuprofen', 'lisinopril'],      severity: 'moderate', message: 'NSAID + ACE Inhibitor: Reduced antihypertensive effect; acute kidney injury risk.' },
  { drugs: ['diclofenac', 'lisinopril'],     severity: 'moderate', message: 'NSAID + ACE Inhibitor: Reduced antihypertensive effect; acute kidney injury risk.' },
  { drugs: ['ibuprofen', 'enalapril'],       severity: 'moderate', message: 'NSAID + ACE Inhibitor: Reduced antihypertensive effect; acute kidney injury risk.' },

  // QT prolongation
  { drugs: ['amiodarone', 'azithromycin'],   severity: 'major',    message: 'Amiodarone + Azithromycin: Additive QTc prolongation — risk of torsades de pointes.' },
  { drugs: ['haloperidol', 'azithromycin'],  severity: 'major',    message: 'Haloperidol + Azithromycin: QTc prolongation risk.' },
  { drugs: ['ondansetron', 'amiodarone'],    severity: 'moderate', message: 'Ondansetron + Amiodarone: Additive QTc prolongation.' },
]

/**
 * Check interactions between a new drug and existing active orders.
 * @param {string} newDrug - drug_name or generic_name of the new order
 * @param {Array} existingOrders - array of {drug_name, generic_name, status}
 * @returns {Array} array of {severity, message, conflictWith}
 */
export function checkInteractions(newDrug, existingOrders) {
  if (!newDrug) return []
  const newLower = newDrug.toLowerCase()
  const alerts = []

  for (const order of existingOrders) {
    if (order.status === 'discontinued' || order.status === 'completed') continue
    const existingLower = `${order.drug_name} ${order.generic_name || ''}`.toLowerCase()

    for (const rule of INTERACTIONS) {
      const [a, b] = rule.drugs
      const matchA = newLower.includes(a) && existingLower.includes(b)
      const matchB = newLower.includes(b) && existingLower.includes(a)
      if (matchA || matchB) {
        alerts.push({
          severity: rule.severity,
          message: rule.message,
          conflictWith: order.drug_name,
        })
        break
      }
    }
  }

  return alerts
}

/**
 * Check if a new drug matches any known patient allergies.
 * @param {string} newDrug
 * @param {Array} allergies - array of {allergen, allergen_name}
 * @returns {Array} matching allergy objects
 */
export function checkAllergyConflict(newDrug, allergies) {
  if (!newDrug || !allergies?.length) return []
  const newLower = newDrug.toLowerCase()
  return allergies.filter(a => {
    const name = `${a.allergen || ''} ${a.allergen_name || ''}`.toLowerCase()
    return name.split(' ').some(word => word.length > 3 && newLower.includes(word))
  })
}
