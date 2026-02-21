import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/helpers'
import { getTodayLocalDate, getTodayWeekday } from '@/lib/helpers'
import { getProgramLabel } from '@/lib/programs'
import { canEditAttendance } from '@/lib/attendance-lock'
import { getOrCreateOccurrence } from '@/lib/actions/dashboard'
import { redirect } from 'next/navigation'
import { DashboardClient } from '@/components/DashboardClient'
import { AdminMissingBanner } from '@/components/AdminMissingBanner'
import { getMissingLogsCount, last7DaysRange } from '@/lib/analytics'

export const dynamic = 'force-dynamic'

const WEEKDAY_NAMES = ['Sun', 'Mán', 'Þri', 'Mið', 'Fim', 'Fös', 'Lau']

export default async function DashboardPage() {
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
  let loadError: string | null = null
  let todayDate = getTodayLocalDate()
  let todayWeekday = getTodayWeekday()

  try {
    const supabase = await createClient()
    const { data: authData } = await supabase.auth.getUser()
    user = authData?.user ?? null

    if (!user) {
      redirect('/login')
    }

    profile = await getCurrentProfile()
    todayDate = getTodayLocalDate()
    todayWeekday = getTodayWeekday()

    // Templates for today's weekday
    let templatesQuery = supabase
      .from('class_templates')
      .select('id, program, title, start_time, location, capacity')
      .eq('weekday', todayWeekday)
      .order('start_time', { ascending: true })

    const { data: templates, error: templatesError } = await templatesQuery

    if (templatesError) {
      loadError = templatesError.message
    } else if (templates && templates.length > 0) {
      let filtered = templates as Array<{ id: string; program: string; title: string; start_time: string; location?: string; capacity?: number }>

      // Only filter by coached_programs when coach has at least one program selected
      const coachedPrograms = profile?.coached_programs ?? []
      const hasProgramFilter =
        profile?.role === 'coach' &&
        Array.isArray(coachedPrograms) &&
        coachedPrograms.length > 0
      if (hasProgramFilter) {
        const set = new Set(coachedPrograms)
        filtered = filtered.filter((t) => set.has(t.program))
      }

      const isAdmin = profile?.role === 'admin'

      for (const template of filtered) {
        const { data: occ, error: occError } = await getOrCreateOccurrence(
          template.id,
          todayDate,
          template.start_time
        )
        if (occError) {
          loadError = occError
          break
        }
        if (!occ?.id || !occ.starts_at) continue

        const editState = canEditAttendance(isAdmin, occ.starts_at)

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
        <h1 className="text-2xl font-bold text-gray-900">My Classes Today</h1>
        <p className="mt-1 text-sm text-gray-500">
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </div>

      {cards.length === 0 ? (
        <div className="rounded-2xl bg-white p-8 shadow-sm border border-gray-200 text-center">
          <p className="text-lg font-medium text-gray-700">Engir tímar í dag</p>
          <p className="mt-2 text-sm text-gray-500">
            Sía: {todayDate} ({WEEKDAY_NAMES[todayWeekday] ?? todayWeekday}). Tímar birtast þegar þú velur íþróttir í prófílnum þínum.
          </p>
          {profile?.role === 'admin' && (
            <p className="mt-2 text-sm text-gray-600">
              Stillingar → Vikudagatal til að setja inn tíma (eða synca frá Google Sheets).
            </p>
          )}
          {profile?.role === 'coach' && (
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
          isAdmin={profile?.role === 'admin'}
          showAllClassesBanner={
            profile?.role === 'coach' &&
            (!Array.isArray(profile?.coached_programs) || profile.coached_programs.length === 0)
          }
        />
      )}
    </div>
  )
}

