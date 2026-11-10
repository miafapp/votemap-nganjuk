import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { getPartyLogo } from '../lib/party-logos'

export default function DetailPanel({ detail, parties }) {
  const hasDetail = detail !== null

  const chartData = parties.map((p) => ({
    name: p.kode_partai,
    suara: p.jumlah_suara || 0,
    nama: p.nama_partai,
  })).sort((a, b) => b.suara - a.suara)

  return (
    <section className="border border-card-border rounded-lg bg-surface/80 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3">
        <span className="text-primary text-xl">●</span>
        <h2 className="m-0 font-bold text-lg [font-family:Georgia,serif]">Detail Wilayah</h2>
      </div>
      {!hasDetail ? (
        <div className="px-4 pb-4">
          <p className="text-muted text-sm leading-relaxed m-0">
            Pilih area pada peta<br />atau gunakan panel filter untuk melihat detail data.
          </p>
        </div>
      ) : (
        <div className="px-4 pb-4 space-y-3">
          <div className="grid grid-cols-2 gap-2 text-sm">
            {detail.nama && <div><span className="text-muted text-xs">Wilayah:</span><br /><strong>{detail.nama}</strong></div>}
            {detail.dpt !== undefined && <div><span className="text-muted text-xs">DPT:</span><br /><strong>{detail.dpt?.toLocaleString('id-ID')}</strong></div>}
            {detail.suara_sah !== undefined && <div><span className="text-muted text-xs">Suara Sah:</span><br /><strong>{detail.suara_sah?.toLocaleString('id-ID')}</strong></div>}
            {detail.suara_tidak_sah !== undefined && <div><span className="text-muted text-xs">Suara Tidak Sah:</span><br /><strong>{detail.suara_tidak_sah?.toLocaleString('id-ID')}</strong></div>}
            {detail.jumlah_tps !== undefined && <div><span className="text-muted text-xs">Jumlah TPS:</span><br /><strong>{detail.jumlah_tps}</strong></div>}
            {detail.jumlah_desa !== undefined && <div><span className="text-muted text-xs">Jumlah Desa:</span><br /><strong>{detail.jumlah_desa}</strong></div>}
            {detail.jumlah_kecamatan !== undefined && <div><span className="text-muted text-xs">Jumlah Kecamatan:</span><br /><strong>{detail.jumlah_kecamatan}</strong></div>}
          </div>

          {chartData.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-bold text-muted mb-2">Perolehan Suara Partai</h3>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-card-border)" />
                    <XAxis type="number" hide />
                    <YAxis 
                      type="category" 
                      dataKey="name" 
                      tick={{ fontSize: 10, fill: 'var(--color-muted)' }}
                      width={45}
                      tickFormatter={(value) => value}
                    />
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload
                          return (
                            <div className="bg-white p-2 rounded shadow border border-card-border text-xs">
                              <div className="flex items-center gap-2 mb-1">
                                <img src={getPartyLogo(data.name)} alt={data.nama} className="w-4 h-4 rounded-sm" />
                                <strong>{data.nama}</strong>
                              </div>
                              <div>Suara: {data.suara.toLocaleString('id-ID')}</div>
                            </div>
                          )
                        }
                        return null
                      }}
                    />
                    <Bar dataKey="suara" fill="#E8442B" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
