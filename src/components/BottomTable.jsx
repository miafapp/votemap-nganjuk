import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import { getPartyLogo } from '../lib/party-logos'

const LEVEL_CONFIG = {
  kabupaten: { childLevel: 'dapil', apiLevel: 'DAPIL', nameLabel: 'DAPIL', extraLabel: 'Jml Kecamatan', extraKey: 'jumlah_kecamatan' },
  dapil: { childLevel: 'kecamatan', apiLevel: 'KECAMATAN', nameLabel: 'Kecamatan', extraLabel: 'Jml Desa/Kel', extraKey: 'jumlah_desa' },
  kecamatan: { childLevel: 'desa', apiLevel: 'DESA', nameLabel: 'Desa/Kelurahan', extraLabel: 'Jml TPS', extraKey: 'jumlah_tps' },
  desa: { childLevel: 'tps', apiLevel: 'TPS', nameLabel: 'TPS', extraLabel: null, extraKey: null },
  tps: { childLevel: null, apiLevel: null, nameLabel: 'TPS', extraLabel: null, extraKey: null },
}

const cellClass = 'border border-[#ecdfcb]'
const headerClass = `${cellClass} bg-[#fff9ed] px-3 py-2 text-center font-bold text-[#8d4838] align-middle whitespace-nowrap`
const bodyClass = `${cellClass} px-3 py-2 align-middle`
const stickyHeaderClass = `${headerClass} sticky left-0 z-20 bg-[#fff9ed]`
const stickyBodyClass = `${bodyClass} sticky left-0 z-10 bg-[#fffdf8]`

