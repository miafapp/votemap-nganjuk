const BASE_URL = 'https://pemilu24.miafapp.workers.dev'

const API_CACHE_TTL_MS = 60_000
const responseCache = new Map()
const inFlightRequests = new Map()

function getApiKey() {
  const key = import.meta.env.VITE_API_KEY
  if (!key || key === 'YOUR_API_KEY_HERE') {
    throw new Error('VITE_API_KEY belum diatur. Tambahkan API key yang valid di file .env pada variabel VITE_API_KEY.')
  }
  return key
}

function buildCacheKey(url) {
  return url.toString()
}

async function apiFetch(path, params = {}) {
  const url = new URL(`${BASE_URL}${path}`)
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value)
    }
  }

  const cacheKey = buildCacheKey(url)
  const cached = responseCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return cached.data
  if (cached) responseCache.delete(cacheKey)

  const existingRequest = inFlightRequests.get(cacheKey)
  if (existingRequest) return existingRequest

  const request = fetch(url, {
    headers: { 'X-API-Key': getApiKey() },
  })
    .then(async (res) => {
      if (!res.ok) {
        throw new Error(`Gagal memuat data (${res.status}): ${res.statusText}`)
      }

      const json = await res.json()
      if (!json.success) {
        throw new Error(json.message || 'Respons API tidak sukses')
      }

      responseCache.set(cacheKey, {
        data: json.data,
        expiresAt: Date.now() + API_CACHE_TTL_MS,
      })
      return json.data
    })
    .finally(() => {
      inFlightRequests.delete(cacheKey)
    })

  inFlightRequests.set(cacheKey, request)
  return request
}

function normalizePartyVoteTotal(row) {
  const total = Number(row?.total_suara)
  const suaraPartai = Number(row?.suara_partai)
  const suaraCaleg = Number(row?.suara_caleg)

  if (Number.isFinite(total) && total !== 0) return total
  if (Number.isFinite(suaraPartai) || Number.isFinite(suaraCaleg)) {
    return (Number.isFinite(suaraPartai) ? suaraPartai : 0)
      + (Number.isFinite(suaraCaleg) ? suaraCaleg : 0)
  }
  return Number.isFinite(total) ? total : 0
}

function normalizePartyRows(rows) {
  if (!Array.isArray(rows)) return rows

  return rows.map((row) => ({
    ...row,
    jumlah_suara: normalizePartyVoteTotal(row),
  }))
}

function normalizePagedResult(result) {
  if (!result || typeof result !== 'object') {
    return { rows: [], pagination: { page: 1, limit: 10, total: 0, total_pages: 1 } }
  }

  const rows = Array.isArray(result.rows)
    ? result.rows
    : Array.isArray(result.data)
      ? result.data
      : []

  const pagination = result.pagination || {
    page: Number(result.page) || 1,
    limit: Number(result.limit) || 10,
    total: Number(result.total) || rows.length,
    total_pages: Number(result.total_pages) || Math.max(1, Math.ceil((Number(result.total) || rows.length) / (Number(result.limit) || 10))),
  }

  return {
    ...result,
    rows,
    pagination,
  }
}

function normalizeInfografis(result) {
  if (!result || typeof result !== 'object') {
    return { context: null, summary: null, parties: [] }
  }

  const summary = result.summary || result.detail || null
  const parties = normalizePartyRows(result.parties || result.data?.parties || [])

  return {
    ...result,
    context: result.context || null,
    summary,
    parties: Array.isArray(parties) ? parties : [],
  }
}

export const api = {
  getPemilu: () => apiFetch('/api/pemilu'),
  getDapil: (pemiluId) => apiFetch('/api/dapil', { pemilu_id: pemiluId }),
  getKecamatan: (pemiluId, dapilId) => apiFetch('/api/kecamatan', { pemilu_id: pemiluId, dapil_id: dapilId }),
  getDesa: (kecamatanId, pemiluId, dapilId) => apiFetch('/api/desa', { kecamatan_id: kecamatanId, pemilu_id: pemiluId, dapil_id: dapilId }),
  getTps: (pemiluId, desaId) => apiFetch('/api/tps', { pemilu_id: pemiluId, desa_id: desaId }),

  getWilayahDetail: (params) => apiFetch('/api/wilayah/detail', params),

  getInfografis: (pemiluId, level = 'KABUPATEN', wilayahId = null) => apiFetch('/api/infografis', {
    pemilu_id: pemiluId,
    level,
    wilayah_id: wilayahId,
  }).then(normalizeInfografis),

  getRekapWilayah: (pemiluId, level, wilayahId) => apiFetch('/api/summary', {
    pemilu_id: pemiluId,
    level,
    wilayah_id: wilayahId,
  }),

  getRekapWilayahPartai: async (pemiluId, level, wilayahId) => {
    const rows = await apiFetch('/api/summary/partai', {
      pemilu_id: pemiluId,
      level,
      wilayah_id: wilayahId,
    })

    return normalizePartyRows(rows)
  },

  getRekapWilayahPartaiBatch: async (pemiluId, level, wilayahIds) => {
    const ids = (Array.isArray(wilayahIds) ? wilayahIds : [])
      .map(Number)
      .filter((id) => Number.isInteger(id) && id > 0)

    if (!ids.length) return []

    const rows = await apiFetch('/api/summary/partai/batch', {
      pemilu_id: pemiluId,
      level,
      wilayah_ids: ids.join(','),
    })

    return normalizePartyRows(rows)
  },

  getRekapWilayahPage: async (pemiluId, level, parentId = null, page = 1, limit = 10) => {
    const result = await apiFetch('/api/rekap-wilayah', {
      pemilu_id: pemiluId,
      level,
      parent_id: parentId,
      page,
      limit,
    })

    return normalizePagedResult(result)
  },

  getSuaraKabupaten: (pemiluId) => apiFetch('/api/suara', { pemilu_id: pemiluId }),
  getSuara: (level, id, pemiluId) => apiFetch(`/api/suara/${level}/${id}`, { pemilu_id: pemiluId }),
  getSuaraDetail: (level, id, pemiluId) => apiFetch(`/api/suara/${level}/${id}/detail`, { pemilu_id: pemiluId }),
  getGisTps: (desaId, pemiluId) => apiFetch('/api/gis/tps', { desa_id: desaId, pemilu_id: pemiluId }),
  getRekapTps: (tpsId) => apiFetch(`/api/rekap-tps/${tpsId}`),
}
