'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ClassCard } from '@/components/ClassCard'

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
  isAdmin,
  showAllClassesBanner = false,
}: {
  cards: DashboardCard[]
  isAdmin: boolean
  showAllClassesBanner?: boolean
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [localHeadcounts, setLocalHeadcounts] = useState<Record<string, number>>({})
  const [toast, setToast] = useState<string | null>(null)

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
        {initialCards.map((card) => (
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
          />
        ))}
      </div>
    </>
  )
}
