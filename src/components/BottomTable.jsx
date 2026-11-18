import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import { getPartyLogo } from '../lib/party-logos'

// ---------------------------------------------------------------------------
// Konfigurasi level hierarki wilayah
// ---------------------------------------------------------------------------
const LEVEL_CONFIG = {
  kabupaten: { childLevel: 'dapil',     nameLabel: 'Dapil',          extraLabel: 'Jml Kecamatan',     extraKey: 'kecamatanCount' },
  dapil:     { childLevel: 'kecamatan', nameLabel: 'Kecamatan',      extraLabel: 'Jml Desa/Kelurahan', extraKey: 'desaCount'      },
  kecamatan: { childLevel: 'desa',      nameLabel: 'Desa/Kelurahan', extraLabel: 'Jml TPS',           extraKey: 'tpsCount'       },
  desa:      { childLevel: 'tps',       nameLabel: 'TPS',            extraLabel: null,                extraKey: null             },
  tps:       { childLevel: null,        nameLabel: 'TPS',            extraLabel: null,                extraKey: null             },
}

// ---------------------------------------------------------------------------
// Fungsi utilitas
// ---------------------------------------------------------------------------
function numberValue(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function firstDefined(record, keys, fallback = null) {
  for (const key of keys) {
    if (record?.[key] !== undefined && record?.[key] !== null && record?.[key] !== '') return record[key]
  }
  return fallback
}

function extractArray(data) {
  if (Array.isArray(data)) return data
  if (!data || typeof data !== 'object') return []
  for (const key of ['rows', 'items', 'data', 'results']) {
    if (Array.isArray(data[key])) return data[key]
  }
  return []
}

function normalizePartyCode(value) {
  return String(value || '').trim().toUpperCase().replace(/_/g, '-')
}

function partyEntries(row) {
  const nested = [row?.partai, row?.parties, row?.suara_partai, row?.suaraPartai, row?.party_scores]
    .find((value) => value && typeof value === 'object')

  if (Array.isArray(nested)) {
    return nested.map((party) => [
      normalizePartyCode(party?.kode_partai || party?.singkatan || party?.kode),
      numberValue(party?.jumlah_suara ?? party?.total_suara ?? party?.suara ?? party?.suara_partai),
    ])
  }

  if (nested && typeof nested === 'object') {
    return Object.entries(nested).map(([code, value]) => [
      normalizePartyCode(code),
      numberValue(typeof value === 'object'
        ? value?.jumlah_suara ?? value?.total_suara ?? value?.suara ?? value?.suara_partai
        : value),
    ])
  }

  return []
}

function partyVoteMap(row) {
  return Object.fromEntries(partyEntries(row).filter(([code]) => code).map(([code, value]) => [code, value]))
}

function sumPartyVotes(row) {
  const entries = partyEntries(row)
  const partyTotal = entries.length
    ? entries.reduce((sum, [, value]) => sum + value, 0)
    : numberValue(firstDefined(row, ['suara_seluruh_partai', 'total_suara_partai', 'jumlah_suara_partai', 'suara_partai', 'total_suara']))

  if (partyTotal !== 0) return partyTotal
  const suaraSah = numberValue(firstDefined(row, ['suara_sah', 'jumlah_suara_sah']))
  return suaraSah !== 0 ? suaraSah : partyTotal
}

function normalizeRow(row, index, childLevel) {
  const isTps = childLevel === 'tps'
  const id = firstDefined(row, [`${childLevel}_id`, 'wilayah_id', 'id'], index + 1)
  const name = firstDefined(row, isTps
    ? ['nomor_tps', 'nomor', 'nama_tps', 'nama_wilayah', 'nama']
    : childLevel === 'desa'
      ? ['nama_desa', 'desa', 'nama', 'nama_wilayah']
      : childLevel === 'dapil'
        ? ['nama_dapil', 'dapil', 'nama', 'nama_wilayah']
        : ['nama_kecamatan', 'kecamatan', 'nama', 'nama_wilayah'],
  isTps ? `TPS ${String(index + 1).padStart(3, '0')}` : '-')

  return {
    raw: row,
    id,
    name: isTps && !String(name).toUpperCase().startsWith('TPS') ? `TPS ${name}` : name,
    kecamatanCount: numberValue(firstDefined(row, ['jumlah_kecamatan', 'jml_kecamatan'])),
    desaCount: numberValue(firstDefined(row, ['jumlah_desa', 'jumlah_desa_kelurahan', 'jml_desa', 'jml_desa_kel'])),
    tpsCount: numberValue(firstDefined(row, ['jumlah_tps', 'jml_tps'])),
    dpt: numberValue(firstDefined(row, ['dpt', 'jumlah_dpt'])),
    suaraSeluruhPartai: sumPartyVotes(row),
    suaraSah: numberValue(firstDefined(row, ['suara_sah', 'jumlah_suara_sah'])),
    suaraTidakSah: numberValue(firstDefined(row, ['suara_tidak_sah', 'jumlah_suara_tidak_sah'])),
    partyVotes: partyVoteMap(row),
  }
}

function rowMatchesSummary(row, summary) {
  const rowId = Number(firstDefined(row, ['wilayah_id', 'id']))
  const summaryId = Number(firstDefined(summary, ['wilayah_id', 'id']))
  return Number.isFinite(rowId) && Number.isFinite(summaryId) && rowId === summaryId
}

async function enrichPartyVotes(row, pemiluId, childLevel) {
  const id = firstDefined(row?.raw || row, [`${childLevel}_id`, 'wilayah_id', 'id'])
  if (!id) return { ...row, _partyLoaded: true }

  try {
    const detailPromise = childLevel === 'tps'
      ? api.getWilayahDetail({ pemilu_id: pemiluId, tps_id: id })
      : Promise.resolve(null)
    const partyPromise = childLevel === 'tps'
      ? api.getSuara('tps', id, pemiluId)
      : api.getRekapWilayahPartai(pemiluId, childLevel.toUpperCase(), id)

    const [detailData, partyData] = await Promise.all([detailPromise, partyPromise])
    const detail = childLevel === 'tps' ? (extractArray(detailData)[0] || detailData || {}) : {}
    const baseRaw = row.raw && typeof row.raw === 'object' ? row.raw : row
    const normalized = normalizeRow({ ...baseRaw, ...detail, partai: partyData }, row._index ?? 0, childLevel)
    return { ...normalized, _partyLoaded: true, _index: row._index }
  } catch {
    return { ...row, _partyLoaded: true }
  }
}

async function loadChildRows({ pemiluId, activeLevel, activeId, dapilId, kecamatanList, desaId }) {
  if (activeLevel === 'kabupaten') return (await api.getDapil(pemiluId)).map((row) => ({ ...row, __level: 'dapil' }))
  if (activeLevel === 'dapil') return kecamatanList.map((row) => ({ ...row, __level: 'kecamatan' }))
  if (activeLevel === 'kecamatan') return (await api.getDesa(activeId, pemiluId, dapilId)).map((row) => ({ ...row, __level: 'desa' }))
  if (activeLevel === 'desa') return (await api.getTps(pemiluId, desaId || activeId)).map((row) => ({ ...row, __level: 'tps' }))
  return []
}

// ---------------------------------------------------------------------------
// Konstanta style tabel
// ---------------------------------------------------------------------------
const cellClass = 'border border-table-border'
const headerClass = `${cellClass} bg-surface-warm px-3 py-2 text-center font-bold text-primary-header align-middle`
const bodyClass = `${cellClass} px-3 py-2 align-middle`

// ---------------------------------------------------------------------------
// Komponen utama BottomTable
// ---------------------------------------------------------------------------
export default function BottomTable({
  pemiluId,
  activeLevel,
  activeId,
  kecamatanList = [],
  dapilId,
  desaId,
  parties = [],
  detail,
  onSelectRegion,
}) {
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [partyLoading, setPartyLoading] = useState(false)
  const [error, setError] = useState(null)
  const [isTouchDevice, setIsTouchDevice] = useState(false)

  const config = LEVEL_CONFIG[activeLevel] || LEVEL_CONFIG.kabupaten

  // Normalisasi daftar partai dari App.jsx (sorted by nomor_urut, done in App.jsx)
  const normalizedParties = useMemo(() => (Array.isArray(parties) ? parties : [])
    .map((party) => ({
      ...party,
      kode_partai: normalizePartyCode(party?.kode_partai || party?.singkatan || party?.kode),
      nama_partai: party?.nama_partai || party?.singkatan || party?.kode_partai || 'Partai',
    }))
    .filter((party) => party.kode_partai), [parties])

  // Untuk level TPS: satu baris dari detail prop
  const normalizedDetail = useMemo(() => {
    if (activeLevel !== 'tps' || !detail) return []
    return [normalizeRow({ ...detail, partai: parties }, 0, 'tps')]
  }, [activeLevel, detail, parties])

  // Fallback: derivasi daftar partai dari enriched rows jika normalizedParties kosong
  // (terjadi ketika API tidak menyediakan summary partai di level kecamatan/desa)
  const derivedPartyList = useMemo(() => {
    if (normalizedParties.length > 0) return normalizedParties
    const partyMap = new Map()
    const source = activeLevel === 'tps' ? normalizedDetail : rows
    source.filter((r) => r._partyLoaded).forEach((row) => {
      Object.keys(row.partyVotes || {}).forEach((code) => {
        if (code && !partyMap.has(code)) {
          partyMap.set(code, { kode_partai: code, nama_partai: code, nomor_urut: 999 })
        }
      })
    })
    return Array.from(partyMap.values()).sort((a, b) => a.kode_partai.localeCompare(b.kode_partai))
  }, [normalizedParties, rows, normalizedDetail, activeLevel])

  // Sumber baris untuk Ringkasan Wilayah (dengan search & pagination)
  const sourceRows = activeLevel === 'tps' ? normalizedDetail : rows
  const filteredRows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('id-ID')
    if (!query) return sourceRows
    return sourceRows.filter((row) => String(row.name).toLocaleLowerCase('id-ID').includes(query))
  }, [sourceRows, search])

  const total = filteredRows.length
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const displayRows = filteredRows.slice((page - 1) * limit, page * limit)
  const pageStart = total === 0 ? 0 : (page - 1) * limit + 1
  const pageEnd = Math.min(page * limit, total)

  useEffect(() => {
    setIsTouchDevice(window.matchMedia?.('(pointer: coarse)').matches ?? false)
  }, [])

  useEffect(() => {
    setPage(1)
  }, [activeLevel, activeId, pemiluId, limit, search])

  // Load baris wilayah child + langsung enrich semua untuk tabel Perolehan Partai.
  // Digabung dalam satu effect agar tidak ada masalah deps saat rows berubah.
  useEffect(() => {
    if (!pemiluId || activeLevel === 'tps') {
      setRows([])
      setLoading(false)
      setPartyLoading(false)
      setError(null)
      return undefined
    }

    let cancelled = false
    setRows([])
    setLoading(true)
    setPartyLoading(false)
    setError(null)

    const load = async () => {
      // Langkah 1: Muat daftar child wilayah
      const sourceRows = await loadChildRows({ pemiluId, activeLevel, activeId, dapilId, kecamatanList, desaId })
      if (cancelled) return

      const childLevel = config.childLevel

      // Langkah 2: Muat summary rekap wilayah (DPT, suara sah, dll.)
      let summaryRows = []
      if (childLevel !== 'tps') {
        try {
          summaryRows = extractArray(await api.getRekapWilayah(pemiluId, childLevel.toUpperCase()))
        } catch {
          summaryRows = []
        }
      }
      if (cancelled) return

      // Langkah 3: Susun baris awal (belum ada data partai per wilayah)
      const initialRows = sourceRows.map((row, index) => {
        const summary = summaryRows.find((item) => rowMatchesSummary(row, item))
        const merged = summary ? { ...row, ...summary } : row
        return { ...normalizeRow(merged, index, row.__level || childLevel), _partyLoaded: false, _index: index }
      })

      setRows(initialRows)
      setLoading(false)

      if (!initialRows.length) return

      // Langkah 4: Enrich semua baris dengan data partai per wilayah (untuk tabel Perolehan Partai)
      setPartyLoading(true)

      const results = []
      let nextIndex = 0

      const worker = async () => {
        while (!cancelled) {
          const index = nextIndex++
          if (index >= initialRows.length) return
          const sourceRow = initialRows[index]
          const levelForRow = sourceRow.raw?.__level || childLevel
          const enriched = await enrichPartyVotes(sourceRow, pemiluId, levelForRow)
          results.push(enriched)
        }
      }

      // Dua worker concurrent untuk menjaga latency tanpa burst request
      await Promise.all([worker(), worker()])

      if (!cancelled && results.length) {
        const enrichedMap = new Map(results.map((r) => [r._index, r]))
        setRows((current) => current.map((row) => enrichedMap.has(row._index) ? enrichedMap.get(row._index) : row))
      }
      if (!cancelled) setPartyLoading(false)
    }

    load().catch((err) => {
      if (cancelled) return
      setRows([])
      setLoading(false)
      setPartyLoading(false)
      setError(err.message || 'Gagal memuat data tabel rekap wilayah')
    })

    return () => { cancelled = true }
  }, [pemiluId, activeLevel, activeId, dapilId, desaId, kecamatanList, config.childLevel])

  const selectRow = (row) => {
    if (!config.childLevel || activeLevel === 'tps') return
    const id = Number(row.id)
    if (Number.isFinite(id)) onSelectRegion?.(config.childLevel, id)
  }

  const displayValue = (row, key) => numberValue(row[key]).toLocaleString('id-ID')

  // ---------------------------------------------------------------------------
  // Render: Tabel Perolehan Partai (transposed — baris=partai, kolom=wilayah)
  // ---------------------------------------------------------------------------
  const renderPartyMatrix = () => {
    const allRows = activeLevel === 'tps' ? normalizedDetail : rows
    const partyList = derivedPartyList

    // Kolom wilayah header
    const regionHeaders = allRows.map((row) => (
      <th
        key={row.id}
        className={`min-w-[90px] max-w-[130px] ${headerClass} text-wrap${config.childLevel ? ' cursor-pointer hover:bg-surface-hover' : ''}`}
        title={config.childLevel ? (isTouchDevice ? 'Ketuk untuk membuka wilayah' : 'Klik dua kali untuk membuka wilayah') : undefined}
        onClick={config.childLevel && isTouchDevice ? () => onSelectRegion?.(config.childLevel, Number(row.id)) : undefined}
        onDoubleClick={config.childLevel && !isTouchDevice ? () => onSelectRegion?.(config.childLevel, Number(row.id)) : undefined}
      >
        {row.name}
      </th>
    ))

    // Kondisi loading/error/kosong
    let tbody
    if (loading) {
      tbody = (
        <tbody>
          <tr><td colSpan={2 + Math.max(allRows.length, 1)} className={`${bodyClass} px-3 py-8 text-center text-muted`}>Memuat data wilayah...</td></tr>
        </tbody>
      )
    } else if (error) {
      tbody = (
        <tbody>
          <tr><td colSpan={2 + Math.max(allRows.length, 1)} className={`${bodyClass} px-3 py-8 text-center text-red-600`}>{error}</td></tr>
        </tbody>
      )
    } else if (!allRows.length) {
      tbody = (
        <tbody>
          <tr><td colSpan={2} className={`${bodyClass} px-3 py-8 text-center text-muted`}>Tidak ada data wilayah pada konteks ini.</td></tr>
        </tbody>
      )
    } else if (partyLoading && partyList.length === 0) {
      // Masih loading enrichment dan belum ada partai yang bisa diturunkan
      tbody = (
        <tbody>
          <tr><td colSpan={2 + allRows.length} className={`${bodyClass} px-3 py-8 text-center text-muted`}>Memuat data perolehan partai...</td></tr>
        </tbody>
      )
    } else if (partyList.length === 0) {
      tbody = (
        <tbody>
          <tr><td colSpan={2 + allRows.length} className={`${bodyClass} px-3 py-8 text-center text-muted`}>Data perolehan partai tidak tersedia untuk konteks ini.</td></tr>
        </tbody>
      )
    } else {
      tbody = (
        <tbody>
          {partyList.map((party, index) => (
            <tr key={party.kode_partai || index}>
              {/* Kolom No. */}
              <td className={`sticky left-0 z-10 w-[48px] min-w-[48px] bg-white text-center tabular-nums ${bodyClass}`}>{index + 1}</td>
              {/* Kolom Partai (logo + nama) */}
              <td className={`sticky left-[48px] z-10 min-w-[150px] max-w-[180px] bg-white ${bodyClass}`}>
                <span className="flex items-center gap-1.5 min-w-0">
                  <img src={getPartyLogo(party.kode_partai)} alt={party.nama_partai} className="w-[22px] h-[22px] shrink-0 rounded-sm object-cover" />
                  <span className="break-words text-xs">{party.nama_partai}</span>
                </span>
              </td>
              {/* Kolom per wilayah */}
              {allRows.map((row) => {
                const votes = numberValue(row.partyVotes?.[party.kode_partai])
                return (
                  <td
                    key={row.id}
                    className={`${bodyClass} min-w-[90px] text-right tabular-nums${config.childLevel ? ' cursor-pointer hover:bg-surface-warm' : ''}`}
                    onClick={config.childLevel && isTouchDevice ? () => onSelectRegion?.(config.childLevel, Number(row.id)) : undefined}
                    onDoubleClick={config.childLevel && !isTouchDevice ? () => onSelectRegion?.(config.childLevel, Number(row.id)) : undefined}
                  >
                    {partyLoading && !row._partyLoaded ? '…' : votes.toLocaleString('id-ID')}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      )
    }

    return (
      <table className="regional-table w-max min-w-full border-collapse text-xs">
        <thead className="sticky top-0 z-20">
          <tr>
            <th className={`sticky left-0 z-30 w-[48px] min-w-[48px] ${headerClass} whitespace-nowrap`}>No.</th>
            <th className={`sticky left-[48px] z-30 min-w-[150px] max-w-[180px] ${headerClass} text-left`}>Partai</th>
            {allRows.length === 0
              ? <th className={`min-w-[120px] ${headerClass}`}>—</th>
              : regionHeaders}
          </tr>
        </thead>
        {tbody}
      </table>
    )
  }

  // ---------------------------------------------------------------------------
  // Render: Tabel Ringkasan Wilayah (vertikal, tidak berubah)
  // ---------------------------------------------------------------------------
  const renderSummaryRows = () => {
    if (loading) {
      return <tbody><tr><td colSpan={6 + (config.extraLabel ? 1 : 0)} className={`${bodyClass} px-3 py-8 text-center text-muted`}>Memuat rekap wilayah...</td></tr></tbody>
    }
    if (error) {
      return <tbody><tr><td colSpan={6 + (config.extraLabel ? 1 : 0)} className={`${bodyClass} px-3 py-8 text-center text-red-600`}>{error}</td></tr></tbody>
    }
    if (displayRows.length === 0) {
      return <tbody><tr><td colSpan={6 + (config.extraLabel ? 1 : 0)} className={`${bodyClass} px-3 py-8 text-center text-muted`}>{search ? 'Wilayah yang dicari tidak ditemukan.' : 'Tidak ada data rekap pada konteks ini.'}</td></tr></tbody>
    }

    return (
      <tbody>
        {displayRows.map((row, index) => {
          const rowNumber = (page - 1) * limit + index + 1
          return (
            <tr key={`${row.id}-${rowNumber}`} className={config.childLevel ? 'cursor-pointer hover:bg-surface-warm' : ''} onClick={isTouchDevice ? () => selectRow(row) : undefined} onDoubleClick={!isTouchDevice ? () => selectRow(row) : undefined} title={config.childLevel ? (isTouchDevice ? 'Ketuk untuk membuka wilayah' : 'Klik dua kali untuk membuka wilayah') : undefined}>
              <td className={`sticky left-0 z-10 w-[48px] min-w-[48px] bg-white text-center tabular-nums ${bodyClass}`}>{rowNumber}</td>
              <td className={`sticky left-[48px] z-10 min-w-[170px] max-w-[220px] bg-white font-bold text-wrap ${bodyClass}`}>{row.name}</td>
              {config.extraKey && <td className={`${bodyClass} text-center`}>{displayValue(row, config.extraKey)}</td>}
              <td className={`${bodyClass} min-w-[90px] text-right tabular-nums`}>{displayValue(row, 'dpt')}</td>
              <td className={`${bodyClass} min-w-[135px] text-right tabular-nums`}>{displayValue(row, 'suaraSeluruhPartai')}</td>
              <td className={`${bodyClass} min-w-[90px] text-right tabular-nums`}>{displayValue(row, 'suaraSah')}</td>
              <td className={`${bodyClass} min-w-[105px] text-right tabular-nums`}>{displayValue(row, 'suaraTidakSah')}</td>
            </tr>
          )
        })}
      </tbody>
    )
  }

  const renderSummaryTable = () => (
    <table className="regional-table w-max min-w-full border-collapse text-xs">
      <thead className="sticky top-0 z-20">
        <tr>
          <th className={`sticky left-0 z-30 w-[48px] min-w-[48px] ${headerClass} whitespace-nowrap`}>No.</th>
          <th className={`sticky left-[48px] z-30 min-w-[170px] max-w-[220px] ${headerClass} text-left text-wrap`}>{config.nameLabel}</th>
          {config.extraLabel && <th className={`min-w-[120px] max-w-[150px] ${headerClass} text-wrap`}>{config.extraLabel}</th>}
          <th className={`min-w-[90px] ${headerClass} whitespace-nowrap`}>DPT</th>
          <th className={`min-w-[135px] max-w-[160px] ${headerClass} text-wrap`}>Suara Seluruh Partai</th>
          <th className={`min-w-[90px] ${headerClass} whitespace-nowrap`}>Suara Sah</th>
          <th className={`min-w-[105px] max-w-[125px] ${headerClass} text-wrap`}>Suara Tdk Sah</th>
        </tr>
      </thead>
      {renderSummaryRows()}
    </table>
  )

  // ---------------------------------------------------------------------------
  // Render utama: dua section terpisah
  // ---------------------------------------------------------------------------
  return (
    <div className="flex flex-col gap-4 w-full min-w-0">

      {/* ===== SECTION 1: Perolehan Partai (tabel transposed) ===== */}
      <section className="w-full min-w-0 overflow-hidden rounded-lg border border-card-border bg-surface/80 shadow-sm">
        <div className="flex items-center gap-2.5 px-4 py-3">
          <span className="shrink-0 text-primary text-xl">⚑</span>
          <h2 className="m-0 font-bold text-base sm:text-lg tracking-tight">Perolehan Partai</h2>
          {partyLoading && <span className="ml-auto text-xs text-muted">Memuat data...</span>}
        </div>

        <div className="min-w-0 px-3 pb-3">
          <div className="regional-table-scroll w-full max-w-full min-w-0 max-h-[520px] overflow-auto border border-table-border">
            {renderPartyMatrix()}
          </div>
        </div>
      </section>

      {/* ===== SECTION 2: Ringkasan Wilayah (tabel vertikal) ===== */}
      <section className="w-full min-w-0 overflow-hidden rounded-lg border border-card-border bg-surface/80 shadow-sm">
        <div className="px-4 pt-3 pb-2">
          <div className="flex items-center gap-2.5">
            <span className="shrink-0 text-primary text-xl">♟</span>
            <h2 className="m-0 font-bold text-base sm:text-lg tracking-tight">Ringkasan Wilayah</h2>
          </div>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <label className="relative block w-full sm:w-[260px]">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-icon">⌕</span>
              <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari wilayah..." className="w-full rounded border border-card-border bg-surface py-2 pl-8 pr-3 text-xs outline-none focus:border-primary" />
            </label>
          </div>
        </div>

        <div className="min-w-0 px-3 pb-3">
          <div className="regional-table-scroll w-full max-w-full min-w-0 max-h-[520px] overflow-auto border border-table-border">
            {renderSummaryTable()}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-table-border px-4 py-3 text-xs text-subtle">
          <div className="flex items-center gap-2">Baris {pageStart}-{pageEnd} dari {total} <span>Per halaman</span>
            <select value={limit} onChange={(event) => setLimit(Number(event.target.value))} className="rounded border border-card-border bg-white px-2 py-1.5">
              {[10, 20, 50].map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded border border-card-border px-2.5 py-1.5 disabled:opacity-40">Sebelumnya</button>
            <span className="font-medium text-main tabular-nums">Halaman {page} / {totalPages}</span>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} className="rounded border border-card-border px-2.5 py-1.5 disabled:opacity-40">Berikutnya</button>
          </div>
        </div>
      </section>

    </div>
  )
}
