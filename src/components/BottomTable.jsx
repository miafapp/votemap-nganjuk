import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import { getPartyLogo } from '../lib/party-logos'

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
  if (!id) return { ...row, _loadingParty: false }

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
    return { ...normalized, _loadingParty: false, _index: row._index }
  } catch {
    return { ...row, _loadingParty: false }
  }
}

async function enrichPartyVotesBatch(rows, pemiluId, childLevel) {
  if (!rows.length) return []

  const wilayahIds = rows
    .map((row) => Number(row.id))
    .filter((id) => Number.isInteger(id) && id > 0)

  if (!wilayahIds.length) return rows

  const batchRows = extractArray(await api.getRekapWilayahPartaiBatch(pemiluId, childLevel.toUpperCase(), wilayahIds))
  const byWilayah = new Map()

  batchRows.forEach((party) => {
    const wilayahId = Number(firstDefined(party, ['wilayah_id', 'id']))
    if (!Number.isInteger(wilayahId)) return
    const current = byWilayah.get(wilayahId) || []
    current.push(party)
    byWilayah.set(wilayahId, current)
  })

  return rows.map((row) => {
    const partyRows = byWilayah.get(Number(row.id)) || []
    const baseRaw = row.raw && typeof row.raw === 'object' ? row.raw : row
    const normalized = normalizeRow({ ...baseRaw, partai: partyRows }, row._index ?? 0, childLevel)
    return { ...normalized, _loadingParty: false, _index: row._index, _partyLoaded: true }
  })
}

async function loadChildRows({ pemiluId, activeLevel, activeId, dapilId, kecamatanList, desaId }) {
  if (activeLevel === 'kabupaten') return (await api.getDapil(pemiluId)).map((row) => ({ ...row, __level: 'dapil' }))
  if (activeLevel === 'dapil') return kecamatanList.map((row) => ({ ...row, __level: 'kecamatan' }))
  if (activeLevel === 'kecamatan') return (await api.getDesa(activeId, pemiluId, dapilId)).map((row) => ({ ...row, __level: 'desa' }))
  if (activeLevel === 'desa') return (await api.getTps(pemiluId, desaId || activeId)).map((row) => ({ ...row, __level: 'tps' }))
  return []
}

const cellClass = 'border border-[#ecdfcb]'
const headerClass = `${cellClass} bg-[#fff9ed] px-3 py-2 text-center font-bold text-[#8d4838] align-middle`
const bodyClass = `${cellClass} px-3 py-2 align-middle`

