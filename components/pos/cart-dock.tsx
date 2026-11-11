'use client'

import Image from 'next/image'
import { useState } from 'react'
import { ChevronUp, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { coverImage, formatMNT } from '@/lib/products'
import { useCart } from './cart-context'
import { CheckoutDialog } from './checkout-dialog'

export function CartDock() {
  const { lines, count, total, setQty, remove, clear } = useCart()
  const [expanded, setExpanded] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)

  const isEmpty = count === 0
  const showList = expanded && !isEmpty

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-30 px-3 pb-3 sm:px-6">
        <div className="mx-auto max-w-6xl overflow-hidden rounded-2xl bg-primary text-primary-foreground shadow-2xl ring-1 ring-foreground/10">
          {showList && (
            <div
              id="cart-panel"
              className="max-h-[50vh] overflow-y-auto bg-card text-card-foreground"
            >
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <h2 className="text-sm font-semibold">Сагсан дахь бараа</h2>
                <button
                  type="button"
                  onClick={clear}
                  className="min-h-9 rounded-lg px-2 text-sm text-muted-foreground hover:text-destructive"
                >
                  Сагс хоослох
                </button>
              </div>
              <ul className="divide-y divide-border">
                {lines.map((line) => (
                  <li key={line.key} className="flex items-center gap-3 px-4 py-3">
                    <div className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                      <Image
                        src={coverImage(line.product)}
                        alt=""
                        fill
                        sizes="48px"
                        className="object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{line.product.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {line.size ? `Хэмжээ ${line.size} · ` : ''}
                        {formatMNT(line.product.price)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon-lg"
                        className="size-10"
                        aria-label={`${line.product.name}: нэгээр хасах`}
                        onClick={() => setQty(line.key, line.qty - 1)}
                      >
                        <Minus aria-hidden="true" />
                      </Button>
                      <span className="w-8 text-center text-sm font-semibold" aria-live="polite">
                        {line.qty}
                      </span>
                      <Button
                        variant="outline"
                        size="icon-lg"
                        className="size-10"
                        aria-label={`${line.product.name}: нэгээр нэмэх`}
                        disabled={line.qty >= line.maxQty}
                        title={line.qty >= line.maxQty ? 'Үлдэгдэл хүрэлцэхгүй' : undefined}
                        onClick={() => setQty(line.key, line.qty + 1)}
                      >
                        <Plus aria-hidden="true" />
                      </Button>
                    </div>
                    <p className="hidden w-24 text-right text-sm font-semibold sm:block">
                      {formatMNT(line.lineTotal)}
                    </p>
                    <Button
                      variant="ghost"
                      size="icon-lg"
                      className="size-10 text-muted-foreground hover:text-destructive"
                      aria-label={`${line.product.name}: сагснаас хасах`}
                      onClick={() => remove(line.key)}
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center gap-3 p-3 sm:gap-4 sm:p-4">
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              disabled={isEmpty}
              aria-expanded={showList}
              aria-controls="cart-panel"
              className="flex min-h-12 items-center gap-3 rounded-xl px-2 text-left transition-colors hover:bg-primary-foreground/10 disabled:cursor-default disabled:hover:bg-transparent"
            >
              <span className="relative">
                <ShoppingBag aria-hidden="true" className="size-6" />
                {!isEmpty && (
                  <span
                    key={count}
                    className="absolute -top-2 -right-2.5 flex size-5 animate-in items-center justify-center rounded-full bg-highlight text-xs font-bold text-highlight-foreground zoom-in-50"
                  >
                    {count}
                  </span>
                )}
              </span>
              <span className="flex flex-col leading-tight">
                <span className="text-sm font-semibold">Сагс</span>
                <span className="text-xs text-primary-foreground/70">
                  {isEmpty ? 'Бараа сонгоно уу' : `${lines.length} төрөл · ${count} ширхэг`}
                </span>
              </span>
              {!isEmpty && (
                <ChevronUp
                  aria-hidden="true"
                  className={cn('size-4 transition-transform', showList && 'rotate-180')}
                />
              )}
            </button>

            <ul
              aria-hidden="true"
              className="ml-2 hidden items-center -space-x-3 md:flex"
            >
              {lines.slice(0, 5).map((line) => (
                <li
                  key={line.key}
                  className="relative size-10 overflow-hidden rounded-full bg-muted ring-2 ring-primary"
                >
                  <Image
                    src={coverImage(line.product)}
                    alt=""
                    fill
                    sizes="40px"
                    className="object-cover"
                  />
                </li>
              ))}
            </ul>

            <div className="ml-auto flex items-center gap-3 sm:gap-5">
              <div className="flex flex-col items-end leading-tight">
                <span className="text-xs text-primary-foreground/70">Нийт дүн</span>
                <span className="text-xl font-bold sm:text-2xl">{formatMNT(total)}</span>
              </div>
              <Button
                onClick={() => setCheckoutOpen(true)}
                disabled={isEmpty}
                className="h-12 bg-highlight px-5 text-base font-semibold text-highlight-foreground hover:bg-highlight/90 sm:px-7"
              >
                Төлбөр төлөх
              </Button>
            </div>
          </div>
        </div>
      </div>

      <CheckoutDialog open={checkoutOpen} onOpenChange={setCheckoutOpen} />
    </>
  )
}
