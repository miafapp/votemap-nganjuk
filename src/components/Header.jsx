import { useEffect, useState } from 'react'
import { api } from '../lib/api'

const FALLBACK_PEMILU_LIST = [
  { id: 1, tahun: 2024 },
]

function formatUpdatedAt(value) {
  if (!value) return 'Belum tersedia'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export default function Header({ pemiluId, onPemiluChange, lastUpdated }) {
  const [pemiluList, setPemiluList] = useState([])
  const [loadingPemilu, setLoadingPemilu] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoadingPemilu(true)
    setError(null)

    api.getPemilu()
      .then((data) => {
        if (cancelled) return
        const list = Array.isArray(data) && data.length > 0 ? data : FALLBACK_PEMILU_LIST
        setPemiluList(list)
        if (list.length > 0 && !pemiluId) onPemiluChange(list[0].id)
      })
      .catch(() => {
        if (cancelled) return
        setPemiluList(FALLBACK_PEMILU_LIST)
        if (!pemiluId) onPemiluChange(FALLBACK_PEMILU_LIST[0].id)
        setError(null)
      })
      .finally(() => {
        if (!cancelled) setLoadingPemilu(false)
      })

    return () => { cancelled = true }
  }, [])

  return (
    <header className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-4 border-b border-[#d8c9b3] px-3">
      <div className="flex items-center gap-4">
        <img src="/images/favicon.png" alt="VoteMap Nganjuk" className="w-14 h-14 object-contain" />
        <div>
          <h1 className="m-0 font-bold text-[clamp(22px,3vw,34px)] leading-[1.05] [font-family:Georgia,serif]">Vote Map Kabupaten Nganjuk</h1>
          <p className="text-[#c4482a] mt-1 text-[15px] font-semibold m-0">Pemilihan Umum Anggota DPRD Kabupaten Nganjuk</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-stretch sm:items-center w-full lg:w-auto">
        <div className="grid gap-[3px] px-4 py-[7px] min-w-[190px] w-full sm:w-auto">
          <span className="text-xs text-[#82776e]">Tahun Pemilihan Umum</span>
          <select className="text-[15px] border border-[#e4d9c7] rounded-md px-3 py-2 bg-[#fffdf8] text-[#332e29] cursor-pointer disabled:opacity-50" value={pemiluId || ''} disabled={loadingPemilu} onChange={(e) => onPemiluChange(e.target.value ? Number(e.target.value) : null)}>
            <option value="">{loadingPemilu ? 'Memuat...' : 'Pilih Tahun...'}</option>
            {pemiluList.map((p) => <option key={p.id} value={p.id}>{p.tahun}</option>)}
          </select>
        </div>

        <div className="grid gap-[3px] px-4 py-[7px] min-w-[240px] border-l-2 border-[#bfa98e] w-full sm:w-auto">
          <span className="text-xs text-[#82776e]">Status data terakhir diperbarui</span>
          <strong className="text-[15px] font-semibold text-[#332e29] leading-10 whitespace-nowrap">
            {formatUpdatedAt(lastUpdated)}
          </strong>
        </div>
      </div>
    </header>
  )
}
