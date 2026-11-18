/**
 * Memformat nilai timestamp ISO ke format tanggal dan waktu bahasa Indonesia.
 * @param {string|null} value - Nilai timestamp ISO 8601
 * @param {string} [fallback='Belum tersedia'] - Nilai fallback jika tidak ada timestamp
 * @returns {string|null} String tanggal terformat, fallback jika kosong, atau null jika fallback null
 */
export function formatUpdatedAt(value, fallback = 'Belum tersedia') {
  if (!value) return fallback
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}
