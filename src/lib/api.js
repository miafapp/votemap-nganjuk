const BASE_URL = 'https://pemilu24.miafapp.workers.dev'

function getApiKey() {
  const key = import.meta.env.VITE_API_KEY
  if (!key || key === 'YOUR_API_KEY_HERE') {
    throw new Error('VITE_API_KEY belum diatur. Tambahkan API key yang valid di file .env pada variabel VITE_API_KEY.')
  }
  return key
}

async function apiFetch(path, params = {}) {
  const url = new URL(`${BASE_URL}${path}`)
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value)
    }
  }

  const res = await fetch(url, {
    headers: { 'X-API-Key': getApiKey() },
  })

  if (!res.ok) {
    throw new Error(`Gagal memuat data (${res.status}): ${res.statusText}`)
  }

  const json = await res.json()
  if (!json.success) {
    throw new Error(json.message || 'Respons API tidak sukses')
  }
  return json.data
}

export const api = {
  getPemilu: () => apiFetch('/api/pemilu'),
  getDapil: (pemiluId) => apiFetch('/api/dapil', { pemilu_id: pemiluId }),
  getKecamatan: (pemiluId, dapilId) => apiFetch('/api/kecamatan', { pemilu_id: pemiluId, dapil_id: dapilId }),
  getDesa: (kecamatanId, pemiluId, dapilId) => apiFetch('/api/desa', { kecamatan_id: kecamatanId, pemilu_id: pemiluId, dapil_id: dapilId }),
  getTps: (pemiluId, desaId) => apiFetch('/api/tps', { pemilu_id: pemiluId, desa_id: desaId }),
  getWilayahDetail: (params) => apiFetch('/api/wilayah/detail', params),
  getRekapWilayah: (pemiluId, level, wilayahId) => apiFetch('/api/summary', {
    pemilu_id: pemiluId,
    level,
    wilayah_id: wilayahId,
  }),
  getSuara: (level, id, pemiluId) => apiFetch(`/api/suara/${level}/${id}`, { pemilu_id: pemiluId }),
  getSuaraDetail: (level, id, pemiluId) => apiFetch(`/api/suara/${level}/${id}/detail`, { pemilu_id: pemiluId }),
  getGisTps: (desaId, pemiluId) => apiFetch('/api/gis/tps', { desa_id: desaId, pemilu_id: pemiluId }),
  getRekapTps: (tpsId) => apiFetch(`/api/rekap-tps/${tpsId}`),
}
