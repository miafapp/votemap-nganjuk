import { useEffect, useState } from 'react'
import { api } from '../lib/api'

export default function FilterBar({ pemiluId, dapilId, kecamatanId, desaId, onKecamatanChange, onDesaChange, onTpsChange, onReset }) {
  const [kecamatanList, setKecamatanList] = useState([])
  const [desaList, setDesaList] = useState([])
  const [tpsList, setTpsList] = useState([])
  const [loadingKecamatan, setLoadingKecamatan] = useState(false)
  const [loadingDesa, setLoadingDesa] = useState(false)
  const [loadingTps, setLoadingTps] = useState(false)

  useEffect(() => {
    if (!pemiluId) {
      setKecamatanList([])
      return
    }
    setLoadingKecamatan(true)
    api.getKecamatan(pemiluId, dapilId)
      .then((data) => setKecamatanList(data))
      .catch(() => setKecamatanList([]))
      .finally(() => setLoadingKecamatan(false))
  }, [pemiluId, dapilId])

  useEffect(() => {
    if (!kecamatanId) {
      setDesaList([])
      return
    }
    setLoadingDesa(true)
    api.getDesa(kecamatanId, pemiluId, dapilId)
      .then((data) => setDesaList(data))
      .catch(() => setDesaList([]))
      .finally(() => setLoadingDesa(false))
  }, [kecamatanId, pemiluId, dapilId])

  useEffect(() => {
    if (!desaId || !pemiluId) {
      setTpsList([])
      return
    }
    setLoadingTps(true)
    api.getTps(pemiluId, desaId)
      .then((data) => setTpsList(data))
      .catch(() => setTpsList([]))
      .finally(() => setLoadingTps(false))
  }, [desaId, pemiluId])

  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.15fr_1fr_auto] gap-5 items-end my-4 p-4 border border-[#e4d9c7] rounded-lg bg-[rgba(255,253,247,0.72)] shadow-sm">
      <label className="grid gap-[5px] font-bold text-xs">
        Pilih Kecamatan
        <select
          className="appearance-none w-full border border-[#e4d9c7] rounded-md px-3 py-2 text-[#82776e] bg-[#fffdf8] cursor-pointer disabled:opacity-50"
          value={kecamatanId || ''}
          disabled={!pemiluId || loadingKecamatan}
          onChange={(e) => onKecamatanChange(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">{loadingKecamatan ? 'Memuat...' : 'Semua Kecamatan'}</option>
          {kecamatanList.map((k) => (
            <option key={k.id} value={k.id}>{k.nama || k.kecamatan}</option>
          ))}
        </select>
      </label>

      <label className="grid gap-[5px] font-bold text-xs">
        Pilih Desa / Kelurahan
        <select
          className="appearance-none w-full border border-[#e4d9c7] rounded-md px-3 py-2 text-[#82776e] bg-[#fffdf8] cursor-pointer disabled:opacity-50"
          value={desaId || ''}
          disabled={!kecamatanId || loadingDesa}
          onChange={(e) => onDesaChange(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">{loadingDesa ? 'Memuat...' : 'Semua Desa / Kelurahan'}</option>
          {desaList.map((d) => (
            <option key={d.id} value={d.id}>{d.nama || d.desa}</option>
          ))}
        </select>
      </label>

      <label className="grid gap-[5px] font-bold text-xs">
        Pilih TPS
        <select
          className="appearance-none w-full border border-[#e4d9c7] rounded-md px-3 py-2 text-[#82776e] bg-[#fffdf8] cursor-pointer disabled:opacity-50"
          value={''}
          disabled={!desaId || loadingTps}
          onChange={(e) => onTpsChange(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">{loadingTps ? 'Memuat...' : 'Semua TPS'}</option>
          {tpsList.map((t) => (
            <option key={t.id} value={t.id}>TPS {t.nomor}</option>
          ))}
        </select>
      </label>

      <button
        className="border-0 rounded-lg bg-[#c4482a] text-white px-4 py-3 whitespace-nowrap font-bold cursor-pointer shadow-[0_3px_0_#9f321d] hover:bg-[#b03d22] transition-colors"
        onClick={onReset}
      >
        <span className="text-xl align-middle mr-2">↻</span>
        Muat Ulang Data
      </button>
    </section>
  )
}
