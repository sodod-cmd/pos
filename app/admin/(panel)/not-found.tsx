import { AdminLink, Card, EmptyState } from '@/components/admin/ui'

export default function AdminNotFound() {
  return (
    <div className="flex min-h-[calc(100dvh-7rem)] items-center justify-center lg:min-h-[calc(100dvh-5rem)]">
      <Card className="w-full max-w-lg">
        <EmptyState
          title="Олдсонгүй"
          text="Таны хайсан бичлэг устсан эсвэл хаяг буруу байна."
          action={<AdminLink href="/admin">Хянах самбар руу буцах</AdminLink>}
        />
      </Card>
    </div>
  )
}
