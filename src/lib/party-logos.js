// Pemetaan kode_partai ke nama file logo di public/logos/
// Sebagian besar nama file = kode_partai lowercase, dengan pengecualian:
const LOGO_OVERRIDES = {
  'PDI-P': 'pdi-perjuangan',
  'BURUH': 'partai-buruh',
}

export function getPartyLogo(kodePartai) {
  if (!kodePartai) return ''
  const override = LOGO_OVERRIDES[kodePartai.toUpperCase()]
  const fileName = override || kodePartai.toLowerCase()
  return `${import.meta.env.BASE_URL}logos/${fileName}.png`
}
