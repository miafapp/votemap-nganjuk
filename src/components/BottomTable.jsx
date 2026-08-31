import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'

const LEVEL_CONFIG = {
  kabupaten: { childLevel: 'dapil', nameLabel: 'Dapil', extraLabel: 'Jml Kecamatan', extraKey: 'kecamatanCount' },
  dapil: { childLevel: 'kecamatan', nameLabel: 'Kecamatan', extraLabel: 'Jml Desa/Kelurahan', extraKey: 'desaCount' },
  kecamatan: { childLevel: 'desa', nameLabel: 'Desa/Kelurahan', extraLabel: 'Jml TPS', extraKey: 'tpsCount' },
  desa: { childLevel: 'tps', nameLabel: 'TPS', extraLabel: null, extraKey: null },
  tps: { childLevel: null, nameLabel: 'TPS', extraLabel: null, extraKey: null },
}

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

function sumPartyVotes(row) {
  const entries = partyEntries(row)
  if (entries.length) return entries.reduce((sum, [, value]) => sum + value, 0)
  return numberValue(firstDefined(row, [
    'suara_seluruh_partai',
    'total_suara_partai',
    'jumlah_suara_partai',
    'suara_partai',
    'total_suara',
  ]))
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
  }
}

function rowMatchesSummary(row, summary) {
  const rowId = Number(firstDefined(row, ['wilayah_id', 'id']))
  const summaryId = Number(firstDefined(summary, ['wilayah_id', 'id']))
  return Number.isFinite(rowId) && Number.isFinite(summaryId) && rowId === summaryId
}

async function enrichPartyVotes(row, pemiluId, childLevel) {
  const id = firstDefined(row, [`${childLevel}_id`, 'wilayah_id', 'id'])
  if (!id) return { ...normalizeRow(row, 0, childLevel), _loadingParty: false }

  try {
    const detailPromise = childLevel === 'tps'
      ? api.getWilayahDetail({ pemilu_id: pemiluId, tps_id: id })
      : Promise.resolve(row)
    const partyPromise = api.getRekapWilayahPartai(pemiluId, childLevel.toUpperCase(), id)

    const [detailData, partyData] = await Promise.all([detailPromise, partyPromise])
    const detail = childLevel === 'tps'
      ? (extractArray(detailData)[0] || detailData || row)
      : row

    return {
      ...normalizeRow({ ...row, ...detail, partai: partyData }, 0, childLevel),
      _loadingParty: false,
    }
  } catch {
    return {
      ...normalizeRow(row, 0, childLevel),
      _loadingParty: false,
    }
  }
}

