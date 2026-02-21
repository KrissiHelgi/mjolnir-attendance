'use client'

import { useState, useEffect } from 'react'

const PHRASE_NORMAL = 'OVERWRITE SCHEDULE'
const PHRASE_WITH_LOGS = 'OVERWRITE AND BREAK ANALYTICS'

export function OverwriteScheduleConfirmModal({
  open,
  onClose,
  hasLogs,
  onConfirm,
  importing,
}: {
  open: boolean
  onClose: () => void
  hasLogs: boolean
  onConfirm: () => Promise<void>
  importing: boolean
}) {
  const [step, setStep] = useState<1 | 2>(1)
  const [typedPhrase, setTypedPhrase] = useState('')

  const requiredPhrase = hasLogs ? PHRASE_WITH_LOGS : PHRASE_NORMAL
  const phraseMatch = typedPhrase === requiredPhrase

  useEffect(() => {
    if (!open) {
      setStep(1)
      setTypedPhrase('')
    }
  }, [open])

  if (!open) return null

  async function handleFinalConfirm() {
    if (!phraseMatch) return
    await onConfirm()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {step === 1 && (
          <>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900">Overwrite weekly schedule?</h3>
              <div className="mt-4 p-4 rounded-lg bg-red-50 border border-red-200">
                <p className="text-sm font-medium text-red-900">
                  This will DELETE all classes and recreate them. Historical slot analytics will break (slot IDs will change).
                </p>
                {hasLogs && (
                  <p className="mt-3 text-sm text-red-800">
                    Attendance logs already exist. Overwriting will make it impossible to view attendance trends per slot across time.
                  </p>
                )}
              </div>
            </div>
            <div className="px-6 pb-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="min-h-[44px] px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700"
              >
                Continue
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900">
                {hasLogs ? 'Last chance' : 'Confirm overwrite'}
              </h3>
              <div className="mt-4 p-4 rounded-lg bg-red-50 border border-red-200 space-y-2">
                <p className="text-sm font-medium text-red-900">Consequences:</p>
                <ul className="list-disc list-inside text-sm text-red-800 space-y-1">
                  <li>All current weekly classes will be deleted</li>
                  <li>New classes will be inserted (new IDs)</li>
                  <li>Slot-based analytics will no longer match old slots</li>
                  {hasLogs && <li>Historical “per slot” trends will be broken</li>}
                </ul>
              </div>
              <div className="mt-4">
                <label htmlFor="overwrite-phrase" className="block text-sm font-medium text-gray-700">
                  Type <code className="bg-gray-100 px-1 rounded">{requiredPhrase}</code> to confirm:
                </label>
                <input
                  id="overwrite-phrase"
                  type="text"
                  value={typedPhrase}
                  onChange={(e) => setTypedPhrase(e.target.value)}
                  placeholder={requiredPhrase}
                  className="mt-2 block w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm focus:border-red-500 focus:ring-red-500"
                  autoComplete="off"
                />
              </div>
            </div>
            <div className="px-6 pb-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                disabled={importing}
                className="min-h-[44px] px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleFinalConfirm}
                disabled={!phraseMatch || importing}
                className="min-h-[44px] px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {importing ? 'Overwriting…' : 'Yes, overwrite schedule'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
