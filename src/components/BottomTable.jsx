import { useState } from 'react'
import React from 'react'
import { api } from '../lib/api'
import { getPartyLogo } from '../lib/party-logos'

export default function BottomTable({ pemiluId, kecamatanList }) {
  const [expandedId, setExpandedId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [partyData, setPartyData] = useState([])
  const [error, setError] = useState(null)

  const handleExpand = async (kecId) => {
    if (expandedId === kecId) {
      setExpandedId(null)
      return
    }
    setExpandedId(kecId)
    if (!pemiluId) return
    setLoading(true)
    setError(null)
    try {
      const data = await api.getSuara('kecamatan', kecId, pemiluId)
      setPartyData(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="border border-[#e4d9c7] rounded-lg bg-[rgba(255,253,247,0.8)] shadow-sm overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3">
        <span className="text-[#c4482a] text-xl">♟</span>
        <h2 className="m-0 font-bold text-lg [font-family:Georgia,serif]">Data Perolehan Suara per Wilayah</h2>
      </div>
      <div className="px-4 pb-3 text-xs text-[#82776e] flex justify-between items-center">
        <strong>(Kecamatan - Desa/Kelurahan - TPS)</strong>
      </div>
      <div className="overflow-x-auto px-3 pb-3">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="text-[#8d4838] bg-[#fff9ed] font-bold whitespace-nowrap px-2 py-2 border border-[#ecdfcb] text-center">No</th>
              <th className="text-[#8d4838] bg-[#fff9ed] font-bold whitespace-nowrap px-2 py-2 border border-[#ecdfcb] text-left">Nama Kecamatan</th>
              <th className="text-[#8d4838] bg-[#fff9ed] font-bold whitespace-nowrap px-2 py-2 border border-[#ecdfcb] text-center">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {kecamatanList.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-2 py-4 text-center text-[#82776e] border border-[#ecdfcb]">
                  Pilih tahun pemilu untuk melihat data kecamatan
                </td>
              </tr>
            ) : (
              kecamatanList.map((kec, i) => (
                <React.Fragment key={kec.id || kec.kecamatan_id}>
                  <tr key={`row-${kec.id || kec.kecamatan_id}`}>
                    <td className="px-2 py-2 border border-[#ecdfcb] text-center">{i + 1}</td>
                    <td className="px-2 py-2 border border-[#ecdfcb] font-bold text-left">{kec.nama || kec.kecamatan}</td>
                    <td className="px-2 py-2 border border-[#ecdfcb] text-center">
                      <button
                        className="px-2 py-1 border border-[#c4482a] text-[#c4482a] rounded bg-transparent cursor-pointer text-xs hover:bg-[#c4482a] hover:text-white transition-colors"
                        onClick={() => handleExpand(kec.id || kec.kecamatan_id)}
                      >
                        {expandedId === (kec.id || kec.kecamatan_id) ? 'Tutup' : 'Lihat Detail'}
                      </button>
                    </td>
                  </tr>
                  {expandedId === (kec.id || kec.kecamatan_id) && (
                    <tr key={`expanded-${kec.id || kec.kecamatan_id}`}>
                      <td colSpan={3} className="px-2 py-2 border border-[#ecdfcb] bg-[#fff9ed]">
                        {loading ? (
                          <div className="text-center py-4 text-[#82776e]">Memuat data suara...</div>
                        ) : error ? (
                          <div className="text-center py-4 text-red-600">{error}</div>
                        ) : partyData.length === 0 ? (
                          <div className="text-center py-4 text-[#82776e]">Tidak ada data suara</div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {partyData.map((p, j) => (
                              <div key={p.partai_id || j} className="flex items-center gap-2 px-2 py-1.5 border border-[#eee3d1] rounded">
                                <img src={getPartyLogo(p.kode_partai)} alt={p.nama_partai} className="w-6 h-6 rounded-sm object-cover" />
                                <span className="font-bold text-xs flex-1">{p.kode_partai}</span>
                                <span className="text-xs">{(p.jumlah_suara || 0).toLocaleString('id-ID')}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
