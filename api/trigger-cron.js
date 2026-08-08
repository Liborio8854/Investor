import { createClient } from '@supabase/supabase-js'

const JOBS = {
  prices: '/api/cron/fetch-prices',
  recommendations: '/api/cron/generate-recommendations',
  // zpětná kompatibilita
  'fetch-prices': '/api/cron/fetch-prices',
  'generate-recommendations': '/api/cron/generate-recommendations',
}

function getSupabaseUrl() {
  return process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
}

function getAnonKey() {
  return process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
}

function parseBody(req) {
  const raw = req.body
  if (raw == null || raw === '') return {}
  if (typeof raw === 'object') return raw
  try {
    return JSON.parse(String(raw))
  } catch {
    return {}
  }
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

    const payload = parseBody(req)
    const type = String(payload.type || payload.job || req.query?.type || req.query?.job || '').trim()
    const path = JOBS[type]
    if (!path) {
      return res.status(400).json({
        error: 'Invalid type',
        allowed: ['prices', 'recommendations'],
      })
    }

    const target = `${absoluteUrl(req, path)}?force=1`
    console.log(`[trigger-cron] user=${user.id} type=${type} → ${path}`)

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
      body = { raw: text?.slice?.(0, 500) || text }
    }

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        ok: false,
        error: body.error || body.message || `Cron failed (${upstream.status})`,
        type,
        ...body,
      })
    }

    return res.status(200).json({
      ok: true,
      type,
      triggeredBy: user.id,
      ...body,
    })
  } catch (err) {
    console.error('[trigger-cron] fatal', err)
    return res.status(500).json({ error: err.message || String(err) })
  }
}
