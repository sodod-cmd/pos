'use client'

import { useActionState } from 'react'
import { Save } from 'lucide-react'
import { FormAlert, PasswordInput, SubmitButton, TextInput } from '@/components/admin/fields'
import { AdminLink, Card } from '@/components/admin/ui'
import { initialAdminFormState, type AdminFormState } from '@/lib/admin-form'

type Action = (state: AdminFormState, formData: FormData) => Promise<AdminFormState>

export function UserForm({
  action,
  user,
  cancelHref,
  minPassword,
}: {
  action: Action
  user?: { name: string; email: string }
  cancelHref: string
  minPassword: number
}) {
  const [state, formAction] = useActionState(action, initialAdminFormState)
  const v = state.values

  return (
    <form action={formAction} noValidate className="flex max-w-3xl flex-col gap-6">
      <FormAlert state={state} />
      <Card className="flex flex-col gap-6 p-5 md:p-7">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-bold text-foreground">Хувийн мэдээлэл</h2>
          <p className="text-sm text-muted-foreground">Нэвтрэхдээ имэйл хаягаа ашиглана.</p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <TextInput name="name" label="Нэр" autoComplete="off" defaultValue={v?.name ?? user?.name} error={state.errors?.name} placeholder="Б. Болд" />
          <TextInput
            name="email"
            label="Имэйл"
            type="email"
            inputMode="email"
            autoComplete="off"
            defaultValue={v?.email ?? user?.email}
            error={state.errors?.email}
            placeholder="name@school.mn"
          />
        </div>
      </Card>
      <Card className="flex flex-col gap-6 p-5 md:p-7">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-bold text-foreground">{user ? 'Нууц үг солих' : 'Нууц үг'}</h2>
          <p className="text-sm text-muted-foreground">
            {user
              ? 'Хоосон орхивол нууц үг өөрчлөгдөхгүй. Солибол тухайн админы бусад төхөөрөмж дээрх нэвтрэлт дуусна.'
              : `Дор хаяж ${minPassword} тэмдэгт. Админд аюулгүй сувгаар дамжуулна уу.`}
          </p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <PasswordInput name="password" label={user ? 'Шинэ нууц үг' : 'Нууц үг'} optional={Boolean(user)} error={state.errors?.password} />
          <PasswordInput name="confirm" label="Нууц үг давтах" optional={Boolean(user)} error={state.errors?.confirm} />
        </div>
      </Card>
      <div className="flex items-center justify-end gap-2">
        <AdminLink href={cancelHref} variant="ghost">
          Болих
        </AdminLink>
        <SubmitButton>
          <Save aria-hidden="true" />
          {user ? 'Өөрчлөлтийг хадгалах' : 'Админ үүсгэх'}
        </SubmitButton>
      </div>
    </form>
  )
}
