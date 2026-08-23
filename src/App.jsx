import { useEffect, useState } from 'react'
import Header from './components/Header'
import FilterBar from './components/FilterBar'
import MapView from './components/MapView'
import SummaryCards from './components/SummaryCards'
import PartyTable from './components/PartyTable'
import DetailPanel from './components/DetailPanel'
import BottomTable from './components/BottomTable'
import Footer from './components/Footer'
import { api } from './lib/api'

function App() {
  const [pemiluId, setPemiluId] = useState(null)
  const [dapilId, setDapilId] = useState(null)
  const [kecamatanId, setKecamatanId] = useState(null)
  const [desaId, setDesaId] = useState(null)
  const [tpsId, setTpsId] = useState(null)

  const [kecamatanList, setKecamatanList] = useState([])
  const [detail, setDetail] = useState(null)
  const [parties, setParties] = useState([])

  const level = tpsId ? 'tps' : desaId ? 'desa' : kecamatanId ? 'kecamatan' : dapilId ? 'dapil' : null
  const levelId = tpsId || desaId || kecamatanId || dapilId

  useEffect(() => {
    if (!pemiluId) {
      setKecamatanList([])
      return
    }
    api.getKecamatan(pemiluId, dapilId)
      .then((data) => setKecamatanList(data))
      .catch(() => setKecamatanList([]))
  }, [pemiluId, dapilId])

  useEffect(() => {
    if (!level || !levelId || !pemiluId) {
      setDetail(null)
      setParties([])
      return
    }
    const params = {}
    if (level === 'dapil') params.dapil_id = levelId
    if (level === 'kecamatan') params.kecamatan_id = levelId
    if (level === 'desa') params.desa_id = levelId
    if (level === 'tps') params.tps_id = levelId
    params.pemilu_id = pemiluId

    api.getWilayahDetail(params)
      .then((data) => setDetail(Array.isArray(data) ? data[0] : data))
      .catch(() => setDetail(null))

    api.getSuara(level, levelId, pemiluId)
      .then((data) => setParties(data))
      .catch(() => setParties([]))
  }, [level, levelId, pemiluId])

  const handleReset = () => {
    setDapilId(null)
    setKecamatanId(null)
    setDesaId(null)
    setTpsId(null)
  }

  const handlePemiluChange = (id) => {
    setPemiluId(id)
    setDapilId(null)
    setKecamatanId(null)
    setDesaId(null)
    setTpsId(null)
  }

  const handleDapilChange = (id) => {
    setDapilId(id)
    setKecamatanId(null)
    setDesaId(null)
    setTpsId(null)
  }

  return (
    <main className="max-w-[1440px] mx-auto min-h-screen px-6 py-6 text-[#332e29] bg-[radial-gradient(circle_at_92%_8%,#fff9e9_0,transparent_25%),#fbf7f0]">
      <Header
        pemiluId={pemiluId}
        onPemiluChange={handlePemiluChange}
        dapilId={dapilId}
        onDapilChange={handleDapilChange}
      />

      <FilterBar
        pemiluId={pemiluId}
        dapilId={dapilId}
        kecamatanId={kecamatanId}
        desaId={desaId}
        onKecamatanChange={(id) => { setKecamatanId(id); setDesaId(null); setTpsId(null) }}
        onDesaChange={(id) => { setDesaId(id); setTpsId(null) }}
        onTpsChange={setTpsId}
        onReset={handleReset}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.7fr)_minmax(230px,0.58fr)_minmax(280px,0.78fr)] gap-4">
        <div className="lg:col-span-1 lg:row-span-1">
          <MapView />
        </div>
        <div className="lg:col-span-1 lg:row-span-1">
          <SummaryCards detail={detail} />
        </div>
        <div className="lg:col-span-1 lg:row-span-2 flex flex-col gap-4">
          <PartyTable parties={parties} />
          <DetailPanel detail={detail} parties={parties} />
        </div>
        <div className="lg:col-span-2">
          <BottomTable pemiluId={pemiluId} kecamatanList={kecamatanList} />
        </div>
      </div>

      <Footer />
    </main>
  )
}

export default App
