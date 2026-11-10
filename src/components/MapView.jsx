import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, GeoJSON, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { api } from '../lib/api'

const DAPIL_COLORS = ['#E8442B', '#F5A623', '#22C55E', '#14B8A6', '#8B5CF6']
const KECAMATAN_COLORS = ['#1565C0', '#2E7D32', '#C62828', '#6A1B9A', '#EF6C00', '#00838F', '#AD1457', '#4E342E', '#558B2F', '#283593', '#00695C', '#9E9D24']
const DESA_COLORS = ['#D32F2F', '#1976D2', '#388E3C', '#7B1FA2', '#F57C00', '#00796B', '#C2185B', '#5D4037', '#455A64', '#512DA8', '#0288D1', '#689F38']
const DEFAULT_MAP_CENTER = [-7.6, 111.9]
const DEFAULT_MAP_ZOOM = 10
const MAP_HEIGHT = '520px'
const MAP_PADDING = [10, 10]

function MapController({ bounds, level, selectedTps }) {
  const map = useMap()

  useLayoutEffect(() => {
    if (!selectedTps) return
    const center = L.latLng(selectedTps.lat, selectedTps.lng)
    map.stop()
    map.invalidateSize({ pan: false })
    map.setView(center, 18, { animate: false })
  }, [selectedTps, map])

  useEffect(() => {
    if (selectedTps) return
    if (!bounds || !bounds.isValid?.()) {
      map.setView(DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM)
      return
    }
    map.invalidateSize({ pan: false })
    const maxZoom = level === 'kabupaten' ? 12 : level === 'dapil' ? 15 : level === 'kecamatan' ? 17 : 18
    map.fitBounds(bounds, { padding: MAP_PADDING, maxZoom })
    map.panTo(bounds.getCenter(), { animate: false })
  }, [bounds, level, selectedTps, map])
  return null
}

function MapControls({ level, onBack }) {
  const map = useMap()
  const shellRef = useRef(null)
  const [fullscreen, setFullscreen] = useState(false)

  useEffect(() => {
    const shell = map.getContainer()?.parentElement
    shellRef.current = shell
    const handleChange = () => {
      setFullscreen(Boolean(document.fullscreenElement === shell || shell?.classList.contains('map-pseudo-fullscreen')))
      window.requestAnimationFrame(() => map.invalidateSize({ pan: false }))
    }
    document.addEventListener('fullscreenchange', handleChange)
    return () => document.removeEventListener('fullscreenchange', handleChange)
  }, [map])

  const toggleFullscreen = async () => {
    const shell = shellRef.current
    if (!shell) return
    if (document.fullscreenElement === shell) {
      await document.exitFullscreen?.()
      return
    }
    if (document.fullscreenEnabled && shell.requestFullscreen) {
      await shell.requestFullscreen()
      return
    }
    shell.classList.toggle('map-pseudo-fullscreen')
    setFullscreen(shell.classList.contains('map-pseudo-fullscreen'))
    window.requestAnimationFrame(() => map.invalidateSize({ pan: false }))
  }

  return (
    <div className="map-floating-controls" aria-label="Kontrol peta">
      {level === 'desa' && <>
        <button type="button" title="Perbesar peta" aria-label="Perbesar peta" onClick={() => map.zoomIn()}>+</button>
        <button type="button" title="Perkecil peta" aria-label="Perkecil peta" onClick={() => map.zoomOut()}>−</button>
      </>}
      <button type="button" title={fullscreen ? 'Keluar layar penuh' : 'Layar penuh'} aria-label={fullscreen ? 'Keluar layar penuh' : 'Layar penuh'} onClick={toggleFullscreen}>⛶</button>
      {level !== 'kabupaten' && <button type="button" title="Kembali ke tingkat wilayah di atasnya" aria-label="Kembali ke tingkat wilayah di atasnya" onClick={onBack}>↩</button>}
    </div>
  )
}

