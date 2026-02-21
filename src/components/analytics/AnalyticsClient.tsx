'use client'

import { useState, useEffect, useCallback } from 'react'
import { DateRangePicker } from '@/components/analytics/DateRangePicker'
import { OverviewSection } from '@/components/analytics/OverviewSection'
import { SlotsSection } from '@/components/analytics/SlotsSection'
import { ProgramAvgSection } from '@/components/analytics/ProgramAvgSection'
import { CoachesSection } from '@/components/analytics/CoachesSection'
import { UtilizationSection } from '@/components/analytics/UtilizationSection'
import { AlertsSection } from '@/components/analytics/AlertsSection'
import { ExportSection } from '@/components/analytics/ExportSection'
import { getProgramKeys } from '@/lib/programs'
import {
  fetchOverview,
  fetchSlotTimeSeries,
  fetchAvgByProgram,
  fetchCoachPerformance,
  fetchCapacityUtilization,
  fetchCapacityUtilizationBySlot,
  fetchLowAttendanceAlerts,
  fetchMissingLogs,
  fetchOverCapacityLogs,
  getSlotOptions,
  exportAttendanceLogsCSV,
  exportSlotSummaryCSV,
} from '@/lib/actions/analytics'
import type { DateRange } from '@/lib/analytics'
import type { SlotOption } from '@/lib/actions/analytics'

const TABS = ['Overview', 'Slots', 'Coaches', 'Utilization', 'Alerts', 'Export'] as const
type Tab = (typeof TABS)[number]

type Props = {
  initialRange: DateRange
  initialTab?: Tab
  initialView?: 'missing'
}

