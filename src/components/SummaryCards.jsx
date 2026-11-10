export default function SummaryCards({ detail, loading }) {
  const dpt = detail?.dpt ?? '-'
  const suaraSah = detail?.suara_sah ?? '-'
  const partisipasi = detail && detail.dpt > 0
    ? ((detail.suara_sah / detail.dpt) * 100).toFixed(2).replace('.', ',') + '%'
    : '-'
  const totalPartai = detail?.jumlah_partai ?? 18

  const stats = [
    { icon: '♟', label: 'Total DPT', value: dpt },
    { icon: '▣', label: 'Total Suara Sah', value: suaraSah },
    { icon: '%', label: 'Partisipasi', value: partisipasi },
    { icon: '▥', label: 'Total Partai Politik', value: totalPartai },
  ]

  return (
    <section className="border border-card-border rounded-lg bg-surface/80 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3">
        <span className="text-primary text-xl">▥</span>
        <h2 className="m-0 font-bold text-lg [font-family:Georgia,serif]">Ringkasan Suara</h2>
      </div>
      <div className="grid gap-3 px-4 pb-4">
        {loading ? (
          <div className="flex items-center justify-center h-[72px] text-muted text-sm">
            Memuat data...
          </div>
        ) : (
          stats.map((s) => (
            <div key={s.label} className="flex items-center gap-3 min-h-[72px] px-3 py-2.5 border border-light-border rounded-lg">
              <span className="text-primary text-2xl w-9 text-center">{s.icon}</span>
              <div>
                <small className="block text-xs text-muted">{s.label}</small>
                <strong className="block font-bold text-xl [font-family:Georgia,serif] mt-0.5">
                  {typeof s.value === 'number' ? s.value.toLocaleString('id-ID') : s.value}
                </strong>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  )
}
