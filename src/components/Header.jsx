import { useEffect, useState } from 'react'
import { api } from '../lib/api'

export default function Header({ pemiluId, onPemiluChange, dapilId, onDapilChange }) {
  const [pemiluList, setPemiluList] = useState([])
  const [dapilList, setDapilList] = useState([])
  const [loadingPemilu, setLoadingPemilu] = useState(false)
  const [loadingDapil, setLoadingDapil] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    setLoadingPemilu(true)
    setError(null)
    api.getPemilu()
      .then((data) => setPemiluList(data))
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
  }, [pemiluId])

  return (
    <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#d8c9b3] px-3">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 border-[3px] border-[#234c4c] rounded-full grid place-content-center text-center text-[8px] leading-[11px] text-[#c4482a] bg-[#e9d8ae] font-extrabold">
          VOTE<br /><span className="text-base text-[#234c4c]">24</span>
        </div>
        <div>
          <h1 className="m-0 font-bold text-[clamp(22px,3vw,34px)] leading-[1.05] [font-family:Georgia,serif]">
            Vote Map Kabupaten Nganjuk
          </h1>
          <p className="text-[#c4482a] mt-1 text-[15px] font-semibold m-0">
            Pemilihan Umum Anggota DPRD Kabupaten Nganjuk
          </p>
        </div>
      </div>

      <div className="flex gap-8 items-center">
        <div className="grid gap-[3px] px-4 py-[7px] min-w-[190px]">
          <span className="text-xs text-[#82776e]">Tahun Pemilihan Umum</span>
          <select
            className="text-[15px] border border-[#e4d9c7] rounded-md px-3 py-2 bg-[#fffdf8] text-[#332e29] cursor-pointer"
            value={pemiluId || ''}
            disabled={loadingPemilu}
            onChange={(e) => onPemiluChange(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">Pilih Tahun...</option>
            {pemiluList.map((p) => (
              <option key={p.id} value={p.id}>{p.tahun}</option>
            ))}
          </select>
        </div>

        <div className="grid gap-[3px] px-4 py-[7px] min-w-[190px] border-l-2 border-[#bfa98e]">
          <span className="text-xs text-[#82776e]">Pilih DAPIL</span>
          <select
            className="text-[15px] border border-[#e4d9c7] rounded-md px-3 py-2 bg-[#fffdf8] text-[#332e29] cursor-pointer disabled:opacity-50"
            value={dapilId || ''}
            disabled={!pemiluId || loadingDapil}
            onChange={(e) => onDapilChange(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">Semua DAPIL</option>
            {dapilList.map((d) => (
              <option key={d.id} value={d.id}>{d.nama}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="w-full mt-2 px-4 py-2 bg-red-50 border border-red-300 rounded-md text-red-700 text-sm">
          {error}
        </div>
      )}
    </header>
  )
}
