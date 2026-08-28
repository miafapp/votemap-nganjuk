import { useEffect, useState } from 'react'
import { api } from '../lib/api'

export default function Header({ pemiluId, onPemiluChange, dapilId, onDapilChange, refreshToken = 0, onReloadDapil }) {
  const [pemiluList, setPemiluList] = useState([])
  const [dapilList, setDapilList] = useState([])
  const [loadingPemilu, setLoadingPemilu] = useState(false)
  const [loadingDapil, setLoadingDapil] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    setLoadingPemilu(true)
    setError(null)
    api.getPemilu()
      .then((data) => {
        setPemiluList(data)
        if (data.length > 0 && !pemiluId) onPemiluChange(data[0].id)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoadingPemilu(false))
  }, [])

  useEffect(() => {
    if (!pemiluId) {
      setDapilList([])
      return
    }
    setLoadingDapil(true)
    api.getDapil(pemiluId)
      .then((data) => setDapilList(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoadingDapil(false))
  }, [pemiluId, refreshToken])

  return (
    <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#d8c9b3] px-3">
      <div className="flex items-center gap-4">
        <img src="/images/favicon.png" alt="VoteMap Nganjuk" className="w-14 h-14 object-contain" />
        <div>
          <h1 className="m-0 font-bold text-[clamp(22px,3vw,34px)] leading-[1.05] [font-family:Georgia,serif]">Vote Map Kabupaten Nganjuk</h1>
          <p className="text-[#c4482a] mt-1 text-[15px] font-semibold m-0">Pemilihan Umum Anggota DPRD Kabupaten Nganjuk</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 sm:gap-8 items-start sm:items-center w-full sm:w-auto">
        <div className="grid gap-[3px] px-4 py-[7px] min-w-[190px] w-full sm:w-auto">
          <span className="text-xs text-[#82776e]">Tahun Pemilihan Umum</span>
          <select className="text-[15px] border border-[#e4d9c7] rounded-md px-3 py-2 bg-[#fffdf8] text-[#332e29] cursor-pointer disabled:opacity-50" value={pemiluId || ''} disabled={loadingPemilu} onChange={(e) => onPemiluChange(e.target.value ? Number(e.target.value) : null)}>
            <option value="">{loadingPemilu ? 'Memuat...' : 'Pilih Tahun...'}</option>
            {pemiluList.map((p) => <option key={p.id} value={p.id}>{p.tahun}</option>)}
          </select>
        </div>

        <div className="grid gap-[3px] px-4 py-[7px] min-w-[220px] border-l-2 border-[#bfa98e] w-full sm:w-auto">
          <span className="text-xs text-[#82776e]">Pilih DAPIL</span>
          <div className="flex items-center gap-2">
            <select className="min-w-0 flex-1 text-[15px] border border-[#e4d9c7] rounded-md px-3 py-2 bg-[#fffdf8] text-[#332e29] cursor-pointer disabled:opacity-50" value={dapilId || ''} disabled={!pemiluId || loadingDapil} onChange={(e) => onDapilChange(e.target.value ? Number(e.target.value) : null)}>
              <option value="">{loadingDapil ? 'Memuat...' : 'Semua DAPIL'}</option>
              {dapilList.map((d) => <option key={d.id} value={d.id}>{d.nama}</option>)}
            </select>
            <button type="button" title="Muat ulang DAPIL" aria-label="Muat ulang DAPIL" onClick={onReloadDapil} disabled={!pemiluId || loadingDapil} className="shrink-0 w-10 h-10 inline-flex items-center justify-center rounded-md border-0 bg-[#c4482a] text-white shadow-[0_3px_0_#9f321d] hover:bg-[#b03d22] disabled:opacity-40 disabled:cursor-not-allowed">↻</button>
          </div>
        </div>
      </div>

      {error && <div className="w-full mt-2 px-4 py-2 bg-red-50 border border-red-300 rounded-md text-red-700 text-sm">{error}</div>}
    </header>
  )
}
