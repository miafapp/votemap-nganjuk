export default function DetailPanel({ detail, parties }) {
  const hasDetail = detail !== null

  return (
    <section className="border border-[#e4d9c7] rounded-lg bg-[rgba(255,253,247,0.8)] shadow-sm overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3">
        <span className="text-[#c4482a] text-xl">●</span>
        <h2 className="m-0 font-bold text-lg [font-family:Georgia,serif]">Detail Wilayah</h2>
      </div>
      {!hasDetail ? (
        <div className="px-4 pb-4">
          <p className="text-[#82776e] text-sm leading-relaxed m-0">
            Pilih area pada peta<br />atau gunakan panel filter untuk melihat detail data.
          </p>
        </div>
      ) : (
        <div className="px-4 pb-4 space-y-3">
          <div className="grid grid-cols-2 gap-2 text-sm">
            {detail.nama && <div><span className="text-[#82776e] text-xs">Wilayah:</span><br /><strong>{detail.nama}</strong></div>}
            {detail.dpt !== undefined && <div><span className="text-[#82776e] text-xs">DPT:</span><br /><strong>{detail.dpt?.toLocaleString('id-ID')}</strong></div>}
            {detail.suara_sah !== undefined && <div><span className="text-[#82776e] text-xs">Suara Sah:</span><br /><strong>{detail.suara_sah?.toLocaleString('id-ID')}</strong></div>}
            {detail.suara_tidak_sah !== undefined && <div><span className="text-[#82776e] text-xs">Suara Tidak Sah:</span><br /><strong>{detail.suara_tidak_sah?.toLocaleString('id-ID')}</strong></div>}
            {detail.jumlah_tps !== undefined && <div><span className="text-[#82776e] text-xs">Jumlah TPS:</span><br /><strong>{detail.jumlah_tps}</strong></div>}
            {detail.jumlah_desa !== undefined && <div><span className="text-[#82776e] text-xs">Jumlah Desa:</span><br /><strong>{detail.jumlah_desa}</strong></div>}
            {detail.jumlah_kecamatan !== undefined && <div><span className="text-[#82776e] text-xs">Jumlah Kecamatan:</span><br /><strong>{detail.jumlah_kecamatan}</strong></div>}
          </div>
        </div>
      )}
    </section>
  )
}
