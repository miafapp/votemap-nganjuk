import { useMemo, useState } from 'react'
import './App.css'

const parties = [
  ['01', 'PKB', '256.789', '25,36%', 'green'],
  ['02', 'Gerindra', '198.432', '19,56%', 'red'],
  ['03', 'PDI Perjuangan', '176.543', '17,42%', 'black'],
  ['04', 'Golkar', '142.331', '14,03%', 'yellow'],
  ['05', 'NasDem', '120.114', '11,87%', 'blue'],
  ['06', 'Partai Buruh', '98.765', '9,76%', 'orange'],
  ['07', 'Gelora Indonesia', '76.543', '7,56%', 'cyan'],
]

const rows = [
  ['Sawahan', '1.234', '245.678', '202.345', '51.234', '41.123', '36.789', '29.876', '25.432'],
  ['Ngetos', '987', '198.765', '164.321', '42.345', '33.567', '29.876', '24.567', '20.123'],
  ['Berbek', '1.156', '221.456', '181.234', '46.789', '37.654', '32.456', '26.789', '22.345'],
  ['Loceret', '1.045', '210.345', '172.345', '43.210', '34.567', '30.123', '24.789', '20.987'],
  ['Pace', '1.098', '193.456', '156.100', '38.987', '31.521', '27.299', '22.310', '18.236'],
]

function App() {
  const [filters, setFilters] = useState({ dapil: 'Semua DAPIL', kecamatan: 'Semua Kecamatan', desa: 'Semua Desa / Kelurahan', tps: 'Semua TPS' })
  const [query, setQuery] = useState('')
  const [refreshed, setRefreshed] = useState('14 Feb 2024 12:30 WIB')

  const filteredRows = useMemo(() => rows.filter((row) => row[0].toLowerCase().includes(query.toLowerCase())), [query])
  const updateFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }))

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><div className="seal">VOTE<br /><span>24</span></div><div><h1>Vote Map Kabupaten Nganjuk</h1><p>Pemilihan Umum Anggota DPRD Kabupaten Nganjuk</p></div></div>
        <div className="top-meta"><div><span>Tahun Pemilihan Umum</span><strong>2024 <b>⌄</b></strong></div><div className="updated"><span>Data Terakhir Diperbarui</span><strong>◷ {refreshed}</strong></div></div>
      </header>

      <section className="filters">
        {Object.entries(filters).map(([key, value]) => <label key={key}>{getFilterLabel(key)}<select value={value} onChange={(event) => updateFilter(key, event.target.value)}><option>{value}</option><option>Wilayah Terpilih</option><option>Semua Wilayah</option></select></label>)}
        <button className="reload" onClick={() => setRefreshed('Baru saja')}><span>↻</span> Muat Ulang Data</button>
      </section>

      <div className="dashboard-grid">
        <section className="panel map-panel"><PanelTitle icon="◆" title="Peta Wilayah Kabupaten Nganjuk" /><div className="map-content"><div className="legend"><strong>DAPIL</strong>{[['dapil-one','NGANJUK 1'],['dapil-two','NGANJUK 2'],['dapil-three','NGANJUK 3'],['dapil-four','NGANJUK 4'],['dapil-five','NGANJUK 5']].map(([color, name]) => <span key={name}><i className={color} />{name}</span>)}</div><div className="map-shape" aria-label="Peta wilayah dapil Kabupaten Nganjuk"><div className="district d1">NGANJUK 1<small>10 KURSI</small></div><div className="district d2">NGANJUK 2<small>10 KURSI</small></div><div className="district d3">NGANJUK 3<small>10 KURSI</small></div><div className="district d4">NGANJUK 4<small>10 KURSI</small></div><div className="district d5">NGANJUK 5<small>10 KURSI</small></div></div></div></section>

        <section className="panel summary-panel"><PanelTitle icon="▥" title="Ringkasan Suara" /><div className="summary-list"><Stat icon="♟" label="Total DPT" value="1.234.567" /><Stat icon="▣" label="Total Suara Sah" value="1.012.345" /><Stat icon="%" label="Partisipasi" value="82,03%" /><Stat icon="▥" label="Total Partai Politik" value="18" /></div></section>

        <section className="panel parties-panel"><PanelTitle icon="⚑" title="Daftar Partai Politik" /><div className="party-table"><div className="party-head"><span>No</span><span>Partai Politik</span><span>Suara</span><span>%</span></div>{parties.map(([number, name, votes, percent, color]) => <div className="party-row" key={name}><span>{number}</span><span><i className={`party-mark ${color}`}>{number}</i>{name}</span><span>{votes}</span><span>{percent}</span></div>)}</div></section>

        <section className="panel detail-panel"><PanelTitle icon="●" title="Detail Wilayah" /><p>Pilih area pada peta<br />atau gunakan panel filter untuk melihat detail data.</p><button className="outline-button" onClick={() => setFilters({ dapil: 'Semua DAPIL', kecamatan: 'Semua Kecamatan', desa: 'Semua Desa / Kelurahan', tps: 'Semua TPS' })}>Reset pilihan</button></section>

        <section className="panel data-panel"><PanelTitle icon="♟" title="Data Perolehan Suara per Wilayah" /><div className="table-toolbar"><strong>(Kecamatan - Desa/Kelurahan - TPS)</strong><label className="search"><span>⌕</span><input placeholder="Cari kecamatan..." value={query} onChange={(event) => setQuery(event.target.value)} /></label></div><div className="data-scroll"><table><thead><tr><th>No</th><th>Nama Kecamatan</th><th>Jml<br />Desa/Kel</th><th>TPS</th><th>DPT</th>{['PKB','Gerindra','PDI-P','Golkar','NasDem','Buruh','PKS','PAN','PPP','Demokrat','PSI','Perindo'].map((party) => <th key={party}>{party}</th>)}</tr></thead><tbody>{filteredRows.map((row, index) => <tr key={row[0]}><td>{index + 1}</td>{row.map((cell, cellIndex) => <td key={`${row[0]}-${cellIndex}`} className={cellIndex === 0 ? 'place' : ''}>{cell}</td>)}{Array.from({ length: 8 }, (_, extra) => <td key={extra}>{(987 - extra * 73).toLocaleString('id-ID')}</td>)}</tr>)}</tbody></table></div></section>
      </div>

      <aside className="notes panel"><PanelTitle icon="ⓘ" title="Keterangan" /><p><i className="dapil-one" />Warna menunjukkan DAPIL</p><p><i className="dapil-four" />Klik pada wilayah untuk melihat detail data</p><p><i className="dapil-two" />Pilih filter untuk menampilkan data sesuai wilayah</p><p><i className="info-dot">i</i>Data akan diperbarui secara berkala</p></aside>
    </main>
  )
}

function PanelTitle({ icon, title }) { return <div className="panel-title"><span>{icon}</span><h2>{title}</h2></div> }
function Stat({ icon, label, value }) { return <div className="stat"><span className="stat-icon">{icon}</span><div><small>{label}</small><strong>{value}</strong></div></div> }
function getFilterLabel(key) { return { dapil: 'Pilih DAPIL', kecamatan: 'Pilih Kecamatan', desa: 'Pilih Desa / Kelurahan', tps: 'Pilih TPS' }[key] }

export default App
