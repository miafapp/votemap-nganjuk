import { getPartyLogo } from '../lib/party-logos'

export default function PartyTable({ parties, totalSuara, loading }) {
  const safeParties = Array.isArray(parties) ? parties : []
  const total = Number(totalSuara) || safeParties.reduce((sum, party) => sum + (Number(party?.jumlah_suara) || 0), 0)
  const topParties = [...safeParties]
    .sort((a, b) => (Number(b?.jumlah_suara) || 0) - (Number(a?.jumlah_suara) || 0))
    .slice(0, 10)

  return (
    <section className="border border-card-border rounded-lg bg-surface/80 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3">
        <span className="text-primary text-xl">⚑</span>
        <h2 className="m-0 font-bold text-base sm:text-lg tracking-tight">Top 10 Partai Politik</h2>
      </div>
      <div className="px-3 pb-4 text-xs">
        <div className="grid grid-cols-[28px_1fr_70px_45px] items-center gap-[5px] px-2 py-2 bg-primary text-white font-bold rounded-t-md">
          <span>No</span>
          <span>Partai Politik</span>
          <span className="text-right">Suara</span>
          <span className="text-right">%</span>
        </div>
        {loading ? (
          <div className="px-2 py-4 text-muted text-center">Memuat data...</div>
        ) : topParties.length === 0 ? (
          <div className="px-2 py-4 text-muted text-center">Pilih wilayah untuk melihat data partai</div>
        ) : (
          topParties.map((party, index) => (
            <div key={party.partai_id || party.kode_partai || index} className="grid grid-cols-[28px_1fr_70px_45px] items-center gap-[5px] px-2 py-2 border-b border-subtle-border">
              <span className="tabular-nums">{index + 1}</span>
              <span className="flex items-center gap-1.5 min-w-0">
                <img src={getPartyLogo(party.kode_partai)} alt={party.nama_partai} className="w-[22px] h-[22px] shrink-0 rounded-sm object-cover" />
                <span className="break-words">{party.nama_partai}</span>
              </span>
              <span className="text-right tabular-nums">{(Number(party.jumlah_suara) || 0).toLocaleString('id-ID')}</span>
              <span className="text-right tabular-nums">
                {total > 0 ? (((Number(party.jumlah_suara) || 0) / total) * 100).toFixed(2).replace('.', ',') : '0,00'}%
              </span>
            </div>
          ))
        )}
      </div>
    </section>
  )
}
