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
    jumlah_suara: Number(party.jumlah_suara ?? party.total_suara ?? 0),
  }))
}

function firstRecord(data) {
  if (Array.isArray(data)) return data[0] || null
  return data || null
}

function updatedAtFromData(data) {
  if (Array.isArray(data)) {
    return data
      .map((record) => record?.updated_at || record?.last_updated_at || record?.updatedAt)
      .filter(Boolean)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] || null
  }
  return data?.updated_at || data?.last_updated_at || data?.updatedAt || null
}

function latestUpdatedAt(records) {
  return (Array.isArray(records) ? records : [])
    .map((record) => record?.updated_at || record?.last_updated_at || record?.updatedAt)
    .filter(Boolean)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] || null
}

function aggregateKabupaten(records) {
  const rows = Array.isArray(records) ? records : []
  const direct = rows.find((row) => String(row?.level || '').toUpperCase() === 'KABUPATEN')
  if (direct) return direct

  const source = rows.filter((row) => String(row?.level || '').toUpperCase() === 'KECAMATAN')
  const fallbackSource = source.length
    ? source
    : rows.filter((row) => String(row?.level || '').toUpperCase() === 'DAPIL')

  if (!fallbackSource.length) return null

  return {
    level: 'KABUPATEN',
    wilayah_id: null,
    jumlah_tps: fallbackSource.reduce((sum, row) => sum + Number(row?.jumlah_tps || 0), 0),
    jumlah_tps_terisi: fallbackSource.reduce((sum, row) => sum + Number(row?.jumlah_tps_terisi || 0), 0),
    jumlah_desa: fallbackSource.reduce((sum, row) => sum + Number(row?.jumlah_desa || 0), 0),
    jumlah_kecamatan: source.length || fallbackSource.reduce((sum, row) => sum + Number(row?.jumlah_kecamatan || 0), 0),
    dpt: fallbackSource.reduce((sum, row) => sum + Number(row?.dpt || 0), 0),
    pengguna_hak_pilih: fallbackSource.reduce((sum, row) => sum + Number(row?.pengguna_hak_pilih || 0), 0),
    suara_sah: fallbackSource.reduce((sum, row) => sum + Number(row?.suara_sah || 0), 0),
    suara_tidak_sah: fallbackSource.reduce((sum, row) => sum + Number(row?.suara_tidak_sah || 0), 0),
    updated_at: latestUpdatedAt(fallbackSource),
  }
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
  const [lastUpdated, setLastUpdated] = useState(null)
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
      setLastUpdated(null)
      setLoadingDetail(false)
      setLoadingParties(false)
      return undefined
    }

    let cancelled = false
    setLoadingDetail(true)
    setLoadingParties(true)

    const loadDashboard = async () => {
      if (level === 'tps') {
        const [detailData, partyData] = await Promise.all([
          api.getWilayahDetail({ pemilu_id: pemiluId, tps_id: levelId }),
          api.getSuara(level, levelId, pemiluId),
        ])
        if (cancelled) return
        const tpsDetail = firstRecord(detailData)
        const tpsUpdatedAt = updatedAtFromData(detailData) || updatedAtFromData(partyData)
        setDetail(tpsDetail)
        setParties(normalizeParties(partyData))
        if (tpsUpdatedAt) setLastUpdated(tpsUpdatedAt)
        return
      }

      if (isSpecificRegion) {
        const apiLevel = level.toUpperCase()
        const [summaryData, partyData] = await Promise.all([
          api.getRekapWilayah(pemiluId, apiLevel, levelId),
          api.getRekapWilayahPartai(pemiluId, apiLevel, levelId).catch(() => api.getSuara(level, levelId, pemiluId)),
        ])
        if (cancelled) return
        const regionDetail = firstRecord(summaryData)
        const regionUpdatedAt = updatedAtFromData(summaryData) || updatedAtFromData(partyData)
        setDetail(regionDetail)
        setParties(normalizeParties(partyData))
        if (regionUpdatedAt) setLastUpdated(regionUpdatedAt)
        return
      }

      const [summaryRows, partyRows] = await Promise.all([
        api.getRekapWilayah(pemiluId),
        api.getSuaraKabupaten(pemiluId),
      ])
      if (cancelled) return
      const rows = Array.isArray(summaryRows) ? summaryRows : []
      setDetail(aggregateKabupaten(rows))
      setParties(normalizeParties(partyRows))
      const kabupatenUpdatedAt = latestUpdatedAt(rows) || updatedAtFromData(partyRows)
      if (kabupatenUpdatedAt) setLastUpdated(kabupatenUpdatedAt)
    }

    loadDashboard()
      .catch(() => {
        if (cancelled) return
        setDetail(null)
        setParties([])
      })
      .finally(() => {
        if (cancelled) return
        setLoadingDetail(false)
        setLoadingParties(false)
      })

    return () => { cancelled = true }
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
    setLastUpdated(null)
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

  const handleTableRegionSelect = (nextLevel, id) => {
    if (nextLevel === 'kecamatan') {
      handleKecamatanChange(id)
      return
    }
    if (nextLevel === 'desa') {
      handleDesaChange(id)
      return
    }
    if (nextLevel === 'tps') {
      setTpsId(id)
    }
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

  return (
    <main className="max-w-[1440px] mx-auto min-h-screen px-6 py-6 text-[#332e29] bg-[radial-gradient(circle_at_92%_8%,#fff9e9_0,transparent_25%),#fbf7f0]">
      <Header
        pemiluId={pemiluId}
        onPemiluChange={handlePemiluChange}
        lastUpdated={lastUpdated}
      />
      <FilterBar
        pemiluId={pemiluId}
        dapilId={dapilId}
        kecamatanId={kecamatanId}
        desaId={desaId}
        onDapilChange={handleDapilChange}
        onKecamatanChange={handleKecamatanChange}
        onDesaChange={handleDesaChange}
        onTpsChange={setTpsId}
        refreshDapilToken={refreshTokens.dapil}
        refreshKecamatanToken={refreshTokens.kecamatan}
        refreshDesaToken={refreshTokens.desa}
        refreshTpsToken={refreshTokens.tps}
        onReloadDapil={handleReloadDapil}
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
          <BottomTable
            pemiluId={pemiluId}
            activeLevel={level || 'kabupaten'}
            activeId={levelId}
            parties={parties}
            detail={detail}
            onSelectRegion={handleTableRegionSelect}
          />
        </div>
        <div className="flex flex-col gap-4">
          <PartyTable parties={parties} loading={loadingParties} />
          <DetailPanel detail={isSpecificRegion ? detail : null} parties={parties} />
          <DashboardInfoPanel />
        </div>
      </div>
      <Footer />
    </main>
  )
}

export default App
