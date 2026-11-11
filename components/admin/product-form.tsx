'use client'

import { useActionState, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ImagePlus, Plus, Save, Star, Trash2, X } from 'lucide-react'
import { Field, FormAlert, SubmitButton, Switch, TextArea, TextInput } from '@/components/admin/fields'
import { controlClass, selectClass } from '@/components/admin/styles'
import { AdminLink, Card, adminButton } from '@/components/admin/ui'
import { initialAdminFormState, type AdminFormState } from '@/lib/admin-form'
import { DEFAULT_LOW_STOCK_THRESHOLD, formatMNT } from '@/lib/products'
import { cn } from '@/lib/utils'

type Action = (state: AdminFormState, formData: FormData) => Promise<AdminFormState>

export type ProductFormCategory = { id: string; name: string; hasSizes: boolean; sizePresets: string[] }

export type ProductFormValues = {
  name: string
  description: string
  categoryId: string
  price: number
  lowStockThreshold: number
  active: boolean
  images: string[]
  variants: { size: string; stock: number }[]
}

type VariantRow = { key: string; size: string; stock: string; orig: number | null }
type ImageItem = { key: string; kind: 'url'; url: string } | { key: string; kind: 'file'; file: File; preview: string }

const MAX_IMAGES = 6
const ACCEPT = 'image/jpeg,image/png,image/webp,image/avif'

let keySeed = 0
const nextKey = () => `k${++keySeed}`

/** Natural order so 116 < 122 < 1000 and S < M < L stay as entered. */
function sortRows(rows: VariantRow[], presets: string[]) {
  const rank = (size: string) => {
    const i = presets.indexOf(size)
    return i === -1 ? presets.length : i
  }
  return [...rows].sort((a, b) => rank(a.size) - rank(b.size) || a.size.localeCompare(b.size, 'mn', { numeric: true }))
}

