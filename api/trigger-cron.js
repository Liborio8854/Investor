import { createClient } from '@supabase/supabase-js'

const JOBS = {
  'fetch-prices': '/api/cron/fetch-prices',
  'generate-recommendations': '/api/cron/generate-recommendations',
}

function getSupabaseUrl() {
  return process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
}

function getAnonKey() {
  return process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
}

async function requireUser(req) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!token) return null

  const url = getSupabaseUrl()
  const anon = getAnonKey()
  if (!url || !anon) throw new Error('Missing Supabase URL or anon key')

  const supabase = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data?.user) return null
  return data.user
}

function absoluteUrl(req, path) {
  const proto = req.headers['x-forwarded-proto'] || 'https'
  const host = req.headers.host
  return `${proto}://${host}${path}`
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const secret = process.env.CRON_SECRET
  if (!secret) {
    return res.status(500).json({ error: 'Missing CRON_SECRET' })
  }

  try {
    const user = await requireUser(req)
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const job = String(req.body?.job || req.query?.job || '').trim()
    const path = JOBS[job]
    if (!path) {
      return res.status(400).json({
        error: 'Invalid job',
        allowed: Object.keys(JOBS),
      })
    }

    const target = `${absoluteUrl(req, path)}?force=1`
    console.log(`[trigger-cron] user=${user.id} job=${job}`)

    const upstream = await fetch(target, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
    })

    const text = await upstream.text()
    let body
    try {
      body = JSON.parse(text)
    } catch {
      body = { raw: text }
    }

    return res.status(upstream.status).json({
      ...body,
      triggeredBy: user.id,
      job,
    })
  } catch (err) {
    console.error('[trigger-cron] fatal', err)
    return res.status(500).json({ error: err.message || String(err) })
  }
}
