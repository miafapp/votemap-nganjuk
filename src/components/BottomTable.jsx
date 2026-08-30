import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import { getPartyLogo } from '../lib/party-logos'

const PARTY_CODES = [
  'PKB', 'GERINDRA', 'PDI-P', 'GOLKAR', 'NASDEM', 'BURUH', 'GELORA', 'PKS', 'PKN',
  'HANURA', 'GARUDA', 'PAN', 'PBB', 'DEMOKRAT', 'PSI', 'PERINDO', 'PPP', 'UMMAT',
]

const LEVEL_CONFIG = {
  kabupaten: { childLevel: 'kecamatan', nameKey: 'kecamatan', nameLabel: 'Kecamatan', columns: ['desaCount', 'tpsCount'] },
  dapil: { childLevel: 'kecamatan', nameKey: 'kecamatan', nameLabel: 'Kecamatan', columns: ['desaCount', 'tpsCount'] },
  kecamatan: { childLevel: 'desa', nameKey: 'desa', nameLabel: 'Desa / Kelurahan', columns: ['tpsCount'] },
  desa: { childLevel: 'tps', nameKey: 'tps', nameLabel: 'TPS', columns: [] },
  tps: { childLevel: null, nameKey: 'tps', nameLabel: 'TPS', columns: [] },
}

function firstDefined(row, keys, fallback = 0) {
  for (const key of keys.filter(Boolean)) {
    if (row?.[key] !== undefined && row?.[key] !== null && row?.[key] !== '') return row[key]
  }
  return fallback
}

