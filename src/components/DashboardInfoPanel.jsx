function formatUpdatedAt(value) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export default function DashboardInfoPanel({ lastUpdated }) {
  const formatted = formatUpdatedAt(lastUpdated)

  return (
    <section className="border border-[#e4d9c7] rounded-lg bg-[rgba(255,253,247,0.8)] shadow-sm overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3">
        <span className="text-[#c4482a] text-xl">ⓘ</span>
        <h2 className="m-0 font-bold text-lg [font-family:Georgia,serif]">Keterangan</h2>
      </div>
      <div className="px-4 pb-4 text-sm leading-relaxed text-[#5f554c]">
        <p className="m-0">
          Warna DAPIL membedakan wilayah pemilihan. Pilih wilayah pada peta atau gunakan filter bertingkat untuk mempersempit konteks. Ringkasan dan daftar partai mengikuti wilayah aktif.
        </p>
        {formatted && (
          <p className="mt-3 mb-0 pt-3 border-t border-[#eadfce]">
            <span className="text-xs text-[#82776e]">Data terakhir diperbarui</span><br />
            <strong className="text-[#332e29]">{formatted}</strong>
          </p>
        )}
      </div>
    </section>
  )
}
