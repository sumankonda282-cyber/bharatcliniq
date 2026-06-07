// Indian adult reference ranges (18-65 yrs) — ICMR / Thyrocare / SRL norms

export const TUBE_CONFIG = {
  edta:      { label: 'EDTA',      color: '#7C3AED', bg: '#EDE9FE', dot: '#7C3AED' },
  sst:       { label: 'SST',       color: '#B45309', bg: '#FEF3C7', dot: '#D97706' },
  fluoride:  { label: 'Fluoride',  color: '#4B5563', bg: '#F3F4F6', dot: '#6B7280' },
  citrate:   { label: 'Citrate',   color: '#1D4ED8', bg: '#EFF6FF', dot: '#3B82F6' },
  heparin:   { label: 'Heparin',   color: '#15803D', bg: '#F0FDF4', dot: '#16A34A' },
  midstream: { label: 'Urine',     color: '#0369A1', bg: '#E0F2FE', dot: '#0EA5E9' },
}

// Ordered so EDTA / Fluoride / Citrate patterns match before the SST catch-all
const TUBE_MAP = [
  { re: /\b(cbc|complete blood|hb%|haemoglobin|hemoglobin|tlc|wbc|rbc count|platelets?|plcr|mpv|pdw|mch|mcv|mchc|esr|reticulocyte|peripheral smear|blood film|malaria|mp\b|blood group|hba1c)\b/i, tube: 'edta' },
  { re: /\b(fbs|ppbs|rbs|fasting blood|post.?prandial|random blood sugar|glucose tolerance|ogtt|gtt)\b/i, tube: 'fluoride' },
  { re: /\b(pt\/inr|aptt|d.?dimer|fibrinogen|coagulation|bleeding time|clotting time|inr\b)\b/i, tube: 'citrate' },
  { re: /\b(ammonia|karyotype)\b/i, tube: 'heparin' },
  { re: /\b(urine|urinalysis|urine r\/e|urine routine|urine culture|microalbumin)\b/i, tube: 'midstream' },
  { re: /./, tube: 'sst' },
]

export function getTubeForTest(name = '') {
  for (const { re, tube } of TUBE_MAP) {
    if (re.test(name)) return tube
  }
  return 'sst'
}

