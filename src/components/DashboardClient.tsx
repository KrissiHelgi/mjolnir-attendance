'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ClassCard } from '@/components/ClassCard'
import { addDaysToLocalDate, formatLocalDateLabelWithWeekday } from '@/lib/dates'
import { canEditAttendance } from '@/lib/attendance-lock'

export type DashboardCard = {
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
  /** When set, used with startsAt for client-side lock/canEdit recompute as time passes */
  updatedAt?: string
  locked: boolean
  canEdit: boolean
  showOverride: boolean
  status: 'finished' | 'ongoing' | 'upcoming'
  finishedMinutesAgo?: number
}

export function DashboardClient({
  cards: initialCards,
  allCards = null,
  isAdmin,
  coachOptions = [],
  showAllClassesBanner = false,
  selectedLocalDate,
  todayLocalDate,
  viewOnly = false,
}: {
  cards: DashboardCard[]
  allCards?: DashboardCard[] | null
  isAdmin: boolean
  coachOptions?: { id: string; full_name: string | null }[]
  showAllClassesBanner?: boolean
  selectedLocalDate: string
  todayLocalDate: string
  viewOnly?: boolean
}) {
  const router = useRouter()
  const isToday = selectedLocalDate === todayLocalDate
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [localHeadcounts, setLocalHeadcounts] = useState<Record<string, number>>({})
  const [toast, setToast] = useState<string | null>(null)
  const [showAllClasses, setShowAllClasses] = useState(
    initialCards.length === 0 && (allCards?.length ?? 0) > 0
  )
  const baseCards = showAllClasses && allCards && allCards.length > 0 ? allCards : initialCards

  // Live "now" so classes move from upcoming → ongoing → finished without refresh (e.g. coach logs one class then the next appears as ongoing)
  const [liveNow, setLiveNow] = useState(() => Date.now())
  useEffect(() => {
    const interval = setInterval(() => setLiveNow(Date.now()), 60_000)
    return () => clearInterval(interval)
  }, [])
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') setLiveNow(Date.now())
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  const cardsToShow = useMemo(() => {
    const now = liveNow
    type S = 'finished' | 'ongoing' | 'upcoming'
    const derived: DashboardCard[] = baseCards.map((card) => {
      if (viewOnly) return card
      const startMs = new Date(card.startsAt).getTime()
      const endMs = card.endsAt ? new Date(card.endsAt).getTime() : startMs + 60 * 60 * 1000
      let status: S
      let finishedMinutesAgo: number | undefined
      if (now < startMs) status = 'upcoming'
      else if (now < endMs) status = 'ongoing'
      else {
        status = 'finished'
        finishedMinutesAgo = Math.floor((now - endMs) / 60000)
      }
      const editState =
        status === 'upcoming'
          ? { locked: true, allowed: false }
          : canEditAttendance(isAdmin, card.startsAt, card.updatedAt ?? null)
      return {
        ...card,
        status,
        finishedMinutesAgo,
        locked: editState.locked,
        canEdit: editState.allowed,
        showOverride: editState.locked && editState.allowed && 'isOverride' in editState,
      }
    })
    const order = { finished: 0, ongoing: 1, upcoming: 2 }
    derived.sort((a, b) => {
      if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status]
      if (a.status === 'finished') return (b.finishedMinutesAgo ?? 0) - (a.finishedMinutesAgo ?? 0)
      return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
    })
    return derived
  }, [baseCards, liveNow, isAdmin, viewOnly])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  function handleExpandToggle(occurrenceId: string) {
    setExpandedId((prev) => (prev === occurrenceId ? null : occurrenceId))
  }

  function handleSaved(occurrenceId: string, headcount: number) {
    setExpandedId(null) // Close card immediately so it's clear attendance was saved
    setLocalHeadcounts((prev) => ({ ...prev, [occurrenceId]: headcount }))
    setToast('Attendance saved')
    requestAnimationFrame(() => router.refresh())
  }

  return (
    <>
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-md rounded-xl bg-gray-900 text-white px-4 py-3 text-sm font-medium shadow-lg"
        >
          {toast}
        </div>
      )}

      {/* Day navigator — single pill */}
      <div className="flex items-center justify-between rounded-full bg-[#F0F2F5] px-5 py-3 mb-4 min-h-[48px]">
        <Link
          href={`/?date=${addDaysToLocalDate(selectedLocalDate, -1)}`}
          className="flex items-center justify-center min-w-[44px] min-h-[44px] -m-1 rounded-full text-[#888] hover:text-gray-700 hover:bg-black/5 active:bg-black/10"
          aria-label="Previous day"
        >
          <span className="text-xl leading-none">←</span>
        </Link>
        {isToday ? (
          <span className="flex-1 flex items-center justify-center min-h-[44px] font-semibold text-gray-900">
            í dag
          </span>
        ) : (
          <Link
            href={`/?date=${todayLocalDate}`}
            className="flex-1 flex items-center justify-center min-h-[44px] font-semibold text-gray-900 hover:opacity-80"
            aria-label="Go to today"
          >
            {formatLocalDateLabelWithWeekday(selectedLocalDate)}
          </Link>
        )}
        <Link
          href={`/?date=${addDaysToLocalDate(selectedLocalDate, 1)}`}
          className="flex items-center justify-center min-w-[44px] min-h-[44px] -m-1 rounded-full text-[#888] hover:text-gray-700 hover:bg-black/5 active:bg-black/10"
          aria-label="Next day"
        >
          <span className="text-xl leading-none">→</span>
        </Link>
      </div>

      {!isToday && (
        <p className="mb-3 text-sm text-gray-600">Viewing: {formatLocalDateLabelWithWeekday(selectedLocalDate)}</p>
      )}
      {viewOnly && (
        <p className="mb-3 text-sm font-medium text-amber-800 rounded-lg bg-amber-100 px-3 py-2">
          Future day (view only)
        </p>
      )}

      {showAllClassesBanner && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="font-medium text-amber-900">Sýni alla tíma</p>
          <p className="mt-0.5 text-sm text-amber-800">
            Veldu íþróttir í prófílnum þínum til að sía tímana.
          </p>
          <Link
            href="/profile"
            className="mt-2 inline-block text-sm font-medium text-amber-800 underline underline-offset-2 hover:text-amber-900"
          >
            Velja íþróttir
          </Link>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {(['finished', 'ongoing', 'upcoming'] as const).map((section) => {
          const sectionCards = cardsToShow.filter((c) => c.status === section)
          if (sectionCards.length === 0) return null
          const sectionTitle =
            section === 'finished'
              ? 'Finished'
              : section === 'ongoing'
                ? 'Ongoing'
                : 'Upcoming'
          return (
            <div key={section}>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                {sectionTitle}
              </h2>
              <div className="flex flex-col gap-4">
                {sectionCards.map((card) => (
          <ClassCard
            key={card.occurrenceId}
            occurrenceId={card.occurrenceId}
            programLabel={card.programLabel}
            title={card.title}
            time={card.time}
            location={card.location}
            capacity={card.capacity}
            currentHeadcount={card.headcount}
            locked={card.locked}
            canEdit={card.canEdit}
            showOverride={card.showOverride}
            isAdmin={isAdmin}
            expanded={expandedId === card.occurrenceId}
            onExpandToggle={() => handleExpandToggle(card.occurrenceId)}
            onSaved={(headcount) => handleSaved(card.occurrenceId, headcount)}
            localHeadcount={localHeadcounts[card.occurrenceId]}
            viewOnly={viewOnly}
            status={card.status}
            finishedMinutesAgo={card.finishedMinutesAgo}
            loggedByName={card.loggedByName}
            coachOptions={coachOptions}
          />
                ))}
              </div>
            </div>
          )
        })}
        {allCards && allCards.length > initialCards.length && (
          <button
            type="button"
            onClick={() => setShowAllClasses((prev) => !prev)}
            className="rounded-2xl border-2 border-dashed border-gray-300 bg-white p-5 text-center font-medium text-gray-700 shadow-sm hover:border-gray-400 hover:bg-gray-50"
          >
            {showAllClasses ? 'Show my classes only' : isToday ? 'See all classes today' : 'See all classes'}
          </button>
        )}
      </div>
    </>
  )
}
