import type { Metadata } from 'next'
import { SCHOOL_NAME } from '@/lib/school'

export const metadata: Metadata = {
  title: { default: 'Удирдлага', template: `%s · Удирдлага | ${SCHOOL_NAME}` },
  robots: { index: false, follow: false },
}

export default function AdminRootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children
}
