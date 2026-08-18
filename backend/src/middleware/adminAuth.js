import crypto from 'crypto'

export const COOKIE_NAME = 'admin_session'
const SESSION_TTL_MS = 12 * 60 * 60 * 1000 // 12 hours

function secret() {
  return process.env.ADMIN_SESSION_SECRET || 'dev-admin-secret-change-me'
}

// Signed, tamper-proof token: base64url(payload).base64url(hmac)
export function signSession(adminData) {
  const payload = typeof adminData === 'string'
    ? { u: adminData, role: 'super_admin', exp: Date.now() + SESSION_TTL_MS }
    : {
        u: adminData.username || adminData.u,
        role: adminData.role || 'district_admin',
        assigned_district: adminData.assigned_district || null,
        exp: Date.now() + SESSION_TTL_MS,
      }

  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = crypto.createHmac('sha256', secret()).update(body).digest('base64url')
  return `${body}.${sig}`
}

export function verifySession(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null
  const [body, sig] = token.split('.')
  const expected = crypto.createHmac('sha256', secret()).update(body).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
    if (!payload || typeof payload.exp !== 'number' || payload.exp < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

function parseCookies(header) {
  const out = {}
  if (!header) return out
  for (const part of header.split(';')) {
    const idx = part.indexOf('=')
    if (idx === -1) continue
    const k = part.slice(0, idx).trim()
    const v = part.slice(idx + 1).trim()
    if (k) out[k] = decodeURIComponent(v)
  }
  return out
}

const IS_PROD = process.env.NODE_ENV === 'production'
export const SESSION_COOKIE_OPTS = {
  httpOnly: true,
  sameSite: IS_PROD ? 'none' : 'lax',
  path: '/',
  maxAge: SESSION_TTL_MS,
  secure: IS_PROD,
}

export function requireAdmin(req, res, next) {
  let token = null
  const auth = req.headers.authorization || req.headers.Authorization
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
    token = auth.slice(7).trim()
  }
  if (!token) {
    const cookies = parseCookies(req.headers.cookie)
    token = cookies[COOKIE_NAME]
  }
  const payload = verifySession(token)
  if (!payload) {
    return res.status(401).json({ success: false, message: 'Not authenticated.' })
  }
  req.admin = payload
  next()
}

// Role-Based Access Control Middleware
export function requireRole(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({ success: false, message: 'Not authenticated.' })
    }
    const userRole = req.admin.role || 'district_admin'
    // super_admin always has universal access
    if (userRole === 'super_admin') return next()
    if (allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Requires one of: ${allowedRoles.join(', ')}`,
      })
    }
    next()
  }
}
