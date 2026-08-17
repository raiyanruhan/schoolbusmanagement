import { useEffect, useRef, useState, useCallback } from 'react'
import WaveSurfer from 'wavesurfer.js'
import RegionsPlugin from 'wavesurfer.js/plugins/regions'
import type { Region } from 'wavesurfer.js/plugins/regions'
import { Play, Pause, Save, MapPin, Trash2 } from 'lucide-react'
import { Button, Text, Spinner } from '@primer/react'
import { useUiStore } from '../../store/uiStore'

interface StopMark {
  stop_id: string
  stop_name: string
  sequence_order: number
}

const REGION_COLOR = 'rgba(59, 130, 246, 0.3)'
const REGION_COLOR_ARMED = 'rgba(245, 158, 11, 0.35)'

export default function RouteStopEditor({
  routeId, clipUrl, stops
}: {
  routeId: string
  clipUrl: string
  stops: StopMark[]
}) {
  const { showToast } = useUiStore()
  const containerRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WaveSurfer | null>(null)
  const regionsRef = useRef<RegionsPlugin | null>(null)
  const regionByStopRef = useRef<Map<string, Region>>(new Map())

  const [ready, setReady] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [armedStopId, setArmedStopId] = useState<string | null>(null)
  const [markedStopIds, setMarkedStopIds] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  const armedStopIdRef = useRef<string | null>(null)
  useEffect(() => { armedStopIdRef.current = armedStopId }, [armedStopId])

  const refreshMarked = useCallback(() => {
    setMarkedStopIds(new Set(regionByStopRef.current.keys()))
  }, [])

  // Init wavesurfer + regions plugin, load clip + existing timestamps
  useEffect(() => {
    if (!containerRef.current) return
    setReady(false)
    regionByStopRef.current.clear()

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: 'var(--fgColor-muted)' as unknown as string,
      progressColor: 'var(--fgColor-accent)' as unknown as string,
      height: 72,
      url: clipUrl,
      cursorColor: 'var(--fgColor-default)' as unknown as string
    })
    wsRef.current = ws
    const regions = ws.registerPlugin(RegionsPlugin.create())
    regionsRef.current = regions

    ws.on('play', () => setPlaying(true))
    ws.on('pause', () => setPlaying(false))
    ws.on('finish', () => setPlaying(false))

    regions.on('region-created', (region) => {
      const stopId = armedStopIdRef.current
      if (!stopId) { region.remove(); return }
      const stop = stops.find((s) => s.stop_id === stopId)
      region.setOptions({ color: REGION_COLOR, content: stop?.stop_name ?? '' })
      const prior = regionByStopRef.current.get(stopId)
      if (prior && prior !== region) prior.remove()
      regionByStopRef.current.set(stopId, region)
      refreshMarked()
      setArmedStopId(null)
    })

    ws.on('ready', async () => {
      setReady(true)
      const durationMs = ws.getDuration() * 1000
      const result = await window.api.audio.getStopTimestamps(routeId)
      if (result.success) {
        for (const t of result.data) {
          const stop = stops.find((s) => s.stop_id === t.stop_id)
          if (!stop || durationMs === 0) continue
          const region = regions.addRegion({
            start: t.start_ms / 1000,
            end: t.end_ms / 1000,
            color: REGION_COLOR,
            content: stop.stop_name,
            drag: true,
            resize: true
          })
          regionByStopRef.current.set(t.stop_id, region)
        }
        refreshMarked()
      }
    })

    return () => { ws.destroy(); wsRef.current = null; regionsRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clipUrl, routeId])

  // Toggle drag-to-create-region mode based on whether a stop is armed
  useEffect(() => {
    const regions = regionsRef.current
    if (!regions) return
    if (armedStopId) {
      const disable = regions.enableDragSelection({ color: REGION_COLOR_ARMED })
      return () => disable()
    }
    return undefined
  }, [armedStopId, ready])

  const togglePlay = () => wsRef.current?.playPause()

  const playStop = (stopId: string) => {
    const region = regionByStopRef.current.get(stopId)
    region?.play()
  }

  const clearStop = (stopId: string) => {
    regionByStopRef.current.get(stopId)?.remove()
    regionByStopRef.current.delete(stopId)
    refreshMarked()
  }

  const saveAll = async () => {
    setSaving(true)
    const timestamps = [...regionByStopRef.current.entries()].map(([stop_id, region]) => ({
      stop_id,
      start_ms: Math.round(region.start * 1000),
      end_ms: Math.round(region.end * 1000)
    }))
    const result = await window.api.audio.saveStopTimestamps({ route_id: routeId, timestamps })
    setSaving(false)
    if (result.success) showToast(`Saved ${timestamps.length} stop timestamp${timestamps.length !== 1 ? 's' : ''}`)
    else showToast(result.error, 'error')
  }

  const allMarked = stops.length > 0 && stops.every((s) => markedStopIds.has(s.stop_id))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Button size="small" variant="default" leadingVisual={playing ? Pause : Play} disabled={!ready} onClick={togglePlay}>
          {playing ? 'Pause' : 'Play full clip'}
        </Button>
        {!ready && <Spinner size="small" />}
        <div style={{ flex: 1 }} />
        <Button size="small" variant="primary" leadingVisual={Save} disabled={saving || markedStopIds.size === 0} onClick={saveAll}>
          {saving ? 'Saving…' : `Save Timestamps (${markedStopIds.size}/${stops.length})`}
        </Button>
      </div>

      <div ref={containerRef} style={{ borderRadius: 6, overflow: 'hidden', border: '1px solid var(--borderColor-default)', background: 'var(--bgColor-inset)', padding: '4px 8px' }} />

      {armedStopId && (
        <Text sx={{ fontSize: 0, color: 'attention.fg', fontWeight: 'semibold' }}>
          Drag across the waveform to mark "{stops.find((s) => s.stop_id === armedStopId)?.stop_name}"
        </Text>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {stops.map((stop) => {
          const isMarked = markedStopIds.has(stop.stop_id)
          const isArmed = armedStopId === stop.stop_id
          return (
            <div key={stop.stop_id} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 6,
              background: isArmed ? 'var(--bgColor-attention-muted)' : 'var(--bgColor-muted)',
              border: '1px solid ' + (isArmed ? 'var(--borderColor-attention-emphasis)' : 'var(--borderColor-muted)')
            }}>
              <MapPin size={14} style={{ color: isMarked ? 'var(--fgColor-accent)' : 'var(--fgColor-muted)', flexShrink: 0 }} />
              <Text sx={{ fontSize: 0, flex: 1, fontWeight: isMarked ? 'semibold' : 'normal' }}>{stop.stop_name}</Text>
              {isMarked && (
                <IconTextButton icon={Play} label="Play" onClick={() => playStop(stop.stop_id)} />
              )}
              <Button size="small" variant={isMarked ? 'default' : 'primary'} onClick={() => setArmedStopId(stop.stop_id)}>
                {isMarked ? 'Re-mark' : 'Mark'}
              </Button>
              {isMarked && (
                <Button size="small" variant="danger" leadingVisual={Trash2} onClick={() => clearStop(stop.stop_id)}>Clear</Button>
              )}
            </div>
          )
        })}
      </div>

      {allMarked && (
        <Text sx={{ fontSize: 0, color: 'success.fg' }}>All stops marked — this route can be split for any bus assignment.</Text>
      )}
    </div>
  )
}

function IconTextButton({ icon: Icon, label, onClick }: { icon: typeof Play; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="hov-bg-subtle" style={{
      display: 'flex', alignItems: 'center', gap: 4, background: 'transparent', border: 'none',
      cursor: 'pointer', color: 'var(--fgColor-muted)', fontSize: 12, padding: '4px 6px', borderRadius: 4
    }}>
      <Icon size={12} /> {label}
    </button>
  )
}
