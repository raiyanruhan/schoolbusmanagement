// Client-side audio decode + trim, no ffmpeg/wasm dependency.
// Trimming re-renders the selected range through a MediaStreamDestination and
// captures it with MediaRecorder in real time — the standard trick for
// producing a playable webm/opus clip from an AudioBuffer in the browser.

export function pickMimeType(): string {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm']
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c
  }
  return 'audio/webm'
}

export async function decodeToAudioBuffer(blob: Blob): Promise<AudioBuffer> {
  const arrayBuffer = await blob.arrayBuffer()
  const ctx = new AudioContext()
  try {
    return await ctx.decodeAudioData(arrayBuffer)
  } finally {
    ctx.close()
  }
}

const FULL_RANGE_EPSILON_SEC = 0.05

export function isFullRange(startSec: number, endSec: number, totalDuration: number): boolean {
  return startSec <= FULL_RANGE_EPSILON_SEC && endSec >= totalDuration - FULL_RANGE_EPSILON_SEC
}

export async function renderTrimmedRange(
  buffer: AudioBuffer,
  startSec: number,
  endSec: number
): Promise<Blob> {
  const duration = Math.max(0.05, endSec - startSec)
  const ctx = new AudioContext()
  const dest = ctx.createMediaStreamDestination()
  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.connect(dest)

  const mimeType = pickMimeType()
  const recorder = new MediaRecorder(dest.stream, { mimeType })
  const chunks: Blob[] = []
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }

  const stopped = new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }))
  })

  recorder.start()
  source.start(0, startSec, duration)
  await new Promise((r) => setTimeout(r, duration * 1000 + 150))
  recorder.stop()
  source.stop()

  const blob = await stopped
  await ctx.close()
  return blob
}
