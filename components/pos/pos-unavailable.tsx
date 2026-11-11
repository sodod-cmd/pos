import { DatabaseZap } from 'lucide-react'
import { Header } from './header'

export function PosUnavailable() {
  return (
    <>
      <Header />
      <main className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 py-24 text-center">
        <DatabaseZap aria-hidden="true" className="size-10 text-muted-foreground" />
        <h1 className="text-lg font-semibold">Барааны мэдээлэл ачаалж чадсангүй</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Өгөгдлийн сантай холбогдож чадсангүй. Түр хүлээгээд хуудсаа дахин ачаална уу.
        </p>
      </main>
    </>
  )
}
