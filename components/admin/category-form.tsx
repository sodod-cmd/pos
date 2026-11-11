'use client'

import { useActionState, useState } from 'react'
import { Save } from 'lucide-react'
import { FormAlert, SubmitButton, Switch, TextArea, TextInput } from '@/components/admin/fields'
import { AdminLink, Card } from '@/components/admin/ui'
import { initialAdminFormState, type AdminFormState } from '@/lib/admin-form'

type Action = (state: AdminFormState, formData: FormData) => Promise<AdminFormState>

const CLOTHING_PRESET = '116, 122, 128, 134, 140, 146, 152, 158, 164'

export function CategoryForm({
  action,
  category,
}: {
  action: Action
  category?: { name: string; description: string; hasSizes: boolean; sizePresets: string[]; order: number }
}) {
  const [state, formAction] = useActionState(action, initialAdminFormState)
  const v = state.values
  const [hasSizes, setHasSizes] = useState(v ? v.hasSizes === 'on' : (category?.hasSizes ?? false))

  return (
    <form action={formAction} noValidate className="flex max-w-3xl flex-col gap-6">
      <FormAlert state={state} />
      <Card className="flex flex-col gap-6 p-5 md:p-7">
        <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_8rem]">
          <TextInput name="name" label="Ангиллын нэр" placeholder="Жишээ: Хувцас" defaultValue={v?.name ?? category?.name} error={state.errors?.name} />
          <TextInput
            name="order"
            label="Дараалал"
            type="number"
            inputMode="numeric"
            min={0}
            defaultValue={v?.order ?? category?.order ?? 0}
            error={state.errors?.order}
            hint="Бага нь эхэнд"
          />
        </div>
        <TextArea
          name="description"
          label="Тайлбар"
          optional
          rows={2}
          defaultValue={v?.description ?? category?.description}
          placeholder="Энэ ангилалд ямар бараа багтах вэ"
        />
      </Card>

      <Card className="flex flex-col gap-5 p-5 md:p-7">
        <Switch
          name="hasSizes"
          label="Хэмжээгээр зарагдана"
          description="Хувцас шиг бараа бүр хэмжээ тус бүрээр үлдэгдэлтэй байна. Ном, дэвтэр бол унтраалттай орхино."
          checked={hasSizes}
          onCheckedChange={setHasSizes}
        />
        {hasSizes && (
          <div className="flex flex-col gap-2">
            <TextInput
              name="sizePresets"
              label="Түгээмэл хэмжээнүүд"
              defaultValue={v?.sizePresets ?? category?.sizePresets.join(', ')}
              placeholder={CLOTHING_PRESET}
              error={state.errors?.sizePresets}
              hint="Таслалаар тусгаарлана. Бараа нэмэхэд эдгээрийг нэг товчоор сонгоно."
            />
          </div>
        )}
      </Card>

      <div className="flex items-center justify-end gap-2">
        <AdminLink href="/admin/categories" variant="ghost">
          Болих
        </AdminLink>
        <SubmitButton>
          <Save aria-hidden="true" />
          {category ? 'Өөрчлөлтийг хадгалах' : 'Ангилал үүсгэх'}
        </SubmitButton>
      </div>
    </form>
  )
}
