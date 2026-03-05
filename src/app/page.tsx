import { createClient } from '@/lib/supabase/server'
import {
  getCurrentProfile,
  getTodayLocalDate,
  parseLocalDateParam,
  getWeekdayForLocalDate,
  compareLocalDates,
  formatLocalDateLabelWithWeekday,
} from '@/lib/helpers'
import { getProgramLabel } from '@/lib/programs'
import { canEditAttendance } from '@/lib/attendance-lock'
import { getOrCreateOccurrence } from '@/lib/actions/dashboard'
import { redirect } from 'next/navigation'
import { DashboardClient } from '@/components/DashboardClient'
import { AdminMissingBanner } from '@/components/AdminMissingBanner'
import { getMissingLogsCount, last7DaysRange } from '@/lib/analytics'

export const dynamic = 'force-dynamic'

type PageProps = { searchParams: Promise<{ date?: string }> }

export default async function DashboardPage({ searchParams }: PageProps) {
  const resolved = await searchParams
  const todayDate = getTodayLocalDate()
  const selectedLocalDate = parseLocalDateParam(resolved.date) ?? todayDate
  const selectedWeekday = getWeekdayForLocalDate(selectedLocalDate)
  const isFuture = compareLocalDates(selectedLocalDate, todayDate) > 0

  let user = null
  let profile = null
  let cards: Array<{
    occurrenceId: string
    startsAt: string
    endsAt?: string
    programLabel: string
    title: string
    time: string
    location?: string
    capacity?: number
    headcount?: number
    loggedByName?: string
    updatedAt?: string
    locked: boolean
    canEdit: boolean
    showOverride: boolean
    status: 'finished' | 'ongoing' | 'upcoming'
    finishedMinutesAgo?: number
  }> = []
  let allCardsWhenFiltered: typeof cards | null = null
  let loadError: string | null = null

  try {
    const supabase = await createClient()
    const { data: authData } = await supabase.auth.getUser()
    user = authData?.user ?? null

    if (!user) {
      redirect('/login')
    }

    profile = await getCurrentProfile()

    // Templates for selected date's weekday (only "live" classes show on dashboard)
    let templatesQuery = supabase
      .from('class_templates')
      .select('id, program, title, start_time, location, capacity, duration_minutes')
      .eq('weekday', selectedWeekday)
      .eq('live', true)
      .order('start_time', { ascending: true })

    const { data: templates, error: templatesError } = await templatesQuery

    if (templatesError) {
      loadError = templatesError.message
    } else if (templates && templates.length > 0) {
      const templatesList = templates as Array<{ id: string; program: string; title: string; start_time: string; location?: string; capacity?: number; duration_minutes?: number }>
      const coachedPrograms = Array.isArray(profile?.coached_programs) ? profile!.coached_programs as string[] : []
      const isCoachOrHeadCoach = profile?.role === 'coach' || profile?.role === 'head_coach'
      const hasProgramFilter = isCoachOrHeadCoach && coachedPrograms.length > 0
      const filtered = hasProgramFilter
        ? templatesList.filter((t) => new Set(coachedPrograms).has(t.program))
        : templatesList

      const isAdmin = profile?.role === 'admin'

      // Batch fetch existing occurrences for this date and these templates
      const templateIds = filtered.map((t) => t.id)
      const { data: existingOccs } = await supabase
        .from('class_occurrences')
        .select('id, starts_at, class_template_id')
        .eq('local_date', selectedLocalDate)
        .in('class_template_id', templateIds)
      const occByTemplateId = new Map<string | null, { id: string; starts_at: string }>()
      existingOccs?.forEach((o: { id: string; starts_at: string; class_template_id: string }) => {
        occByTemplateId.set(o.class_template_id, { id: o.id, starts_at: o.starts_at })
      })
      const missing = filtered.filter((t) => !occByTemplateId.has(t.id))
      const created = await Promise.all(
        missing.map((t) => getOrCreateOccurrence(t.id, selectedLocalDate, t.start_time))
      )
      created.forEach((r, i) => {
        if (r.data?.id && r.data?.starts_at) occByTemplateId.set(missing[i].id, { id: r.data.id, starts_at: r.data.starts_at })
      })
      if (created.some((r) => r.error)) {
        const first = created.find((r) => r.error)
        loadError = first?.error ?? 'Failed to create occurrence'
      } else {
        const allOccs = filtered
          .map((t) => ({ template: t, occ: occByTemplateId.get(t.id) }))
          .filter((x): x is { template: typeof filtered[0]; occ: { id: string; starts_at: string } } => x.occ != null)
        const occIds = allOccs.map((x) => x.occ.id)
        const { data: logs } =
          occIds.length > 0
            ? await supabase
                .from('attendance_logs')
                .select('class_occurrence_id, headcount, created_by_name, updated_at')
                .in('class_occurrence_id', occIds)
            : { data: [] }
        const logByOccId = new Map<string, { headcount: number; created_by_name: string | null; updated_at: string }>()
        ;(logs ?? []).forEach((l: { class_occurrence_id: string; headcount: number; created_by_name: string | null; updated_at: string }) => {
          logByOccId.set(l.class_occurrence_id, { headcount: l.headcount, created_by_name: l.created_by_name, updated_at: l.updated_at })
        })
        const now = Date.now()
        type Status = 'finished' | 'ongoing' | 'upcoming'
        for (const { template, occ } of allOccs) {
          const startTime = String(template.start_time)
          const timeStr = startTime.length >= 5 ? startTime.slice(0, 5) : startTime
          const durationMin = template.duration_minutes ?? 60
          const startMs = new Date(occ.starts_at).getTime()
          const endMs = startMs + durationMin * 60 * 1000
          let status: Status
          let finishedMinutesAgo: number | undefined
          if (now < startMs) status = 'upcoming'
          else if (now < endMs) status = 'ongoing'
          else {
            status = 'finished'
            finishedMinutesAgo = Math.floor((now - endMs) / 60000)
          }
          const log = logByOccId.get(occ.id)
          const editState =
            isFuture || status === 'upcoming'
              ? { locked: true, allowed: false }
              : canEditAttendance(isAdmin, occ.starts_at, log?.updated_at ?? null)
          cards.push({
            occurrenceId: occ.id,
            startsAt: occ.starts_at,
            endsAt: new Date(endMs).toISOString(),
            programLabel: getProgramLabel(template.program),
            title: template.title,
            time: timeStr,
            location: template.location,
            capacity: template.capacity,
            headcount: log?.headcount,
            loggedByName: log?.created_by_name ?? undefined,
            updatedAt: log?.updated_at ?? undefined,
            locked: editState.locked,
            canEdit: editState.allowed,
            showOverride: editState.locked && editState.allowed && 'isOverride' in editState,
            status,
            finishedMinutesAgo,
          })
        }
      }

      // Order: finished (most recent first), then ongoing, then upcoming
      cards.sort((a, b) => {
        const order = { finished: 0, ongoing: 1, upcoming: 2 }
        if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status]
        if (a.status === 'finished') return (b.finishedMinutesAgo ?? 0) - (a.finishedMinutesAgo ?? 0)
        return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
      })

      // When coach/head_coach has programs selected, build full list for "See all classes today"
      if (hasProgramFilter && templatesList.length > 0) {
        const allTemplateIds = templatesList.map((t) => t.id)
        const { data: allExistingOccs } = await supabase
          .from('class_occurrences')
          .select('id, starts_at, class_template_id')
          .eq('local_date', selectedLocalDate)
          .in('class_template_id', allTemplateIds)
        const allOccByTpl = new Map<string, { id: string; starts_at: string }>()
        allExistingOccs?.forEach((o: { id: string; starts_at: string; class_template_id: string }) => {
          allOccByTpl.set(o.class_template_id, { id: o.id, starts_at: o.starts_at })
        })
        const allMissing = templatesList.filter((t) => !allOccByTpl.has(t.id))
        const allCreated = await Promise.all(
          allMissing.map((t) => getOrCreateOccurrence(t.id, selectedLocalDate, t.start_time))
        )
        allCreated.forEach((r, i) => {
          if (r.data?.id && r.data?.starts_at) allOccByTpl.set(allMissing[i].id, { id: r.data.id, starts_at: r.data.starts_at })
        })
        const allOccs = templatesList
          .map((t) => ({ template: t, occ: allOccByTpl.get(t.id) }))
          .filter((x): x is { template: typeof templatesList[0]; occ: { id: string; starts_at: string } } => x.occ != null)
        const allOccIds = allOccs.map((x) => x.occ.id)
        const { data: allLogs } =
          allOccIds.length > 0
            ? await supabase
                .from('attendance_logs')
                .select('class_occurrence_id, headcount, created_by_name, updated_at')
                .in('class_occurrence_id', allOccIds)
            : { data: [] }
        const allLogByOcc = new Map<string, { headcount: number; created_by_name: string | null; updated_at: string }>()
        ;(allLogs ?? []).forEach((l: { class_occurrence_id: string; headcount: number; created_by_name: string | null; updated_at: string }) => {
          allLogByOcc.set(l.class_occurrence_id, { headcount: l.headcount, created_by_name: l.created_by_name, updated_at: l.updated_at })
        })
        const nowAll = Date.now()
        type S = 'finished' | 'ongoing' | 'upcoming'
        allCardsWhenFiltered = allOccs.map(({ template, occ }) => {
          const timeStr = String(template.start_time).length >= 5 ? String(template.start_time).slice(0, 5) : String(template.start_time)
          const durationMin = template.duration_minutes ?? 60
          const startMs = new Date(occ.starts_at).getTime()
          const endMs = startMs + durationMin * 60 * 1000
          let status: S
          let finishedMinutesAgo: number | undefined
          if (nowAll < startMs) status = 'upcoming'
          else if (nowAll < endMs) status = 'ongoing'
          else { status = 'finished'; finishedMinutesAgo = Math.floor((nowAll - endMs) / 60000) }
          const log = allLogByOcc.get(occ.id)
          const editState =
            isFuture || status === 'upcoming'
              ? { locked: true, allowed: false }
              : canEditAttendance(isAdmin, occ.starts_at, log?.updated_at ?? null)
          return {
            occurrenceId: occ.id,
            startsAt: occ.starts_at,
            endsAt: new Date(endMs).toISOString(),
            programLabel: getProgramLabel(template.program),
            title: template.title,
            time: timeStr,
            location: template.location,
            capacity: template.capacity,
            headcount: log?.headcount,
            loggedByName: log?.created_by_name ?? undefined,
            updatedAt: log?.updated_at ?? undefined,
            locked: editState.locked,
            canEdit: editState.allowed,
            showOverride: editState.locked && editState.allowed && 'isOverride' in editState,
            status,
            finishedMinutesAgo,
          }
        })
        allCardsWhenFiltered.sort((a, b) => {
          const order = { finished: 0, ongoing: 1, upcoming: 2 }
          if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status]
          if (a.status === 'finished') return (b.finishedMinutesAgo ?? 0) - (a.finishedMinutesAgo ?? 0)
          return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
        })
      }
    }
  } catch (err) {
    loadError = err instanceof Error ? err.message : 'Failed to load dashboard'
  }

  let missingLogsCount: number | null = null
  let coachOptions: { id: string; full_name: string | null }[] = []
  if (profile?.role === 'admin' && !loadError) {
    const [missingResult, profilesRes] = await Promise.all([
      getMissingLogsCount(last7DaysRange()),
      (async () => {
        const s = await createClient()
        return s.from('profiles').select('id, full_name').in('role', ['admin', 'coach', 'head_coach']).order('full_name', { ascending: true, nullsFirst: false })
      })(),
    ])
    if (!missingResult.error) missingLogsCount = missingResult.count ?? 0
    const profilesList = profilesRes.data ?? []
    coachOptions = profilesList.map((p: { id: string; full_name: string | null }) => ({ id: p.id, full_name: p.full_name ?? null }))
  }

  if (loadError) {
    return (
      <div className="px-4 py-6">
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">Error loading classes: {loadError}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 py-6">
      {profile?.role === 'admin' && missingLogsCount != null && missingLogsCount > 0 && (
        <AdminMissingBanner count={missingLogsCount} />
      )}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {selectedLocalDate === todayDate ? 'My Classes Today' : 'My Classes'}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {formatLocalDateLabelWithWeekday(selectedLocalDate)}
        </p>
      </div>

      {cards.length === 0 && (!allCardsWhenFiltered || allCardsWhenFiltered.length === 0) ? (
        <div className="rounded-2xl bg-white p-8 shadow-sm border border-gray-200 text-center">
          <p className="text-lg font-medium text-gray-700">
            {selectedLocalDate === todayDate ? 'Engir tímar í dag' : `Engir tímar ${formatLocalDateLabelWithWeekday(selectedLocalDate)}`}
          </p>
          <p className="mt-2 text-sm text-gray-500">
            Sía: {formatLocalDateLabelWithWeekday(selectedLocalDate)}. Tímar birtast þegar þú velur íþróttir í prófílnum þínum.
          </p>
          {profile?.role === 'admin' && (
            <p className="mt-2 text-sm text-gray-600">
              Stillingar → Vikudagatal til að setja inn tíma (eða synca frá Google Sheets).
            </p>
          )}
          {(profile?.role === 'coach' || profile?.role === 'head_coach') && (
            <a
              href="/profile"
              className="mt-4 inline-block min-h-[44px] px-4 py-2 rounded-xl bg-blue-600 text-white font-medium text-base"
            >
              Opna prófíl
            </a>
          )}
        </div>
      ) : (
        <DashboardClient
          cards={cards}
          allCards={allCardsWhenFiltered}
          isAdmin={profile?.role === 'admin'}
          coachOptions={coachOptions}
          showAllClassesBanner={
            (profile?.role === 'coach' || profile?.role === 'head_coach') &&
            (!Array.isArray(profile?.coached_programs) || profile.coached_programs.length === 0)
          }
          selectedLocalDate={selectedLocalDate}
          todayLocalDate={todayDate}
          viewOnly={isFuture}
        />
      )}
    </div>
  )
}

