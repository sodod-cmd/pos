/** Per-school settings, so the same build can be deployed for any school through .env. */
export const SCHOOL_NAME = process.env.SCHOOL_NAME?.trim() || 'Nest IT School'

export const ORDER_PREFIX =
  (process.env.ORDER_PREFIX?.trim() || 'NEST').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'POS'
