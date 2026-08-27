import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, GeoJSON, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { api } from '../lib/api'

const DAPIL_COLORS = ['#E8442B', '#F5A623', '#22C55E', '#14B8A6', '#8B5CF6']
const DEFAULT_MAP_CENTER = [-7.6, 111.9]
const DEFAULT_MAP_ZOOM = 10

function MapController({ bounds }) {
  const map = useMap()
  useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds)
    } else {
      map.setView(DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM)
    }
  }, [bounds, map])
  return null
}

const tpsIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM6c3ZnPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxjaXJjbGUgY3g9IjEyIiBjeT0iMTIiIHI9IjEwIiBmaWxsPSIjYzQ0ODJhIi8+CjxjaXJjbGUgY3g9IjEyIiBjeT0iMTIiIHI9IjYiIGZpbGw9IiNmZmYiLz4KPC9zdmc+',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  popupAnchor: [0, -12],
})

export default function MapView({ pemiluId, dapilId, kecamatanId, desaId, tpsId, onDapilClick, onKecamatanClick, onDesaClick, onTpsClick }) {
  const [dapilGeoJson, setDapilGeoJson] = useState(null)
  const [kecamatanGeoJson, setKecamatanGeoJson] = useState(null)
  const [desaGeoJson, setDesaGeoJson] = useState(null)
  const [tpsMarkers, setTpsMarkers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedBounds, setSelectedBounds] = useState(null)
  const mapRef = useRef()

  useEffect(() => {
    setLoading(true)
    setError(null)
    Promise.all([
      fetch('/geojson/dapil-nganjuk.geojson').then(r => r.json()),
      fetch('/geojson/nganjuk-kecamatan.geojson').then(r => r.json()),
      fetch('/geojson/nganjuk-desa.geojson').then(r => r.json()),
    ])
      .then(([dapil, kecamatan, desa]) => {
        setDapilGeoJson(dapil)
        setKecamatanGeoJson(kecamatan)
        setDesaGeoJson(desa)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    if (desaId && pemiluId) {
      api.getGisTps(desaId, pemiluId)
        .then((data) => {
          const markers = (Array.isArray(data) ? data : [])
            .map((tps) => ({
              ...tps,
              lat: Number(tps.lat),
              lng: Number(tps.lng),
            }))
            .filter((tps) => Number.isFinite(tps.lat) && Number.isFinite(tps.lng))
          setTpsMarkers(markers)
        })
        .catch(() => setTpsMarkers([]))
    } else {
      setTpsMarkers([])
    }
  }, [desaId, pemiluId])

  useEffect(() => {
    if (!dapilGeoJson || !kecamatanGeoJson || !desaGeoJson) return
    
    let feature = null
    if (tpsId) {
      const tps = tpsMarkers.find(t => t.id === tpsId)
      if (tps) {
        setSelectedBounds([[tps.lat, tps.lng], [tps.lat, tps.lng]])
        return
      }
    } else if (desaId) {
      feature = desaGeoJson.features.find(f => f.properties.desa_id === desaId)
    } else if (kecamatanId) {
      feature = kecamatanGeoJson.features.find(f => f.properties.kecamatan_id === kecamatanId)
    } else if (dapilId) {
      feature = dapilGeoJson.features.find(f => f.properties.dapil_id === dapilId)
    }

    if (feature && feature.geometry) {
      const layer = L.geoJSON(feature)
      setSelectedBounds(layer.getBounds())
    } else if (!dapilId && !kecamatanId && !desaId && !tpsId) {
      setSelectedBounds(null)
    }
  }, [dapilId, kecamatanId, desaId, tpsId, dapilGeoJson, kecamatanGeoJson, desaGeoJson, tpsMarkers])

  const getMapLevel = () => {
    if (tpsId) return 'tps'
    if (desaId) return 'desa'
    if (kecamatanId) return 'kecamatan'
    if (dapilId) return 'dapil'
    return 'kabupaten'
  }

  const handleFeatureClick = (feature, level) => {
    let id
    if (level === 'dapil') {
      id = feature.properties.dapil_id
      onDapilClick(id)
    } else if (level === 'kecamatan') {
      id = feature.properties.kecamatan_id
      onKecamatanClick(id)
    } else if (level === 'desa') {
      id = feature.properties.desa_id
      onDesaClick(id)
    }
    
    if (feature.geometry) {
      const layer = L.geoJSON(feature)
      setSelectedBounds(layer.getBounds())
    }
  }

  const handleTpsClick = (tps) => {
    onTpsClick(tps.id)
  }

  const dapilStyle = (feature) => {
    const isSelected = dapilId === feature.properties.dapil_id
    const colorIndex = (feature.properties.dapil_id - 1) % DAPIL_COLORS.length
    return {
      fillColor: DAPIL_COLORS[colorIndex],
      weight: isSelected ? 3 : 2,
      opacity: 1,
      color: isSelected ? '#234c4c' : '#666',
      fillOpacity: isSelected ? 0.7 : 0.5,
    }
  }

  const kecamatanStyle = (feature) => {
    const isSelected = kecamatanId === feature.properties.kecamatan_id
    const inSelectedDapil = !dapilId || feature.properties.dapil_id === dapilId
    return {
      fillColor: inSelectedDapil ? '#4CAF50' : '#ccc',
      weight: isSelected ? 3 : 1,
      opacity: inSelectedDapil ? 1 : 0.5,
      color: isSelected ? '#234c4c' : '#999',
      fillOpacity: isSelected ? 0.7 : inSelectedDapil ? 0.4 : 0.2,
    }
  }

  const desaStyle = (feature) => {
    const isSelected = desaId === feature.properties.desa_id
    const inSelectedKecamatan = !kecamatanId || feature.properties.kecamatan_id === kecamatanId
    return {
      fillColor: inSelectedKecamatan ? '#2196F3' : '#ddd',
      weight: isSelected ? 3 : 1,
      opacity: inSelectedKecamatan ? 1 : 0.5,
      color: isSelected ? '#234c4c' : '#aaa',
      fillOpacity: isSelected ? 0.7 : inSelectedKecamatan ? 0.4 : 0.2,
    }
  }

  const onEachDapil = (feature, layer) => {
    layer.on({
      click: () => handleFeatureClick(feature, 'dapil'),
    })
    layer.bindTooltip(feature.properties.nama, { sticky: true })
  }

  const onEachKecamatan = (feature, layer) => {
    layer.on({
      click: () => handleFeatureClick(feature, 'kecamatan'),
    })
    layer.bindTooltip(feature.properties.kecamatan, { sticky: true })
  }

  const onEachDesa = (feature, layer) => {
    layer.on({
      click: () => handleFeatureClick(feature, 'desa'),
    })
    layer.bindTooltip(feature.properties.desa, { sticky: true })
  }

  const mapLevel = getMapLevel()
  const showDapil = mapLevel === 'kabupaten' || mapLevel === 'dapil'
  const showKecamatan = mapLevel === 'dapil' || mapLevel === 'kecamatan'
  const showDesa = mapLevel === 'kecamatan' || mapLevel === 'desa' || mapLevel === 'tps'
  const showTps = mapLevel === 'desa' || mapLevel === 'tps'

  return (
    <section className="border border-[#e4d9c7] rounded-lg bg-[rgba(255,253,247,0.8)] shadow-sm overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3">
        <span className="text-[#c4482a] text-xl">◆</span>
        <h2 className="m-0 font-bold text-lg [font-family:Georgia,serif]">Peta Wilayah Kabupaten Nganjuk</h2>
      </div>
      <div className="px-4 pb-5">
        {loading ? (
          <div className="flex items-center justify-center h-[400px] text-[#82776e] text-sm">
            Memuat peta...
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-[400px] text-red-600 text-sm">
            {error}
          </div>
        ) : (
          <MapContainer
            ref={mapRef}
            center={DEFAULT_MAP_CENTER}
            zoom={DEFAULT_MAP_ZOOM}
            style={{ height: '400px', width: '100%' }}
            className="rounded-lg"
            zoomControl={false}
            scrollWheelZoom={false}
            doubleClickZoom={false}
            touchZoom={false}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapController bounds={selectedBounds} />
            {showDapil && dapilGeoJson && (
              <GeoJSON
                data={dapilGeoJson}
                style={dapilStyle}
                onEachFeature={onEachDapil}
              />
            )}
            {showKecamatan && kecamatanGeoJson && (
              <GeoJSON
                data={kecamatanGeoJson}
                style={kecamatanStyle}
                onEachFeature={onEachKecamatan}
              />
            )}
            {showDesa && desaGeoJson && (
              <GeoJSON
                data={desaGeoJson}
                style={desaStyle}
                onEachFeature={onEachDesa}
              />
            )}
            {showTps && tpsMarkers.map((tps) => (
              <Marker
                key={tps.id}
                position={[tps.lat, tps.lng]}
                icon={tpsIcon}
                eventHandlers={{
                  click: () => handleTpsClick(tps),
                }}
              >
                <Popup>
                  <div className="text-xs">
                    <strong>TPS {tps.nomor}</strong>
                    <br />
                    {tps.alamat || ''}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        )}
      </div>
    </section>
  )
}
