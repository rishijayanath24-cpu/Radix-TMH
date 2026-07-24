// The 12 RADIX categories — labels + a colour per category (used by chips/bars).
export const CATEGORIES = {
  COD:  'Coding',
  DSA:  'Data Structures & Algorithms',
  OOD:  'Object-Oriented Design',
  APTI: 'Aptitude',
  COMM: 'Communication',
  AI:   'AI / Machine Learning',
  CLOUD:'Cloud',
  SQL:  'SQL / Databases',
  SWE:  'Software Engineering',
  SYSD: 'System Design',
  NETW: 'Networking',
  OS:   'Operating Systems',
  OTHER:'Other',
}

export const SKILLSET_CODES = ['COD','DSA','OOD','APTI','COMM','AI','CLOUD','SQL','SWE','SYSD','NETW','OS']

export const CAT_COLOR = {
  COD:'#f5451f', DSA:'#ff7a3c', OOD:'#f6a13d', APTI:'#e0b400', COMM:'#7bbf4c',
  AI:'#39b6a8', CLOUD:'#3aa0e0', SQL:'#5a78e0', SWE:'#8a63d2', SYSD:'#c85fc0',
  NETW:'#e05a86', OS:'#9aa3af', OTHER:'#b6bcc4',
}

export const catName  = (c) => CATEGORIES[c] || c
export const catColor = (c) => CAT_COLOR[c] || '#9aa3af'

export function matchLabel(score) {
  if (score >= 80) return 'Strong Match'
  if (score >= 60) return 'Good Match'
  if (score >= 40) return 'Fair Match'
  return 'Low Match'
}
