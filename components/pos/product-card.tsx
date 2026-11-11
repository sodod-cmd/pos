'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { Check, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { PLACEHOLDER_IMAGE, formatMNT, totalStock, variantStock, type Product } from '@/lib/products'
import { useCart } from './cart-context'

export function ProductCard({ product }: { product: Product }) {
  const { add, qtyForProduct, qtyForVariant } = useCart()
  const [imageIndex, setImageIndex] = useState(0)
  const [size, setSize] = useState<string | null>(null)
  const [justAdded, setJustAdded] = useState(false)

  const images = product.images.length > 0 ? product.images : [PLACEHOLDER_IMAGE]
  const inCart = qtyForProduct(product.id)
  const needsSize = product.hasSizes
  const soldOut = totalStock(product) <= 0
  const selected = needsSize ? size : ''
  const stock = selected === null ? 0 : variantStock(product, selected)
  const left = selected === null ? 0 : stock - qtyForVariant(product.id, selected || undefined)
  const canAdd = !soldOut && selected !== null && left > 0

  useEffect(() => {
    if (!justAdded) return
    const timer = setTimeout(() => setJustAdded(false), 1200)
    return () => clearTimeout(timer)
  }, [justAdded])

  function handleAdd() {
    if (!canAdd) return
    if (!add(product.id, selected || undefined)) return
    toast.success(`${product.name} сагсанд нэмэгдлээ`, {
      description: `${selected ? `Хэмжээ ${selected} · ` : ''}${formatMNT(product.price)}`,
      duration: 5000,
    })
    setJustAdded(true)
  }

  let buttonLabel: React.ReactNode
  if (justAdded) buttonLabel = <><Check aria-hidden="true" /> Нэмэгдлээ</>
  else if (soldOut) buttonLabel = 'Дууссан'
  else if (selected === null) buttonLabel = 'Хэмжээ сонгох'
  else if (left <= 0) buttonLabel = stock <= 0 ? 'Дууссан' : 'Бүгд сагсанд'
  else buttonLabel = <><Plus aria-hidden="true" /> Сагсанд нэмэх</>

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="relative aspect-square bg-muted">
        <Image
          src={images[Math.min(imageIndex, images.length - 1)]}
          alt={`${product.name} — зураг ${imageIndex + 1}`}
          fill
          sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw"
          className={cn('object-cover', soldOut && 'opacity-50 grayscale')}
        />
        <span className="absolute top-3 left-3 rounded-full bg-card/90 px-2.5 py-1 text-xs font-medium text-secondary-foreground">
          {product.categoryName}
        </span>
        {soldOut ? (
          <span className="absolute top-3 right-3 rounded-full bg-foreground px-2.5 py-1 text-xs font-semibold text-background">
            Дууссан
          </span>
        ) : (
          inCart > 0 && (
            <span className="absolute top-3 right-3 rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground">
              Сагсанд: {inCart}
            </span>
          )
        )}
      </div>

      {images.length > 1 && (
        <div className="flex gap-2 px-4 pt-3" role="group" aria-label="Зураг сонгох">
          {images.map((src, index) => (
            <button
              key={src}
              type="button"
              onClick={() => setImageIndex(index)}
              aria-label={`Зураг ${index + 1}`}
              aria-pressed={index === imageIndex}
              className={cn(
                'relative size-11 overflow-hidden rounded-lg border-2 transition-colors',
                index === imageIndex ? 'border-primary' : 'border-transparent hover:border-border',
              )}
            >
              <Image src={src} alt="" fill sizes="44px" className="object-cover" />
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex flex-col gap-1">
          <h3 className="text-base leading-snug font-semibold text-balance">{product.name}</h3>
          <p className="text-sm leading-relaxed text-pretty text-muted-foreground">{product.description}</p>
        </div>

        {needsSize && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-xs font-medium text-muted-foreground">Хэмжээ (өндөр, см)</legend>
            <div className="flex flex-wrap gap-1.5">
              {product.variants.map((variant) => {
                const out = variant.stock <= 0
                return (
                  <button
                    key={variant.size}
                    type="button"
                    aria-pressed={size === variant.size}
                    disabled={out}
                    onClick={() => setSize(variant.size)}
                    title={out ? 'Дууссан' : `${variant.stock} ширхэг үлдсэн`}
                    className={cn(
                      'min-h-9 min-w-11 rounded-lg border px-2 text-sm font-medium transition-colors',
                      size === variant.size
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-input bg-card hover:border-primary/60',
                      out && 'cursor-not-allowed border-dashed text-muted-foreground/60 line-through hover:border-input',
                    )}
                  >
                    {variant.size}
                    <span className="sr-only">{out ? ' (дууссан)' : ''}</span>
                  </button>
                )
              })}
            </div>
          </fieldset>
        )}

        <p aria-live="polite" className="min-h-4 text-xs font-medium">
          {!soldOut && selected !== null && stock > 0 && stock <= product.lowStockThreshold && (
            <span className="text-warning-foreground">
              {selected ? `${selected} хэмжээнээс ` : ''}зөвхөн {stock} ширхэг үлдсэн
            </span>
          )}
        </p>

        <div className="mt-auto flex items-center justify-between gap-3">
          <p className="text-lg font-bold text-primary">{formatMNT(product.price)}</p>
          <Button onClick={handleAdd} disabled={!canAdd} className="h-11 min-w-36 px-3 text-sm">
            {buttonLabel}
          </Button>
        </div>
      </div>
    </article>
  )
}
