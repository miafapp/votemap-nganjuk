import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import { getPartyLogo } from '../lib/party-logos'

const PARTY_CODES = [
  'PKB', 'GERINDRA', 'PDI-P', 'GOLKAR', 'NASDEM', 'BURUH', 'GELORA', 'PKS', 'PKN',
  'HANURA', 'GARUDA', 'PAN', 'PBB', 'DEMOKRAT', 'PSI', 'PERINDO', 'PPP', 'UMMAT',
]

const LEVEL_CONFIG = {
  kabupaten: { childLevel: 'kecamatan', nameLabel: 'Kecamatan', columns: ['desaCount', 'tpsCount'] },
  dapil: { childLevel: 'kecamatan', nameLabel: 'Kecamatan', columns: ['desaCount', 'tpsCount'] },
  kecamatan: { childLevel: 'desa', nameLabel: 'Desa / Kelurahan', columns: ['tpsCount'] },
  desa: { childLevel: 'tps', nameLabel: 'TPS', columns: [] },
  tps: { childLevel: null, nameLabel: 'TPS', columns: [] },
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

function firstRecord(data) {
  if (Array.isArray(data)) return data[0] || null
  return data || null
}

function extractArray(data) {
  if (Array.isArray(data)) return data
  if (!data || typeof data !== 'object') return []
  const value = data.rows || data.items || data.data || data.results
  return Array.isArray(value) ? value : []
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
      numberValue(party?.jumlah_suara ?? party?.total_suara ?? party?.suara),
    ])
  }

  if (nested && typeof nested === 'object') {
    return Object.entries(nested).map(([code, value]) => [
      normalizePartyCode(code),
      numberValue(typeof value === 'object' ? value?.jumlah_suara ?? value?.total_suara ?? value?.suara : value),
    ])
  }

  return PARTY_CODES.map((code) => [
    code,
    numberValue(row?.[code] ?? row?.[code.toLowerCase()] ?? row?.[`suara_${code.toLowerCase()}`]),
  ])
}

function getPartyScore(row, code) {
  return partyEntries(row).find(([partyCode]) => partyCode === code)?.[1] || 0
}

function normalizeParties(parties) {
  const source = Array.isArray(parties) ? parties : []
  const byCode = new Map(source.map((party) => [
    normalizePartyCode(party?.kode_partai || party?.singkatan || party?.kode),
    party,
  ]))

  return PARTY_CODES.map((code) => ({
    ...(byCode.get(code) || {}),
    kode_partai: code,
    nama_partai: byCode.get(code)?.nama_partai || byCode.get(code)?.singkatan || code,
  }))
}

function normalizeRow(row, index, childLevel) {
  const isTps = childLevel === 'tps'
  const id = firstDefined(row, [
    `${childLevel}_id`,
    'wilayah_id',
    'id',
  ], index + 1)
  const name = firstDefined(row, isTps
    ? ['nomor_tps', 'nomor', 'nama_tps', 'nama_wilayah', 'nama']
    : childLevel === 'desa'
      ? ['nama_desa', 'desa', 'nama', 'nama_wilayah']
      : ['nama_kecamatan', 'kecamatan', 'nama', 'nama_wilayah'], isTps ? `TPS ${String(index + 1).padStart(3, '0')}` : '-')

  return {
    raw: row,
    id,
    name: isTps && !String(name).toUpperCase().startsWith('TPS') ? `TPS ${name}` : name,
    desaCount: numberValue(firstDefined(row, ['jumlah_desa', 'jumlah_desa_kelurahan', 'jml_desa', 'jml_desa_kel'])),
    tpsCount: numberValue(firstDefined(row, ['jumlah_tps', 'jml_tps'])),
    dpt: numberValue(firstDefined(row, ['dpt', 'jumlah_dpt'])),
    suaraSah: numberValue(firstDefined(row, ['suara_sah', 'jumlah_suara_sah'])),
    suaraTidakSah: numberValue(firstDefined(row, ['suara_tidak_sah', 'jumlah_suara_tidak_sah'])),
  }
}

async function loadChildRows({ pemiluId, activeLevel, activeId, dapilId, kecamatanList, desaId }) {
  if (activeLevel === 'kabupaten' || activeLevel === 'dapil') {
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

async function enrichRow(row, pemiluId, childLevel) {
  const id = firstDefined(row, [`${childLevel}_id`, 'id', 'wilayah_id'])
  if (!id) return normalizeRow(row, 0, childLevel)

  try {
    const [summaryData, partyData] = childLevel === 'tps'
      ? await Promise.all([
        api.getWilayahDetail({ pemilu_id: pemiluId, tps_id: id }),
        api.getSuara('tps', id, pemiluId),
      ])
      : await Promise.all([
        api.getRekapWilayah(pemiluId, childLevel.toUpperCase(), id),
        api.getSuara(childLevel, id, pemiluId),
      ])

    const summary = firstRecord(summaryData) || row
    return {
      ...normalizeRow({ ...row, ...summary }, 0, childLevel),
      raw: { ...row, ...summary, partai: partyData },
    }
  } catch {
    return normalizeRow(row, 0, childLevel)
  }
}

export default function BottomTable({
  pemiluId,
  activeLevel,
  activeId,
  kecamatanList = [],
  dapilId,
  desaId,
  parties,
  detail,
  onSelectRegion,
}) {
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [isTouchDevice, setIsTouchDevice] = useState(false)

  const config = LEVEL_CONFIG[activeLevel] || LEVEL_CONFIG.kabupaten
  const partyColumns = useMemo(() => normalizeParties(parties), [parties])
  const total = rows.length
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const displayRows = rows.slice((page - 1) * limit, page * limit)
  const pageStart = total === 0 ? 0 : (page - 1) * limit + 1
  const pageEnd = Math.min(page * limit, total)

  useEffect(() => {
    setIsTouchDevice(window.matchMedia?.('(pointer: coarse)').matches ?? false)
  }, [])

  useEffect(() => {
    setPage(1)
  }, [activeLevel, activeId, pemiluId, limit])

  useEffect(() => {
    if (!pemiluId || activeLevel === 'tps') {
      setRows([])
      setLoading(false)
      setError(null)
      return undefined
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    loadChildRows({ pemiluId, activeLevel, activeId, dapilId, kecamatanList, desaId })
      .then(async (sourceRows) => {
        const enriched = await Promise.all(sourceRows.map((row, index) => enrichRow(row, pemiluId, row.__level || config.childLevel).then((value) => ({ ...value, _index: index }))))
        if (cancelled) return
        setRows(enriched)
      })
      .catch((err) => {
        if (cancelled) return
        setRows([])
        setError(err.message || 'Gagal memuat data tabel rekap wilayah')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [pemiluId, activeLevel, activeId, dapilId, desaId, kecamatanList, config.childLevel])

  const selectRow = (row) => {
    if (!config.childLevel || activeLevel === 'tps') return
    const id = Number(row.id)
    if (Number.isFinite(id)) onSelectRegion?.(config.childLevel, id)
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
        <span>Level {String(activeLevel || 'kabupaten').toUpperCase()}</span>
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
                const rowNumber = (page - 1) * limit + index + 1
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
            <button type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="px-2 py-1 border border-[#e4d9c7] rounded disabled:opacity-40">Sebelumnya</button>
            <span className="px-2">Halaman {page} / {totalPages}</span>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} className="px-2 py-1 border border-[#e4d9c7] rounded disabled:opacity-40">Berikutnya</button>
          </div>
        </div>
      )}
    </section>
  )
}
