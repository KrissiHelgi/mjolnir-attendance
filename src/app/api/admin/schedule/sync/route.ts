import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseScheduleCSV, DEFAULT_CSV_URL } from '@/lib/schedule-sheet'

const SCHEDULE_CSV_KEY = 'schedule_csv_url'

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  let url: string
  try {
    const body = await request.json().catch(() => ({}))
    url = (body.url ?? '').trim()
    if (!url) {
      const { data: row } = await supabase.from('app_settings').select('value').eq('key', SCHEDULE_CSV_KEY).single()
      url = (row as { value?: string } | null)?.value ?? DEFAULT_CSV_URL
    }
    if (!url) {
      return NextResponse.json({ error: 'No CSV URL configured.' }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  let csvText: string
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) {
      return NextResponse.json({
        error: res.status === 403 || res.status === 404
          ? 'Sheet may not be public. Set sharing to "Anyone with the link" → Viewer.'
          : `Failed to fetch CSV: ${res.status}`,
      }, { status: 400 })
    }
    csvText = await res.text()
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to fetch CSV'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  const result = parseScheduleCSV(csvText)
  const payload = result.included.map((t) => ({
    program: t.program,
    title: t.title,
    weekday: t.weekday,
    start_time: t.start_time,
    duration_minutes: t.duration_minutes,
    location: t.location,
    capacity: t.capacity,
  }))

  const { error } = await supabase.rpc('sync_class_templates', { p_templates: payload })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  const excludedReasons = result.excluded.reduce((acc, e) => {
    acc[e.reason] = (acc[e.reason] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)
  return NextResponse.json({
    success: true,
    imported: result.included.length,
    excluded: result.excluded.length,
    excludedReasons: Object.keys(excludedReasons).length ? excludedReasons : undefined,
    totalRows: result.totalRows,
  })
}
