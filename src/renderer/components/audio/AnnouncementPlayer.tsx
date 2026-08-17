import { useEffect, useRef, useState } from 'react'
import { Howl } from 'howler'
import { Play, Pause, Square, AlertTriangle, Volume2 } from 'lucide-react'
import { Button, Text, ProgressBar } from '@primer/react'
import type { AnnouncementGroup } from '../../../shared/types'

interface Step {
  label: string
  url: string
  offsetMs?: number
  durationMs?: number
}

function buildSteps(group: AnnouncementGroup): Step[] {
  const steps: Step[] = []
  if (group.greetingClipUrl) steps.push({ label: 'Greeting', url: group.greetingClipUrl })
  if (group.routeClipUrl && group.routeSegment) {
    steps.push({
      label: group.stop_names.join(', '),
      url: group.routeClipUrl,
      offsetMs: group.routeSegment.start_ms,
      durationMs: group.routeSegment.end_ms - group.routeSegment.start_ms
    })
  }
  for (const entry of group.entries) {
    if (entry.busClipUrl) steps.push({ label: `Bus ${entry.bus_number}`, url: entry.busClipUrl })
    if (entry.genderClipUrl) steps.push({ label: entry.gender, url: entry.genderClipUrl })
  }
  return steps
}

export default function AnnouncementPlayer({ group }: { group: AnnouncementGroup | null }) {
  const [stepIndex, setStepIndex] = useState(-1)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const howlRef = useRef<Howl | null>(null)
  const rafRef = useRef<number | null>(null)
  const stepsRef = useRef<Step[]>([])

  const stop = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    howlRef.current?.stop()
    howlRef.current?.unload()
    howlRef.current = null
    setPlaying(false)
    setStepIndex(-1)
    setProgress(0)
  }

  // Reset whenever the selected announcement changes
  useEffect(() => {
    stop()
    stepsRef.current = group ? buildSteps(group) : []
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group?.key])

  useEffect(() => () => stop(), []) // eslint-disable-line react-hooks/exhaustive-deps

  const trackProgress = () => {
    const h = howlRef.current
    if (!h) return
    const dur = h.duration() || 1
    setProgress(Math.min(1, h.seek() / dur))
    rafRef.current = requestAnimationFrame(trackProgress)
  }

  const playStepAt = (index: number) => {
    const steps = stepsRef.current
    if (index >= steps.length) { stop(); return }

    const step = steps[index]
    const sprite = step.offsetMs !== undefined && step.durationMs !== undefined
      ? { seg: [step.offsetMs, Math.max(step.durationMs, 50)] as [number, number] }
      : undefined

    const howl = new Howl({
      src: [step.url],
      format: ['webm'],
      sprite,
      onplay: () => { setPlaying(true); rafRef.current = requestAnimationFrame(trackProgress) },
      onend: () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); playStepAt(index + 1) },
      onloaderror: () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); playStepAt(index + 1) }
    })
    howlRef.current = howl
    setStepIndex(index)
    howl.play(sprite ? 'seg' : undefined)
  }

  const play = () => {
    if (!group) return
    if (howlRef.current && stepIndex >= 0) { howlRef.current.play(); return }
    playStepAt(0)
  }

  const pause = () => {
    howlRef.current?.pause()
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    setPlaying(false)
  }

  if (!group) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', color: 'var(--fgColor-muted)' }}>
        <Volume2 size={16} />
        <Text sx={{ fontSize: 0 }}>Select an announcement to play</Text>
      </div>
    )
  }

  const steps = stepsRef.current
  const currentLabel = stepIndex >= 0 && stepIndex < steps.length ? steps[stepIndex].label : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 14px', border: '1px solid var(--borderColor-default)', borderRadius: 8, background: 'var(--bgColor-muted)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Text sx={{ fontSize: 1, fontWeight: 'semibold', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {group.route_name} — {group.stop_names.join(', ')}
        </Text>
        {!group.isComplete && (
          <span title="Some clips are missing" style={{ display: 'flex', alignItems: 'center', color: 'var(--fgColor-attention)' }}>
            <AlertTriangle size={14} />
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {!playing ? (
          <Button size="small" variant="primary" leadingVisual={Play} disabled={!group.isComplete} onClick={play}>Play</Button>
        ) : (
          <Button size="small" variant="default" leadingVisual={Pause} onClick={pause}>Pause</Button>
        )}
        <Button size="small" variant="default" leadingVisual={Square} disabled={stepIndex === -1} onClick={stop}>Stop</Button>
        <div style={{ flex: 1 }}>
          <ProgressBar progress={progress * 100} bg={playing ? 'accent.emphasis' : 'neutral.emphasis'} />
        </div>
        <Text sx={{ fontSize: 0, color: 'fg.muted', flexShrink: 0 }}>
          {stepIndex >= 0 ? `${stepIndex + 1}/${steps.length}` : `${steps.length} clips`}
        </Text>
      </div>

      {currentLabel && <Text sx={{ fontSize: 0, color: 'fg.muted' }}>Now playing: {currentLabel}</Text>}
      {!group.isComplete && <Text sx={{ fontSize: 0, color: 'attention.fg' }}>Missing recordings — finish them in Settings → Audio.</Text>}
    </div>
  )
}
