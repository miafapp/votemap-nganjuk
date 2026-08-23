import { getPartyLogo } from '../lib/party-logos'

export default function PartyTable({ parties, totalSuara, loading }) {
  const total = totalSuara || parties.reduce((sum, p) => sum + (p.jumlah_suara || 0), 0)

  return (
    <section className="border border-[#e4d9c7] rounded-lg bg-[rgba(255,253,247,0.8)] shadow-sm overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3">
        <span className="text-[#c4482a] text-xl">⚑</span>
        <h2 className="m-0 font-bold text-lg [font-family:Georgia,serif]">Daftar Partai Politik</h2>
      </div>
      <div className="px-3 pb-4 text-xs">
        <div className="grid grid-cols-[28px_1fr_70px_45px] items-center gap-[5px] px-2 py-2 bg-[#c4482a] text-white font-bold rounded-t-md">
          <span>No</span>
          <span>Partai Politik</span>
          <span className="text-right">Suara</span>
          <span className="text-right">%</span>
        </div>
        {loading ? (
          <div className="px-2 py-4 text-[#82776e] text-center">Memuat data...</div>
        ) : parties.length === 0 ? (
          <div className="px-2 py-4 text-[#82776e] text-center">Pilih wilayah untuk melihat data partai</div>
        ) : (
          parties.map((p, i) => (
            <div key={p.partai_id || i} className="grid grid-cols-[28px_1fr_70px_45px] items-center gap-[5px] px-2 py-2 border-b border-[#eadfce]">
              <span>{i + 1}</span>
              <span className="flex items-center gap-1.5">
                <img src={getPartyLogo(p.kode_partai)} alt={p.nama_partai} className="w-[22px] h-[22px] rounded-sm object-cover" />
                {p.nama_partai}
              </span>
              <span className="text-right">{(p.jumlah_suara || 0).toLocaleString('id-ID')}</span>
              <span className="text-right">
                {total > 0 ? ((p.jumlah_suara / total) * 100).toFixed(2).replace('.', ',') : '0,00'}%
              </span>
            </div>
          ))
        )}
      </div>
    </section>
  )
}
