'use client'

import { useState } from 'react'
import { AlertTriangle, Eye, EyeOff, Loader2 } from 'lucide-react'
import { useFormStatus } from 'react-dom'
import { controlClass } from '@/components/admin/styles'
import { adminButton } from '@/components/admin/ui'
import type { AdminFormState } from '@/lib/admin-form'
import { cn } from '@/lib/utils'


type ShellProps = {
  name: string
  label: string
  error?: string
  hint?: React.ReactNode
  optional?: boolean
  className?: string
}

export function Field({ name, label, error, hint, optional, className, children }: ShellProps & { children: React.ReactNode }) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <label id={`${name}-label`} htmlFor={name} className="text-sm font-semibold text-foreground">
        {label}
        {optional && <span className="font-normal text-muted-foreground"> (заавал биш)</span>}
      </label>
      {children}
      {hint && !error && (
        <p id={`${name}-hint`} className="text-xs leading-relaxed text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${name}-error`} className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

export function a11y(name: string, error?: string, hint?: React.ReactNode) {
  return {
    id: name,
    name,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? `${name}-error` : hint ? `${name}-hint` : undefined,
  }
}

export function TextInput({
  type = 'text',
  defaultValue,
  placeholder,
  autoComplete,
  inputMode,
  min,
  step,
  suffix,
  ...shell
}: ShellProps & {
  type?: string
  defaultValue?: string | number
  placeholder?: string
  autoComplete?: string
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']
  min?: number
  step?: number
  suffix?: string
}) {
  return (
    <Field {...shell}>
      <div className="relative">
        <input
          {...a11y(shell.name, shell.error, shell.hint)}
          type={type}
          defaultValue={defaultValue}
          placeholder={placeholder}
          autoComplete={autoComplete}
          inputMode={inputMode}
          min={min}
          step={step}
          className={cn(controlClass, suffix && 'pr-10')}
        />
        {suffix && (
          <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-sm font-semibold text-muted-foreground">{suffix}</span>
        )}
      </div>
    </Field>
  )
}

export function TextArea({ defaultValue, placeholder, rows = 4, ...shell }: ShellProps & { defaultValue?: string; placeholder?: string; rows?: number }) {
  return (
    <Field {...shell}>
      <textarea
        {...a11y(shell.name, shell.error, shell.hint)}
        rows={rows}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className={cn(controlClass, 'resize-y leading-relaxed')}
      />
    </Field>
  )
}


export function PasswordInput({ autoComplete = 'new-password', ...shell }: ShellProps & { autoComplete?: string }) {
  const [shown, setShown] = useState(false)
  return (
    <Field {...shell}>
      <div className="relative">
        <input
          {...a11y(shell.name, shell.error, shell.hint)}
          type={shown ? 'text' : 'password'}
          autoComplete={autoComplete}
          className={cn(controlClass, 'pr-12')}
        />
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          className="absolute top-1/2 right-1.5 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface hover:text-primary"
        >
          {shown ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
          <span className="sr-only">{shown ? 'Нууц үгийг нуух' : 'Нууц үгийг харуулах'}</span>
        </button>
      </div>
    </Field>
  )
}

export function Switch({
  name,
  label,
  description,
  defaultChecked,
  checked,
  onCheckedChange,
}: {
  name: string
  label: string
  description?: string
  defaultChecked?: boolean
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
}) {
  return (
    <label htmlFor={name} className="flex cursor-pointer items-start justify-between gap-4">
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold text-foreground">{label}</span>
        {description && <span className="text-xs leading-relaxed text-muted-foreground">{description}</span>}
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input
          id={name}
          name={name}
          type="checkbox"
          defaultChecked={defaultChecked}
          checked={checked}
          onChange={onCheckedChange ? (e) => onCheckedChange(e.target.checked) : undefined}
          className="peer sr-only"
        />
        <span className="h-6 w-11 rounded-full bg-input transition-colors peer-checked:bg-success peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary" />
        <span className="absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  )
}

export function SubmitButton({
  children,
  pendingText = 'Хадгалж байна…',
  className,
  variant = 'primary',
}: {
  children: React.ReactNode
  pendingText?: string
  className?: string
  variant?: 'primary' | 'brand' | 'outline' | 'danger' | 'dangerSolid'
}) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className={cn(adminButton({ variant, size: 'md' }), className)}>
      {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
      {pending ? pendingText : children}
    </button>
  )
}

export function FormAlert({ state }: { state: AdminFormState }) {
  if (state.status === 'idle' || state.status === 'success') return null
  const text = state.status === 'invalid' ? (state.message ?? 'Улаанаар тэмдэглэсэн талбаруудыг шалгана уу.') : state.message
  return (
    <p role="alert" className="flex items-start gap-2.5 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm font-medium text-destructive">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      {text}
    </p>
  )
}
