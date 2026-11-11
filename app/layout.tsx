import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import type { CSSProperties } from 'react'
import { Inter } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

const inter = Inter({
  subsets: ['latin', 'cyrillic', 'cyrillic-ext'],
  variable: '--font-inter',
})

const DEFAULT_PRIMARY_COLOR = '#5b1fa8'
const DEFAULT_ACCENT_COLOR = '#e9c13c'
const HEX_COLOR_PATTERN = /^#(?:[\da-f]{3}|[\da-f]{6})$/i

function getHexColor(value: string | undefined, fallback: string) {
  if (!value || !HEX_COLOR_PATTERN.test(value.trim())) return fallback
  const color = value.trim().toLowerCase()
  return color.length === 4
    ? `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`
    : color
}

function getReadableForeground(hex: string) {
  const channels = hex.slice(1).match(/.{2}/g)?.map((channel) => Number.parseInt(channel, 16) / 255)
  if (!channels) return '#ffffff'
  const luminance = channels
    .map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4))
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0)
  return luminance > 0.179 ? '#241a2c' : '#ffffff'
}

const primaryColor = getHexColor(process.env.SCHOOL_PRIMARY_COLOR, DEFAULT_PRIMARY_COLOR)
const accentColor = getHexColor(process.env.SCHOOL_ACCENT_COLOR, DEFAULT_ACCENT_COLOR)
const themeStyle = {
  '--school-primary': primaryColor,
  '--school-primary-foreground': getReadableForeground(primaryColor),
  '--school-accent': accentColor,
  '--school-accent-foreground': getReadableForeground(accentColor),
} as CSSProperties

export const metadata: Metadata = {
  title: 'Nest IT School — Борлуулалтын цэг',
  description:
    'Сургалтын албаны борлуулалтын цэг: сургуулийн дүрэмт хувцас, ном, дэвтэр борлуулж QPay-ээр төлбөр хүлээн авна.',
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: primaryColor,
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="mn" className={`${inter.variable} bg-background`} style={themeStyle}>
      <body className="font-sans antialiased">
        {children}
        <Toaster position="top-right" closeButton />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