export default function BottomTable({
  pemiluId,
  activeLevel,
  activeId,
  kecamatanList = [],
  dapilId,
  desaId,
  parties = [],
  selectedTpsId = null,
  onSelectRegion,
}) {
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [search, setSearch] = useState('')
  const [tableMode, setTableMode] = useState('summary')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [partyLoading, setPartyLoading] = useState(false)
  const [error, setError] = useState(null)
  const [isTouchDevice, setIsTouchDevice] = useState(false)

  const tableLevel = activeLevel === 'tps' ? 'desa' : activeLevel
  const tableActiveId = activeLevel === 'tps' ? desaId : activeId
  const config = LEVEL_CONFIG[tableLevel] || LEVEL_CONFIG.kabupaten

  const normalizedParties = useMemo(() => (Array.isArray(parties) ? parties : [])
    .map((party) => ({
      ...party,
      kode_partai: normalizePartyCode(party?.kode_partai || party?.singkatan || party?.kode),
      nama_partai: party?.nama_partai || party?.singkatan || party?.kode_partai || 'Partai',
    }))
    .filter((party) => party.kode_partai), [parties])

  const filteredRows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('id-ID')
    if (!query) return rows
    return rows.filter((row) => String(row.name).toLocaleLowerCase('id-ID').includes(query))
  }, [rows, search])

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
  }, [activeLevel, activeId, pemiluId, limit, search, tableMode, desaId])

  useEffect(() => {
    if (!pemiluId) {
      setRows([])
      setLoading(false)
      setError(null)
      return undefined
    }

    let cancelled = false
    setRows([])
    setLoading(true)
    setError(null)

    const load = async () => {
      const sourceRows = await loadChildRows({
        pemiluId,
        activeLevel: tableLevel,
        activeId: tableActiveId,
        dapilId,
        kecamatanList,
        desaId,
      })
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
        return { ...normalizeRow(merged, index, row.__level || childLevel), _loadingParty: false, _index: index }
      })
      setRows(initialRows)
      setLoading(false)
    }

    load().catch((err) => {
      if (cancelled) return
      setRows([])
      setLoading(false)
      setError(err.message || 'Gagal memuat data tabel rekap wilayah')
    })

    return () => { cancelled = true }
  }, [pemiluId, tableLevel, tableActiveId, dapilId, desaId, kecamatanList, config.childLevel])

  useEffect(() => {
    if (tableMode !== 'party' || !pemiluId || !displayRows.length) {
      setPartyLoading(false)
      return undefined
    }

    let cancelled = false
    setPartyLoading(true)

    const enrich = async () => {
      const childLevel = config.childLevel

      if (childLevel !== 'tps') {
        try {
          const enrichedRows = await enrichPartyVotesBatch(displayRows, pemiluId, childLevel)
          if (!cancelled) {
            const enrichedByIndex = new Map(enrichedRows.map((row) => [row._index, row]))
            setRows((current) => current.map((row) => enrichedByIndex.get(row._index) || row))
          }
        } catch {
          let nextIndex = 0
          const worker = async () => {
            while (!cancelled) {
              const index = nextIndex++
              if (index >= displayRows.length) return
              const sourceRow = displayRows[index]
              if (sourceRow._partyLoaded) continue
              const enriched = await enrichPartyVotes(sourceRow, pemiluId, childLevel)
              if (cancelled) return
              setRows((current) => current.map((row) => row._index === sourceRow._index ? { ...enriched, _partyLoaded: true } : row))
            }
          }
          await Promise.all([worker(), worker()])
        }
      } else {
        let nextIndex = 0
        const worker = async () => {
          while (!cancelled) {
            const index = nextIndex++
            if (index >= displayRows.length) return
            const sourceRow = displayRows[index]
            if (sourceRow._partyLoaded) continue
            const enriched = await enrichPartyVotes(sourceRow, pemiluId, childLevel)
            if (cancelled) return
            setRows((current) => current.map((row) => row._index === sourceRow._index ? { ...enriched, _partyLoaded: true } : row))
          }
        }
        await Promise.all([worker(), worker()])
      }

      if (!cancelled) setPartyLoading(false)
    }

    enrich().catch(() => {
      if (!cancelled) setPartyLoading(false)
    })

    return () => { cancelled = true }
  }, [tableMode, pemiluId, page, limit, rows.length, config.childLevel, displayRows])

  const selectRow = (row) => {
    if (!config.childLevel) return
    const id = Number(row.id)
    if (!Number.isFinite(id)) return
    onSelectRegion?.(config.childLevel, id)
  }

  const displayValue = (row, key) => numberValue(row[key]).toLocaleString('id-ID')
  const partyColumns = normalizedParties.map((party) => ({
    code: party.kode_partai,
    name: party.nama_partai,
    shortName: party.singkatan || party.kode_partai,
  }))

  const renderStateRows = (colSpan, mode) => {
    const modeLoading = mode === 'party' && partyLoading
    if (loading || modeLoading) {
      return <tbody><tr><td colSpan={colSpan} className={`${bodyClass} px-3 py-8 text-center text-[#82776e]`}>Memuat rekap wilayah...</td></tr></tbody>
    }
    if (error) return <tbody><tr><td colSpan={colSpan} className={`${bodyClass} px-3 py-8 text-center text-red-600`}>{error}</td></tr></tbody>
    if (displayRows.length === 0) return <tbody><tr><td colSpan={colSpan} className={`${bodyClass} px-3 py-8 text-center text-[#82776e]`}>{search ? 'Wilayah yang dicari tidak ditemukan.' : 'Tidak ada data rekap pada konteks ini.'}</td></tr></tbody>

    return (
      <tbody>
        {displayRows.map((row, index) => {
          const rowNumber = (page - 1) * limit + index + 1
          const isSelectedTps = activeLevel === 'tps' && Number(row.id) === Number(selectedTpsId)
          const rowClass = [
            config.childLevel ? 'cursor-pointer hover:bg-[#fff9ed]' : '',
            isSelectedTps ? 'bg-[#f7e1d5]' : '',
          ].filter(Boolean).join(' ')
          const stickyClass = isSelectedTps ? 'bg-[#f7e1d5]' : 'bg-white'

          return (
            <tr key={`${row.id}-${rowNumber}`} className={rowClass} onClick={isTouchDevice ? () => selectRow(row) : undefined} onDoubleClick={!isTouchDevice ? () => selectRow(row) : undefined} title={config.childLevel ? (isTouchDevice ? 'Ketuk untuk membuka wilayah' : 'Klik dua kali untuk membuka wilayah') : undefined}>
              <td className={`sticky left-0 z-10 w-[48px] min-w-[48px] ${stickyClass} text-center ${bodyClass}`}>{rowNumber}</td>
              <td className={`sticky left-[48px] z-10 min-w-[170px] max-w-[220px] ${stickyClass} font-bold text-wrap ${bodyClass}`}>{row.name}</td>
              {config.extraKey && <td className={`${bodyClass} text-center`}>{displayValue(row, config.extraKey)}</td>}
              {mode === 'party' && partyColumns.map((party) => (
                <td key={party.code} className={`${bodyClass} min-w-[76px] text-right`}>{numberValue(row.partyVotes?.[party.code]).toLocaleString('id-ID')}</td>
              ))}
              <td className={`${bodyClass} min-w-[90px] text-right tabular-nums whitespace-nowrap`}>{displayValue(row, 'dpt')}</td>
              {mode === 'summary' && <td className={`${bodyClass} min-w-[135px] text-right tabular-nums whitespace-nowrap`}>{displayValue(row, 'suaraSeluruhPartai')}</td>}
              <td className={`${bodyClass} min-w-[90px] text-right tabular-nums whitespace-nowrap`}>{displayValue(row, 'suaraSah')}</td>
              <td className={`${bodyClass} min-w-[105px] text-right tabular-nums whitespace-nowrap pr-4`}>{displayValue(row, 'suaraTidakSah')}</td>
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
      {renderStateRows(6 + (config.extraLabel ? 1 : 0), 'summary')}
    </table>
  )

  const renderPartyTable = () => (
    <table className="regional-table w-max min-w-full border-collapse text-xs">
      <thead className="sticky top-0 z-20">
        <tr>
          <th rowSpan={2} className={`sticky left-0 z-30 w-[48px] min-w-[48px] ${headerClass} whitespace-nowrap`}>No.</th>
          <th rowSpan={2} className={`sticky left-[48px] z-30 min-w-[170px] max-w-[220px] ${headerClass} text-left text-wrap`}>{config.nameLabel}</th>
          {config.extraLabel && <th rowSpan={2} className={`min-w-[120px] max-w-[150px] ${headerClass} text-wrap`}>{config.extraLabel}</th>}
          <th rowSpan={2} className={`min-w-[90px] ${headerClass} whitespace-nowrap`}>DPT</th>
          <th colSpan={partyColumns.length || 1} className={`${headerClass} whitespace-nowrap`}>Perolehan Suara Partai</th>
          <th rowSpan={2} className={`min-w-[90px] ${headerClass} whitespace-nowrap`}>Suara Sah</th>
          <th rowSpan={2} className={`min-w-[105px] max-w-[125px] ${headerClass} text-wrap`}>Suara Tdk Sah</th>
        </tr>
        <tr>
          {(partyColumns.length ? partyColumns : [{ code: 'none', name: 'Tidak ada partai', shortName: '-' }]).map((party) => (
            <th key={party.code} className={`min-w-[76px] max-w-[90px] ${headerClass} py-1.5`} title={party.name}>
              <span className="inline-flex min-h-[30px] items-center justify-center">
                {party.code === 'none' ? '-' : <img src={getPartyLogo(party.code)} alt={party.name} className="h-7 w-7 rounded-sm object-contain" />}
              </span>
            </th>
          ))}
        </tr>
      </thead>
      {renderStateRows(5 + (config.extraLabel ? 1 : 0) + Math.max(partyColumns.length, 1), 'party')}
    </table>
  )

  return (
    <section className="w-full min-w-0 overflow-hidden rounded-lg border border-[#e4d9c7] bg-[rgba(255,253,247,0.8)] shadow-sm">
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-start gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <span className="shrink-0 text-[#c4482a] text-xl">♟</span>
            <h2 className="m-0 font-bold text-lg [font-family:Georgia,serif]">Data Perolehan Suara per Wilayah</h2>
          </div>
        </div>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="order-2 flex justify-start sm:order-1">
            <div className="inline-flex shrink-0 rounded border border-[#e4d9c7] bg-[#fffdf8] p-0.5" role="group" aria-label="Mode tampilan tabel">
              <button type="button" onClick={() => setTableMode('summary')} className={`rounded px-3 py-1.5 text-xs ${tableMode === 'summary' ? 'bg-[#c4482a] text-white' : 'text-[#6f6259] hover:bg-[#fff3df]'}`}>Ringkasan Wilayah</button>
              <button type="button" onClick={() => setTableMode('party')} className={`rounded px-3 py-1.5 text-xs ${tableMode === 'party' ? 'bg-[#c4482a] text-white' : 'text-[#6f6259] hover:bg-[#fff3df]'}`}>Perolehan Partai</button>
            </div>
          </div>
          <label className="order-1 relative block w-full sm:order-2 sm:w-[260px]">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#7d6f64]">⌕</span>
            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari wilayah..." className="w-full rounded border border-[#e4d9c7] bg-[#fffdf8] py-2 pl-8 pr-3 text-xs outline-none focus:border-[#c4482a]" />
          </label>
        </div>
        <div className="pt-2 text-xs text-[#82776e]"><strong>(Kecamatan - Desa/Kelurahan - TPS)</strong></div>
      </div>

      <div className="min-w-0 px-3 pb-3">
        <div className="regional-table-scroll w-full max-w-full min-w-0 max-h-[520px] overflow-auto border border-[#ecdfcb]">
          {tableMode === 'party' ? renderPartyTable() : renderSummaryTable()}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#ecdfcb] px-4 py-3 text-xs text-[#6f6259]">
        <div className="flex items-center gap-2">Baris {pageStart}-{pageEnd} dari {total} <span>Per halaman</span>
          <select value={limit} onChange={(event) => setLimit(Number(event.target.value))} className="rounded border border-[#e4d9c7] bg-white px-2 py-1.5">
            {[10, 20, 50].map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded border border-[#e4d9c7] px-2.5 py-1.5 disabled:opacity-40">Sebelumnya</button>
          <span className="font-medium text-[#332e29]">Halaman {page} / {totalPages}</span>
          <button type="button" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} className="rounded border border-[#e4d9c7] px-2.5 py-1.5 disabled:opacity-40">Berikutnya</button>
        </div>
      </div>
    </section>
  )
}
