import { useEffect, useRef, useState, useCallback } from 'react'
import WaveSurfer from 'wavesurfer.js'
import RegionsPlugin from 'wavesurfer.js/plugins/regions'
import type { Region } from 'wavesurfer.js/plugins/regions'
import HoverPlugin from 'wavesurfer.js/plugins/hover'
import TimelinePlugin from 'wavesurfer.js/plugins/timeline'
import ZoomPlugin from 'wavesurfer.js/plugins/zoom'
import { Play, Pause, Save, MapPin, Trash2, ArrowLeftRight, MousePointerClick } from 'lucide-react'
import { Button, Text, Spinner, Select } from '@primer/react'
import { useUiStore } from '../../store/uiStore'

interface StopMark {
  stop_id: string
  stop_name: string
  sequence_order: number
}

const REGION_COLOR = 'rgba(59, 130, 246, 0.3)'

export default function RouteStopEditor({
  routeId, clipUrl, stops
}: {
  routeId: string
  clipUrl: string
  stops: StopMark[]
}) {
  const { showToast } = useUiStore()
  const containerRef = useRef<HTMLDivElement>(null)
  const timelineRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WaveSurfer | null>(null)
  const regionsRef = useRef<RegionsPlugin | null>(null)
  const regionByStopRef = useRef<Map<string, Region>>(new Map())

  const [ready, setReady] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [markedStopIds, setMarkedStopIds] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [reassigningStopId, setReassigningStopId] = useState<string | null>(null)

  const sortedStops = [...stops].sort((a, b) => a.sequence_order - b.sequence_order)
  const stopsRef = useRef(sortedStops)
  stopsRef.current = sortedStops

  const refreshMarked = useCallback(() => {
    setMarkedStopIds(new Set(regionByStopRef.current.keys()))
  }, [])

  const labelRegion = useCallback((region: Region, stopId: string) => {
    const stop = stopsRef.current.find((s) => s.stop_id === stopId)
    region.setOptions({ color: REGION_COLOR, content: stop?.stop_name ?? '' })
  }, [])

  // Init wavesurfer + regions/timeline/hover/zoom plugins, load clip + existing timestamps
  useEffect(() => {
    if (!containerRef.current) return
    setReady(false)
    regionByStopRef.current.clear()

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: 'var(--fgColor-muted)' as unknown as string,
      progressColor: 'var(--fgColor-accent)' as unknown as string,
      height: 88,
      url: clipUrl,
      cursorColor: 'var(--fgColor-default)' as unknown as string,
      plugins: [
        HoverPlugin.create({ labelBackground: 'var(--bgColor-emphasis)', labelColor: 'var(--fgColor-onEmphasis)' }),
        TimelinePlugin.create({ container: timelineRef.current ?? undefined, height: 16 }),
        ZoomPlugin.create({ scale: 0.5, maxZoom: 400 })
      ]
    })
    wsRef.current = ws
    const regions = ws.registerPlugin(RegionsPlugin.create())
    regionsRef.current = regions

    ws.on('play', () => setPlaying(true))
    ws.on('pause', () => setPlaying(false))
    ws.on('finish', () => setPlaying(false))

    // Dragging anywhere on empty waveform creates a region auto-assigned to
    // the next unmarked stop in sequence order — no separate "arm" step.
    regions.on('region-created', (region) => {
      const unmarked = stopsRef.current.filter((s) => !regionByStopRef.current.has(s.stop_id))
      const next = unmarked[0]
      if (!next) {
        region.remove()
        showToast('All stops are already marked — clear one first to re-mark it', 'error')
        return
      }
      labelRegion(region, next.stop_id)
      regionByStopRef.current.set(next.stop_id, region)
      refreshMarked()
    })

    ws.on('ready', async () => {
      setReady(true)
      const durationMs = ws.getDuration() * 1000
      const result = await window.api.audio.getStopTimestamps(routeId)
      if (result.success) {
        for (const t of result.data) {
          const stop = stopsRef.current.find((s) => s.stop_id === t.stop_id)
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

  // Drag-to-create is always on — new regions auto-assign to the next unmarked stop
  useEffect(() => {
    const regions = regionsRef.current
    if (!regions || !ready) return
    const disable = regions.enableDragSelection({ color: REGION_COLOR })
    return () => disable()
  }, [ready])

  const togglePlay = () => wsRef.current?.playPause()

  const playStop = (stopId: string) => {
    regionByStopRef.current.get(stopId)?.play(true)
  }

  const clearStop = (stopId: string) => {
    regionByStopRef.current.get(stopId)?.remove()
    regionByStopRef.current.delete(stopId)
    refreshMarked()
  }

  const reassign = (fromStopId: string, toStopId: string) => {
    setReassigningStopId(null)
    if (fromStopId === toStopId) return
    const region = regionByStopRef.current.get(fromStopId)
    if (!region) return
    const swapRegion = regionByStopRef.current.get(toStopId) ?? null

    regionByStopRef.current.delete(fromStopId)
    regionByStopRef.current.set(toStopId, region)
    labelRegion(region, toStopId)

    if (swapRegion) {
      regionByStopRef.current.set(fromStopId, swapRegion)
      labelRegion(swapRegion, fromStopId)
    }
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

  const allMarked = sortedStops.length > 0 && sortedStops.every((s) => markedStopIds.has(s.stop_id))
  const nextUnmarkedId = sortedStops.find((s) => !markedStopIds.has(s.stop_id))?.stop_id ?? null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Button size="small" variant="default" leadingVisual={playing ? Pause : Play} disabled={!ready} onClick={togglePlay}>
          {playing ? 'Pause' : 'Play full clip'}
        </Button>
        {!ready && <Spinner size="small" />}
        <Text sx={{ fontSize: 0, color: 'fg.muted', display: 'flex', alignItems: 'center', gap: 4 }}>
          <MousePointerClick size={12} /> Drag on the waveform to mark stops · scroll to zoom
        </Text>
        <div style={{ flex: 1 }} />
        <Button size="small" variant="primary" leadingVisual={Save} disabled={saving || markedStopIds.size === 0} onClick={saveAll}>
          {saving ? 'Saving…' : `Save Timestamps (${markedStopIds.size}/${sortedStops.length})`}
        </Button>
      </div>

      <div style={{ borderRadius: 6, overflow: 'hidden', border: '1px solid var(--borderColor-default)', background: 'var(--bgColor-inset)', padding: '4px 8px' }}>
        <div ref={containerRef} />
        <div ref={timelineRef} />
      </div>

      {nextUnmarkedId && (
        <Text sx={{ fontSize: 0, color: 'accent.fg' }}>
          Next drag will mark: <strong>{sortedStops.find((s) => s.stop_id === nextUnmarkedId)?.stop_name}</strong>
        </Text>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {sortedStops.map((stop) => {
          const isMarked = markedStopIds.has(stop.stop_id)
          const isNext = stop.stop_id === nextUnmarkedId
          return (
            <div key={stop.stop_id} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 6,
              background: isNext ? 'var(--bgColor-attention-muted)' : 'var(--bgColor-muted)',
              border: '1px solid ' + (isNext ? 'var(--borderColor-attention-emphasis)' : 'var(--borderColor-muted)')
            }}>
              <MapPin size={14} style={{ color: isMarked ? 'var(--fgColor-accent)' : 'var(--fgColor-muted)', flexShrink: 0 }} />
              <Text sx={{ fontSize: 0, flex: 1, fontWeight: isMarked ? 'semibold' : 'normal' }}>{stop.stop_name}</Text>

              {isMarked ? (
                <>
                  <IconTextButton icon={Play} label="Play" onClick={() => playStop(stop.stop_id)} />
                  {reassigningStopId === stop.stop_id ? (
                    <Select size="small" defaultValue="" onChange={(e) => reassign(stop.stop_id, e.target.value)} onBlur={() => setReassigningStopId(null)}>
                      <Select.Option value="" disabled>Reassign to…</Select.Option>
                      {sortedStops.filter((s) => s.stop_id !== stop.stop_id).map((s) => (
                        <Select.Option key={s.stop_id} value={s.stop_id}>{s.stop_name}</Select.Option>
                      ))}
                    </Select>
                  ) : (
                    <IconTextButton icon={ArrowLeftRight} label="Reassign" onClick={() => setReassigningStopId(stop.stop_id)} />
                  )}
                  <Button size="small" variant="danger" leadingVisual={Trash2} onClick={() => clearStop(stop.stop_id)}>Clear</Button>
                </>
              ) : isNext ? (
                <Text sx={{ fontSize: 0, color: 'attention.fg', fontWeight: 'semibold' }}>Up next</Text>
              ) : (
                <Text sx={{ fontSize: 0, color: 'fg.muted' }}>Not marked</Text>
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