function createTpsIcon(nomor) {
  const label = String(nomor ?? '').padStart(3, '0')
  return L.divIcon({ className: 'tps-marker', html: `<span>${label}</span>`, iconSize: [34, 22], iconAnchor: [17, 11], popupAnchor: [0, -11] })
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

function featureCollection(features) {
  return features?.length ? { type: 'FeatureCollection', features } : null
}

function geometryRings(geometry) {
  if (!geometry) return []
  if (geometry.type === 'Polygon') return geometry.coordinates || []
  if (geometry.type === 'MultiPolygon') return (geometry.coordinates || []).flat()
  return []
}

function ContextMask({ features, maskKey }) {
  const list = Array.isArray(features) ? features.filter((feature) => feature?.geometry) : []
  if (!list.length) return null
  const worldRing = [[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]]
  const holes = list.flatMap((feature) => geometryRings(feature.geometry))
  if (!holes.length) return null
  return (
    <GeoJSON
      key={`mask-${maskKey}`}
      data={{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [worldRing, ...holes] } }}
      style={{ fillColor: '#777777', color: '#777777', weight: 0, opacity: 1, fillOpacity: 1, fillRule: 'evenodd' }}
      interactive={false}
    />
  )
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>\"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;' }[char]))
}

function regionPopupHtml(name, levelLabel, id) {
  return `<div class="region-popup"><div class="region-popup__info"><strong>${escapeHtml(name || 'Wilayah')}</strong><span>${escapeHtml(levelLabel)}</span></div><button type="button" class="region-popup__select" data-region-id="${id}" aria-label="Pilih ${escapeHtml(name)}" title="Pilih wilayah">Pilih</button></div>`
}