async function loadChildRows({ pemiluId, activeLevel, activeId, dapilId, kecamatanList, desaId }) {
  if (activeLevel === 'kabupaten') {
    const dapils = await api.getDapil(pemiluId)
    return dapils.map((row) => ({ ...row, __level: 'dapil' }))
  }

  if (activeLevel === 'dapil') {
    return kecamatanList.map((row) => ({ ...row, __level: 'kecamatan' }))
  }

  if (activeLevel === 'kecamatan') {
    return (await api.getDesa(activeId, pemiluId, dapilId)).map((row) => ({ ...row, __level: 'desa' }))
  }

  if (activeLevel === 'desa') {
    return (await api.getTps(pemiluId, desaId || activeId)).map((row) => ({ ...row, __level: 'tps' }))
  }

  return []
}

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
  const [error, setError] = useState(null)
  const [isTouchDevice, setIsTouchDevice] = useState(false)

  const config = LEVEL_CONFIG[activeLevel] || LEVEL_CONFIG.kabupaten

  const normalizedDetail = useMemo(() => {
    if (activeLevel !== 'tps' || !detail) return []
    return [normalizeRow({ ...detail, partai: parties }, 0, 'tps')]
  }, [activeLevel, detail, parties])

  const filteredRows = useMemo(() => {
    const source = activeLevel === 'tps' ? normalizedDetail : rows
    const query = search.trim().toLocaleLowerCase('id-ID')
    if (!query) return source
    return source.filter((row) => String(row.name).toLocaleLowerCase('id-ID').includes(query))
  }, [activeLevel, normalizedDetail, rows, search])

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

  useEffect(() => {
    if (!pemiluId || activeLevel === 'tps') {
      setRows([])
      setLoading(false)
      setError(null)
      return undefined
    }

    let cancelled = false
    let sourceRows = []
    let nextIndex = 0

    setRows([])
    setLoading(true)
    setError(null)

    const load = async () => {
      sourceRows = await loadChildRows({ pemiluId, activeLevel, activeId, dapilId, kecamatanList, desaId })
      if (cancelled) return

      const childLevel = config.childLevel
      let summaryRows = []

      if (childLevel !== 'tps') {
        try {
          summaryRows = extractArray(await api.getRekapWilayah(pemiluId, childLevel.toUpperCase()))
        } catch {
          summaryRows = []
        }
      }

      if (cancelled) return

      const initialRows = sourceRows.map((row, index) => {
        const summary = summaryRows.find((item) => rowMatchesSummary(row, item))
        const merged = summary ? { ...row, ...summary } : row
        return {
          ...normalizeRow(merged, index, row.__level || childLevel),
          _loadingParty: true,
          _index: index,
        }
      })

      setRows(initialRows)
      setLoading(false)

      const worker = async () => {
        while (!cancelled) {
          const index = nextIndex
          nextIndex += 1
          if (index >= sourceRows.length) return

          const sourceRow = initialRows[index]
          const levelForRow = sourceRows[index].__level || childLevel
          const enriched = await enrichPartyVotes(sourceRow, pemiluId, levelForRow)
          if (cancelled) return

          setRows((current) => current.map((row, rowIndex) => (
            rowIndex === index
              ? { ...enriched, _index: index }
              : row
          )))
        }
      }

      await Promise.all([worker(), worker(), worker()])
    }

    load().catch((err) => {
      if (cancelled) return
      setRows([])
      setLoading(false)
      setError(err.message || 'Gagal memuat data tabel rekap wilayah')
    })

    return () => { cancelled = true }
  }, [pemiluId, activeLevel, activeId, dapilId, desaId, kecamatanList, config.childLevel])

  const selectRow = (row) => {
    if (!config.childLevel || activeLevel === 'tps') return
    const id = Number(row.id)
    if (Number.isFinite(id)) onSelectRegion?.(config.childLevel, id)
  }

  const columnCount = config.extraLabel ? 7 : 6
  const displayValue = (row, key) => row[key].toLocaleString('id-ID')
  const displayPartyValue = (row) => row._loadingParty ? '...' : displayValue(row, 'suaraSeluruhPartai')

  return (
    <section className="w-full min-w-0 border border-[#e4d9c7] rounded-lg bg-[rgba(255,253,247,0.8)] shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-[#c4482a] text-xl">♟</span>
          <h2 className="m-0 font-bold text-lg [font-family:Georgia,serif]">Data Perolehan Suara per Wilayah</h2>
        </div>
        <label className="relative flex w-full max-w-[260px] shrink-0 items-center">
          <span className="sr-only">Cari wilayah</span>
          <span className="absolute left-3 text-[#82776e]" aria-hidden="true">⌕</span>
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari wilayah..." className="w-full rounded border border-[#e4d9c7] bg-[#fffdf8] py-1.5 pl-8 pr-3 text-xs outline-none focus:border-[#c4482a]" />
        </label>
      </div>
      <div className="px-4 pb-3 text-xs text-[#82776e]"><strong>(Kecamatan - Desa/Kelurahan - TPS)</strong></div>

      <div className="px-3 pb-3 min-w-0">
        <div className="w-full max-w-full max-h-[520px] overflow-auto border border-[#ecdfcb]">
          <table className="w-max min-w-full border-collapse text-xs">
            <thead className="sticky top-0 z-20">
              <tr>
                <th className="sticky left-0 z-30 w-[48px] min-w-[48px] bg-[#fff9ed] px-3 py-2 text-center font-bold text-[#8d4838] border border-[#ecdfcb] whitespace-nowrap">No.</th>
                <th className="sticky left-[48px] z-30 min-w-[170px] max-w-[220px] bg-[#fff9ed] px-3 py-2 text-left font-bold text-[#8d4838] border border-[#ecdfcb] text-wrap">{config.nameLabel}</th>
                {config.extraLabel && <th className="min-w-[120px] max-w-[150px] bg-[#fff9ed] px-3 py-2 text-center font-bold text-[#8d4838] border border-[#ecdfcb] text-wrap">{config.extraLabel}</th>}
                <th className="min-w-[90px] bg-[#fff9ed] px-3 py-2 text-center font-bold text-[#8d4838] border border-[#ecdfcb] whitespace-nowrap">DPT</th>
                <th className="min-w-[135px] max-w-[160px] bg-[#fff9ed] px-3 py-2 text-center font-bold text-[#8d4838] border border-[#ecdfcb] text-wrap">Suara Seluruh Partai</th>
                <th className="min-w-[90px] bg-[#fff9ed] px-3 py-2 text-center font-bold text-[#8d4838] border border-[#ecdfcb] whitespace-nowrap">Suara Sah</th>
                <th className="min-w-[105px] max-w-[125px] bg-[#fff9ed] px-3 py-2 text-center font-bold text-[#8d4838] border border-[#ecdfcb] text-wrap">Suara Tdk Sah</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={columnCount} className="px-3 py-8 text-center text-[#82776e] border border-[#ecdfcb]">Memuat rekap wilayah...</td></tr>
                : error ? <tr><td colSpan={columnCount} className="px-3 py-8 text-center text-red-600 border border-[#ecdfcb]">{error}</td></tr>
                  : displayRows.length === 0 ? <tr><td colSpan={columnCount} className="px-3 py-8 text-center text-[#82776e] border border-[#ecdfcb]">{search ? 'Wilayah yang dicari tidak ditemukan.' : 'Tidak ada data rekap pada konteks ini.'}</td></tr>
                    : displayRows.map((row, index) => {
                      const rowNumber = (page - 1) * limit + index + 1
                      return <tr key={`${row.id}-${rowNumber}`} className={config.childLevel ? 'cursor-pointer hover:bg-[#fff9ed]' : ''} onClick={isTouchDevice ? () => selectRow(row) : undefined} onDoubleClick={!isTouchDevice ? () => selectRow(row) : undefined} title={config.childLevel ? (isTouchDevice ? 'Ketuk untuk membuka wilayah' : 'Klik dua kali untuk membuka wilayah') : undefined}>
                        <td className="sticky left-0 z-10 w-[48px] min-w-[48px] bg-white px-3 py-2 text-center border border-[#ecdfcb]">{rowNumber}</td>
                        <td className="sticky left-[48px] z-10 min-w-[170px] max-w-[220px] bg-white px-3 py-2 font-bold border border-[#ecdfcb] text-wrap">{row.name}</td>
                        {config.extraKey && <td className="px-3 py-2 text-center border border-[#ecdfcb]">{displayValue(row, config.extraKey)}</td>}
                        <td className="px-3 py-2 text-right border border-[#ecdfcb]">{displayValue(row, 'dpt')}</td>
                        <td className="px-3 py-2 text-right border border-[#ecdfcb]">{displayPartyValue(row)}</td>
                        <td className="px-3 py-2 text-right border border-[#ecdfcb]">{displayValue(row, 'suaraSah')}</td>
                        <td className="px-3 py-2 text-right border border-[#ecdfcb]">{displayValue(row, 'suaraTidakSah')}</td>
                      </tr>
                    })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-[#e4d9c7] px-4 py-3 text-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2 text-[#82776e]"><span>Baris {pageStart}-{pageEnd} dari {total.toLocaleString('id-ID')}</span><label className="flex items-center gap-1">Per halaman<select value={limit} onChange={(event) => setLimit(Number(event.target.value))} className="rounded border border-[#e4d9c7] bg-[#fffdf8] px-2 py-1"><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option></select></label></div>
        <div className="flex items-center gap-1"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded border border-[#e4d9c7] px-2 py-1 disabled:opacity-40">Sebelumnya</button><span className="px-2">Halaman {page} / {totalPages}</span><button type="button" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} className="rounded border border-[#e4d9c7] px-2 py-1 disabled:opacity-40">Berikutnya</button></div>
      </div>
    </section>
  )
}