function numberValue(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function firstDefined(record, keys, fallback = null) {
  for (const key of keys) {
    if (record?.[key] !== undefined && record?.[key] !== null && record?.[key] !== '') {
      return record[key]
    }
  }
  return fallback
}

function extractPartyArray(value) {
  if (Array.isArray(value)) return value
  if (typeof value !== 'string' || !value.trim()) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function normalizePartyCode(value) {
  return String(value || '').trim().toUpperCase().replace(/_/g, '-')
}

function partyEntries(row) {
  const nested = row?.partai
    ?? row?.parties
    ?? row?.suara_partai
    ?? row?.suaraPartai
    ?? row?.party_scores

  if (nested) {
    const array = extractPartyArray(nested)
    if (array.length) {
      return array.map((party) => [
        normalizePartyCode(party?.kode_partai || party?.singkatan || party?.kode),
        numberValue(party?.jumlah_suara ?? party?.total_suara ?? party?.suara ?? party?.suara_partai),
      ])
    }

    if (typeof nested === 'object' && !Array.isArray(nested)) {
      return Object.entries(nested).map(([code, value]) => [
        normalizePartyCode(code),
        numberValue(typeof value === 'object'
          ? value?.jumlah_suara ?? value?.total_suara ?? value?.suara ?? value?.suara_partai
          : value),
      ])
    }
  }

  return []
}

function partyVoteMap(row) {
  return Object.fromEntries(
    partyEntries(row)
      .filter(([code]) => code)
      .map(([code, value]) => [code, value]),
  )
}

function normalizeRow(row, index, level) {
  const isTps = level === 'tps'
  const id = Number(firstDefined(row, [`${level}_id`, 'wilayah_id', 'id'], index + 1))

  const rawName = firstDefined(
    row,
    isTps
      ? ['nomor_tps', 'nomor', 'nama_tps', 'nama_wilayah', 'nama']
      : level === 'dapil'
        ? ['nama_dapil', 'dapil', 'nama_wilayah', 'nama']
        : level === 'kecamatan'
          ? ['nama_kecamatan', 'kecamatan', 'nama_wilayah', 'nama']
          : level === 'desa'
            ? ['nama_desa', 'desa', 'nama_wilayah', 'nama']
            : ['nama'],
    isTps ? String(index + 1).padStart(3, '0') : '-',
  )

  const name = isTps && !String(rawName).toUpperCase().startsWith('TPS')
    ? `TPS ${rawName}`
    : rawName

  return {
    raw: row,
    id,
    name,
    jumlahKecamatan: numberValue(firstDefined(row, ['jumlah_kecamatan', 'jml_kecamatan'])),
    jumlahDesa: numberValue(firstDefined(row, ['jumlah_desa', 'jumlah_desa_kelurahan', 'jml_desa', 'jml_desa_kel'])),
    jumlahTps: numberValue(firstDefined(row, ['jumlah_tps', 'jml_tps'])),
    dpt: numberValue(firstDefined(row, ['dpt', 'jumlah_dpt'])),
    suaraSeluruhPartai: numberValue(firstDefined(row, [
      'suara_seluruh_partai',
      'total_suara_partai',
      'jumlah_suara_partai',
      'total_suara',
    ])),
    suaraSah: numberValue(firstDefined(row, ['suara_sah', 'jumlah_suara_sah'])),
    suaraTidakSah: numberValue(firstDefined(row, ['suara_tidak_sah', 'jumlah_suara_tidak_sah'])),
    partyVotes: partyVoteMap(row),
  }
}

function normalizeServerRows(rows, level) {
  return (Array.isArray(rows) ? rows : []).map((row, index) => normalizeRow(row, index, level))
}

function formatNumber(value) {
  return numberValue(value).toLocaleString('id-ID')
}

function getParentId(activeLevel, activeId) {
  if (activeLevel === 'kabupaten') return null
  return Number(activeId) || null
}

function partyColumns(parties) {
  return (Array.isArray(parties) ? parties : [])
    .map((party) => ({
      code: normalizePartyCode(party?.kode_partai || party?.singkatan || party?.kode),
      name: party?.nama_partai || party?.singkatan || party?.kode_partai || 'Partai',
      shortName: party?.singkatan || party?.kode_partai || '',
    }))
    .filter((party) => party.code)
}

export default function BottomTable({
  pemiluId,
  activeLevel,
  activeId,
  parties = [],
  detail,
  onSelectRegion,
}) {
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [search, setSearch] = useState('')
  const [tableMode, setTableMode] = useState('summary')
  const [rows, setRows] = useState([])
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, total_pages: 1 })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const config = LEVEL_CONFIG[activeLevel] || LEVEL_CONFIG.kabupaten
  const columns = useMemo(() => partyColumns(parties), [parties])

  const tpsDetailRow = useMemo(() => {
    if (activeLevel !== 'tps' || !detail) return []
    return normalizeServerRows([{ ...detail, partai: parties }], 'tps')
  }, [activeLevel, detail, parties])

  const sourceRows = activeLevel === 'tps' ? tpsDetailRow : rows

  const filteredRows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('id-ID')
    if (!query) return sourceRows
    return sourceRows.filter((row) => String(row.name).toLocaleLowerCase('id-ID').includes(query))
  }, [sourceRows, search])

  const total = activeLevel === 'tps'
    ? filteredRows.length
    : Number(pagination.total) || filteredRows.length

  const totalPages = activeLevel === 'tps'
    ? Math.max(1, Math.ceil(filteredRows.length / limit))
    : Math.max(1, Number(pagination.total_pages) || 1)

  const displayRows = activeLevel === 'tps'
    ? filteredRows.slice((page - 1) * limit, page * limit)
    : filteredRows

  const pageStart = total === 0 ? 0 : (page - 1) * limit + 1
  const pageEnd = Math.min(page * limit, total)

  useEffect(() => {
    setPage(1)
  }, [activeLevel, activeId, pemiluId, limit, search, tableMode])

  useEffect(() => {
    if (!pemiluId || activeLevel === 'tps') {
      setRows([])
      setPagination({ page: 1, limit, total: 0, total_pages: 1 })
      setLoading(false)
      setError(null)
      return undefined
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    const load = async () => {
      const result = await api.getRekapWilayahPage(
        pemiluId,
        config.apiLevel,
        getParentId(activeLevel, activeId),
        page,
        limit,
      )

      if (cancelled) return

      setRows(normalizeServerRows(result.rows, config.childLevel))
      setPagination({
        page: Number(result.pagination?.page) || page,
        limit: Number(result.pagination?.limit) || limit,
        total: Number(result.pagination?.total) || result.rows.length,
        total_pages: Math.max(1, Number(result.pagination?.total_pages) || 1),
      })
      setLoading(false)
    }

    load().catch((err) => {
      if (cancelled) return
      setRows([])
      setPagination({ page: 1, limit, total: 0, total_pages: 1 })
      setLoading(false)
      setError(err.message || 'Gagal memuat data tabel rekap wilayah.')
    })

    return () => {
      cancelled = true
    }
  }, [pemiluId, activeLevel, activeId, page, limit, config.apiLevel, config.childLevel])

  const selectRow = (row) => {
    if (!config.childLevel || activeLevel === 'tps') return
    if (!Number.isFinite(row.id) || row.id <= 0) return
    onSelectRegion?.(config.childLevel, row.id)
  }

  const renderState = (colSpan) => {
    if (loading) {
      return <tbody><tr><td colSpan={colSpan} className={`${bodyClass} py-8 text-center text-[#82776e]`}>Memuat rekap wilayah...</td></tr></tbody>
    }

    if (error) {
      return <tbody><tr><td colSpan={colSpan} className={`${bodyClass} py-8 text-center text-red-600`}>{error}</td></tr></tbody>
    }

    if (displayRows.length === 0) {
      return <tbody><tr><td colSpan={colSpan} className={`${bodyClass} py-8 text-center text-[#82776e]`}>
        {search ? 'Wilayah yang dicari tidak ditemukan.' : 'Tidak ada data rekap pada konteks ini.'}
      </td></tr></tbody>
    }

    return null
  }

  const renderSummaryTable = () => {
    const colSpan = 7

    return (
      <table className="min-w-[900px] w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className={stickyHeaderClass}>No.</th>
            <th className={`${headerClass} sticky left-[52px] z-20 bg-[#fff9ed] text-left`}>{config.nameLabel}</th>
            {activeLevel === 'kabupaten' && <th className={headerClass}>Jml Kecamatan</th>}
            {activeLevel === 'dapil' && <th className={headerClass}>Jml Desa/Kel</th>}
            {activeLevel === 'kecamatan' && <th className={headerClass}>Jml TPS</th>}
            {activeLevel === 'desa' && <th className={headerClass}>Jenis</th>}
            {activeLevel === 'tps' && <th className={headerClass}>Alamat</th>}
            <th className={headerClass}>DPT</th>
            <th className={headerClass}>Suara Seluruh Partai</th>
            <th className={headerClass}>Suara Sah</th>
            <th className={headerClass}>Suara Tdk Sah</th>
          </tr>
        </thead>
        {renderState(colSpan) || (
          <tbody>
            {displayRows.map((row, index) => (
              <tr
                key={`${row.id}-${index}`}
                onClick={() => selectRow(row)}
                onDoubleClick={() => selectRow(row)}
                className={`${config.childLevel ? 'cursor-pointer hover:bg-[#fff7e8]' : ''}`}
              >
                <td className={stickyBodyClass}>{pageStart + index}</td>
                <td className={`${bodyClass} sticky left-[52px] z-10 bg-[#fffdf8] font-semibold text-left`}>{row.name}</td>
                {activeLevel === 'kabupaten' && <td className={`${bodyClass} text-center`}>{formatNumber(row.jumlahKecamatan)}</td>}
                {activeLevel === 'dapil' && <td className={`${bodyClass} text-center`}>{formatNumber(row.jumlahDesa)}</td>}
                {activeLevel === 'kecamatan' && <td className={`${bodyClass} text-center`}>{formatNumber(row.jumlahTps)}</td>}
                {activeLevel === 'desa' && <td className={`${bodyClass} text-center`}>-</td>}
                {activeLevel === 'tps' && <td className={`${bodyClass} min-w-[280px]`}>{row.raw?.alamat || '-'}</td>}
                <td className={`${bodyClass} text-right`}>{formatNumber(row.dpt)}</td>
                <td className={`${bodyClass} text-right`}>{formatNumber(row.suaraSeluruhPartai)}</td>
                <td className={`${bodyClass} text-right`}>{formatNumber(row.suaraSah)}</td>
                <td className={`${bodyClass} text-right`}>{formatNumber(row.suaraTidakSah)}</td>
              </tr>
            ))}
          </tbody>
        )}
      </table>
    )
  }

  const renderPartyTable = () => {
    const colSpan = 5 + columns.length

    return (
      <table className="min-w-max w-full border-collapse text-xs">
        <thead>
          <tr>
            <th rowSpan={2} className={stickyHeaderClass}>No.</th>
            <th rowSpan={2} className={`${headerClass} sticky left-[52px] z-20 bg-[#fff9ed] text-left`}>{config.nameLabel}</th>
            <th rowSpan={2} className={headerClass}>DPT</th>
            <th colSpan={Math.max(columns.length, 1)} className={headerClass}>Perolehan Suara Partai</th>
            <th rowSpan={2} className={headerClass}>Suara Sah</th>
            <th rowSpan={2} className={headerClass}>Suara Tdk Sah</th>
          </tr>
          <tr>
            {columns.length
              ? columns.map((party) => (
                <th key={party.code} className={`${headerClass} min-w-[72px]`}>
                  <img
                    src={getPartyLogo(party.code)}
                    alt={party.name}
                    title={party.name}
                    className="mx-auto h-7 w-7 object-contain"
                    loading="lazy"
                  />
                  <span className="sr-only">{party.name}</span>
                </th>
              ))
              : <th className={headerClass}>Partai</th>}
          </tr>
        </thead>
        {renderState(colSpan) || (
          <tbody>
            {displayRows.map((row, index) => (
              <tr
                key={`${row.id}-${index}`}
                onClick={() => selectRow(row)}
                onDoubleClick={() => selectRow(row)}
                className={`${config.childLevel ? 'cursor-pointer hover:bg-[#fff7e8]' : ''}`}
              >
                <td className={stickyBodyClass}>{pageStart + index}</td>
                <td className={`${bodyClass} sticky left-[52px] z-10 bg-[#fffdf8] font-semibold text-left`}>{row.name}</td>
                <td className={`${bodyClass} text-right`}>{formatNumber(row.dpt)}</td>
                {columns.length
                  ? columns.map((party) => (
                    <td key={party.code} className={`${bodyClass} min-w-[72px] text-right`}>
                      {formatNumber(row.partyVotes[party.code])}
                    </td>
                  ))
                  : <td className={`${bodyClass} text-center`}>-</td>}
                <td className={`${bodyClass} text-right`}>{formatNumber(row.suaraSah)}</td>
                <td className={`${bodyClass} text-right`}>{formatNumber(row.suaraTidakSah)}</td>
              </tr>
            ))}
          </tbody>
        )}
      </table>
    )
  }

  return (
    <section className="min-w-0 rounded-lg border border-[#e4d9c7] bg-[rgba(255,253,247,0.78)] shadow-sm">
      <div className="flex flex-col gap-3 border-b border-[#ecdfcb] px-4 pt-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-serif text-xl font-bold text-[#332e29]">Data Perolehan Suara per Wilayah</h2>
          <div className="mt-2 inline-flex rounded-md border border-[#e4d9c7] bg-[#fffdf8] p-0.5">
            <button
              type="button"
              onClick={() => setTableMode('summary')}
              className={`rounded px-3 py-2 text-xs font-semibold ${tableMode === 'summary' ? 'bg-[#c4482a] text-white' : 'text-[#6f6258]'}`}
            >
              Ringkasan Wilayah
            </button>
            <button
              type="button"
              onClick={() => setTableMode('party')}
              className={`rounded px-3 py-2 text-xs font-semibold ${tableMode === 'party' ? 'bg-[#c4482a] text-white' : 'text-[#6f6258]'}`}
            >
              Perolehan Partai
            </button>
          </div>
          <p className="mt-2 pb-3 text-[11px] text-[#82776e]">(Kecamatan - Desa/Kelurahan - TPS)</p>
        </div>

        <label className="mb-3 flex w-full items-center gap-2 rounded-md border border-[#e4d9c7] bg-[#fffdf8] px-3 py-2 text-sm text-[#82776e] sm:w-[250px]">
          <span aria-hidden="true">⌕</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari wilayah..."
            className="min-w-0 flex-1 bg-transparent outline-none"
          />
        </label>
      </div>

      <div className="max-h-[520px] min-h-[170px] overflow-auto">
        {tableMode === 'party' ? renderPartyTable() : renderSummaryTable()}
      </div>

      <div className="flex flex-col gap-2 border-t border-[#ecdfcb] px-4 py-3 text-xs text-[#6f6258] sm:flex-row sm:items-center sm:justify-between">
        <div>Baris {pageStart}-{pageEnd} dari {total}</div>
        <div className="flex items-center gap-2">
          <span>Per halaman</span>
          <select
            value={limit}
            onChange={(event) => setLimit(Number(event.target.value))}
            className="rounded border border-[#e4d9c7] bg-[#fffdf8] px-2 py-1"
          >
            {[10, 20, 50].map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            className="rounded border border-[#e4d9c7] px-3 py-1 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Sebelumnya
          </button>
          <span>Halaman {page} / {totalPages}</span>
          <button
            type="button"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            className="rounded border border-[#e4d9c7] px-3 py-1 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Berikutnya
          </button>
        </div>
      </div>
    </section>
  )
}
