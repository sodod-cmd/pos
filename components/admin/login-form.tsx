'use client'

import { useActionState } from 'react'
import { ArrowRight } from 'lucide-react'
import { login } from '@/app/actions/auth'
import { FormAlert, PasswordInput, SubmitButton, TextInput } from '@/components/admin/fields'
import { initialAdminFormState } from '@/lib/admin-form'

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState(login, initialAdminFormState)
  return (
    <form action={action} noValidate className="flex flex-col gap-5">
      <input type="hidden" name="next" value={next ?? ''} />
      <FormAlert state={state} />
      <TextInput
        name="email"
        label="Имэйл хаяг"
        type="email"
        autoComplete="username"
        inputMode="email"
        placeholder="Нэвтрэх имэйл хаяг"
        defaultValue={state.values?.email}
        error={state.errors?.email}
      />
      <PasswordInput name="password" label="Нууц үг" autoComplete="current-password" error={state.errors?.password} />
      <SubmitButton variant="brand" pendingText="Нэвтэрч байна…" className="mt-2 h-12 w-full text-base">
        Нэвтрэх
        <ArrowRight aria-hidden="true" />
      </SubmitButton>
    </form>
  )
}
