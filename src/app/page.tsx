import { createClient } from '@/lib/supabase/server'
import {
  getCurrentProfile,
  getTodayLocalDate,
  parseLocalDateParam,
  getWeekdayForLocalDate,
  compareLocalDates,
} from '@/lib/helpers'
import { getProgramLabel } from '@/lib/programs'
import { canEditAttendance } from '@/lib/attendance-lock'
import { getOrCreateOccurrence } from '@/lib/actions/dashboard'
import { redirect } from 'next/navigation'
import { DashboardClient } from '@/components/DashboardClient'
import { AdminMissingBanner } from '@/components/AdminMissingBanner'
import { getMissingLogsCount, last7DaysRange } from '@/lib/analytics'

export const dynamic = 'force-dynamic'

const WEEKDAY_NAMES = ['Sun', 'Mán', 'Þri', 'Mið', 'Fim', 'Fös', 'Lau']

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
    programLabel: string
    title: string
    time: string
    location?: string
    capacity?: number
    headcount?: number
    locked: boolean
    canEdit: boolean
    showOverride: boolean
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

    // Templates for selected date's weekday
    let templatesQuery = supabase
      .from('class_templates')
      .select('id, program, title, start_time, location, capacity')
      .eq('weekday', selectedWeekday)
      .order('start_time', { ascending: true })

    const { data: templates, error: templatesError } = await templatesQuery

    if (templatesError) {
      loadError = templatesError.message
    } else if (templates && templates.length > 0) {
      const templatesList = templates as Array<{ id: string; program: string; title: string; start_time: string; location?: string; capacity?: number }>
      const coachedPrograms = Array.isArray(profile?.coached_programs) ? profile!.coached_programs as string[] : []
      const isCoachOrHeadCoach = profile?.role === 'coach' || profile?.role === 'head_coach'
      const hasProgramFilter = isCoachOrHeadCoach && coachedPrograms.length > 0
      const filtered = hasProgramFilter
        ? templatesList.filter((t) => new Set(coachedPrograms).has(t.program))
        : templatesList

      const isAdmin = profile?.role === 'admin'

      for (const template of filtered) {
        const { data: occ, error: occError } = await getOrCreateOccurrence(
          template.id,
          selectedLocalDate,
          template.start_time
        )
        if (occError) {
          loadError = occError
          break
        }
        if (!occ?.id || !occ.starts_at) continue

        const editState = isFuture
          ? { locked: true, allowed: false }
          : canEditAttendance(isAdmin, occ.starts_at)

        const { data: log } = await supabase
          .from('attendance_logs')
          .select('headcount')
          .eq('class_occurrence_id', occ.id)
          .single()

        const startTime = String(template.start_time)
        const timeStr =
          startTime.length >= 5
            ? `${startTime.slice(0, 5)}`
            : startTime

        cards.push({
          occurrenceId: occ.id,
          startsAt: occ.starts_at,
          programLabel: getProgramLabel(template.program),
          title: template.title,
          time: timeStr,
          location: template.location,
          capacity: template.capacity,
          headcount: log?.headcount,
          locked: editState.locked,
          canEdit: editState.allowed,
          showOverride: editState.locked && editState.allowed && 'isOverride' in editState,
        })
      }

      // When coach/head_coach has programs selected, build full list for "See all classes today"
      if (hasProgramFilter && templatesList.length > 0) {
        allCardsWhenFiltered = []
        for (const template of templatesList) {
          const { data: occ, error: occError } = await getOrCreateOccurrence(
            template.id,
            selectedLocalDate,
            template.start_time
          )
          if (occError || !occ?.id || !occ.starts_at) continue
          const editState = isFuture
            ? { locked: true, allowed: false }
            : canEditAttendance(isAdmin, occ.starts_at)
          const { data: log } = await supabase
            .from('attendance_logs')
            .select('headcount')
            .eq('class_occurrence_id', occ.id)
            .single()
          const startTime = String(template.start_time)
          const timeStr = startTime.length >= 5 ? `${startTime.slice(0, 5)}` : startTime
          allCardsWhenFiltered.push({
            occurrenceId: occ.id,
            startsAt: occ.starts_at,
            programLabel: getProgramLabel(template.program),
            title: template.title,
            time: timeStr,
            location: template.location,
            capacity: template.capacity,
            headcount: log?.headcount,
            locked: editState.locked,
            canEdit: editState.allowed,
            showOverride: editState.locked && editState.allowed && 'isOverride' in editState,
          })
        }
      }
    }
  } catch (err) {
    loadError = err instanceof Error ? err.message : 'Failed to load dashboard'
  }

  let missingLogsCount: number | null = null
  if (profile?.role === 'admin' && !loadError) {
    const r = await getMissingLogsCount(last7DaysRange())
    if (!r.error) missingLogsCount = r.count ?? 0
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
          {selectedLocalDate === todayDate
            ? new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })
            : selectedLocalDate}
        </p>
      </div>

      {cards.length === 0 && (!allCardsWhenFiltered || allCardsWhenFiltered.length === 0) ? (
        <div className="rounded-2xl bg-white p-8 shadow-sm border border-gray-200 text-center">
          <p className="text-lg font-medium text-gray-700">
            {selectedLocalDate === todayDate ? 'Engir tímar í dag' : `Engir tímar ${selectedLocalDate}`}
          </p>
          <p className="mt-2 text-sm text-gray-500">
            Sía: {selectedLocalDate} ({WEEKDAY_NAMES[selectedWeekday] ?? selectedWeekday}). Tímar birtast þegar þú velur íþróttir í prófílnum þínum.
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

