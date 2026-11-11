/** Result of an admin form action. Successful saves redirect, so there is no success state. */
export type AdminFormState = {
  status: 'idle' | 'invalid' | 'error' | 'success'
  message?: string
  errors?: Record<string, string>
  values?: Record<string, string>
  /** Changes on every submit so a form can reset inputs React does not repopulate (file pickers). */
  attempt?: number
}

export const initialAdminFormState: AdminFormState = { status: 'idle' }

export function readField(formData: FormData, key: string, max = 5000) {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
