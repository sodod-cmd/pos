'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { readField, type AdminFormState } from '@/lib/admin-form'
import { requireAdmin } from '@/lib/auth/session'
import { categoryNameTaken, createCategory, deleteCategory, getCategoryById, updateCategory } from '@/lib/catalog'

function revalidateCatalog() {
  revalidatePath('/')
  revalidatePath('/admin', 'layout')
}

/** "116, 122 128" → ['116', '122', '128'], without duplicates. */
function parseSizes(text: string) {
  return [...new Set(text.split(/[\s,;/]+/).map((s) => s.trim()).filter(Boolean))].slice(0, 40)
}

export async function saveCategory(id: string | null, _prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  await requireAdmin()
  if (id && !(await getCategoryById(id))) return { status: 'error', message: 'Ангилал олдсонгүй. Өөр админ устгасан байж магадгүй.' }

  const values = {
    name: readField(formData, 'name', 60),
    description: readField(formData, 'description', 300),
    sizePresets: readField(formData, 'sizePresets', 400),
    order: readField(formData, 'order', 4),
    hasSizes: formData.get('hasSizes') === 'on' ? 'on' : '',
  }
  const sizes = parseSizes(values.sizePresets)
  const order = values.order === '' ? 0 : Number(values.order)

  const errors: Record<string, string> = {}
  if (values.name.length < 2) errors.name = 'Ангиллын нэр дор хаяж 2 тэмдэгт байна.'
  else if (await categoryNameTaken(values.name, id ?? undefined)) errors.name = 'Ийм нэртэй ангилал аль хэдийн байна.'
  if (!Number.isInteger(order) || order < 0 || order > 999) errors.order = '0-999 хооронд бүхэл тоо оруулна уу.'
  if (sizes.some((s) => s.length > 12)) errors.sizePresets = 'Хэмжээ бүр 12 тэмдэгтээс ихгүй байна.'
  if (Object.keys(errors).length) return { status: 'invalid', errors, values }

  const input = { name: values.name, description: values.description, hasSizes: values.hasSizes === 'on', sizePresets: values.hasSizes === 'on' ? sizes : [], order }
  try {
    if (id) await updateCategory(id, input)
    else await createCategory(input)
  } catch (error) {
    console.error('[admin-categories] Save failed', error)
    return { status: 'error', message: 'Хадгалах үед алдаа гарлаа. Дахин оролдоно уу.', values }
  }

  revalidateCatalog()
  redirect(`/admin/categories?flash=${id ? 'updated' : 'created'}`)
}

export async function removeCategory(id: string) {
  await requireAdmin()
  const result = await deleteCategory(id)
  if (result === 'deleted') revalidateCatalog()
  redirect(`/admin/categories?flash=${result === 'in-use' ? 'in-use' : 'deleted'}`)
}