function numberValue(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function normalizePartyCode(value) {
  return String(value || '').trim().toUpperCase().replace(/_/g, '-')
}

function normalizePartyList(parties) {
  const source = Array.isArray(parties) ? parties : []
  const byCode = new Map()

  PARTY_CODES.forEach((code) => byCode.set(code, { kode_partai: code, nama_partai: code, jumlah_suara: 0 }))
  source.forEach((party) => {
    const code = normalizePartyCode(party?.kode_partai || party?.singkatan || party?.kode)
    if (!code) return
    byCode.set(code, {
      ...party,
      kode_partai: code,
      nama_partai: party?.nama_partai || party?.nama || party?.singkatan || code,
      jumlah_suara: numberValue(party?.jumlah_suara ?? party?.total_suara),
    })
  })

  return PARTY_CODES.map((code) => byCode.get(code)).filter(Boolean)
}

function partyEntries(row) {
  const candidates = [row?.partai, row?.parties, row?.suara_partai, row?.suaraPartai, row?.party_scores]
  const nested = candidates.find((value) => value && typeof value === 'object')
  if (Array.isArray(nested)) {
    return nested.map((party) => [
      normalizePartyCode(party?.kode_partai || party?.singkatan || party?.kode),
      numberValue(party?.jumlah_suara ?? party?.total_suara ?? party?.suara),
    ])
  }
  if (nested && typeof nested === 'object') {
    return Object.entries(nested).map(([code, value]) => [
      normalizePartyCode(code),
      numberValue(typeof value === 'object' ? value?.jumlah_suara ?? value?.total_suara ?? value?.suara : value),
    ])
  }

  return PARTY_CODES.map((code) => {
    const value = row?.[code] ?? row?.[code.toLowerCase()] ?? row?.[`suara_${code.toLowerCase()}`]
    return [code, numberValue(value)]
  }).filter(([, value]) => value !== 0)
}

function getPartyScore(row, code) {
  const match = partyEntries(row).find(([partyCode]) => partyCode === code)
  return match ? match[1] : 0
}

function normalizeRow(row, index, config) {
  const id = firstDefined(row, [
    `${config.childLevel}_id`,
    config.childLevel === 'tps' ? 'tps_id' : null,
    'wilayah_id',
    'id',
  ], index + 1)
  const name = firstDefined(row, [
    `nama_${config.nameKey}`,
    config.nameKey === 'kecamatan' ? 'nama' : null,
    config.nameKey === 'desa' ? 'desa' : null,
    config.nameKey === 'tps' ? 'nomor_tps' : null,
    config.nameKey === 'tps' ? 'nomor' : null,
    'nama_wilayah',
  ], config.nameKey === 'tps' ? `TPS ${String(index + 1).padStart(3, '0')}` : '-')

  return {
    raw: row,
    id,
    name: config.nameKey === 'tps' && !String(name).toUpperCase().startsWith('TPS') ? `TPS ${name}` : name,
    desaCount: numberValue(firstDefined(row, ['jumlah_desa', 'jumlah_desa_kelurahan', 'jml_desa', 'jml_desa_kel'])),
    tpsCount: numberValue(firstDefined(row, ['jumlah_tps', 'jml_tps'])),
    dpt: numberValue(firstDefined(row, ['dpt', 'jumlah_dpt'])),
    suaraSah: numberValue(firstDefined(row, ['suara_sah', 'jumlah_suara_sah'])),
    suaraTidakSah: numberValue(firstDefined(row, ['suara_tidak_sah', 'jumlah_suara_tidak_sah'])),
  }
}

function extractRows(payload) {
  if (Array.isArray(payload)) return { rows: payload, total: payload.length }
  if (!payload || typeof payload !== 'object') return { rows: [], total: 0 }
  const rows = payload.rows || payload.items || payload.data || payload.results || []
  return {
    rows: Array.isArray(rows) ? rows : [],
    total: numberValue(payload.total ?? payload.total_count ?? payload.totalRows ?? (Array.isArray(rows) ? rows.length : 0)),
  }
}

export default function BottomTable({ pemiluId, activeLevel, activeId, parties, detail, onSelectRegion }) {
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [isTouchDevice, setIsTouchDevice] = useState(false)

  const config = LEVEL_CONFIG[activeLevel || 'kabupaten']
  const partyColumns = useMemo(() => normalizePartyList(parties), [parties])
  const totalPages = Math.max(1, Math.ceil(total / limit))

  useEffect(() => {
    setIsTouchDevice(window.matchMedia?.('(pointer: coarse)').matches ?? false)
  }, [])

  useEffect(() => {
    setPage(1)
  }, [activeLevel, activeId, pemiluId, limit])

  useEffect(() => {
    if (!pemiluId || !activeLevel || activeLevel === 'tps') {
      setRows([])
      setTotal(detail ? 1 : 0)
      setLoading(false)
      setError(null)
      return undefined
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    api.getRekapWilayahPage(pemiluId, config.childLevel.toUpperCase(), activeId, page, limit)
      .then((data) => {
        if (cancelled) return
        const result = extractRows(data)
        setRows(result.rows.map((row, index) => normalizeRow(row, index + ((page - 1) * limit), config)))
        setTotal(result.total)
      })
      .catch((err) => {
        if (cancelled) return
        setRows([])
        setTotal(0)
        setError(err.message || 'Gagal memuat tabel rekap wilayah')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [pemiluId, activeLevel, activeId, page, limit, config.childLevel, detail])

  const displayRows = activeLevel === 'tps' && detail ? [normalizeRow(detail, 0, config)] : rows
  const pageStart = total === 0 ? 0 : ((page - 1) * limit) + 1
  const pageEnd = Math.min(page * limit, total)

  const selectRow = (row) => {
    if (!config.childLevel || activeLevel === 'tps') return
    const id = Number(row.id)
    if (!Number.isFinite(id)) return
    onSelectRegion?.(config.childLevel, id)
  }

  const dataColumnCount = partyColumns.length + 5 + config.columns.length

  return (
    <section className="border border-[#e4d9c7] rounded-lg bg-[rgba(255,253,247,0.8)] shadow-sm overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3">
        <span className="text-[#c4482a] text-xl">♟</span>
        <h2 className="m-0 font-bold text-lg [font-family:Georgia,serif]">Data Perolehan Suara per Wilayah</h2>
      </div>
      <div className="px-4 pb-3 text-xs text-[#82776e] flex justify-between items-center">
        <strong>(Kecamatan - Desa/Kelurahan - TPS)</strong>
        <span>{activeLevel ? `Level ${activeLevel.toUpperCase()}` : 'Level KABUPATEN'}</span>
      </div>

      <div className="max-h-[520px] overflow-auto px-3 pb-3">
        <table className="min-w-max w-full border-collapse text-xs">
          <thead className="sticky top-0 z-20">
            <tr>
              <th rowSpan={2} className="sticky left-0 z-30 text-[#8d4838] bg-[#fff9ed] font-bold whitespace-nowrap px-3 py-2 border border-[#ecdfcb] text-center">No</th>
              <th rowSpan={2} className="sticky left-[43px] z-30 text-[#8d4838] bg-[#fff9ed] font-bold whitespace-nowrap px-3 py-2 border border-[#ecdfcb] text-left">{config.nameLabel}</th>
              {config.columns.includes('desaCount') && <th rowSpan={2} className="text-[#8d4838] bg-[#fff9ed] font-bold whitespace-nowrap px-3 py-2 border border-[#ecdfcb] text-center">Jml Desa/Kel</th>}
              {config.columns.includes('tpsCount') && <th rowSpan={2} className="text-[#8d4838] bg-[#fff9ed] font-bold whitespace-nowrap px-3 py-2 border border-[#ecdfcb] text-center">Jml TPS</th>}
              <th rowSpan={2} className="text-[#8d4838] bg-[#fff9ed] font-bold whitespace-nowrap px-3 py-2 border border-[#ecdfcb] text-center">DPT</th>
              <th colSpan={partyColumns.length} className="text-[#8d4838] bg-[#fff9ed] font-bold whitespace-nowrap px-3 py-2 border border-[#ecdfcb] text-center">Perolehan Suara Partai</th>
              <th rowSpan={2} className="text-[#8d4838] bg-[#fff9ed] font-bold whitespace-nowrap px-3 py-2 border border-[#ecdfcb] text-center">Suara Sah</th>
              <th rowSpan={2} className="text-[#8d4838] bg-[#fff9ed] font-bold whitespace-nowrap px-3 py-2 border border-[#ecdfcb] text-center">Suara Tdk Sah</th>
            </tr>
            <tr>
              {partyColumns.map((party) => (
                <th key={party.kode_partai} title={party.nama_partai} className="text-[#8d4838] bg-[#fff9ed] font-bold px-2 py-2 border border-[#ecdfcb] text-center min-w-[54px]">
                  <img src={getPartyLogo(party.kode_partai)} alt={party.nama_partai} className="w-7 h-7 mx-auto object-contain" />
                  <span className="block mt-1 text-[9px]">{party.kode_partai}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={dataColumnCount} className="px-3 py-8 text-center text-[#82776e] border border-[#ecdfcb]">Memuat rekap wilayah...</td></tr>
            ) : error ? (
              <tr><td colSpan={dataColumnCount} className="px-3 py-8 text-center text-red-600 border border-[#ecdfcb]">{error}</td></tr>
            ) : displayRows.length === 0 ? (
              <tr><td colSpan={dataColumnCount} className="px-3 py-8 text-center text-[#82776e] border border-[#ecdfcb]">Tidak ada data rekap pada konteks ini.</td></tr>
            ) : (
              displayRows.map((row, index) => {
                const rowNumber = activeLevel === 'tps' ? 1 : ((page - 1) * limit) + index + 1
                return (
                  <tr
                    key={`${row.id}-${rowNumber}`}
                    className={config.childLevel ? 'cursor-pointer hover:bg-[#fff9ed]' : ''}
                    onClick={isTouchDevice ? () => selectRow(row) : undefined}
                    onDoubleClick={!isTouchDevice ? () => selectRow(row) : undefined}
                    title={config.childLevel ? (isTouchDevice ? 'Ketuk untuk membuka wilayah' : 'Klik dua kali untuk membuka wilayah') : undefined}
                  >
                    <td className="sticky left-0 z-10 bg-white px-3 py-2 border border-[#ecdfcb] text-center">{rowNumber}</td>
                    <td className="sticky left-[43px] z-10 bg-white px-3 py-2 border border-[#ecdfcb] font-bold">{row.name}</td>
                    {config.columns.includes('desaCount') && <td className="px-3 py-2 border border-[#ecdfcb] text-center">{row.desaCount.toLocaleString('id-ID')}</td>}
                    {config.columns.includes('tpsCount') && <td className="px-3 py-2 border border-[#ecdfcb] text-center">{row.tpsCount.toLocaleString('id-ID')}</td>}
                    <td className="px-3 py-2 border border-[#ecdfcb] text-right">{row.dpt.toLocaleString('id-ID')}</td>
                    {partyColumns.map((party) => <td key={party.kode_partai} className="px-3 py-2 border border-[#ecdfcb] text-right">{getPartyScore(row.raw, party.kode_partai).toLocaleString('id-ID')}</td>)}
                    <td className="px-3 py-2 border border-[#ecdfcb] text-right">{row.suaraSah.toLocaleString('id-ID')}</td>
                    <td className="px-3 py-2 border border-[#ecdfcb] text-right">{row.suaraTidakSah.toLocaleString('id-ID')}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {activeLevel !== 'tps' && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 border-t border-[#e4d9c7] text-xs">
          <div className="flex items-center gap-2 text-[#82776e]">
            <span>Baris {pageStart}-{pageEnd} dari {total.toLocaleString('id-ID')}</span>
            <label className="flex items-center gap-1">
              Per halaman
              <select value={limit} onChange={(event) => setLimit(Number(event.target.value))} className="border border-[#e4d9c7] rounded px-2 py-1 bg-[#fffdf8]">
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </label>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)} className="px-3 py-1.5 border border-[#e4d9c7] rounded disabled:opacity-40">Sebelumnya</button>
            <span className="px-2">{page} / {totalPages}</span>
            <button type="button" disabled={page >= totalPages || loading} onClick={() => setPage((current) => current + 1)} className="px-3 py-1.5 border border-[#e4d9c7] rounded disabled:opacity-40">Berikutnya</button>
          </div>
        </div>
      )}
    </section>
  )
}
