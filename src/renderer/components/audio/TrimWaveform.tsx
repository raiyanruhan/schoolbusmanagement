import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import WaveSurfer from 'wavesurfer.js'
import RegionsPlugin, { type Region } from 'wavesurfer.js/plugins/regions'
import HoverPlugin from 'wavesurfer.js/plugins/hover'
import TimelinePlugin from 'wavesurfer.js/plugins/timeline'
import { Play, Pause, Scissors, Maximize2 } from 'lucide-react'
import { Button, Text, Spinner } from '@primer/react'

export interface TrimWaveformHandle {
  getRange: () => { start: number; end: number }
  duration: () => number
}

function formatTime(s: number): string {
  if (!isFinite(s)) return '0.0s'
  return `${s.toFixed(1)}s`
}

const TRIM_COLOR = 'rgba(59, 130, 246, 0.25)'

/**
 * Waveform + single draggable/resizable trim region. Used to review a fresh
 * recording/upload before saving, or to re-trim an already-saved clip.
 */
const TrimWaveform = forwardRef<TrimWaveformHandle, { source: Blob | string }>(function TrimWaveform(
  { source },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const timelineRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WaveSurfer | null>(null)
  const regionRef = useRef<Region | null>(null)

  const [ready, setReady] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [range, setRange] = useState({ start: 0, end: 0 })
  const [duration, setDuration] = useState(0)

  useImperativeHandle(ref, () => ({
    getRange: () => (regionRef.current ? { start: regionRef.current.start, end: regionRef.current.end } : range),
    duration: () => duration
  }))

  useEffect(() => {
    if (!containerRef.current) return
    setReady(false)

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: 'var(--fgColor-muted)' as unknown as string,
      progressColor: 'var(--fgColor-accent)' as unknown as string,
      height: 64,
      cursorColor: 'var(--fgColor-default)' as unknown as string,
      plugins: [
        HoverPlugin.create({ labelBackground: 'var(--bgColor-emphasis)', labelColor: 'var(--fgColor-onEmphasis)' }),
        TimelinePlugin.create({ container: timelineRef.current ?? undefined, height: 16 })
      ]
    })
    wsRef.current = ws
    const regions = ws.registerPlugin(RegionsPlugin.create())

    if (typeof source === 'string') ws.load(source)
    else ws.loadBlob(source)

    ws.on('play', () => setPlaying(true))
    ws.on('pause', () => setPlaying(false))
    ws.on('finish', () => setPlaying(false))

    ws.on('ready', () => {
      const d = ws.getDuration()
      setDuration(d)
      const region = regions.addRegion({ start: 0, end: d, color: TRIM_COLOR, drag: true, resize: true })
      regionRef.current = region
      setRange({ start: 0, end: d })
      setReady(true)
    })

    regions.on('region-updated', (region) => {
      setRange({ start: region.start, end: region.end })
    })

    return () => { ws.destroy(); wsRef.current = null; regionRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source])

  const playSelection = () => regionRef.current?.play(true)
  const resetRange = () => {
    if (!regionRef.current || duration === 0) return
    regionRef.current.setOptions({ start: 0, end: duration })
    setRange({ start: 0, end: duration })
  }

  const trimmedMs = Math.max(0, range.end - range.start) * 1000
  const isTrimmed = duration > 0 && (range.start > 0.05 || range.end < duration - 0.05)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ position: 'relative', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--borderColor-default)', background: 'var(--bgColor-inset)', padding: '6px 8px' }}>
        <div ref={containerRef} />
        <div ref={timelineRef} />
        {!ready && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bgColor-inset)' }}>
            <Spinner size="small" />
          </div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Button size="small" variant="default" leadingVisual={playing ? Pause : Play} disabled={!ready} onClick={playSelection}>
          {playing ? 'Pause' : 'Preview'}
        </Button>
        <Text sx={{ fontSize: 0, color: 'fg.muted' }}>
          <Scissors size={11} style={{ verticalAlign: -1, marginRight: 3 }} />
          {formatTime(trimmedMs / 1000)} selected {duration > 0 && `of ${formatTime(duration)}`}
        </Text>
        {isTrimmed && (
          <Button size="small" variant="invisible" leadingVisual={Maximize2} onClick={resetRange}>
            Use full clip
          </Button>
        )}
        <div style={{ flex: 1 }} />
        <Text sx={{ fontSize: 0, color: 'fg.muted' }}>Drag the edges to trim</Text>
      </div>
    </div>
  )
})

export default TrimWaveform