// Range shape: { low?, high?, critLow?, critHigh?, lowF?, highF?, unit, note? }
// Female-specific fields (lowF/highF) override low/high when sex === 'F'
const REF = {
  // Haematology (EDTA)
  hemoglobin:             { low: 13.0, high: 17.5, lowF: 12.0, highF: 15.5, critLow: 7.0, critHigh: 20.0, unit: 'g/dL' },
  'hb%':                  { low: 13.0, high: 17.5, lowF: 12.0, highF: 15.5, critLow: 7.0, critHigh: 20.0, unit: 'g/dL' },
  tlc:                    { low: 4.0,  high: 11.0, critLow: 2.0, critHigh: 30.0, unit: '×10³/μL' },
  wbc:                    { low: 4.0,  high: 11.0, critLow: 2.0, critHigh: 30.0, unit: '×10³/μL' },
  platelets:              { low: 150,  high: 400,  critLow: 50,  critHigh: 1000, unit: '×10³/μL' },
  'platelet count':       { low: 150,  high: 400,  critLow: 50,  critHigh: 1000, unit: '×10³/μL' },
  mcv:                    { low: 80,   high: 100,  unit: 'fL' },
  mch:                    { low: 27,   high: 33,   unit: 'pg' },
  mchc:                   { low: 32,   high: 36,   unit: 'g/dL' },
  neutrophils:            { low: 40,   high: 70,   unit: '%' },
  lymphocytes:            { low: 20,   high: 40,   unit: '%' },
  monocytes:              { low: 2,    high: 10,   unit: '%' },
  eosinophils:            { low: 1,    high: 6,    unit: '%' },
  basophils:              { low: 0,    high: 1,    unit: '%' },
  esr:                    { low: 0,    high: 20,   highF: 30,  unit: 'mm/hr' },
  'reticulocyte count':   { low: 0.5,  high: 2.5,  unit: '%' },
  hba1c:                  { low: 4.0,  high: 5.6,  unit: '%', note: '5.7–6.4 Prediabetes  ≥6.5 Diabetes' },

  // LFT (SST)
  'total bilirubin':      { low: 0.2,  high: 1.2,  critHigh: 15.0, unit: 'mg/dL' },
  'direct bilirubin':     { low: 0.0,  high: 0.4,  unit: 'mg/dL' },
  'indirect bilirubin':   { low: 0.1,  high: 0.8,  unit: 'mg/dL' },
  sgpt:                   { low: 7,    high: 40,   highF: 35, critHigh: 1000, unit: 'U/L' },
  alt:                    { low: 7,    high: 40,   highF: 35, critHigh: 1000, unit: 'U/L' },
  sgot:                   { low: 10,   high: 40,   highF: 35, critHigh: 1000, unit: 'U/L' },
  ast:                    { low: 10,   high: 40,   highF: 35, critHigh: 1000, unit: 'U/L' },
  alp:                    { low: 40,   high: 130,  unit: 'U/L' },
  ggt:                    { low: 10,   high: 70,   highF: 45, unit: 'U/L' },
  'total protein':        { low: 6.0,  high: 8.3,  unit: 'g/dL' },
  albumin:                { low: 3.5,  high: 5.0,  critLow: 2.0, unit: 'g/dL' },
  globulin:               { low: 2.0,  high: 3.5,  unit: 'g/dL' },
  'a/g ratio':            { low: 1.2,  high: 2.2,  unit: '' },

  // RFT/KFT (SST)
  creatinine:             { low: 0.7,  high: 1.3,  lowF: 0.5, highF: 1.1, critHigh: 10.0, unit: 'mg/dL' },
  urea:                   { low: 15,   high: 45,   critHigh: 100, unit: 'mg/dL' },
  bun:                    { low: 7,    high: 20,   critHigh: 50,  unit: 'mg/dL' },
  'uric acid':            { low: 3.5,  high: 7.2,  lowF: 2.6, highF: 6.0, unit: 'mg/dL' },
  sodium:                 { low: 136,  high: 145,  critLow: 120, critHigh: 160, unit: 'mEq/L' },
  potassium:              { low: 3.5,  high: 5.0,  critLow: 2.5, critHigh: 6.5, unit: 'mEq/L' },
  chloride:               { low: 98,   high: 107,  unit: 'mEq/L' },
  calcium:                { low: 8.5,  high: 10.5, critLow: 6.0, critHigh: 13.0, unit: 'mg/dL' },
  phosphorus:             { low: 2.5,  high: 4.5,  unit: 'mg/dL' },
  magnesium:              { low: 1.7,  high: 2.4,  critLow: 0.9, critHigh: 4.9, unit: 'mg/dL' },

  // Blood Sugar (Fluoride)
  fbs:                    { low: 70,   high: 100,  critLow: 40, critHigh: 500, unit: 'mg/dL' },
  'fasting blood sugar':  { low: 70,   high: 100,  critLow: 40, critHigh: 500, unit: 'mg/dL' },
  ppbs:                   { low: 70,   high: 140,  critLow: 40, critHigh: 500, unit: 'mg/dL' },
  'post prandial blood sugar': { low: 70, high: 140, critLow: 40, critHigh: 500, unit: 'mg/dL' },
  rbs:                    { low: 70,   high: 140,  critLow: 40, critHigh: 500, unit: 'mg/dL' },
  'random blood sugar':   { low: 70,   high: 140,  critLow: 40, critHigh: 500, unit: 'mg/dL' },
  glucose:                { low: 70,   high: 100,  critLow: 40, critHigh: 500, unit: 'mg/dL' },

  // Lipid Profile (SST)
  'total cholesterol':    { low: 0,    high: 199,  unit: 'mg/dL', note: '200–239 Borderline  ≥240 High' },
  triglycerides:          { low: 0,    high: 149,  critHigh: 500, unit: 'mg/dL' },
  hdl:                    { low: 40,   high: 999,  lowF: 50, unit: 'mg/dL', note: 'Higher is better' },
  ldl:                    { low: 0,    high: 99,   unit: 'mg/dL', note: '100–129 Near optimal  ≥160 High' },
  vldl:                   { low: 5,    high: 40,   unit: 'mg/dL' },
  'non-hdl':              { low: 0,    high: 129,  unit: 'mg/dL' },

  // Thyroid (SST)
  tsh:                    { low: 0.4,  high: 4.0,  critLow: 0.01, critHigh: 20.0, unit: 'mIU/L' },
  't3 total':             { low: 0.6,  high: 1.8,  unit: 'ng/mL' },
  't4 total':             { low: 5.0,  high: 12.0, unit: 'μg/dL' },
  ft3:                    { low: 2.3,  high: 4.2,  unit: 'pg/mL' },
  ft4:                    { low: 0.7,  high: 1.8,  unit: 'ng/dL' },
  'anti-tpo':             { low: 0,    high: 35,   unit: 'IU/mL', note: '<35 Negative' },

  // Iron Studies (SST)
  'serum iron':           { low: 65,   high: 175,  lowF: 50, highF: 170, unit: 'μg/dL' },
  tibc:                   { low: 250,  high: 370,  unit: 'μg/dL' },
  ferritin:               { low: 12,   high: 300,  lowF: 12, highF: 150, critLow: 5, unit: 'ng/mL' },
  'transferrin sat':      { low: 20,   high: 50,   unit: '%' },

  // Vitamins (SST)
  'vitamin d':            { low: 30,   high: 100,  critLow: 10, unit: 'ng/mL', note: '<20 Deficient  20–29 Insufficient' },
  'vitamin b12':          { low: 200,  high: 900,  critLow: 100, unit: 'pg/mL' },
  folate:                 { low: 4.6,  high: 18.7, critLow: 2, unit: 'ng/mL' },

  // Hormones (SST)
  prolactin:              { low: 2,    high: 25,   highF: 29, unit: 'ng/mL' },
  fsh:                    { low: 1.5,  high: 12.4, unit: 'mIU/mL' },
  lh:                     { low: 1.7,  high: 8.6,  unit: 'mIU/mL' },
  testosterone:           { low: 300,  high: 1000, unit: 'ng/dL' },

  // Cardiac (SST)
  troponin:               { low: 0,    high: 0.04, critHigh: 0.1,  unit: 'ng/mL' },
  'ck-mb':                { low: 0,    high: 25,   critHigh: 100,  unit: 'U/L' },
  ldh:                    { low: 120,  high: 246,  unit: 'U/L' },

  // CRP (SST)
  crp:                    { low: 0,    high: 5.0,  critHigh: 100, unit: 'mg/L' },
  'hs-crp':               { low: 0,    high: 3.0,  unit: 'mg/L' },

  // Coagulation (Citrate)
  'pt':                   { low: 11,   high: 13.5, unit: 'seconds' },
  inr:                    { low: 0.8,  high: 1.2,  critHigh: 5.0, unit: '' },
  aptt:                   { low: 25,   high: 35,   critHigh: 70,  unit: 'seconds' },
  'd-dimer':              { low: 0,    high: 500,  critHigh: 1000, unit: 'ng/mL' },
  fibrinogen:             { low: 200,  high: 400,  critLow: 100, unit: 'mg/dL' },

  // Urine (Midstream)
  'urine ph':             { low: 4.6,  high: 8.0,  unit: '' },
  'specific gravity':     { low: 1.001, high: 1.035, unit: '' },
  'urine wbc':            { low: 0,    high: 5,    unit: '/HPF' },
  'urine rbc':            { low: 0,    high: 2,    unit: '/HPF' },
}

