// The Store field is a comma-separated list of these labels. Anything typed by hand is tidied into this form,
// because the export, the store filters and Stock Finder all look for the standard labels.
export const STORE_HINT = 'VK, Delhi · BH, Hyderabad · Pune · Mumbai · Online'

const CANON = [
  ['VK, Delhi', /delhi/i],
  ['BH, Hyderabad', /hyderabad|\bhyd\b/i],
  ['Pune', /pune/i],
  ['Mumbai', /mumbai/i],
  ['Online', /online/i],
]

// "Hyderabad, Mumbai" -> "BH, Hyderabad, Mumbai". Returns '' when nothing recognisable was typed.
export function canonicalStore(text) {
  const t = String(text == null ? '' : text)
  return CANON.filter(([, re]) => re.test(t)).map(([label]) => label).join(', ')
}
