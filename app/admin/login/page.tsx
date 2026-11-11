import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { BarChart3, Boxes, ReceiptText, ShieldCheck } from 'lucide-react'
import { LoginForm } from '@/components/admin/login-form'
import { getCurrentAdmin } from '@/lib/auth/session'
import { SCHOOL_NAME } from '@/lib/school'

export const metadata: Metadata = { title: 'Нэвтрэх' }

const features = [
  { icon: BarChart3, text: 'Өдөр, сарын борлуулалт, хамгийн их зарагдсан бараа' },
  { icon: Boxes, text: 'Хэмжээ тус бүрийн үлдэгдэл, дуусч буй барааны сануулга' },
  { icon: ReceiptText, text: 'QPay-ээр төлөгдсөн захиалга, буцаалтын бүртгэл' },
]

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getCurrentAdmin().catch(() => null)) redirect('/admin')
  const { next } = await searchParams

  return (
    <main id="main" className="grid min-h-dvh bg-background lg:grid-cols-[1.1fr_1fr]">
      <section className="relative isolate hidden overflow-hidden bg-primary-deep text-primary-foreground lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        <div className="absolute inset-0 -z-10 bg-linear-to-br from-primary-deep via-primary to-primary-deep" aria-hidden="true" />
        <div className="absolute -top-32 -right-32 -z-10 size-96 rounded-full bg-highlight/25 blur-3xl" aria-hidden="true" />
        <div className="absolute -bottom-40 -left-20 -z-10 size-96 rounded-full bg-white/10 blur-3xl" aria-hidden="true" />

        <Link href="/" className="flex w-fit items-center gap-3 rounded-2xl bg-white px-4 py-2.5 shadow-lg shadow-black/20">
          <Image src="/logo.webp" alt={SCHOOL_NAME} width={156} height={48} className="h-9 w-auto object-contain" priority />
        </Link>

        <div className="flex max-w-lg flex-col gap-6">
          <p className="eyebrow flex items-center gap-3 text-highlight">
            <span className="h-px w-10 bg-highlight" aria-hidden="true" />
            Сургалтын албаны удирдлага
          </p>
          <h1 className="text-4xl leading-[1.08] font-extrabold tracking-tight text-balance xl:text-5xl">
            Дүрэмт хувцас, ном дэвтрийн борлуулалтыг <span className="text-highlight">нэг дороос</span>
          </h1>
          <ul className="flex flex-col gap-3">
            {features.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-base text-primary-foreground/85">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <Icon className="size-4 text-highlight" aria-hidden="true" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-primary-foreground/60">© {new Date().getFullYear()} {SCHOOL_NAME}</p>
      </section>

      <section className="flex flex-col justify-center px-5 py-12 sm:px-12">
        <div className="mx-auto flex w-full max-w-sm flex-col gap-8">
          <div className="flex flex-col gap-5">
            <Image src="/logo.webp" alt={SCHOOL_NAME} width={156} height={48} className="h-11 w-auto self-start object-contain lg:hidden" />
            <div className="flex flex-col gap-2">
              <h2 className="text-3xl font-bold text-foreground">Тавтай морил</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">Админ эрхээрээ нэвтэрч бараа, үлдэгдэл, борлуулалтаа удирдана уу.</p>
            </div>
          </div>
          <LoginForm next={next} />
          <p className="flex items-center gap-2 border-t border-border pt-6 text-xs text-muted-foreground">
            <ShieldCheck className="size-4 shrink-0 text-success" aria-hidden="true" />
            Зөвхөн эрх бүхий ажилтнуудад.
          </p>
        </div>
      </section>
    </main>
  )
}