export function AnalyticsClient({ initialRange, initialTab, initialView }: Props) {
  const [startDate, setStartDate] = useState(initialRange.startDate)
  const [endDate, setEndDate] = useState(initialRange.endDate)
  const [activeTab, setActiveTab] = useState<Tab>(initialTab ?? 'Overview')
  const [scrollToMissing, setScrollToMissing] = useState(initialView === 'missing')

  const range: DateRange = { startDate, endDate }
  const handleRangeChange = useCallback((start: string, end: string) => {
    setStartDate(start)
    setEndDate(end)
  }, [])

  const [overview, setOverview] = useState<{
    totalOccurrences?: number
    totalLogged?: number
    uniquePrograms?: number
  } | null>(null)
  const [overviewError, setOverviewError] = useState<string | null>(null)
  const [slotData, setSlotData] = useState<Awaited<ReturnType<typeof fetchSlotTimeSeries>>['data'] | null>(null)
  const [slotError, setSlotError] = useState<string | null>(null)
  const [slotOptions, setSlotOptions] = useState<SlotOption[] | null>(null)
  const [programFilter, setProgramFilter] = useState('')
  const [slotFilter, setSlotFilter] = useState('')
  const [programAvg, setProgramAvg] = useState<Awaited<ReturnType<typeof fetchAvgByProgram>>['data'] | null>(null)
  const [programAvgError, setProgramAvgError] = useState<string | null>(null)
  const [coachData, setCoachData] = useState<Awaited<ReturnType<typeof fetchCoachPerformance>>['data'] | null>(null)
  const [coachError, setCoachError] = useState<string | null>(null)
  const [utilProgram, setUtilProgram] = useState<Awaited<ReturnType<typeof fetchCapacityUtilization>>['data'] | null>(null)
  const [utilSlot, setUtilSlot] = useState<Awaited<ReturnType<typeof fetchCapacityUtilizationBySlot>>['data'] | null>(null)
  const [capacityMissing, setCapacityMissing] = useState(0)
  const [utilError, setUtilError] = useState<string | null>(null)
  const [alerts, setAlerts] = useState<Awaited<ReturnType<typeof fetchLowAttendanceAlerts>>['alerts'] | null>(null)
  const [slotsRepeated, setSlotsRepeated] = useState<Awaited<ReturnType<typeof fetchLowAttendanceAlerts>>['slotsWithRepeated'] | null>(null)
  const [missingLogs, setMissingLogs] = useState<Awaited<ReturnType<typeof fetchMissingLogs>>['data'] | null>(null)
  const [overCapacity, setOverCapacity] = useState<Awaited<ReturnType<typeof fetchOverCapacityLogs>>['data'] | null>(null)
  const [alertsError, setAlertsError] = useState<string | null>(null)

  const programKeys = getProgramKeys()

  const loadOverview = useCallback(async () => {
    setOverviewError(null)
    const r = await fetchOverview(range)
    if (r.error) {
      setOverviewError(r.error)
    } else {
      setOverviewError(null)
      setOverview(r)
    }
  }, [range.startDate, range.endDate])

  const loadSlot = useCallback(async () => {
    setSlotError(null)
    const r = await fetchSlotTimeSeries(range, programFilter || undefined, slotFilter || undefined)
    if (r.error) setSlotError(r.error)
    else setSlotData(r.data ?? null)
  }, [range.startDate, range.endDate, programFilter, slotFilter])

  const loadSlotOptions = useCallback(async () => {
    const r = await getSlotOptions(range)
    if (r.data) setSlotOptions(r.data)
  }, [range.startDate, range.endDate])

  const loadProgramAvg = useCallback(async () => {
    setProgramAvgError(null)
    const r = await fetchAvgByProgram(range)
    if (r.error) setProgramAvgError(r.error)
    else setProgramAvg(r.data ?? null)
  }, [range.startDate, range.endDate])

  const loadCoach = useCallback(async () => {
    setCoachError(null)
    const r = await fetchCoachPerformance(range)
    if (r.error) setCoachError(r.error)
    else setCoachData(r.data ?? null)
  }, [range.startDate, range.endDate])

  const loadUtil = useCallback(async () => {
    setUtilError(null)
    const [rProgram, rSlot] = await Promise.all([
      fetchCapacityUtilization(range),
      fetchCapacityUtilizationBySlot(range),
    ])
    if (rProgram.error) setUtilError(rProgram.error)
    else {
      setUtilProgram(rProgram.data ?? null)
      setCapacityMissing(rProgram.capacityMissingCount ?? 0)
    }
    if (!rSlot.error) setUtilSlot(rSlot.data ?? null)
  }, [range.startDate, range.endDate])

  const loadAlerts = useCallback(async () => {
    setAlertsError(null)
    const r = await fetchLowAttendanceAlerts(range)
    if (r.error) setAlertsError(r.error)
    else {
      setAlerts(r.alerts ?? null)
      setSlotsRepeated(r.slotsWithRepeated ?? null)
    }
    const rMissing = await fetchMissingLogs(range)
    if (!rMissing.error) setMissingLogs(rMissing.data ?? null)
    const rOver = await fetchOverCapacityLogs(range)
    if (!rOver.error) setOverCapacity(rOver.data ?? null)
  }, [range.startDate, range.endDate])

  useEffect(() => {
    loadOverview()
    loadProgramAvg()
  }, [loadOverview, loadProgramAvg])
  useEffect(() => {
    if (activeTab === 'Overview') {
      loadOverview()
      loadProgramAvg()
    }
  }, [activeTab, loadOverview, loadProgramAvg])
  useEffect(() => {
    if (activeTab === 'Slots') {
      loadSlotOptions()
      loadSlot()
    }
  }, [activeTab, loadSlot, loadSlotOptions])
  useEffect(() => {
    if (activeTab === 'Slots' && (programFilter || slotFilter)) loadSlot()
  }, [activeTab, programFilter, slotFilter, loadSlot])
  useEffect(() => {
    if (activeTab === 'Coaches') loadCoach()
  }, [activeTab, loadCoach])
  useEffect(() => {
    if (activeTab === 'Utilization') loadUtil()
  }, [activeTab, loadUtil])
  useEffect(() => {
    if (activeTab === 'Alerts') loadAlerts()
  }, [activeTab, loadAlerts])

  useEffect(() => {
    if (activeTab === 'Alerts' && scrollToMissing) {
      const el = document.getElementById('alerts-missing')
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setScrollToMissing(false)
    }
  }, [activeTab, scrollToMissing])

  useEffect(() => {
    if (activeTab === 'Slots') loadSlot()
  }, [activeTab, startDate, endDate, programFilter, slotFilter])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <DateRangePicker
          startDate={startDate}
          endDate={endDate}
          onRangeChange={handleRangeChange}
        />
      </div>

      <div className="border-b border-gray-200">
        <nav className="flex gap-1 overflow-x-auto" aria-label="Analytics tabs">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`min-h-[44px] px-4 py-2 text-sm font-medium rounded-t-lg whitespace-nowrap ${
                activeTab === tab
                  ? 'bg-white border border-b-0 border-gray-200 text-gray-900 -mb-px'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        {activeTab === 'Overview' && (
          <div className="space-y-8">
            {overviewError && <p className="text-sm text-red-600">{overviewError}</p>}
            <OverviewSection data={overview} error={overviewError ?? undefined} />
            <div>
              <h3 className="text-sm font-semibold text-gray-800 mb-2">Average attendance by program</h3>
              <ProgramAvgSection data={programAvg ?? null} error={programAvgError ?? undefined} />
            </div>
          </div>
        )}
        {activeTab === 'Slots' && (
          <SlotsSection
            data={slotData ?? null}
            slotOptions={slotOptions ?? null}
            programKeys={programKeys}
            programFilter={programFilter}
            slotFilter={slotFilter}
            onProgramFilterChange={setProgramFilter}
            onSlotFilterChange={setSlotFilter}
            error={slotError ?? undefined}
          />
        )}
        {activeTab === 'Coaches' && (
          <>
            {coachError && <p className="text-sm text-red-600 mb-2">{coachError}</p>}
            <CoachesSection data={coachData ?? null} error={coachError ?? undefined} />
          </>
        )}
        {activeTab === 'Utilization' && (
          <UtilizationSection
            byProgram={utilProgram ?? null}
            bySlot={utilSlot ?? null}
            capacityMissingCount={capacityMissing}
            error={utilError ?? undefined}
          />
        )}
        {activeTab === 'Alerts' && (
          <AlertsSection
            alerts={alerts ?? null}
            slotsWithRepeated={slotsRepeated ?? null}
            missingLogs={missingLogs ?? null}
            overCapacity={overCapacity ?? null}
            error={alertsError ?? undefined}
            onMissingMarked={loadAlerts}
          />
        )}
        {activeTab === 'Export' && (
          <ExportSection
            startDate={startDate}
            endDate={endDate}
            onExportLogs={() => exportAttendanceLogsCSV(range)}
            onExportSlotSummary={() => exportSlotSummaryCSV(range)}
          />
        )}
      </div>
    </div>
  )
}
