import { useEffect, useState } from 'react'
import { api } from '../lib/api'

function ReloadButton({ label, onClick, disabled }) {
  return (
    <button type="button" title={label} aria-label={label} onClick={onClick} disabled={disabled} className="shrink-0 w-10 h-10 inline-flex items-center justify-center rounded-md border-0 bg-primary text-white shadow-[0_3px_0_var(--color-primary-shadow)] hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed">
      ↻
    </button>
  )
}

function FilterField({ label, children }) {
  return <label className="grid gap-[5px] font-bold text-xs min-w-0">{label}{children}</label>
}

export default function FilterBar({ pemiluId, dapilId, kecamatanId, desaId, tpsId, kecamatanList = [], onDapilChange, onKecamatanChange, onDesaChange, onTpsChange, refreshDapilToken = 0, refreshDesaToken = 0, refreshTpsToken = 0, onReloadDapil, onReloadKecamatan, onReloadDesa, onReloadTps }) {
  const [dapilList, setDapilList] = useState([])
  const [desaList, setDesaList] = useState([])
  const [tpsList, setTpsList] = useState([])
  const [loadingDapil, setLoadingDapil] = useState(false)
  const [loadingDesa, setLoadingDesa] = useState(false)
  const [loadingTps, setLoadingTps] = useState(false)

  useEffect(() => {
    if (!pemiluId) {
      setDapilList([])
      return
    }
    setLoadingDapil(true)
    api.getDapil(pemiluId).then(setDapilList).catch(() => setDapilList([])).finally(() => setLoadingDapil(false))
  }, [pemiluId, refreshDapilToken])

  useEffect(() => {
    if (!kecamatanId) {
      setDesaList([])
      return
    }
    setLoadingDesa(true)
    api.getDesa(kecamatanId, pemiluId, dapilId).then(setDesaList).catch(() => setDesaList([])).finally(() => setLoadingDesa(false))
  }, [kecamatanId, pemiluId, dapilId, refreshDesaToken])

  useEffect(() => {
    if (!desaId || !pemiluId) {
      setTpsList([])
      return
    }
    setLoadingTps(true)
    api.getTps(pemiluId, desaId).then(setTpsList).catch(() => setTpsList([])).finally(() => setLoadingTps(false))
  }, [desaId, pemiluId, refreshTpsToken])

  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1.15fr] gap-5 items-end my-4 p-4 border border-card-border rounded-lg bg-surface/72 shadow-sm">
      <FilterField label="Pilih DAPIL">
        <div className="flex items-center gap-2">
          <select className="min-w-0 flex-1 appearance-none border border-card-border rounded-md px-3 py-2 text-muted bg-surface cursor-pointer disabled:opacity-50" value={dapilId || ''} disabled={!pemiluId || loadingDapil} onChange={(e) => onDapilChange(e.target.value ? Number(e.target.value) : null)}>
            <option value="">{loadingDapil ? 'Memuat...' : 'Semua DAPIL'}</option>
            {dapilList.map((d) => <option key={d.id} value={d.id}>{d.nama}</option>)}
          </select>
          <ReloadButton label="Muat ulang DAPIL" onClick={onReloadDapil} disabled={!pemiluId || loadingDapil} />
        </div>
      </FilterField>

      <FilterField label="Pilih Kecamatan">
        <div className="flex items-center gap-2">
          <select className="min-w-0 flex-1 appearance-none border border-card-border rounded-md px-3 py-2 text-muted bg-surface cursor-pointer disabled:opacity-50" value={kecamatanId || ''} disabled={!pemiluId || !kecamatanList.length} onChange={(e) => onKecamatanChange(e.target.value ? Number(e.target.value) : null)}>
            <option value="">Semua Kecamatan</option>
            {kecamatanList.map((k) => <option key={k.id} value={k.id}>{k.nama || k.kecamatan}</option>)}
          </select>
          <ReloadButton label="Muat ulang Kecamatan" onClick={onReloadKecamatan} disabled={!pemiluId} />
        </div>
      </FilterField>

      <FilterField label="Pilih Desa / Kelurahan">
        <div className="flex items-center gap-2">
          <select className="min-w-0 flex-1 appearance-none border border-card-border rounded-md px-3 py-2 text-muted bg-surface cursor-pointer disabled:opacity-50" value={desaId || ''} disabled={!kecamatanId || loadingDesa} onChange={(e) => onDesaChange(e.target.value ? Number(e.target.value) : null)}>
            <option value="">{loadingDesa ? 'Memuat...' : 'Semua Desa / Kelurahan'}</option>
            {desaList.map((d) => <option key={d.id} value={d.id}>{d.nama || d.desa}</option>)}
          </select>
          <ReloadButton label="Muat ulang Desa / Kelurahan" onClick={onReloadDesa} disabled={!kecamatanId || loadingDesa} />
        </div>
      </FilterField>

      <FilterField label="Pilih TPS">
        <div className="flex items-center gap-2">
          <select className="min-w-0 flex-1 appearance-none border border-card-border rounded-md px-3 py-2 text-muted bg-surface cursor-pointer disabled:opacity-50" value={tpsId || ''} disabled={!desaId || loadingTps} onChange={(e) => onTpsChange(e.target.value ? Number(e.target.value) : null)}>
            <option value="">{loadingTps ? 'Memuat...' : 'Semua TPS'}</option>
            {tpsList.map((t) => <option key={t.id} value={t.id}>TPS {t.nomor}</option>)}
          </select>
          <ReloadButton label="Muat ulang TPS" onClick={onReloadTps} disabled={!desaId || loadingTps} />
        </div>
      </FilterField>
    </section>
  )
}
