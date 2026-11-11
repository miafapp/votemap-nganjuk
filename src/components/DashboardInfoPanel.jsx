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
    <section className="border border-card-border rounded-lg bg-surface/80 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3">
        <span className="text-primary text-xl">ⓘ</span>
        <h2 className="m-0 font-bold text-base sm:text-lg tracking-tight">Keterangan</h2>
      </div>
      <div className="px-4 pb-4 text-sm leading-relaxed text-secondary">
        <p className="m-0">
          Warna DAPIL membedakan wilayah pemilihan. Pilih wilayah pada peta atau gunakan filter bertingkat untuk mempersempit konteks. Ringkasan dan daftar partai mengikuti wilayah aktif.
        </p>
        {formatted && (
          <p className="mt-3 mb-0 pt-3 border-t border-subtle-border">
            <span className="text-xs text-muted">Data terakhir diperbarui</span><br />
            <strong className="text-main">{formatted}</strong>
          </p>
        )}
      </div>
    </section>
  )
}
