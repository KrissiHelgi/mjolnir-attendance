'use client'

import { useState } from 'react'
import { AddClassForm } from './AddClassForm'

export function AddClassSection() {
  const [expanded, setExpanded] = useState(true)

  return (
    <div className="rounded-lg bg-white p-6 shadow-sm border">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Add class</h2>
      <p className="text-sm text-gray-600 mb-4">
        Add one or more weekly recurring classes. Select multiple days to create a class on each selected day (e.g. BJJ 201 at 16:00 on Þri and Fim = 2 classes).
      </p>
      {expanded ? (
        <AddClassForm onSaveSuccess={() => setExpanded(false)} />
      ) : (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="min-h-[44px] px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50"
        >
          Show form
        </button>
      )}
    </div>
  )
}
