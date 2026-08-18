import { useEffect, useRef, useState } from 'react'
import WaveSurfer from 'wavesurfer.js'
import RecordPlugin from 'wavesurfer.js/plugins/record'
import { Mic, Square, Play, Pause, RotateCcw, Check, Upload, Pencil } from 'lucide-react'
import { Button, Text, Spinner } from '@primer/react'
import { useUiStore } from '../../store/uiStore'
import TrimWaveform, { type TrimWaveformHandle } from './TrimWaveform'
import { decodeToAudioBuffer, renderTrimmedRange, isFullRange } from '../../lib/audioTrim'
import type { AudioClip, AudioClipType } from '../../../shared/types'

interface AudioRecorderProps {
  type: AudioClipType
  /** route_id / bus_id / gender value — null for the single GREETING clip */
  refId: string | null
  existingClip: AudioClip | null
  onSaved: (clip: AudioClip) => void
  /** Stop names in order, shown as a reading guide while recording a ROUTE clip */
  stopNames?: string[]
}

type Mode = 'idle' | 'recording' | 'pending'

function formatMs(ms: number): string {
  const s = Math.round(ms / 100) / 10
  return `${s.toFixed(1)}s`
}

export default function AudioRecorder({ type, refId, existingClip, onSaved, stopNames }: AudioRecorderProps) {
  const { showToast } = useUiStore()
  const [mode, setMode] = useState<Mode>('idle')
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null)
  const [recordElapsedMs, setRecordElapsedMs] = useState(0)
  const [recordPaused, setRecordPaused] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loadingExisting, setLoadingExisting] = useState(false)
  const [playing, setPlaying] = useState(false)

  const recordContainerRef = useRef<HTMLDivElement>(null)
  const recordPluginRef = useRef<RecordPlugin | null>(null)
  const trimRef = useRef<TrimWaveformHandle>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const audioElRef = useRef<HTMLAudioElement | null>(null)

  // Live waveform recording — attaches the official Record plugin whenever we enter 'recording' mode
  useEffect(() => {
    if (mode !== 'recording' || !recordContainerRef.current) return
    const ws = WaveSurfer.create({
      container: recordContainerRef.current,
      waveColor: 'var(--fgColor-muted)' as unknown as string,
      progressColor: 'var(--fgColor-danger)' as unknown as string,
      height: 64
    })
    const record = ws.registerPlugin(RecordPlugin.create({ scrollingWaveform: true, renderRecordedAudio: false }))
    recordPluginRef.current = record
    setRecordElapsedMs(0)
    setRecordPaused(false)

    record.on('record-progress', (ms) => setRecordElapsedMs(ms))
    record.on('record-end', (blob) => {
      setPendingBlob(blob)
      setMode('pending')
    })
    record.startRecording().catch(() => {
      showToast('Microphone access denied or unavailable', 'error')
      setMode('idle')
    })

    return () => { ws.destroy(); recordPluginRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  const togglePause = () => {
    const r = recordPluginRef.current
    if (!r) return
    if (r.isPaused()) { r.resumeRecording(); setRecordPaused(false) } else { r.pauseRecording(); setRecordPaused(true) }
  }

  const stopRecording = () => recordPluginRef.current?.stopRecording()

  const onUploadClick = () => fileInputRef.current?.click()

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setPendingBlob(file)
    setMode('pending')
  }

  const editExisting = async () => {
    if (!existingClip) return
    setLoadingExisting(true)
    try {
      const res = await fetch(existingClip.url)
      const blob = await res.blob()
      setPendingBlob(blob)
      setMode('pending')
    } catch {
      showToast('Could not load clip for editing', 'error')
    }
    setLoadingExisting(false)
  }

  const discard = () => {
    setPendingBlob(null)
    setMode('idle')
  }

  const save = async () => {
    if (!pendingBlob || !trimRef.current) return
    setSaving(true)
    try {
      const { start, end } = trimRef.current.getRange()
      const total = trimRef.current.duration()
      let outBlob = pendingBlob
      if (!(isFullRange(start, end, total) && pendingBlob.type.startsWith('audio/webm'))) {
        const buffer = await decodeToAudioBuffer(pendingBlob)
        outBlob = await renderTrimmedRange(buffer, start, end)
      }
      const buffer = await outBlob.arrayBuffer()
      const duration_ms = Math.round((end - start) * 1000)
      const result = await window.api.audio.saveClip({ type, ref_id: refId, buffer, duration_ms })
      if (result.success) {
        showToast('Clip saved')
        setPendingBlob(null)
        setMode('idle')
        onSaved(result.data)
      } else {
        showToast(result.error, 'error')
      }
    } catch (e) {
      showToast(`Failed to process audio: ${String(e)}`, 'error')
    }
    setSaving(false)
  }

  const togglePlayExisting = () => {
    if (!audioElRef.current) return
    if (playing) audioElRef.current.pause()
    else audioElRef.current.play()
  }

  const fileInput = (
    <input ref={fileInputRef} type="file" accept="audio/*" style={{ display: 'none' }} onChange={onFileChange} />
  )

  if (mode === 'pending' && pendingBlob) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {fileInput}
        <TrimWaveform ref={trimRef} source={pendingBlob} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Button size="small" variant="danger" leadingVisual={RotateCcw} onClick={discard}>Discard</Button>
          <Button size="small" variant="primary" leadingVisual={saving ? undefined : Check} disabled={saving} onClick={save}>
            {saving ? <Spinner size="small" /> : 'Save'}
          </Button>
          {saving && <Text sx={{ fontSize: 0, color: 'fg.muted' }}>Processing audio…</Text>}
        </div>
      </div>
    )
  }

  if (mode === 'recording') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {fileInput}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--fgColor-danger)', animation: recordPaused ? 'none' : 'audio-rec-pulse 1s infinite' }} />
          <Text sx={{ fontSize: 0, color: 'danger.fg', fontWeight: 'semibold' }}>
            {recordPaused ? 'Paused' : 'Recording…'} {formatMs(recordElapsedMs)}
          </Text>
          <div style={{ flex: 1 }} />
          <Button size="small" variant="default" leadingVisual={recordPaused ? Play : Pause} onClick={togglePause}>
            {recordPaused ? 'Resume' : 'Pause'}
          </Button>
          <Button size="small" variant="danger" leadingVisual={Square} onClick={stopRecording}>Stop</Button>
        </div>
        {stopNames && stopNames.length > 0 && (
          <div style={{ borderRadius: 6, border: '1px solid var(--borderColor-accent-emphasis)', background: 'var(--bgColor-accent-muted)', padding: '10px 14px' }}>
            <Text sx={{ fontSize: 0, fontWeight: 'semibold', color: 'accent.fg', display: 'block', mb: 2 }}>
              Read these stops in order:
            </Text>
            <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {stopNames.map((name, i) => (
                <li key={i}><Text sx={{ fontSize: 1 }}>{name}</Text></li>
              ))}
            </ol>
          </div>
        )}
        <div ref={recordContainerRef} style={{ borderRadius: 6, overflow: 'hidden', border: '1px solid var(--borderColor-default)', background: 'var(--bgColor-inset)', padding: '6px 8px' }} />
        <style>{`@keyframes audio-rec-pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.3 } }`}</style>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {fileInput}
      {!existingClip && stopNames && stopNames.length > 0 && (
        <div style={{ borderRadius: 6, border: '1px solid var(--borderColor-default)', background: 'var(--bgColor-muted)', padding: '10px 14px' }}>
          <Text sx={{ fontSize: 0, fontWeight: 'semibold', color: 'fg.muted', display: 'block', mb: 2 }}>
            You'll read these stops in order:
          </Text>
          <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {stopNames.map((name, i) => (
              <li key={i}><Text sx={{ fontSize: 1 }}>{name}</Text></li>
            ))}
          </ol>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
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
            <Button size="small" variant="default" leadingVisual={Mic} onClick={() => setMode('recording')}>Re-record</Button>
            <Button size="small" variant="default" leadingVisual={Upload} onClick={onUploadClick}>Upload New</Button>
            <Button size="small" variant="default" leadingVisual={loadingExisting ? undefined : Pencil} disabled={loadingExisting} onClick={editExisting}>
              {loadingExisting ? <Spinner size="small" /> : 'Trim'}
            </Button>
          </>
        ) : (
          <>
            <Button size="small" variant="primary" leadingVisual={Mic} onClick={() => setMode('recording')}>Record</Button>
            <Button size="small" variant="default" leadingVisual={Upload} onClick={onUploadClick}>Upload File</Button>
          </>
        )}
      </div>
    </div>
  )
}
