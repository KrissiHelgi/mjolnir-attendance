'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ClassCard } from '@/components/ClassCard'
import { addDaysToLocalDate, formatLocalDateLabel } from '@/lib/dates'

export type DashboardCard = {
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
}

export function DashboardClient({
  cards: initialCards,
  allCards = null,
  isAdmin,
  showAllClassesBanner = false,
  selectedLocalDate,
  todayLocalDate,
  viewOnly = false,
}: {
  cards: DashboardCard[]
  allCards?: DashboardCard[] | null
  isAdmin: boolean
  showAllClassesBanner?: boolean
  selectedLocalDate: string
  todayLocalDate: string
  viewOnly?: boolean
}) {
  const isToday = selectedLocalDate === todayLocalDate
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [localHeadcounts, setLocalHeadcounts] = useState<Record<string, number>>({})
  const [toast, setToast] = useState<string | null>(null)
  const [showAllClasses, setShowAllClasses] = useState(
    initialCards.length === 0 && (allCards?.length ?? 0) > 0
  )
  const cardsToShow = showAllClasses && allCards && allCards.length > 0 ? allCards : initialCards

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  function handleExpandToggle(occurrenceId: string) {
    setExpandedId((prev) => (prev === occurrenceId ? null : occurrenceId))
  }

  function handleSaved(occurrenceId: string, headcount: number) {
    setLocalHeadcounts((prev) => ({ ...prev, [occurrenceId]: headcount }))
    setExpandedId(null)
    setToast('Attendance saved')
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

      {/* Day navigator */}
      <div className="flex items-center justify-between gap-2 mb-4 py-2 px-1">
        <Link
          href={`/?date=${addDaysToLocalDate(selectedLocalDate, -1)}`}
          className="min-h-[44px] px-4 rounded-xl border border-gray-300 bg-white font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100"
        >
          ◀ Prev
        </Link>
        <div className="flex flex-col items-center gap-0.5">
          <Link
            href={isToday ? '/' : `/?date=${todayLocalDate}`}
            className={`min-h-[44px] px-4 rounded-xl font-medium ${
              isToday
                ? 'bg-blue-600 text-white'
                : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Today
          </Link>
          <span className="text-sm text-gray-600">{formatLocalDateLabel(selectedLocalDate)}</span>
        </div>
        <Link
          href={`/?date=${addDaysToLocalDate(selectedLocalDate, 1)}`}
          className="min-h-[44px] px-4 rounded-xl border border-gray-300 bg-white font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100"
        >
          Next ▶
        </Link>
      </div>

      {!isToday && (
        <p className="mb-3 text-sm text-gray-600">Viewing: {selectedLocalDate}</p>
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
        {cardsToShow.map((card) => (
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
          />
        ))}
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
