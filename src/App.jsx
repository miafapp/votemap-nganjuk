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
  const [loadingDetail, setLoadingDetail] = useState(false)

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
    if (!pemiluId || !level) {
      setDetail(null)
      setParties([])
      setLoadingDetail(false)
      return
    }

    setLoadingDetail(true)
    const apiLevel = level.toUpperCase()

    Promise.all([
      level === 'tps'
        ? api.getWilayahDetail({ pemilu_id: pemiluId, tps_id: levelId })
        : api.getRekapWilayah(pemiluId, apiLevel, levelId),
      api.getSuara(level, levelId, pemiluId)
    ])
      .then(([detailData, partiesData]) => {
        setDetail(Array.isArray(detailData) ? detailData[0] : detailData)
        setParties(partiesData)
      })
      .catch(() => {
        setDetail(null)
        setParties([])
      })
      .finally(() => setLoadingDetail(false))
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

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.7fr)_minmax(230px,0.58fr)] gap-4">
            <MapView 
              pemiluId={pemiluId} 
              dapilId={dapilId} 
              kecamatanId={kecamatanId} 
              desaId={desaId} 
              tpsId={tpsId}
              onDapilClick={handleDapilChange}
              onKecamatanClick={(id) => { setKecamatanId(id); setDesaId(null); setTpsId(null) }}
              onDesaClick={(id) => { setDesaId(id); setTpsId(null) }}
              onTpsClick={setTpsId}
            />
            <SummaryCards detail={detail} loading={loadingDetail} />
          </div>
          <BottomTable pemiluId={pemiluId} kecamatanList={kecamatanList} />
        </div>
        <div className="flex flex-col gap-4">
          <PartyTable parties={parties} loading={loadingDetail} />
          <DetailPanel detail={detail} parties={parties} />
        </div>
      </div>

      <Footer />
    </main>
  )
}

export default App
