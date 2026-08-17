import { useEffect, useRef, useState } from 'react'
import { Mic, Square, Play, Pause, RotateCcw, Check } from 'lucide-react'
import { Button, Text, Spinner } from '@primer/react'
import { useUiStore } from '../../store/uiStore'
import type { AudioClip, AudioClipType } from '../../../shared/types'

interface AudioRecorderProps {
  type: AudioClipType
  /** route_id / bus_id / gender value — null for the single GREETING clip */
  refId: string | null
  existingClip: AudioClip | null
  onSaved: (clip: AudioClip) => void
  /** compact = icon-only row (used in list rows); default = full card */
  compact?: boolean
}

function formatMs(ms: number): string {
  const s = Math.round(ms / 100) / 10
  return `${s.toFixed(1)}s`
}

export default function AudioRecorder({ type, refId, existingClip, onSaved, compact }: AudioRecorderProps) {
  const { showToast } = useUiStore()
  const [recording, setRecording] = useState(false)
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null)
  const [pendingUrl, setPendingUrl] = useState<string | null>(null)
  const [pendingDurationMs, setPendingDurationMs] = useState(0)
  const [saving, setSaving] = useState(false)
  const [playing, setPlaying] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startTimeRef = useRef(0)
  const streamRef = useRef<MediaStream | null>(null)
  const audioElRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => () => {
    if (pendingUrl) URL.revokeObjectURL(pendingUrl)
    streamRef.current?.getTracks().forEach((t) => t.stop())
  }, [pendingUrl])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunksRef.current = []
      const recorder = new MediaRecorder(stream)
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const url = URL.createObjectURL(blob)
        setPendingBlob(blob)
        setPendingUrl(url)
        setPendingDurationMs(Date.now() - startTimeRef.current)
        stream.getTracks().forEach((t) => t.stop())
      }
      mediaRecorderRef.current = recorder
      startTimeRef.current = Date.now()
      recorder.start()
      setRecording(true)
    } catch {
      showToast('Microphone access denied or unavailable', 'error')
    }
  }

  const stopRecording = () => {
    mediaRecorderRef.current?.stop()
    setRecording(false)
  }

  const discard = () => {
    if (pendingUrl) URL.revokeObjectURL(pendingUrl)
    setPendingBlob(null)
    setPendingUrl(null)
    setPendingDurationMs(0)
  }

  const save = async () => {
    if (!pendingBlob) return
    setSaving(true)
    const buffer = await pendingBlob.arrayBuffer()
    const result = await window.api.audio.saveClip({ type, ref_id: refId, buffer, duration_ms: pendingDurationMs })
    setSaving(false)
    if (result.success) {
      showToast('Clip saved')
      discard()
      onSaved(result.data)
    } else {
      showToast(result.error, 'error')
    }
  }

  const togglePlayExisting = () => {
    if (!audioElRef.current) return
    if (playing) { audioElRef.current.pause() } else { audioElRef.current.play() }
  }

  const gap = compact ? 6 : 8

  if (pendingUrl) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap }}>
        <audio src={pendingUrl} controls style={{ height: 32, maxWidth: compact ? 180 : 260 }} />
        <Text sx={{ fontSize: 0, color: 'fg.muted' }}>{formatMs(pendingDurationMs)}</Text>
        <Button size="small" variant="danger" leadingVisual={RotateCcw} onClick={discard}>Discard</Button>
        <Button size="small" variant="primary" leadingVisual={saving ? undefined : Check} disabled={saving} onClick={save}>
          {saving ? <Spinner size="small" /> : 'Save'}
        </Button>
      </div>
    )
  }

  if (recording) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--fgColor-danger)', animation: 'audio-rec-pulse 1s infinite' }} />
        <Text sx={{ fontSize: 0, color: 'danger.fg', fontWeight: 'semibold' }}>Recording…</Text>
        <Button size="small" variant="danger" leadingVisual={Square} onClick={stopRecording}>Stop</Button>
        <style>{`@keyframes audio-rec-pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.3 } }`}</style>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap }}>
      {existingClip ? (
        <>
          <audio
            ref={audioElRef}
            src={existingClip.url}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
            style={{ display: 'none' }}
          />
          <Button size="small" variant="default" leadingVisual={playing ? Pause : Play} onClick={togglePlayExisting}>
            {playing ? 'Pause' : 'Play'}
          </Button>
          <Text sx={{ fontSize: 0, color: 'fg.muted' }}>{formatMs(existingClip.duration_ms)}</Text>
          <Button size="small" variant="default" leadingVisual={Mic} onClick={startRecording}>Re-record</Button>
        </>
      ) : (
        <Button size="small" variant="primary" leadingVisual={Mic} onClick={startRecording}>Record</Button>
      )}
    </div>
  )
}