function norm(name = '') { return name.toLowerCase().trim().replace(/\s+/g, ' ') }

export function getRefRange(testName, sex = 'M') {
  const key = norm(testName)
  let r = REF[key]
  if (!r) {
    for (const k of Object.keys(REF)) {
      if (key.includes(k) || k.includes(key)) { r = REF[k]; break }
    }
  }
  if (!r) return null
  const F = sex === 'F'
  return {
    low:      F && r.lowF      !== undefined ? r.lowF      : r.low,
    high:     F && r.highF     !== undefined ? r.highF     : r.high,
    critLow:  F && r.critLowF  !== undefined ? r.critLowF  : r.critLow,
    critHigh: F && r.critHighF !== undefined ? r.critHighF : r.critHigh,
    unit:     r.unit,
    note:     r.note,
  }
}

export const FLAG_META = {
  N:         { label: 'Normal',    tw: 'text-green-700 bg-green-50 border-green-200' },
  L:         { label: 'Low ↓',     tw: 'text-blue-700 bg-blue-50 border-blue-200' },
  H:         { label: 'High ↑',    tw: 'text-orange-700 bg-orange-50 border-orange-200' },
  LL:        { label: 'Very Low ↓↓', tw: 'text-red-700 bg-red-100 border-red-300' },
  HH:        { label: 'Very High ↑↑', tw: 'text-red-700 bg-red-100 border-red-300' },
  CRIT_LOW:  { label: '⚠ CRITICAL', tw: 'text-white bg-red-700 border-red-800' },
  CRIT_HIGH: { label: '⚠ CRITICAL', tw: 'text-white bg-red-700 border-red-800' },
}

export function autoFlag(value, range) {
  if (!range) return 'N'
  const v = parseFloat(value)
  if (isNaN(v)) return 'N'
  const { low, high, critLow, critHigh } = range
  if (critLow  !== undefined && v <= critLow)  return 'CRIT_LOW'
  if (critHigh !== undefined && v >= critHigh) return 'CRIT_HIGH'
  if (low  !== undefined && v < low)  return v < low  * 0.8 ? 'LL' : 'L'
  if (high !== undefined && v > high) return v > high * 1.2 ? 'HH' : 'H'
  return 'N'
}

export function isCritical(flag) {
  return flag === 'CRIT_LOW' || flag === 'CRIT_HIGH'
}

export function formatRange(range) {
  if (!range) return ''
  const { low, high, unit } = range
  const u = unit ? ` ${unit}` : ''
  if (low !== undefined && high !== undefined) return `${low} – ${high}${u}`
  if (low  !== undefined) return `≥ ${low}${u}`
  if (high !== undefined) return `≤ ${high}${u}`
  return ''
}
