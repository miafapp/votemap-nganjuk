import { useEffect, useState } from 'react'
import { api } from '../lib/api'

function ReloadButton({ label, onClick, disabled }) {
  return (
    <button type="button" title={label} aria-label={label} onClick={onClick} disabled={disabled} className="shrink-0 w-10 h-10 inline-flex items-center justify-center rounded-md border border-[#e4d9c7] bg-[#fffdf8] text-[#c4482a] hover:bg-[#f8eee4] disabled:opacity-40 disabled:cursor-not-allowed">
      ↻
    </button>
  )
}

export default function FilterBar({ pemiluId, dapilId, kecamatanId, desaId, onKecamatanChange, onDesaChange, onTpsChange, onReset, refreshToken = 0, onReloadKecamatan, onReloadDesa, onReloadTps }) {
  const [kecamatanList, setKecamatanList] = useState([])
  const [desaList, setDesaList] = useState([])
  const [tpsList, setTpsList] = useState([])
  const [loadingKecamatan, setLoadingKecamatan] = useState(false)
  const [loadingDesa, setLoadingDesa] = useState(false)
  const [loadingTps, setLoadingTps] = useState(false)

  useEffect(() => {
    if (!pemiluId) { setKecamatanList([]); return }
    setLoadingKecamatan(true)
    api.getKecamatan(pemiluId, dapilId).then(setKecamatanList).catch(() => setKecamatanList([])).finally(() => setLoadingKecamatan(false))
  }, [pemiluId, dapilId, refreshToken])

  useEffect(() => {
    if (!kecamatanId) { setDesaList([]); return }
    setLoadingDesa(true)
    api.getDesa(kecamatanId, pemiluId, dapilId).then(setDesaList).catch(() => setDesaList([])).finally(() => setLoadingDesa(false))
  }, [kecamatanId, pemiluId, dapilId, refreshToken])

  useEffect(() => {
    if (!desaId || !pemiluId) { setTpsList([]); return }
    setLoadingTps(true)
    api.getTps(pemiluId, desaId).then(setTpsList).catch(() => setTpsList([])).finally(() => setLoadingTps(false))
  }, [desaId, pemiluId, refreshToken])

  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.15fr_auto] gap-5 items-end my-4 p-4 border border-[#e4d9c7] rounded-lg bg-[rgba(255,253,247,0.72)] shadow-sm">
      <label className="grid gap-[5px] font-bold text-xs">
        Pilih Kecamatan
        <div className="flex items-center gap-2">
          <select className="min-w-0 flex-1 appearance-none border border-[#e4d9c7] rounded-md px-3 py-2 text-[#82776e] bg-[#fffdf8] cursor-pointer disabled:opacity-50" value={kecamatanId || ''} disabled={!pemiluId || loadingKecamatan} onChange={(e) => onKecamatanChange(e.target.value ? Number(e.target.value) : null)}>
            <option value="">{loadingKecamatan ? 'Memuat...' : 'Semua Kecamatan'}</option>
            {kecamatanList.map((k) => <option key={k.id} value={k.id}>{k.nama || k.kecamatan}</option>)}
          </select>
          <ReloadButton label="Muat ulang Kecamatan" onClick={onReloadKecamatan} disabled={!pemiluId || loadingKecamatan} />
        </div>
      </label>

      <label className="grid gap-[5px] font-bold text-xs">
        Pilih Desa / Kelurahan
        <div className="flex items-center gap-2">
          <select className="min-w-0 flex-1 appearance-none border border-[#e4d9c7] rounded-md px-3 py-2 text-[#82776e] bg-[#fffdf8] cursor-pointer disabled:opacity-50" value={desaId || ''} disabled={!kecamatanId || loadingDesa} onChange={(e) => onDesaChange(e.target.value ? Number(e.target.value) : null)}>
            <option value="">{loadingDesa ? 'Memuat...' : 'Semua Desa / Kelurahan'}</option>
            {desaList.map((d) => <option key={d.id} value={d.id}>{d.nama || d.desa}</option>)}
          </select>
          <ReloadButton label="Muat ulang Desa / Kelurahan" onClick={onReloadDesa} disabled={!kecamatanId || loadingDesa} />
        </div>
      </label>

      <label className="grid gap-[5px] font-bold text-xs">
        Pilih TPS
        <div className="flex items-center gap-2">
          <select className="min-w-0 flex-1 appearance-none border border-[#e4d9c7] rounded-md px-3 py-2 text-[#82776e] bg-[#fffdf8] cursor-pointer disabled:opacity-50" value="" disabled={!desaId || loadingTps} onChange={(e) => onTpsChange(e.target.value ? Number(e.target.value) : null)}>
            <option value="">{loadingTps ? 'Memuat...' : 'Semua TPS'}</option>
            {tpsList.map((t) => <option key={t.id} value={t.id}>TPS {t.nomor}</option>)}
          </select>
          <ReloadButton label="Muat ulang TPS" onClick={onReloadTps} disabled={!desaId || loadingTps} />
        </div>
      </label>

      <button type="button" title="Kembali ke Kabupaten" aria-label="Kembali ke Kabupaten" className="w-10 h-10 inline-flex items-center justify-center border-0 rounded-lg bg-[#c4482a] text-white font-bold cursor-pointer shadow-[0_3px_0_#9f321d] hover:bg-[#b03d22] transition-colors" onClick={onReset}>⌂</button>
    </section>
  )
}