export default function MapView({ pemiluId, dapilId, kecamatanId, desaId, tpsId, tpsRefreshToken = 0, onDapilClick, onKecamatanClick, onDesaClick, onTpsClick, onBack }) {
  const [dapilGeoJson, setDapilGeoJson] = useState(null)
  const [kecamatanGeoJson, setKecamatanGeoJson] = useState(null)
  const [desaGeoJson, setDesaGeoJson] = useState(null)
  const [tpsMarkers, setTpsMarkers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedBounds, setSelectedBounds] = useState(null)

  const kecamatanLoadedRef = useRef(false)
  const desaLoadedRef = useRef(false)

  // DAPIL — dimuat saat mount, menentukan loading state awal
  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch('/geojson/dapil-nganjuk.geojson')
      .then((response) => { if (!response.ok) throw new Error('GeoJSON DAPIL gagal dimuat'); return response.json() })
      .then((dapil) => { setDapilGeoJson(dapil); setLoading(false) })
      .catch((err) => { setError(err.message); setLoading(false) })
  }, [])

  // KECAMATAN — dimuat lazy saat dapilId pertama kali ada
  useEffect(() => {
    if (!dapilId || kecamatanLoadedRef.current) return
    fetch('/geojson/nganjuk-kecamatan.geojson')
      .then((response) => { if (!response.ok) throw new Error('GeoJSON kecamatan gagal dimuat'); return response.json() })
      .then((kecamatan) => { kecamatanLoadedRef.current = true; setKecamatanGeoJson(kecamatan) })
      .catch(() => {})
  }, [dapilId])

  // DESA — dimuat lazy saat kecamatanId pertama kali ada
  useEffect(() => {
    if (!kecamatanId || desaLoadedRef.current) return
    fetch('/geojson/nganjuk-desa.geojson')
      .then((response) => { if (!response.ok) throw new Error('GeoJSON desa gagal dimuat'); return response.json() })
      .then((desa) => { desaLoadedRef.current = true; setDesaGeoJson(desa) })
      .catch(() => {})
  }, [kecamatanId])

  useEffect(() => {
    if (!desaId || !pemiluId) { setTpsMarkers([]); return }
    api.getGisTps(desaId, pemiluId)
      .then((data) => setTpsMarkers((Array.isArray(data) ? data : []).map((tps) => ({ ...tps, lat: Number(tps.lat ?? tps.latitude), lng: Number(tps.lng ?? tps.longitude) })).filter((tps) => Number.isFinite(tps.lat) && Number.isFinite(tps.lng))))
      .catch(() => setTpsMarkers([]))
  }, [desaId, pemiluId, tpsRefreshToken])

  const mapLevel = tpsId ? 'tps' : desaId ? 'desa' : kecamatanId ? 'kecamatan' : dapilId ? 'dapil' : 'kabupaten'
  const selectedDapilFeature = dapilId ? dapilGeoJson?.features.find((feature) => getFeatureId(feature, 'dapil_id') === Number(dapilId)) : null
  const selectedKecamatanFeature = kecamatanId ? kecamatanGeoJson?.features.find((feature) => getFeatureId(feature, 'kecamatan_id') === Number(kecamatanId)) : null
  const selectedDesaFeature = desaId ? desaGeoJson?.features.find((feature) => getFeatureId(feature, 'desa_id') === Number(desaId)) : null
  const selectedTps = tpsId ? tpsMarkers.find((item) => Number(item.id) === Number(tpsId)) : null

  const visibleDapilGeoJson = mapLevel === 'kabupaten' ? dapilGeoJson : mapLevel === 'dapil' && selectedDapilFeature ? featureCollection([selectedDapilFeature]) : null
  const visibleKecamatanGeoJson = mapLevel === 'dapil' && dapilId
    ? featureCollection((kecamatanGeoJson?.features || []).filter((feature) => getFeatureId(feature, 'dapil_id') === Number(dapilId)))
    : mapLevel === 'kecamatan' && selectedKecamatanFeature ? featureCollection([selectedKecamatanFeature]) : null
  const visibleDesaGeoJson = mapLevel === 'kecamatan' && kecamatanId
    ? featureCollection((desaGeoJson?.features || []).filter((feature) => getFeatureId(feature, 'kecamatan_id') === Number(kecamatanId)))
    : (mapLevel === 'desa' || mapLevel === 'tps') && selectedDesaFeature ? featureCollection([selectedDesaFeature]) : null

  const maskFeatures = mapLevel === 'kabupaten'
    ? (dapilGeoJson?.features || [])
    : mapLevel === 'dapil'
      ? [selectedDapilFeature]
      : mapLevel === 'kecamatan'
        ? [selectedKecamatanFeature]
        : [selectedDesaFeature]

  useEffect(() => {
    if (!dapilGeoJson) return
    const feature = selectedDesaFeature || selectedKecamatanFeature || selectedDapilFeature
    if (feature?.geometry) { setSelectedBounds(L.geoJSON(feature).getBounds()); return }
    setSelectedBounds(L.geoJSON(dapilGeoJson).getBounds())
  }, [selectedDapilFeature, selectedKecamatanFeature, selectedDesaFeature, dapilGeoJson])

  const bindRegionInteraction = (feature, layer, level, levelLabel, idKey, onSelect) => {
    const name = getFeatureName(feature, level === 'dapil' ? ['nama', 'dapil'] : level === 'kecamatan' ? ['kecamatan', 'nama'] : ['desa', 'nama'])
    const id = getFeatureId(feature, idKey)
    if (!name) return

    const supportsHover = typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches
    if (supportsHover) {
      layer.bindTooltip(String(name), { sticky: true, direction: 'top', opacity: 0.96, className: 'region-tooltip' })
      layer.on('click', () => onSelect?.(id))
      return
    }

    layer.bindPopup(regionPopupHtml(name, levelLabel, id), { className: 'region-popup-container', closeButton: true, autoPan: true, maxWidth: 280, minWidth: 190 })
    layer.on('popupopen', (event) => {
      const button = event.popup.getElement()?.querySelector('.region-popup__select')
      if (!button) return
      button.onclick = (clickEvent) => {
        clickEvent.preventDefault()
        clickEvent.stopPropagation()
        onSelect?.(id)
        event.popup._source?.closePopup()
      }
    })
  }

  const dapilStyle = (feature) => {
    const id = getFeatureId(feature, 'dapil_id')
    const selected = Number(dapilId) === id
    const index = Math.max(0, ((id || 1) - 1) % DAPIL_COLORS.length)
    return { fillColor: DAPIL_COLORS[index], weight: selected ? 3 : 2, opacity: 1, color: '#111111', fillOpacity: selected ? 0.72 : 0.62 }
  }

  const kecamatanStyle = (feature) => {
    const id = getFeatureId(feature, 'kecamatan_id')
    const selected = Number(kecamatanId) === id
    const index = Math.abs((id || 1) - 1) % KECAMATAN_COLORS.length
    return { fillColor: KECAMATAN_COLORS[index], weight: selected ? 3 : 2, opacity: 1, color: '#111111', fillOpacity: selected ? 0.72 : 0.56 }
  }

  const desaStyle = (feature) => {
    const id = getFeatureId(feature, 'desa_id')
    const selected = Number(desaId) === id
    const index = Math.abs((id || 1) - 1) % DESA_COLORS.length
    return { fillColor: DESA_COLORS[index], weight: selected ? 3 : 1.8, opacity: 1, color: '#111111', fillOpacity: selected ? 0.72 : 0.52 }
  }

  const onEachDapil = (feature, layer) => bindRegionInteraction(feature, layer, 'dapil', 'DAPIL', 'dapil_id', onDapilClick)
  const onEachKecamatan = (feature, layer) => bindRegionInteraction(feature, layer, 'kecamatan', 'Kecamatan', 'kecamatan_id', onKecamatanClick)
  const onEachDesa = (feature, layer) => bindRegionInteraction(feature, layer, 'desa', 'Desa / Kelurahan', 'desa_id', onDesaClick)

  return (
    <section className="border border-[#e4d9c7] rounded-lg bg-[rgba(255,253,247,0.8)] shadow-sm overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3"><span className="text-[#c4482a] text-xl">◆</span><h2 className="m-0 font-bold text-lg [font-family:Georgia,serif]">Peta Wilayah Kabupaten Nganjuk</h2></div>
      <div className="px-4 pb-5">
        {loading ? <div className="flex items-center justify-center h-[520px] text-[#82776e] text-sm">Memuat peta...</div> : error ? <div className="flex items-center justify-center h-[520px] text-red-600 text-sm">{error}</div> : (
          <div className="map-shell">
            <MapContainer center={DEFAULT_MAP_CENTER} zoom={DEFAULT_MAP_ZOOM} style={{ height: MAP_HEIGHT, width: '100%' }} className="rounded-lg" zoomControl={false} scrollWheelZoom={false} doubleClickZoom={false} touchZoom={false}>
              <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <MapController bounds={selectedBounds} level={mapLevel} selectedTps={selectedTps} />
              <MapControls level={mapLevel} onBack={onBack} />
              <ContextMask features={maskFeatures} maskKey={`${mapLevel}-${dapilId || ''}-${kecamatanId || ''}-${desaId || ''}`} />
              {visibleDapilGeoJson && <GeoJSON key={`dapil-${dapilId || 'all'}`} data={visibleDapilGeoJson} style={dapilStyle} onEachFeature={onEachDapil} />}
              {visibleKecamatanGeoJson && <GeoJSON key={`kecamatan-${dapilId || ''}-${kecamatanId || ''}`} data={visibleKecamatanGeoJson} style={kecamatanStyle} onEachFeature={onEachKecamatan} />}
              {visibleDesaGeoJson && <GeoJSON key={`desa-${kecamatanId || ''}-${desaId || ''}`} data={visibleDesaGeoJson} style={desaStyle} onEachFeature={onEachDesa} />}
              {(mapLevel === 'desa' || mapLevel === 'tps') && tpsMarkers.map((tps) => {
                const routeUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${tps.lat},${tps.lng}`)}`
                return (
                  <Marker key={tps.id} position={[tps.lat, tps.lng]} icon={createTpsIcon(tps.nomor)} eventHandlers={{ click: () => onTpsClick?.(tps.id) }}>
                    <Popup className="tps-popup-container" maxWidth={320} minWidth={250} autoPan={false}>
                      <div className="tps-popup">
                        <div className="tps-popup__info">
                          <strong>TPS {String(tps.nomor ?? '').padStart(3, '0')}</strong>
                          {tps.alamat ? <span>{tps.alamat}</span> : null}
                          {tps.desa_nama || tps.desa ? <span>{tps.desa_nama || tps.desa}</span> : null}
                        </div>
                        <a className="tps-popup__route" href={routeUrl} target="_blank" rel="noreferrer" aria-label="Buka Rute Google Maps" title="Buka Rute Google Maps">
                          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4.5A2.5 2.5 0 0 1 7.5 2h4A2.5 2.5 0 0 1 14 4.5V7h2.5A2.5 2.5 0 0 1 19 9.5v9A2.5 2.5 0 0 1 16.5 21H7.5A2.5 2.5 0 0 1 5 18.5v-14ZM7.5 4a.5.5 0 0 0-.5.5V7h5V4.5a.5.5 0 0 0-.5-.5h-4Zm7 5H7.5a.5.5 0 0 0-.5.5v9a.5.5 0 0 0 .5.5h9a.5.5 0 0 0 .5-.5v-9a.5.5 0 0 0-.5-.5H14.5v2h-2V9h2Z" /></svg>
                        </a>
                      </div>
                    </Popup>
                  </Marker>
                )
              })}
            </MapContainer>
          </div>
        )}
      </div>
    </section>
  )
}