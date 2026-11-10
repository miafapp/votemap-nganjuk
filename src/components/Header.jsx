import { useEffect, useState } from 'react'
import { api } from '../lib/api'

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

  return (
    <header className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-4 border-b border-divider px-3">
      <div className="flex items-center gap-4">
        <img src="/images/favicon.png" alt="VoteMap Nganjuk" className="w-14 h-14 object-contain" />
        <div>
          <h1 className="m-0 font-bold text-[clamp(22px,3vw,34px)] leading-[1.05] [font-family:Georgia,serif]">Vote Map Kabupaten Nganjuk</h1>
          <p className="text-primary mt-1 text-[15px] font-semibold m-0">Pemilihan Umum Anggota DPRD Kabupaten Nganjuk</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-stretch sm:items-center w-full lg:w-auto">
        <div className="grid gap-[3px] px-4 py-[7px] min-w-[190px] w-full sm:w-auto">
          <span className="text-xs text-muted">Tahun Pemilihan Umum</span>
          <select className="text-[15px] border border-card-border rounded-md px-3 py-2 bg-surface text-main cursor-pointer disabled:opacity-50" value={pemiluId || ''} disabled={loadingPemilu} onChange={(e) => onPemiluChange(e.target.value ? Number(e.target.value) : null)}>
            <option value="">{loadingPemilu ? 'Memuat...' : 'Pilih Tahun...'}</option>
            {pemiluList.map((p) => <option key={p.id} value={p.id}>{p.tahun}</option>)}
          </select>
        </div>

        <div className="grid gap-[3px] px-4 py-[7px] min-w-[240px] border-l-2 border-accent-border w-full sm:w-auto">
          <span className="text-xs text-muted">Status data terakhir diperbarui</span>
          <strong className="text-[15px] font-semibold text-main leading-10 whitespace-nowrap">
            {formatUpdatedAt(lastUpdated)}
          </strong>
        </div>
      </div>

      {error && <div className="w-full mt-2 px-4 py-2 bg-red-50 border border-red-300 rounded-md text-red-700 text-sm">{error}</div>}
    </header>
  )
}
