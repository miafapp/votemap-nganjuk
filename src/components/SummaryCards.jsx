export default function SummaryCards({ detail }) {
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
    <section className="border border-[#e4d9c7] rounded-lg bg-[rgba(255,253,247,0.8)] shadow-sm overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3">
        <span className="text-[#c4482a] text-xl">▥</span>
        <h2 className="m-0 font-bold text-lg [font-family:Georgia,serif]">Ringkasan Suara</h2>
      </div>
      <div className="grid gap-3 px-4 pb-4">
        {stats.map((s) => (
          <div key={s.label} className="flex items-center gap-3 min-h-[72px] px-3 py-2.5 border border-[#eee3d1] rounded-lg">
            <span className="text-[#c4482a] text-2xl w-9 text-center">{s.icon}</span>
            <div>
              <small className="block text-xs text-[#82776e]">{s.label}</small>
              <strong className="block font-bold text-xl [font-family:Georgia,serif] mt-0.5">
                {typeof s.value === 'number' ? s.value.toLocaleString('id-ID') : s.value}
              </strong>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
