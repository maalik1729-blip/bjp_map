import crypto from 'crypto'
import { getAppDb, isAppDbOnline } from '../config/db.js'

const COLLECTION = 'admin_users'

// Secure Password Hashing via Node crypto PBKDF2
export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.pbkdf2Sync(String(password), salt, 10000, 64, 'sha512').toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(':')) return false
  const [salt, originalHash] = storedHash.split(':')
  const hash = crypto.pbkdf2Sync(String(password), salt, 10000, 64, 'sha512').toString('hex')
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(originalHash))
}

export async function findAdminByUsername(username) {
  if (!isAppDbOnline()) return null
  const db = getAppDb()
  const cleanUser = String(username || '').trim().toLowerCase()
  return db.collection(COLLECTION).findOne({ username: cleanUser, is_active: { $ne: false } })
}

export async function createAdminUser({
  username,
  password,
  role = 'district_admin',
  assigned_district = null,
  full_name = '',
  email = '',
  mobile = '',
}) {
  const db = getAppDb()
  const cleanUser = String(username || '').trim().toLowerCase()
  const password_hash = hashPassword(password)

  const doc = {
    username: cleanUser,
    password_hash,
    role, // 'super_admin' | 'state_admin' | 'district_admin'
    assigned_district: role === 'district_admin' ? assigned_district : null,
    full_name,
    email,
    mobile,
    is_active: true,
    created_at: new Date(),
    last_login: null,
  }

  await db.collection(COLLECTION).updateOne(
    { username: cleanUser },
    { $set: doc },
    { upsert: true }
  )
  return doc
}

export async function updateAdminLastLogin(username) {
  if (!isAppDbOnline()) return
  const db = getAppDb()
  const cleanUser = String(username || '').trim().toLowerCase()
  await db.collection(COLLECTION).updateOne(
    { username: cleanUser },
    { $set: { last_login: new Date() } }
  )
}
