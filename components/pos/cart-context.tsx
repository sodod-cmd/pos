'use client'

import { createContext, useContext, useMemo, useReducer, type ReactNode } from 'react'
import { variantStock, type Product } from '@/lib/products'

const MAX_LINE_QTY = 20

interface CartEntry {
  key: string
  productId: string
  size?: string
  qty: number
}

export interface CartLine extends CartEntry {
  product: Product
  lineTotal: number
  /** Most the shelf allows for this line. */
  maxQty: number
}

type Action =
  | { type: 'add'; productId: string; size?: string; max: number }
  | { type: 'setQty'; key: string; qty: number; max: number }
  | { type: 'remove'; key: string }
  | { type: 'clear' }

function lineKey(productId: string, size?: string) {
  return `${productId}:${size ?? ''}`
}

function reducer(state: CartEntry[], action: Action): CartEntry[] {
  switch (action.type) {
    case 'add': {
      if (action.max < 1) return state
      const key = lineKey(action.productId, action.size)
      const existing = state.find((entry) => entry.key === key)
      if (existing) {
        return state.map((entry) => (entry.key === key ? { ...entry, qty: Math.min(entry.qty + 1, action.max) } : entry))
      }
      return [...state, { key, productId: action.productId, size: action.size, qty: 1 }]
    }
    case 'setQty':
      return action.qty < 1
        ? state.filter((entry) => entry.key !== action.key)
        : state.map((entry) => (entry.key === action.key ? { ...entry, qty: Math.min(action.qty, action.max) } : entry))
    case 'remove':
      return state.filter((entry) => entry.key !== action.key)
    case 'clear':
      return []
  }
}

interface CartContextValue {
  lines: CartLine[]
  count: number
  total: number
  qtyForProduct: (productId: string) => number
  qtyForVariant: (productId: string, size?: string) => number
  /** Returns false when the size is sold out or the cart already holds all of it. */
  add: (productId: string, size?: string) => boolean
  setQty: (key: string, qty: number) => void
  remove: (key: string) => void
  clear: () => void
}

const CartContext = createContext<CartContextValue | null>(null)

export function CartProvider({ products, children }: { products: Product[]; children: ReactNode }) {
  const [entries, dispatch] = useReducer(reducer, [])

  const value = useMemo<CartContextValue>(() => {
    const byId = new Map(products.map((product) => [product.id, product]))
    const maxFor = (productId: string, size?: string) => {
      const product = byId.get(productId)
      return product ? Math.min(MAX_LINE_QTY, Math.max(0, variantStock(product, size))) : 0
    }

    const lines = entries.flatMap((entry) => {
      const product = byId.get(entry.productId)
      if (!product) return []
      const maxQty = maxFor(entry.productId, entry.size)
      return [{ ...entry, product, maxQty, lineTotal: product.price * entry.qty }]
    })
    const qtyForVariant = (productId: string, size?: string) =>
      lines.find((line) => line.key === lineKey(productId, size))?.qty ?? 0

    return {
      lines,
      count: lines.reduce((sum, line) => sum + line.qty, 0),
      total: lines.reduce((sum, line) => sum + line.lineTotal, 0),
      qtyForProduct: (productId) => lines.filter((line) => line.productId === productId).reduce((sum, l) => sum + l.qty, 0),
      qtyForVariant,
      add: (productId, size) => {
        const max = maxFor(productId, size)
        if (qtyForVariant(productId, size) >= max) return false
        dispatch({ type: 'add', productId, size, max })
        return true
      },
      setQty: (key, qty) => {
        const line = lines.find((l) => l.key === key)
        dispatch({ type: 'setQty', key, qty, max: line?.maxQty ?? MAX_LINE_QTY })
      },
      remove: (key) => dispatch({ type: 'remove', key }),
      clear: () => dispatch({ type: 'clear' }),
    }
  }, [entries, products])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const context = useContext(CartContext)
  if (!context) throw new Error('useCart must be used inside CartProvider')
  return context
}
