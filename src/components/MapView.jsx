import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, GeoJSON, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { api } from '../lib/api'

const DAPIL_COLORS = ['#E8442B', '#F5A623', '#22C55E', '#14B8A6', '#8B5CF6']
const KECAMATAN_COLORS = ['#2E7D32', '#388E3C', '#43A047', '#4CAF50', '#66BB6A', '#7CB342', '#8BC34A']
const DESA_COLORS = ['#1565C0', '#1976D2', '#1E88E5', '#2196F3', '#42A5F5', '#64B5F6', '#90CAF9']
const DEFAULT_MAP_CENTER = [-7.6, 111.9]
const DEFAULT_MAP_ZOOM = 10
const MAP_PADDING = [32, 32]

function MapController({ bounds, level }) {
  const map = useMap()

  useEffect(() => {
    if (level === 'tps' && bounds) {
      const center = bounds.getCenter ? bounds.getCenter() : L.latLng(bounds[0][0], bounds[0][1])
      map.setView(center, 16)
      return
    }

    if (bounds) {
      const maxZoom = level === 'kabupaten' ? 11 : level === 'dapil' ? 12 : level === 'kecamatan' ? 14 : 15
      map.fitBounds(bounds, { padding: MAP_PADDING, maxZoom })
      return
    }

    map.setView(DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM)
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

function createRegionLabelIcon(name, className) {
  const safeName = String(name ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')

  return L.divIcon({
    className: `region-label ${className}`,
    html: `<span>${safeName}</span>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
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

function getFeatureCenter(feature) {
  if (!feature?.geometry) return null
  const bounds = L.geoJSON(feature).getBounds()
  return bounds.isValid() ? bounds.getCenter() : null
}

function ContextMask({ contextFeature, maskKey }) {
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
      key={`mask-${maskKey}`}
      data={{
        type: 'Feature',
        properties: {},
        geometry: { type: 'Polygon', coordinates: [worldRing, ...holes] },
      }}
      style={{ fillColor: '#808080', color: '#808080', weight: 0, fillOpacity: 0.48 }}
      interactive={false}
    />
  )
}

function RegionLabels({ features, nameKeys, className, filter }) {
  return (features || []).map((feature) => {
    if (filter && !filter(feature)) return null
    const center = getFeatureCenter(feature)
    const name = getFeatureName(feature, nameKeys)
    if (!center || !name) return null

    const key = `${className}-${getFeatureId(feature, nameKeys[0]) ?? name}`
    return (
      <Marker
        key={key}
        position={center}
        icon={createRegionLabelIcon(name, className)}
        interactive={false}
        keyboard={false}
      />
    )
  })
}

export default function MapView({ pemiluId, dapilId, kecamatanId, desaId, tpsId, onDapilClick, onKecamatanClick, onDesaClick, onTpsClick }) {
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
    if (!desaId || !pemiluId) {
      setTpsMarkers([])
      return
    }

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
  }, [desaId, pemiluId])

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

    if (feature?.geometry) {
      setSelectedBounds(L.geoJSON(feature).getBounds())
      return
    }

    setSelectedBounds(L.geoJSON(dapilGeoJson).getBounds())
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
    return {
      fillColor: DAPIL_COLORS[colorIndex],
      weight: isSelected ? 3 : 2,
      opacity: 1,
      color: isSelected ? '#234c4c' : '#666',
      fillOpacity: isSelected ? 0.72 : 0.5,
    }
  }

  const kecamatanStyle = (feature) => {
    const id = getFeatureId(feature, 'kecamatan_id')
    const isSelected = Number(kecamatanId) === id
    const inSelectedDapil = !dapilId || getFeatureId(feature, 'dapil_id') === Number(dapilId)
    const colorIndex = Math.abs((id || 1) - 1) % KECAMATAN_COLORS.length
    return {
      fillColor: inSelectedDapil ? KECAMATAN_COLORS[colorIndex] : '#999',
      weight: isSelected ? 3 : 1,
      opacity: inSelectedDapil ? 1 : 0.35,
      color: isSelected ? '#183f22' : '#777',
      fillOpacity: isSelected ? 0.72 : inSelectedDapil ? 0.52 : 0.1,
    }
  }

  const desaStyle = (feature) => {
    const id = getFeatureId(feature, 'desa_id')
    const isSelected = Number(desaId) === id
    const inSelectedKecamatan = !kecamatanId || getFeatureId(feature, 'kecamatan_id') === Number(kecamatanId)
    const colorIndex = Math.abs((id || 1) - 1) % DESA_COLORS.length
    return {
      fillColor: inSelectedKecamatan ? DESA_COLORS[colorIndex] : '#999',
      weight: isSelected ? 3 : 1,
      opacity: inSelectedKecamatan ? 1 : 0.35,
      color: isSelected ? '#123c68' : '#777',
      fillOpacity: isSelected ? 0.72 : inSelectedKecamatan ? 0.48 : 0.1,
    }
  }

  const onEachDapil = (feature, layer) => {
    layer.on({ click: () => handleFeatureClick(feature, 'dapil') })
  }

  const onEachKecamatan = (feature, layer) => {
    layer.on({ click: () => handleFeatureClick(feature, 'kecamatan') })
  }

  const onEachDesa = (feature, layer) => {
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

  const selectedDapilFilter = (feature) => !dapilId || getFeatureId(feature, 'dapil_id') === Number(dapilId)
  const selectedKecamatanFilter = (feature) => !kecamatanId || getFeatureId(feature, 'kecamatan_id') === Number(kecamatanId)

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
          <MapContainer center={DEFAULT_MAP_CENTER} zoom={DEFAULT_MAP_ZOOM} style={{ height: '400px', width: '100%' }} className="rounded-lg" zoomControl={false} scrollWheelZoom={false} doubleClickZoom={false} touchZoom={false}>
            <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <MapController bounds={selectedBounds} level={mapLevel} />

            {mapLevel !== 'kabupaten' && <ContextMask contextFeature={contextFeature} maskKey={`${mapLevel}-${dapilId || ''}-${kecamatanId || ''}-${desaId || ''}`} />}

            {showDapil && dapilGeoJson && (
              <>
                <GeoJSON data={dapilGeoJson} style={dapilStyle} onEachFeature={onEachDapil} />
                <RegionLabels
                  features={dapilGeoJson.features}
                  nameKeys={['nama', 'dapil']}
                  className="dapil-label"
                />
              </>
            )}

            {showKecamatan && kecamatanGeoJson && (
              <>
                <GeoJSON data={kecamatanGeoJson} style={kecamatanStyle} onEachFeature={onEachKecamatan} />
                <RegionLabels
                  features={kecamatanGeoJson.features}
                  nameKeys={['kecamatan', 'nama']}
                  className="kecamatan-label"
                  filter={selectedDapilFilter}
                />
              </>
            )}

            {showDesa && desaGeoJson && (
              <>
                <GeoJSON data={desaGeoJson} style={desaStyle} onEachFeature={onEachDesa} />
                {mapLevel === 'kecamatan' && (
                  <RegionLabels
                    features={desaGeoJson.features}
                    nameKeys={['desa', 'nama']}
                    className="desa-label"
                    filter={selectedKecamatanFilter}
                  />
                )}
              </>
            )}

            {showTps && tpsMarkers.map((tps) => (
              <Marker
                key={tps.id}
                position={[tps.lat, tps.lng]}
                icon={createTpsIcon(tps.nomor)}
                eventHandlers={{ click: () => onTpsClick(tps.id) }}
              >
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
