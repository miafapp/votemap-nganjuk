import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, GeoJSON, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { api } from '../lib/api'

const DAPIL_COLORS = ['#E8442B', '#F5A623', '#22C55E', '#14B8A6', '#8B5CF6']
const KECAMATAN_COLORS = ['#1B5E20', '#6A1B9A', '#0D47A1', '#E65100', '#00695C', '#AD1457', '#4E342E', '#1565C0']
const DESA_COLORS = ['#B71C1C', '#4A148C', '#004D40', '#BF360C', '#01579B', '#33691E', '#6D4C41', '#283593', '#827717', '#880E4F']
const DEFAULT_MAP_CENTER = [-7.6, 111.9]
const DEFAULT_MAP_ZOOM = 10
const MAP_PADDING = [8, 8]

function MapController({ bounds, level }) {
  const map = useMap()

  useEffect(() => {
    if (!bounds || !bounds.isValid?.()) {
      map.setView(DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM)
      return
    }

    if (level === 'tps') {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 17 })
      return
    }

    const maxZoom = level === 'kabupaten' ? 13 : level === 'dapil' ? 15 : level === 'kecamatan' ? 17 : 18
    map.fitBounds(bounds, { padding: MAP_PADDING, maxZoom })
  }, [bounds, level, map])

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

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
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

function getFeatureBounds(feature) {
  if (!feature?.geometry) return null
  const bounds = L.geoJSON(feature).getBounds()
  return bounds.isValid() ? bounds : null
}

function normalizeCoordinatePosition(value) {
  if (!Array.isArray(value) || value.length < 2) return null
  const lng = Number(value[0])
  const lat = Number(value[1])
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null
  return [lng, lat]
}

function normalizeGeoJsonCoordinates(value) {
  if (!Array.isArray(value)) return value

  const isScalarArray = value.every((item) => !Array.isArray(item))
  if (isScalarArray) {
    if (value.length === 2 || value.length === 3) {
      return normalizeCoordinatePosition(value)
    }

    if (value.length > 3 && value.length % 2 === 0) {
      const positions = []
      for (let index = 0; index < value.length; index += 2) {
        const position = normalizeCoordinatePosition([value[index], value[index + 1]])
        if (position) positions.push(position)
      }
      return positions
    }

    return value
  }

  return value.map(normalizeGeoJsonCoordinates)
}

function normalizeGeoJson(data) {
  if (!data) return data
  if (data.type === 'FeatureCollection') {
    return { ...data, features: data.features.map(normalizeGeoJson) }
  }
  if (data.type === 'Feature') {
    return { ...data, geometry: normalizeGeoJson(data.geometry) }
  }
  if (data.type === 'GeometryCollection') {
    return { ...data, geometries: data.geometries.map(normalizeGeoJson) }
  }
  if (data.type === 'Polygon' || data.type === 'MultiPolygon' || data.type === 'MultiLineString' || data.type === 'LineString' || data.type === 'Point' || data.type === 'MultiPoint') {
    return { ...data, coordinates: normalizeGeoJsonCoordinates(data.coordinates) }
  }
  if (data.geometry) return { ...data, geometry: normalizeGeoJson(data.geometry) }
  if (data.coordinates) return { ...data, coordinates: normalizeGeoJsonCoordinates(data.coordinates) }
  return data
}

function getContextRings(geometry) {
  if (!geometry) return []

  if (geometry.type === 'Polygon') {
    return geometry.coordinates.filter((ring) => Array.isArray(ring) && ring.length >= 3)
  }

  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.flatMap((polygon) => (
      Array.isArray(polygon)
        ? polygon.filter((ring) => Array.isArray(ring) && ring.length >= 3)
        : []
    ))
  }

  return []
}

function ContextMask({ contextFeature, maskKey }) {
  if (!contextFeature?.geometry) return null

  const worldRing = [[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]]
  const rings = getContextRings(contextFeature.geometry)

  if (!rings.length) return null

  return (
    <GeoJSON
      key={`mask-${maskKey}`}
      data={{
        type: 'Feature',
        properties: {},
        geometry: { type: 'Polygon', coordinates: [worldRing, ...rings] },
      }}
      style={{ fillColor: '#808080', color: '#808080', weight: 0, fillOpacity: 1, fillRule: 'evenodd' }}
      interactive={false}
    />
  )
}

function bindRegionTooltip(feature, layer, nameKeys) {
  const name = getFeatureName(feature, nameKeys)
  if (name) {
    layer.bindTooltip(escapeHtml(name), {
      sticky: true,
      direction: 'top',
      opacity: 0.96,
      className: 'region-tooltip',
    })
  }
}

