import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, GeoJSON, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { api } from '../lib/api'

const DAPIL_COLORS = ['#E8442B', '#F5A623', '#22C55E', '#14B8A6', '#8B5CF6']
const DEFAULT_MAP_CENTER = [-7.6, 111.9]
const DEFAULT_MAP_ZOOM = 10
const MAP_PADDING = [24, 24]

function MapController({ bounds }) {
  const map = useMap()

  useEffect(() => {
    if (bounds) map.fitBounds(bounds, { padding: MAP_PADDING, maxZoom: 14 })
    else map.setView(DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM)
  }, [bounds, map])

  return null
}

function createTpsIcon(nomor) {
  const label = String(nomor ?? '').padStart(3, '0')
  return L.divIcon({
    className: 'tps-marker',
    html: `<span>${label}</span>`,
    iconSize: [34, 22],
    iconAnchor: [17, 11],
    popupAnchor: [0, -11],
  })
}

function getFeatureId(feature, key) {
  const value = feature?.properties?.[key]
  return value == null ? null : Number(value)
}

function getFeatureName(feature, keys) {
  for (const key of keys) {
    const value = feature?.properties?.[key]
    if (value) return value
  }
  return ''
}

function ContextMask({ contextFeature }) {
  if (!contextFeature?.geometry) return null

  const worldRing = [[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]]
  const geometry = contextFeature.geometry
  const holes = geometry.type === 'Polygon'
    ? geometry.coordinates
    : geometry.type === 'MultiPolygon'
      ? geometry.coordinates.flat()
      : []

  if (!holes.length) return null

  return (
    <GeoJSON
      key={`mask-${contextFeature.properties?.dapil_id || contextFeature.properties?.kecamatan_id || contextFeature.properties?.desa_id || 'context'}`}
      data={{
        type: 'Feature',
        properties: {},
        geometry: { type: 'Polygon', coordinates: [worldRing, ...holes] },
      }}
      style={{ fillColor: '#999', color: '#999', weight: 0, fillOpacity: 0.45 }}
      interactive={false}
    />
  )
}

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
              lat: Number(tps.lat ?? tps.latitude),
              lng: Number(tps.lng ?? tps.longitude),
            }))
            .filter((tps) => Number.isFinite(tps.lat) && Number.isFinite(tps.lng))
          setTpsMarkers(markers)
        })
        .catch(() => setTpsMarkers([]))
    } else {
      setTpsMarkers([])
    }
  }, [desaId, pemiluId])

  const mapLevel = tpsId ? 'tps' : desaId ? 'desa' : kecamatanId ? 'kecamatan' : dapilId ? 'dapil' : 'kabupaten'

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
      feature = desaGeoJson.features.find(f => getFeatureId(f, 'desa_id') === Number(desaId))
    } else if (kecamatanId) {
      feature = kecamatanGeoJson.features.find(f => getFeatureId(f, 'kecamatan_id') === Number(kecamatanId))
    } else if (dapilId) {
      feature = dapilGeoJson.features.find(f => getFeatureId(f, 'dapil_id') === Number(dapilId))
    }

    if (feature?.geometry) {
      setSelectedBounds(L.geoJSON(feature).getBounds())
    } else if (!dapilId && !kecamatanId && !desaId && !tpsId) {
      setSelectedBounds(L.geoJSON(dapilGeoJson).getBounds())
    }
  }, [dapilId, kecamatanId, desaId, tpsId, dapilGeoJson, kecamatanGeoJson, desaGeoJson, tpsMarkers])

  const handleFeatureClick = (feature, level) => {
    if (level === 'dapil') onDapilClick(getFeatureId(feature, 'dapil_id'))
    if (level === 'kecamatan') onKecamatanClick(getFeatureId(feature, 'kecamatan_id'))
    if (level === 'desa') onDesaClick(getFeatureId(feature, 'desa_id'))
  }

  const dapilStyle = (feature) => {
    const id = getFeatureId(feature, 'dapil_id')
    const isSelected = Number(dapilId) === id
    const colorIndex = ((id || 1) - 1) % DAPIL_COLORS.length
    return { fillColor: DAPIL_COLORS[colorIndex], weight: isSelected ? 3 : 2, opacity: 1, color: isSelected ? '#234c4c' : '#666', fillOpacity: isSelected ? 0.7 : 0.5 }
  }

  const kecamatanStyle = (feature) => {
    const id = getFeatureId(feature, 'kecamatan_id')
    const isSelected = Number(kecamatanId) === id
    const inSelectedDapil = !dapilId || getFeatureId(feature, 'dapil_id') === Number(dapilId)
    return { fillColor: inSelectedDapil ? '#4CAF50' : '#999', weight: isSelected ? 3 : 1, opacity: inSelectedDapil ? 1 : 0.45, color: isSelected ? '#234c4c' : '#999', fillOpacity: isSelected ? 0.7 : inSelectedDapil ? 0.4 : 0.12 }
  }

  const desaStyle = (feature) => {
    const id = getFeatureId(feature, 'desa_id')
    const isSelected = Number(desaId) === id
    const inSelectedKecamatan = !kecamatanId || getFeatureId(feature, 'kecamatan_id') === Number(kecamatanId)
    return { fillColor: inSelectedKecamatan ? '#2196F3' : '#999', weight: isSelected ? 3 : 1, opacity: inSelectedKecamatan ? 1 : 0.45, color: isSelected ? '#234c4c' : '#aaa', fillOpacity: isSelected ? 0.7 : inSelectedKecamatan ? 0.4 : 0.12 }
  }

  const onEachDapil = (feature, layer) => {
    layer.on({ click: () => handleFeatureClick(feature, 'dapil') })
    layer.bindTooltip(getFeatureName(feature, ['nama', 'dapil']), { sticky: true, direction: 'center' })
  }

  const onEachKecamatan = (feature, layer) => {
    layer.on({ click: () => handleFeatureClick(feature, 'kecamatan') })
    if (mapLevel === 'dapil' || mapLevel === 'kecamatan') layer.bindTooltip(getFeatureName(feature, ['kecamatan', 'nama']), { sticky: true, direction: 'center' })
  }

  const onEachDesa = (feature, layer) => {
    layer.on({ click: () => handleFeatureClick(feature, 'desa') })
    if (mapLevel === 'kecamatan') layer.bindTooltip(getFeatureName(feature, ['desa', 'nama']), { sticky: true, direction: 'center' })
  }

  const selectedDapilFeature = dapilId ? dapilGeoJson?.features.find(f => getFeatureId(f, 'dapil_id') === Number(dapilId)) : null
  const selectedKecamatanFeature = kecamatanId ? kecamatanGeoJson?.features.find(f => getFeatureId(f, 'kecamatan_id') === Number(kecamatanId)) : null
  const selectedDesaFeature = desaId ? desaGeoJson?.features.find(f => getFeatureId(f, 'desa_id') === Number(desaId)) : null
  const contextFeature = selectedDesaFeature || selectedKecamatanFeature || selectedDapilFeature

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
          <div className="flex items-center justify-center h-[400px] text-[#82776e] text-sm">Memuat peta...</div>
        ) : error ? (
          <div className="flex items-center justify-center h-[400px] text-red-600 text-sm">{error}</div>
        ) : (
          <MapContainer ref={mapRef} center={DEFAULT_MAP_CENTER} zoom={DEFAULT_MAP_ZOOM} style={{ height: '400px', width: '100%' }} className="rounded-lg" zoomControl={false} scrollWheelZoom={false} doubleClickZoom={false} touchZoom={false}>
            <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <MapController bounds={selectedBounds} />
            {mapLevel !== 'kabupaten' && <ContextMask contextFeature={contextFeature} />}
            {showDapil && dapilGeoJson && <GeoJSON data={dapilGeoJson} style={dapilStyle} onEachFeature={onEachDapil} />}
            {showKecamatan && kecamatanGeoJson && <GeoJSON data={kecamatanGeoJson} style={kecamatanStyle} onEachFeature={onEachKecamatan} />}
            {showDesa && desaGeoJson && <GeoJSON data={desaGeoJson} style={desaStyle} onEachFeature={onEachDesa} />}
            {showTps && tpsMarkers.map((tps) => (
              <Marker key={tps.id} position={[tps.lat, tps.lng]} icon={createTpsIcon(tps.nomor)} eventHandlers={{ click: () => onTpsClick(tps.id) }}>
                <Popup>
                  <div className="text-xs"><strong>TPS {String(tps.nomor ?? '').padStart(3, '0')}</strong><br />{tps.alamat || ''}</div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        )}
      </div>
    </section>
  )
}
