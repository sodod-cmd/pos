import 'server-only'
import bcrypt from 'bcryptjs'
import { ObjectId, type WithId } from 'mongodb'
import { collections } from '@/lib/db'

export type AdminDoc = {
  name: string
  email: string
  passwordHash: string
  /** Bumped on password change so tokens issued before it stop working. */
  tokenVersion: number
  /** Set on the account created by `npm run seed`, whose password is in the repo. Cleared on password change. */
  mustChangePassword?: boolean
  createdAt: Date
  updatedAt: Date
  lastLoginAt?: Date
}

export type Admin = Omit<AdminDoc, 'passwordHash'> & { id: string }

export const MIN_PASSWORD_LENGTH = 8

function toAdmin({ _id, passwordHash: _hash, ...rest }: WithId<AdminDoc>): Admin {
  return { ...rest, id: _id.toHexString() }
}

function objectId(id: string) {
  return ObjectId.isValid(id) ? new ObjectId(id) : null
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

export function hashPassword(password: string) {
  return bcrypt.hash(password, 12)
}

export async function listAdmins() {
  const { admins } = await collections()
  return (await admins.find().sort({ createdAt: 1 }).toArray()).map(toAdmin)
}

export async function countAdmins() {
  const { admins } = await collections()
  return admins.countDocuments()
}

export async function getAdminById(id: string) {
  const _id = objectId(id)
  if (!_id) return null
  const { admins } = await collections()
  const doc = await admins.findOne({ _id })
  return doc ? toAdmin(doc) : null
}

export async function emailTaken(email: string, exceptId?: string) {
  const { admins } = await collections()
  const except = exceptId ? objectId(exceptId) : null
  return (await admins.countDocuments({ email: normalizeEmail(email), ...(except ? { _id: { $ne: except } } : {}) })) > 0
}

// Compared against when the email is unknown, so a miss takes as long as a wrong password.
const DUMMY_HASH = '$2b$12$7XXJ1oGEzeB9SHjRBdtQk.byIfHbNGC11AZaAYqmiAFdK0Lhz6uny'

/** Checks credentials and records the login. Returns null for any mismatch. */
export async function verifyCredentials(email: string, password: string) {
  const { admins } = await collections()
  const doc = await admins.findOne({ email: normalizeEmail(email) })
  const ok = await bcrypt.compare(password, doc?.passwordHash ?? DUMMY_HASH)
  if (!doc || !ok) return null
  await admins.updateOne({ _id: doc._id }, { $set: { lastLoginAt: new Date() } })
  return toAdmin(doc)
}

export async function createAdmin(input: { name: string; email: string; password: string }) {
  const { admins } = await collections()
  const now = new Date()
  const { insertedId } = await admins.insertOne({
    name: input.name,
    email: normalizeEmail(input.email),
    passwordHash: await hashPassword(input.password),
    tokenVersion: 0,
    createdAt: now,
    updatedAt: now,
  })
  return insertedId.toHexString()
}

export async function updateAdmin(id: string, input: { name: string; email: string; password?: string }) {
  const _id = objectId(id)
  if (!_id) return null
  const { admins } = await collections()
  const set: Partial<AdminDoc> = { name: input.name, email: normalizeEmail(input.email), updatedAt: new Date() }
  if (input.password) {
    set.passwordHash = await hashPassword(input.password)
    set.mustChangePassword = false
  }
  const doc = await admins.findOneAndUpdate(
    { _id },
    { $set: set, ...(input.password ? { $inc: { tokenVersion: 1 } } : {}) },
    { returnDocument: 'after' },
  )
  return doc ? toAdmin(doc) : null
}

export async function deleteAdmin(id: string) {
  const _id = objectId(id)
  if (!_id) return false
  const { admins } = await collections()
  return (await admins.deleteOne({ _id })).deletedCount === 1
}

/** Admins still on the password from the seed script. */
export async function adminsWithSeedPassword() {
  const { admins } = await collections()
  return (await admins.find({ mustChangePassword: true }).toArray()).map(toAdmin)
}
