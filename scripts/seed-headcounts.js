/**
 * Seed the database with 10 days of headcount logs (past 10 days).
 * Each class occurrence gets a headcount between 5–30.
 *
 * Requires in .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (Supabase Dashboard → Settings → API → service_role)
 * Run: npm run seed-headcounts   (or: node scripts/seed-headcounts.js)
 */

const fs = require('fs')
const path = require('path')

// Load .env.local
const envPath = path.resolve(__dirname, '..', '.env.local')
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8')
  content.split('\n').forEach((line) => {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#')) {
      const eq = trimmed.indexOf('=')
      if (eq > 0) {
        const key = trimmed.slice(0, eq).trim()
        const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
        process.env[key] = value
      }
    }
  })
}

const { createClient } = require('@supabase/supabase-js')

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function formatLocalDate(d) {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function randomHeadcount() {
  return Math.floor(5 + Math.random() * 26) // 5–30 inclusive
}

async function main() {
  const { data: templates, error: tErr } = await supabase
    .from('class_templates')
    .select('id, weekday, start_time')
  if (tErr) {
    console.error('Failed to fetch templates:', tErr.message)
    process.exit(1)
  }
  if (!templates?.length) {
    console.error('No class templates found. Add templates in Admin → Schedule first.')
    process.exit(1)
  }

  const { data: profiles } = await supabase.from('profiles').select('id').limit(1)
  const createdBy = profiles?.[0]?.id
  if (!createdBy) {
    console.error('No profile found. Need at least one user/profile.')
    process.exit(1)
  }

  const today = new Date()
  let created = 0
  let updated = 0
  const days = 10

  for (let dayOffset = 1; dayOffset <= days; dayOffset++) {
    const d = new Date(today)
    d.setUTCDate(d.getUTCDate() - dayOffset)
    const localDate = formatLocalDate(d)
    const weekday = d.getUTCDay()

    const dayTemplates = templates.filter((t) => Number(t.weekday) === weekday)
    for (const t of dayTemplates) {
      const startTime = String(t.start_time ?? '').slice(0, 5)
      const [h, m] = startTime.split(':').map(Number)
      const startDate = new Date(localDate + 'T00:00:00Z')
      startDate.setUTCHours(isNaN(h) ? 12 : h, isNaN(m) ? 0 : m, 0, 0)
      const startsAt = startDate.toISOString()

      const { data: existing } = await supabase
        .from('class_occurrences')
        .select('id')
        .eq('class_template_id', t.id)
        .eq('local_date', localDate)
        .maybeSingle()

      let occId
      if (existing?.id) {
        occId = existing.id
      } else {
        const { data: inserted, error: insErr } = await supabase
          .from('class_occurrences')
          .insert({
            class_template_id: t.id,
            local_date: localDate,
            starts_at: startsAt,
          })
          .select('id')
          .single()
        if (insErr) {
          console.warn('Insert occurrence failed', localDate, t.id, insErr.message)
          continue
        }
        occId = inserted.id
        created++
      }

      const headcount = randomHeadcount()
      const { error: logErr } = await supabase.from('attendance_logs').upsert(
        {
          class_occurrence_id: occId,
          headcount,
          created_by: createdBy,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'class_occurrence_id' }
      )
      if (logErr) {
        console.warn('Upsert log failed', occId, logErr.message)
        continue
      }
      updated++
    }
  }

  console.log('Done. Occurrences created (if any):', created)
  console.log('Attendance logs upserted:', updated)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