export default function MapView({ pemiluId, dapilId, kecamatanId, desaId, tpsId, refreshToken = 0, onDapilClick, onKecamatanClick, onDesaClick, onTpsClick }) {
  const [dapilGeoJson, setDapilGeoJson] = useState(null)
  const [kecamatanGeoJson, setKecamatanGeoJson] = useState(null)
  const [desaGeoJson, setDesaGeoJson] = useState(null)
  const [tpsMarkers, setTpsMarkers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedBounds, setSelectedBounds] = useState(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    Promise.all([
      fetch('/geojson/dapil-nganjuk.geojson').then((response) => {
        if (!response.ok) throw new Error('GeoJSON DAPIL gagal dimuat')
        return response.json()
      }),
      fetch('/geojson/nganjuk-kecamatan.geojson').then((response) => {
        if (!response.ok) throw new Error('GeoJSON kecamatan gagal dimuat')
        return response.json()
      }),
      fetch('/geojson/nganjuk-desa.geojson').then((response) => {
        if (!response.ok) throw new Error('GeoJSON desa gagal dimuat')
        return response.json()
      }),
    ])
      .then(([dapil, kecamatan, desa]) => {
        setDapilGeoJson(normalizeGeoJson(dapil))
        setKecamatanGeoJson(normalizeGeoJson(kecamatan))
        setDesaGeoJson(normalizeGeoJson(desa))
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [refreshToken])

  useEffect(() => {
    if (!desaId || !pemiluId) {
      setTpsMarkers([])
      return
    }

    api.getGisTps(desaId, pemiluId)
      .then((data) => {
        const markers = (Array.isArray(data) ? data : [])
          .map((tps) => ({ ...tps, lat: Number(tps.lat ?? tps.latitude), lng: Number(tps.lng ?? tps.longitude) }))
          .filter((tps) => Number.isFinite(tps.lat) && Number.isFinite(tps.lng))
        setTpsMarkers(markers)
      })
      .catch(() => setTpsMarkers([]))
  }, [desaId, pemiluId, refreshToken])

  const mapLevel = tpsId ? 'tps' : desaId ? 'desa' : kecamatanId ? 'kecamatan' : dapilId ? 'dapil' : 'kabupaten'

  useEffect(() => {
    if (!dapilGeoJson || !kecamatanGeoJson || !desaGeoJson) return

    if (mapLevel === 'tps') {
      const tps = tpsMarkers.find((item) => Number(item.id) === Number(tpsId))
      if (tps) {
        setSelectedBounds(L.latLngBounds([tps.lat, tps.lng], [tps.lat, tps.lng]))
        return
      }
    }

    const feature = mapLevel === 'desa'
      ? desaGeoJson.features.find((item) => getFeatureId(item, 'desa_id') === Number(desaId))
      : mapLevel === 'kecamatan'
        ? kecamatanGeoJson.features.find((item) => getFeatureId(item, 'kecamatan_id') === Number(kecamatanId))
        : mapLevel === 'dapil'
          ? dapilGeoJson.features.find((item) => getFeatureId(item, 'dapil_id') === Number(dapilId))
          : null

    const bounds = feature ? getFeatureBounds(feature) : getFeatureBounds({ type: 'Feature', geometry: { type: 'MultiPolygon', coordinates: dapilGeoJson.features.map((f) => f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates) } })
    setSelectedBounds(bounds)
  }, [mapLevel, dapilId, kecamatanId, desaId, tpsId, dapilGeoJson, kecamatanGeoJson, desaGeoJson, tpsMarkers])

  const handleFeatureClick = (feature, level) => {
    if (level === 'dapil') onDapilClick(getFeatureId(feature, 'dapil_id'))
    if (level === 'kecamatan') onKecamatanClick(getFeatureId(feature, 'kecamatan_id'))
    if (level === 'desa') onDesaClick(getFeatureId(feature, 'desa_id'))
  }

  const dapilStyle = (feature) => {
    const id = getFeatureId(feature, 'dapil_id')
    const isSelected = Number(dapilId) === id
    const colorIndex = Math.max(0, ((id || 1) - 1) % DAPIL_COLORS.length)
    return { fillColor: DAPIL_COLORS[colorIndex], weight: isSelected ? 3 : 2, opacity: 1, color: isSelected ? '#234c4c' : '#555', fillOpacity: isSelected ? 0.72 : 0.58 }
  }

  const kecamatanStyle = (feature) => {
    const id = getFeatureId(feature, 'kecamatan_id')
    const isSelected = Number(kecamatanId) === id
    const inSelectedDapil = !dapilId || getFeatureId(feature, 'dapil_id') === Number(dapilId)
    const colorIndex = Math.abs((id || 1) - 1) % KECAMATAN_COLORS.length
    return { fillColor: inSelectedDapil ? KECAMATAN_COLORS[colorIndex] : '#777', weight: isSelected ? 3 : 1.5, opacity: inSelectedDapil ? 1 : 0.35, color: isSelected ? '#111' : '#fff', fillOpacity: isSelected ? 0.78 : inSelectedDapil ? 0.68 : 0.12 }
  }

  const desaStyle = (feature) => {
    const id = getFeatureId(feature, 'desa_id')
    const isSelected = Number(desaId) === id
    const inSelectedKecamatan = !kecamatanId || getFeatureId(feature, 'kecamatan_id') === Number(kecamatanId)
    const colorIndex = Math.abs((id || 1) - 1) % DESA_COLORS.length
    return { fillColor: inSelectedKecamatan ? DESA_COLORS[colorIndex] : '#777', weight: isSelected ? 3 : 1.5, opacity: inSelectedKecamatan ? 1 : 0.35, color: isSelected ? '#111' : '#fff', fillOpacity: isSelected ? 0.8 : inSelectedKecamatan ? 0.68 : 0.12 }
  }

  const onEachDapil = (feature, layer) => {
    bindRegionTooltip(feature, layer, ['nama', 'dapil'])
    layer.on({ click: () => handleFeatureClick(feature, 'dapil') })
  }

  const onEachKecamatan = (feature, layer) => {
    bindRegionTooltip(feature, layer, ['kecamatan', 'nama'])
    layer.on({ click: () => handleFeatureClick(feature, 'kecamatan') })
  }

  const onEachDesa = (feature, layer) => {
    bindRegionTooltip(feature, layer, ['desa', 'nama'])
    layer.on({ click: () => handleFeatureClick(feature, 'desa') })
  }

  const selectedDapilFeature = dapilId ? dapilGeoJson?.features.find((feature) => getFeatureId(feature, 'dapil_id') === Number(dapilId)) : null
  const selectedKecamatanFeature = kecamatanId ? kecamatanGeoJson?.features.find((feature) => getFeatureId(feature, 'kecamatan_id') === Number(kecamatanId)) : null
  const selectedDesaFeature = desaId ? desaGeoJson?.features.find((feature) => getFeatureId(feature, 'desa_id') === Number(desaId)) : null
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
        {loading ? <div className="flex items-center justify-center h-[400px] text-[#82776e] text-sm">Memuat peta...</div> : error ? <div className="flex items-center justify-center h-[400px] text-red-600 text-sm">{error}</div> : (
          <MapContainer center={DEFAULT_MAP_CENTER} zoom={DEFAULT_MAP_ZOOM} style={{ height: '400px', width: '100%' }} className="rounded-lg" zoomControl={false} scrollWheelZoom={false} doubleClickZoom={false} touchZoom={false}>
            <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <MapController bounds={selectedBounds} level={mapLevel} />

            {mapLevel !== 'kabupaten' && <ContextMask contextFeature={contextFeature} maskKey={`${mapLevel}-${dapilId || ''}-${kecamatanId || ''}-${desaId || ''}`} />}

            {showDapil && dapilGeoJson && <GeoJSON data={dapilGeoJson} style={dapilStyle} onEachFeature={onEachDapil} />}
            {showKecamatan && kecamatanGeoJson && <GeoJSON data={kecamatanGeoJson} style={kecamatanStyle} onEachFeature={onEachKecamatan} />}
            {showDesa && desaGeoJson && <GeoJSON data={desaGeoJson} style={desaStyle} onEachFeature={onEachDesa} />}

            {showTps && tpsMarkers.map((tps) => {
              const nomor = String(tps.nomor ?? '').padStart(3, '0')
              const routeUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${tps.lat},${tps.lng}`)}`
              return (
                <Marker key={tps.id} position={[tps.lat, tps.lng]} icon={createTpsIcon(tps.nomor)} eventHandlers={{ click: () => onTpsClick(tps.id) }}>
                  <Popup>
                    <div className="text-xs min-w-[150px]">
                      <strong>TPS {nomor}</strong>
                      {tps.alamat ? <><br />{tps.alamat}</> : null}
                      <a href={routeUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center rounded bg-[#c4482a] px-2.5 py-1.5 text-white font-semibold no-underline hover:bg-[#b03d22]">Buka Rute Google Maps</a>
                    </div>
                  </Popup>
                </Marker>
              )
            })}
          </MapContainer>
        )}
      </div>
    </section>
  )
}
