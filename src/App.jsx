import { useEffect, useState } from 'react'
import Header from './components/Header'
import FilterBar from './components/FilterBar'
import MapView from './components/MapView'
import SummaryCards from './components/SummaryCards'
import PartyTable from './components/PartyTable'
import DetailPanel from './components/DetailPanel'
import DashboardInfoPanel from './components/DashboardInfoPanel'
import BottomTable from './components/BottomTable'
import Footer from './components/Footer'
import { api } from './lib/api'

const PARTY_CODES = {
  PKB: 'PKB', Gerindra: 'GERINDRA', 'PDI Perjuangan': 'PDI-P', Golkar: 'GOLKAR', NasDem: 'NASDEM', Buruh: 'BURUH', Gelora: 'GELORA', PKS: 'PKS', PKN: 'PKN', Hanura: 'HANURA', Garuda: 'GARUDA', PAN: 'PAN', PBB: 'PBB', Demokrat: 'DEMOKRAT', PSI: 'PSI', Perindo: 'PERINDO', PPP: 'PPP', Ummat: 'UMMAT',
}

function normalizeParties(parties) {
  return (Array.isArray(parties) ? parties : []).map((party) => ({
    ...party,
    kode_partai: party.kode_partai || PARTY_CODES[party.singkatan] || party.singkatan || '',
    nama_partai: party.nama_partai || party.singkatan || '',
    jumlah_suara: party.jumlah_suara ?? party.total_suara ?? 0,
  }))
}

function firstRecord(data) {
  if (Array.isArray(data)) return data[0] || null
  return data || null
}

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
  const [loadingParties, setLoadingParties] = useState(false)
  const [refreshTokens, setRefreshTokens] = useState({ dapil: 0, kecamatan: 0, desa: 0, tps: 0 })

  const level = tpsId ? 'tps' : desaId ? 'desa' : kecamatanId ? 'kecamatan' : dapilId ? 'dapil' : null
  const levelId = tpsId || desaId || kecamatanId || dapilId
  const isSpecificRegion = Boolean(level)

  const bumpRefresh = (name) => {
    setRefreshTokens((current) => ({ ...current, [name]: current[name] + 1 }))
  }

  useEffect(() => {
    if (!pemiluId) {
      setKecamatanList([])
      return
    }
    api.getKecamatan(pemiluId, dapilId).then(setKecamatanList).catch(() => setKecamatanList([]))
  }, [pemiluId, dapilId, refreshTokens.kecamatan])

  useEffect(() => {
    if (!pemiluId) {
      setDetail(null)
      setParties([])
      setLoadingDetail(false)
      setLoadingParties(false)
      return
    }

    setLoadingDetail(true)
    setLoadingParties(true)

    const apiLevel = isSpecificRegion ? level.toUpperCase() : 'KABUPATEN'
    const detailRequest = level === 'tps'
      ? api.getWilayahDetail({ pemilu_id: pemiluId, tps_id: levelId })
      : api.getRekapWilayah(pemiluId, apiLevel, isSpecificRegion ? levelId : undefined)

    detailRequest
      .then((data) => setDetail(firstRecord(data)))
      .catch(() => setDetail(null))
      .finally(() => setLoadingDetail(false))

    if (level === 'tps') {
      api.getSuara(level, levelId, pemiluId)
        .then((data) => setParties(normalizeParties(data)))
        .catch(() => setParties([]))
        .finally(() => setLoadingParties(false))
      return
    }

    api.getRekapWilayahPartai(pemiluId, apiLevel, isSpecificRegion ? levelId : undefined)
      .then((data) => {
        const normalized = normalizeParties(data)
        if (normalized.length > 0 || !isSpecificRegion) {
          setParties(normalized)
          return null
        }
        return api.getSuara(level, levelId, pemiluId).then((fallback) => setParties(normalizeParties(fallback)))
      })
      .catch(() => setParties([]))
      .finally(() => setLoadingParties(false))
  }, [level, levelId, pemiluId, isSpecificRegion])

  const resetRegion = () => {
    setDapilId(null)
    setKecamatanId(null)
    setDesaId(null)
    setTpsId(null)
  }

  const handlePemiluChange = (id) => {
    setPemiluId(id)
    resetRegion()
    setRefreshTokens({ dapil: 0, kecamatan: 0, desa: 0, tps: 0 })
  }

  const handleDapilChange = (id) => {
    setDapilId(id)
    setKecamatanId(null)
    setDesaId(null)
    setTpsId(null)
  }

  const handleKecamatanChange = (id) => {
    setKecamatanId(id)
    setDesaId(null)
    setTpsId(null)
  }

  const handleDesaChange = (id) => {
    setDesaId(id)
    setTpsId(null)
  }

  const handleReloadDapil = () => {
    resetRegion()
    bumpRefresh('dapil')
  }

  const handleReloadKecamatan = () => {
    setKecamatanId(null)
    setDesaId(null)
    setTpsId(null)
    bumpRefresh('kecamatan')
  }

  const handleReloadDesa = () => {
    setDesaId(null)
    setTpsId(null)
    bumpRefresh('desa')
  }

  const handleReloadTps = () => {
    setTpsId(null)
    bumpRefresh('tps')
  }

  const handleBackToParent = () => {
    if (tpsId) {
      setTpsId(null)
      return
    }
    if (desaId) {
      setDesaId(null)
      setTpsId(null)
      return
    }
    if (kecamatanId) {
      setKecamatanId(null)
      setDesaId(null)
      setTpsId(null)
      return
    }
    if (dapilId) resetRegion()
  }

  const lastUpdated = detail?.updated_at || detail?.last_updated_at || detail?.updatedAt || null

  return (
    <main className="max-w-[1440px] mx-auto min-h-screen px-6 py-6 text-[#332e29] bg-[radial-gradient(circle_at_92%_8%,#fff9e9_0,transparent_25%),#fbf7f0]">
      <Header
        pemiluId={pemiluId}
        onPemiluChange={handlePemiluChange}
        dapilId={dapilId}
        onDapilChange={handleDapilChange}
        refreshToken={refreshTokens.dapil}
        onReloadDapil={handleReloadDapil}
      />
      <FilterBar
        pemiluId={pemiluId}
        dapilId={dapilId}
        kecamatanId={kecamatanId}
        desaId={desaId}
        onKecamatanChange={handleKecamatanChange}
        onDesaChange={handleDesaChange}
        onTpsChange={setTpsId}
        refreshKecamatanToken={refreshTokens.kecamatan}
        refreshDesaToken={refreshTokens.desa}
        refreshTpsToken={refreshTokens.tps}
        onReloadKecamatan={handleReloadKecamatan}
        onReloadDesa={handleReloadDesa}
        onReloadTps={handleReloadTps}
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
              tpsRefreshToken={refreshTokens.tps}
              onDapilClick={handleDapilChange}
              onKecamatanClick={handleKecamatanChange}
              onDesaClick={handleDesaChange}
              onTpsClick={setTpsId}
              onBack={handleBackToParent}
            />
            <SummaryCards detail={detail} loading={loadingDetail} />
          </div>
          <BottomTable pemiluId={pemiluId} kecamatanList={kecamatanList} />
        </div>
        <div className="flex flex-col gap-4">
          <PartyTable parties={parties} loading={loadingParties} />
          <DetailPanel detail={isSpecificRegion ? detail : null} parties={parties} />
          <DashboardInfoPanel lastUpdated={lastUpdated} />
        </div>
      </div>
      <Footer />
    </main>
  )
}

export default App
