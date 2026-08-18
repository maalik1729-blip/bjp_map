// Canonical 38 Districts of Tamil Nadu (from Spec)
export const TN_DISTRICTS = [
  'Chennai', 'Tiruvallur', 'Kanchipuram', 'Chengalpattu', 'Ranipet', 'Vellore', 'Tirupattur',
  'Krishnagiri', 'Dharmapuri', 'Tiruvannamalai', 'Viluppuram', 'Kallakurichi', 'Salem',
  'Namakkal', 'Perambalur', 'Ariyalur', 'Cuddalore', 'Mayiladuthurai', 'Nagapattinam',
  'Tiruvarur', 'Thanjavur', 'Tiruchirappalli', 'Karur', 'Nilgiris', 'Erode', 'Coimbatore',
  'Tiruppur', 'Dindigul', 'Pudukkottai', 'Theni', 'Madurai', 'Sivaganga', 'Virudhunagar',
  'Ramanathapuram', 'Thoothukudi', 'Tenkasi', 'Tirunelveli', 'Kanyakumari'
]

// Normalizes district names across variations
export function normalizeDistrictName(name = '') {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\./g, '')
    .replace('the nilgiris', 'nilgiris')
    .replace('kanniyakumari', 'kanyakumari')
    .replace('sivagangai', 'sivaganga')
    .replace('thiruvarur', 'tiruvarur')
    .replace('thoothukkudi', 'thoothukudi')
    .replace('kanchipuram', 'kancheepuram')
}

// Build a fast lookup dictionary with normalized keys
export function buildCountLookup(counts = {}) {
  const map = {}
  Object.entries(counts).forEach(([k, v]) => {
    map[normalizeDistrictName(k)] = v
  })
  return map
}