export function ProductForm({
  action,
  categories,
  product,
  s3Configured,
}: {
  action: Action
  categories: ProductFormCategory[]
  product?: ProductFormValues
  s3Configured: boolean
}) {
  const [state, formAction] = useActionState(action, initialAdminFormState)
  const v = state.values

  const [categoryId, setCategoryId] = useState(product?.categoryId ?? categories[0]?.id ?? '')
  const category = categories.find((c) => c.id === categoryId)
  const hasSizes = category?.hasSizes ?? false
  const presets = useMemo(() => category?.sizePresets ?? [], [category])

  const [rows, setRows] = useState<VariantRow[]>(() =>
    (product?.variants ?? []).filter((variant) => variant.size !== '').map((variant) => ({ key: nextKey(), size: variant.size, stock: String(variant.stock), orig: variant.stock })),
  )
  const single = product?.variants.find((variant) => variant.size === '')
  const [singleStock, setSingleStock] = useState(single ? String(single.stock) : '')
  const [customSize, setCustomSize] = useState('')
  const [fillAll, setFillAll] = useState('')
  const [price, setPrice] = useState(product ? String(product.price) : '')

  const [images, setImages] = useState<ImageItem[]>(() => (product?.images ?? []).map((url) => ({ key: nextKey(), kind: 'url', url })))
  const fileInput = useRef<HTMLInputElement>(null)

  // Object URLs for new files are released when the form goes away.
  const previews = useRef(new Set<string>())
  useEffect(() => {
    const urls = previews.current
    return () => urls.forEach((url) => URL.revokeObjectURL(url))
  }, [])

  const sizes = new Set(rows.map((row) => row.size))
  const totalUnits = hasSizes ? rows.reduce((sum, row) => sum + (Number(row.stock) || 0), 0) : Number(singleStock) || 0

  function addSizes(list: string[]) {
    const fresh = list.map((s) => s.trim()).filter((s) => s && !sizes.has(s))
    if (fresh.length === 0) return
    setRows((current) => sortRows([...current, ...fresh.map((size) => ({ key: nextKey(), size, stock: fillAll || '0', orig: null }))], presets))
  }

  function toggleSize(size: string) {
    if (sizes.has(size)) setRows((current) => current.filter((row) => row.size !== size))
    else addSizes([size])
  }

  function addFiles(list: FileList | null) {
    if (!list) return
    const room = MAX_IMAGES - images.length
    const picked = [...list].slice(0, Math.max(0, room)).map((file) => {
      const preview = URL.createObjectURL(file)
      previews.current.add(preview)
      return { key: nextKey(), kind: 'file' as const, file, preview }
    })
    setImages((current) => [...current, ...picked])
  }

  function moveImage(index: number, to: number) {
    setImages((current) => {
      const next = [...current]
      const [item] = next.splice(index, 1)
      next.splice(to, 0, item)
      return next
    })
  }

  /** Lists and files live in React state, so they are added to the submission here (React resets the form after every action). */
  function submit(formData: FormData) {
    const variants = hasSizes
      ? rows.map((row) => ({ size: row.size, stock: Number(row.stock), orig: row.orig }))
      : [{ size: '', stock: Number(singleStock || 0), orig: single ? single.stock : null }]
    formData.set('variants', JSON.stringify(variants))

    const order: string[] = []
    let fileIndex = 0
    for (const item of images) {
      if (item.kind === 'url') order.push(`url:${item.url}`)
      else {
        formData.append('images', item.file)
        order.push(`file:${fileIndex++}`)
      }
    }
    formData.set('imageOrder', JSON.stringify(order))
    formData.set('categoryId', categoryId)
    formAction(formData)
  }

  return (
    <form action={submit} noValidate className="flex flex-col gap-6">
      <FormAlert state={state} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col gap-6">
          <Card className="flex flex-col gap-6 p-5 md:p-7">
            <div className="flex flex-col gap-1">
              <h2 className="text-base font-bold">Үндсэн мэдээлэл</h2>
              <p className="text-sm text-muted-foreground">Борлуулалтын цэг дээр эцэг эхэд харагдана.</p>
            </div>
            <TextInput name="name" label="Барааны нэр" placeholder="Жишээ: Сургуулийн Hoodie" defaultValue={v?.name ?? product?.name} error={state.errors?.name} />
            <TextArea
              name="description"
              label="Тайлбар"
              optional
              rows={3}
              placeholder="Өнгө, материал, онцлог"
              defaultValue={v?.description ?? product?.description}
            />
            <div className="grid gap-5 sm:grid-cols-2">
              <Field name="categoryId" label="Ангилал" error={state.errors?.categoryId}>
                <select
                  id="categoryId"
                  name="categoryId"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  aria-invalid={state.errors?.categoryId ? true : undefined}
                  className={selectClass}
                >
                  {categories.length === 0 && <option value="">Эхлээд ангилал үүсгэнэ үү</option>}
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.hasSizes ? ' (хэмжээтэй)' : ''}
                    </option>
                  ))}
                </select>
              </Field>
              <Field name="price" label="Үнэ" error={state.errors?.price} hint={Number(price) > 0 ? formatMNT(Number(price)) : 'Төгрөгөөр'}>
                <div className="relative">
                  <input
                    id="price"
                    name="price"
                    inputMode="numeric"
                    value={price}
                    onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ''))}
                    placeholder="59000"
                    aria-invalid={state.errors?.price ? true : undefined}
                    aria-describedby={state.errors?.price ? 'price-error' : 'price-hint'}
                    className={cn(controlClass, 'pr-9')}
                  />
                  <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-sm font-semibold text-muted-foreground">₮</span>
                </div>
              </Field>
            </div>
          </Card>

          <Card className="flex flex-col gap-5 p-5 md:p-7">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <h2 className="text-base font-bold">{hasSizes ? 'Хэмжээ ба үлдэгдэл' : 'Үлдэгдэл'}</h2>
                <p className="text-sm text-muted-foreground">
                  {product
                    ? 'Үлдэгдлийг өөрчилбөл агуулахын түүхэнд «Тооллого / засвар» гэж бүртгэгдэнэ.'
                    : 'Одоо агуулахад байгаа тоог оруулна. «Эхний үлдэгдэл» гэж бүртгэгдэнэ.'}
                </p>
              </div>
              <span className="rounded-full bg-primary/8 px-3 py-1 text-sm font-bold text-primary">Нийт {totalUnits} ширхэг</span>
            </div>

            {hasSizes ? (
              <>
                {presets.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold">Хэмжээ сонгох</p>
                      <button type="button" onClick={() => addSizes(presets)} className="text-sm font-semibold text-primary hover:underline">
                        Бүгдийг нэмэх
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Түгээмэл хэмжээнүүд">
                      {presets.map((size) => (
                        <button
                          key={size}
                          type="button"
                          aria-pressed={sizes.has(size)}
                          onClick={() => toggleSize(size)}
                          className={cn(
                            'min-h-9 min-w-12 rounded-lg border px-2.5 text-sm font-semibold transition-colors',
                            sizes.has(size) ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-card hover:border-primary/50',
                          )}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-end gap-2">
                  <div className="flex flex-col gap-2">
                    <label htmlFor="customSize" className="text-sm font-semibold">
                      Өөр хэмжээ
                    </label>
                    <input
                      id="customSize"
                      value={customSize}
                      onChange={(e) => setCustomSize(e.target.value.slice(0, 12))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          addSizes([customSize])
                          setCustomSize('')
                        }
                      }}
                      placeholder="170, XL…"
                      className={cn(controlClass, 'h-10 w-32 py-2')}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      addSizes([customSize])
                      setCustomSize('')
                    }}
                    disabled={!customSize.trim() || sizes.has(customSize.trim())}
                    className={adminButton({ variant: 'outline', size: 'sm' })}
                  >
                    <Plus aria-hidden="true" />
                    Нэмэх
                  </button>
                  <span className="mx-1 hidden h-8 w-px bg-border sm:block" aria-hidden="true" />
                  <div className="flex flex-col gap-2">
                    <label htmlFor="fillAll" className="text-sm font-semibold">
                      Бүх хэмжээнд ижил тоо
                    </label>
                    <input
                      id="fillAll"
                      inputMode="numeric"
                      value={fillAll}
                      onChange={(e) => setFillAll(e.target.value.replace(/[^\d]/g, '').slice(0, 5))}
                      placeholder="10"
                      className={cn(controlClass, 'h-10 w-24 py-2')}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setRows((current) => current.map((row) => ({ ...row, stock: fillAll })))}
                    disabled={!fillAll || rows.length === 0}
                    className={adminButton({ variant: 'outline', size: 'sm' })}
                  >
                    Бүгдэд тавих
                  </button>
                </div>

                {rows.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border bg-surface px-4 py-6 text-center text-sm text-muted-foreground">
                    Дээрээс хэмжээ сонгож эхэлнэ үү.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                    {rows.map((row) => {
                      const changed = row.orig !== null && Number(row.stock) !== row.orig
                      return (
                        <div
                          key={row.key}
                          className={cn('flex flex-col gap-1.5 rounded-xl border bg-card p-2.5', changed ? 'border-highlight' : 'border-border', Number(row.stock) === 0 && 'bg-destructive/4')}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-sm font-bold">{row.size}</span>
                            <button
                              type="button"
                              onClick={() => setRows((current) => current.filter((r) => r.key !== row.key))}
                              className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            >
                              <X className="size-3.5" aria-hidden="true" />
                              <span className="sr-only">{row.size} хэмжээг хасах</span>
                            </button>
                          </div>
                          <label className="sr-only" htmlFor={`stock-${row.key}`}>
                            {row.size} хэмжээний үлдэгдэл
                          </label>
                          <input
                            id={`stock-${row.key}`}
                            inputMode="numeric"
                            value={row.stock}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => {
                              const stock = e.target.value.replace(/[^\d]/g, '').slice(0, 5)
                              setRows((current) => current.map((r) => (r.key === row.key ? { ...r, stock } : r)))
                            }}
                            className={cn(controlClass, 'h-10 py-2 text-center font-semibold')}
                          />
                          <span className="min-h-4 text-center text-[11px] text-muted-foreground">
                            {row.orig === null ? 'Шинэ' : changed ? `Өмнө нь ${row.orig}` : 'ширхэг'}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            ) : (
              <div className="max-w-xs">
                <Field name="singleStock" label="Агуулахад байгаа тоо" hint={single && Number(singleStock) !== single.stock ? `Өмнө нь ${single.stock}` : 'ширхэг'}>
                  <input
                    id="singleStock"
                    inputMode="numeric"
                    value={singleStock}
                    onChange={(e) => setSingleStock(e.target.value.replace(/[^\d]/g, '').slice(0, 5))}
                    placeholder="0"
                    className={controlClass}
                  />
                </Field>
              </div>
            )}
            {state.errors?.variants && (
              <p role="alert" className="text-sm font-medium text-destructive">
                {state.errors.variants}
              </p>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card className="flex flex-col gap-4 p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-bold">Зураг</h2>
              <span className="text-xs text-muted-foreground">
                {images.length}/{MAX_IMAGES}
              </span>
            </div>
            {images.length > 0 && (
              <ul className="grid grid-cols-3 gap-2">
                {images.map((item, index) => (
                  <li key={item.key} className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-surface">
                    {/* eslint-disable-next-line @next/next/no-img-element -- local object URLs and S3 uploads */}
                    <img src={item.kind === 'url' ? item.url : item.preview} alt="" className="size-full object-cover" />
                    {index === 0 && (
                      <span className="absolute bottom-1 left-1 rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">Нүүр</span>
                    )}
                    <span className="absolute inset-x-1 top-1 flex justify-between opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                      {index > 0 ? (
                        <button
                          type="button"
                          onClick={() => moveImage(index, index === 1 ? 0 : index - 1)}
                          className="flex size-7 items-center justify-center rounded-md bg-card/90 text-foreground shadow-sm hover:bg-card"
                          title={index === 1 ? 'Нүүр зураг болгох' : 'Өмнө нь шилжүүлэх'}
                        >
                          {index === 1 ? <Star className="size-3.5" aria-hidden="true" /> : <ArrowLeft className="size-3.5" aria-hidden="true" />}
                          <span className="sr-only">{index === 1 ? 'Нүүр зураг болгох' : 'Өмнө нь шилжүүлэх'}</span>
                        </button>
                      ) : (
                        <span />
                      )}
                      <button
                        type="button"
                        onClick={() => setImages((current) => current.filter((i) => i.key !== item.key))}
                        className="flex size-7 items-center justify-center rounded-md bg-card/90 text-destructive shadow-sm hover:bg-card"
                        title="Хасах"
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" />
                        <span className="sr-only">Зургийг хасах</span>
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {images.length < MAX_IMAGES && (
              <label
                className={cn(
                  'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-input bg-surface px-4 py-6 text-center text-sm font-semibold text-primary transition-colors hover:border-primary/40',
                  !s3Configured && 'cursor-not-allowed opacity-60',
                )}
              >
                <ImagePlus className="size-6" aria-hidden="true" />
                Зураг нэмэх
                <span className="text-xs font-normal text-muted-foreground">JPG, PNG, WebP · 8MB хүртэл · дөрвөлжин зураг тохиромжтой</span>
                <input
                  ref={fileInput}
                  type="file"
                  accept={ACCEPT}
                  multiple
                  disabled={!s3Configured}
                  className="sr-only"
                  onChange={(e) => {
                    addFiles(e.target.files)
                    e.target.value = ''
                  }}
                />
              </label>
            )}
            {!s3Configured && (
              <p className="rounded-lg bg-warning/15 px-3 py-2 text-xs text-warning-foreground">
                S3 тохиргоо (.env) хийгдээгүй тул шинэ зураг байршуулах боломжгүй.
              </p>
            )}
            {state.errors?.images && <p className="text-sm font-medium text-destructive">{state.errors.images}</p>}
          </Card>

          <Card className="flex flex-col gap-5 p-5">
            <h2 className="text-base font-bold">Тохиргоо</h2>
            <Switch
              name="active"
              label="Борлуулалтад гаргах"
              description="Унтраавал борлуулалтын цэг дээр харагдахгүй."
              defaultChecked={v ? v.active === 'on' : (product?.active ?? true)}
            />
            <TextInput
              name="lowStockThreshold"
              label="Дуусч буй гэж үзэх хязгаар"
              type="number"
              inputMode="numeric"
              min={0}
              suffix="ш"
              defaultValue={v?.lowStockThreshold ?? product?.lowStockThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD}
              error={state.errors?.lowStockThreshold}
              hint="Хэмжээ тус бүрийн үлдэгдэл үүнээс бага болоход хянах самбарт сануулга гарна."
            />
          </Card>
        </div>
      </div>

      <div className="sticky bottom-0 z-10 -mx-4 flex items-center justify-end gap-2 border-t border-border/80 bg-surface/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border">
        <AdminLink href="/admin/products" variant="ghost">
          Болих
        </AdminLink>
        <SubmitButton>
          <Save aria-hidden="true" />
          {product ? 'Өөрчлөлтийг хадгалах' : 'Бараа бүртгэх'}
        </SubmitButton>
      </div>
    </form>
  )
}
