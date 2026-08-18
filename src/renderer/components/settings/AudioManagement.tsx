import { useEffect, useState, useCallback } from 'react'
import { Volume2, MapPin, Bus as BusIcon, Users, CheckCircle2 } from 'lucide-react'
import { Text, Heading, Spinner } from '@primer/react'
import AudioRecorder from '../audio/AudioRecorder'
import RouteStopEditor from '../audio/RouteStopEditor'
import type { AudioClip, Bus, Route, RouteWithStops, RunGender } from '../../../shared/types'

type Selection =
  | { kind: 'GREETING' }
  | { kind: 'GENDER'; gender: RunGender }
  | { kind: 'ROUTE'; route: Route }
  | { kind: 'BUS'; bus: Bus }

const GENDER_LABELS: Record<RunGender, string> = { BOYS: 'Boys', GIRLS: 'Girls', MIXED: 'Mixed' }

function selectionKey(s: Selection): string {
  if (s.kind === 'GREETING') return 'GREETING'
  if (s.kind === 'GENDER') return `GENDER:${s.gender}`
  if (s.kind === 'ROUTE') return `ROUTE:${s.route.id}`
  return `BUS:${s.bus.id}`
}

export default function AudioManagement() {
  const [clips, setClips] = useState<AudioClip[]>([])
  const [routes, setRoutes] = useState<Route[]>([])
  const [buses, setBuses] = useState<Bus[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Selection>({ kind: 'GREETING' })
  const [selectedRouteStops, setSelectedRouteStops] = useState<RouteWithStops | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [clipsRes, routesRes, busesRes] = await Promise.all([
      window.api.audio.getAll(),
      window.api.route.getAll(),
      window.api.bus.getAll()
    ])
    if (clipsRes.success) setClips(clipsRes.data)
    if (routesRes.success) setRoutes(routesRes.data)
    if (busesRes.success) setBuses(busesRes.data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  useEffect(() => {
    if (selected.kind === 'ROUTE') {
      window.api.route.getWithStops(selected.route.id).then((r) => {
        if (r.success) setSelectedRouteStops(r.data)
      })
    } else {
      setSelectedRouteStops(null)
    }
  }, [selected])

  const findClip = (type: AudioClip['type'], ref_id: string | null) =>
    clips.find((c) => c.type === type && c.ref_id === ref_id) ?? null

  const handleSaved = (clip: AudioClip) => {
    setClips((prev) => {
      const idx = prev.findIndex((c) => c.id === clip.id || (c.type === clip.type && c.ref_id === clip.ref_id))
      if (idx === -1) return [...prev, clip]
      const next = [...prev]
      next[idx] = clip
      return next
    })
  }

  if (loading) {
    return <div style={{ padding: 32, textAlign: 'center' }}><Spinner /></div>
  }

  const greetingClip = findClip('GREETING', null)
  const genderClip = (g: RunGender) => findClip('GENDER', g)
  const routeClip = (id: string) => findClip('ROUTE', id)
  const busClip = (id: string) => findClip('BUS', id)

  const activeRoutes = routes.filter((r) => r.is_active)

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Left: category list */}
      <div style={{ width: 280, flexShrink: 0, borderRight: '1px solid var(--borderColor-default)', display: 'flex', flexDirection: 'column', background: 'var(--bgColor-default)' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--borderColor-default)' }}>
          <Heading as="h2" sx={{ fontSize: 1, fontWeight: 'semibold' }}>Audio Clips</Heading>
          <Text sx={{ fontSize: 0, color: 'fg.muted' }}>Record the pieces the app stitches into announcements</Text>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          <SectionHeader label="General" />
          <ListRow
            icon={Volume2}
            label="Greeting"
            marked={!!greetingClip}
            selected={selected.kind === 'GREETING'}
            onClick={() => setSelected({ kind: 'GREETING' })}
          />
          {(['BOYS', 'GIRLS', 'MIXED'] as RunGender[]).map((g) => (
            <ListRow
              key={g}
              icon={Users}
              label={GENDER_LABELS[g]}
              marked={!!genderClip(g)}
              selected={selected.kind === 'GENDER' && selected.gender === g}
              onClick={() => setSelected({ kind: 'GENDER', gender: g })}
            />
          ))}

          <SectionHeader label={`Routes (${activeRoutes.length})`} />
          {activeRoutes.map((route) => (
            <ListRow
              key={route.id}
              icon={MapPin}
              iconColor={route.color}
              label={route.name}
              marked={!!routeClip(route.id)}
              selected={selected.kind === 'ROUTE' && selected.route.id === route.id}
              onClick={() => setSelected({ kind: 'ROUTE', route })}
            />
          ))}
          {activeRoutes.length === 0 && <EmptyHint text="No active routes yet" />}

          <SectionHeader label={`Buses (${buses.length})`} />
          {buses.map((bus) => (
            <ListRow
              key={bus.id}
              icon={BusIcon}
              label={`Bus ${bus.number}`}
              marked={!!busClip(bus.id)}
              selected={selected.kind === 'BUS' && selected.bus.id === bus.id}
              onClick={() => setSelected({ kind: 'BUS', bus })}
            />
          ))}
          {buses.length === 0 && <EmptyHint text="No buses yet" />}
        </div>
      </div>

      {/* Right: recorder + editor */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        {selected.kind === 'GREETING' && (
          <Panel title="Greeting" subtitle='Plays first in every announcement, e.g. "আসসালামু আলাইকুম"'>
            <AudioRecorder key={selectionKey(selected)} type="GREETING" refId={null} existingClip={greetingClip} onSaved={handleSaved} />
          </Panel>
        )}

        {selected.kind === 'GENDER' && (
          <Panel title={`${GENDER_LABELS[selected.gender]} label`} subtitle="Plays after each bus number, e.g. ছাত্র / ছাত্রী">
            <AudioRecorder key={selectionKey(selected)} type="GENDER" refId={selected.gender} existingClip={genderClip(selected.gender)} onSaved={handleSaved} />
          </Panel>
        )}

        {selected.kind === 'BUS' && (
          <Panel title={`Bus ${selected.bus.number}`} subtitle='e.g. "২২ নম্বর বাস"'>
            <AudioRecorder key={selectionKey(selected)} type="BUS" refId={selected.bus.id} existingClip={busClip(selected.bus.id)} onSaved={handleSaved} />
          </Panel>
        )}

        {selected.kind === 'ROUTE' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <Panel title={selected.route.name} subtitle="Record the full stop list as one natural phrase, in stop order">
              <AudioRecorder
                key={selectionKey(selected)}
                type="ROUTE"
                refId={selected.route.id}
                existingClip={routeClip(selected.route.id)}
                onSaved={handleSaved}
                stopNames={selectedRouteStops?.stops
                  .filter((s) => s.is_active)
                  .sort((a, b) => a.sequence_order - b.sequence_order)
                  .map((s) => s.name)}
              />
            </Panel>

            {routeClip(selected.route.id) && selectedRouteStops && (
              <Panel title="Mark stop boundaries" subtitle="Drag on the waveform to mark where each stop is spoken — lets the app trim this clip to any subset of stops when a run only covers part of the route">
                {selectedRouteStops.stops.filter((s) => s.is_active).length === 0 ? (
                  <Text sx={{ fontSize: 0, color: 'fg.muted' }}>This route has no active stops yet.</Text>
                ) : (
                  <RouteStopEditor
                    key={routeClip(selected.route.id)!.url}
                    routeId={selected.route.id}
                    clipUrl={routeClip(selected.route.id)!.url}
                    stops={selectedRouteStops.stops
                      .filter((s) => s.is_active)
                      .sort((a, b) => a.sequence_order - b.sequence_order)
                      .map((s) => ({ stop_id: s.id, stop_name: s.name, sequence_order: s.sequence_order }))}
                  />
                )}
              </Panel>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div style={{ padding: '10px 16px 4px' }}>
      <Text sx={{ fontSize: 0, fontWeight: 'semibold', color: 'fg.muted', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</Text>
    </div>
  )
}

function EmptyHint({ text }: { text: string }) {
  return <div style={{ padding: '4px 16px 8px' }}><Text sx={{ fontSize: 0, color: 'fg.muted' }}>{text}</Text></div>
}

function ListRow({
  icon: Icon, iconColor, label, marked, selected, onClick
}: {
  icon: typeof Volume2
  iconColor?: string
  label: string
  marked: boolean
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="hov-bg-subtle"
      style={{
        width: '100%', textAlign: 'left', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8,
        border: 'none', cursor: 'pointer',
        borderLeft: `2px solid ${selected ? 'var(--borderColor-accent-emphasis)' : 'transparent'}`,
        background: selected ? 'var(--bgColor-muted)' : 'transparent'
      }}
    >
      <Icon size={14} style={{ flexShrink: 0, color: iconColor ?? 'var(--fgColor-muted)' }} />
      <Text sx={{ fontSize: 1, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</Text>
      {marked && <CheckCircle2 size={14} style={{ color: 'var(--fgColor-success)', flexShrink: 0 }} />}
    </button>
  )
}

function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div style={{ border: '1px solid var(--borderColor-default)', borderRadius: 6, overflow: 'hidden' }}>
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--borderColor-muted)', background: 'var(--bgColor-muted)' }}>
        <Text sx={{ fontSize: 1, fontWeight: 'semibold', display: 'block' }}>{title}</Text>
        <Text sx={{ fontSize: 0, color: 'fg.muted', display: 'block', mt: 1 }}>{subtitle}</Text>
      </div>
      <div style={{ padding: 16 }}>{children}</div>
    </div>
  )
}
