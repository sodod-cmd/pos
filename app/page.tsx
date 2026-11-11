import { PosApp } from '@/components/pos/pos-app'
import { PosUnavailable } from '@/components/pos/pos-unavailable'
import { getPosCatalog } from '@/lib/catalog'

// Stock changes with every sale, so the catalog is read fresh on each visit.
export const dynamic = 'force-dynamic'

export default async function Page() {
  let catalog
  try {
    catalog = await getPosCatalog()
  } catch (error) {
    console.error('[pos] Catalog could not be loaded', error)
    return <PosUnavailable />
  }
  return <PosApp categories={catalog.categories} products={catalog.products} />
}
