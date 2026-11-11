// Initial catalog for `npm run seed`: the products the POS showed before it moved to MongoDB.
// Plain TypeScript without path aliases, so Node can run scripts/seed.mts directly.

export const CLOTHING_SIZES = ['116', '122', '128', '134', '140', '146', '152', '158', '164']

export interface SeedCategory {
  slug: string
  name: string
  description: string
  hasSizes: boolean
  sizePresets: string[]
  order: number
}

export interface SeedProduct {
  slug: string
  name: string
  description: string
  category: string
  price: number
  images: string[]
  sizes?: string[]
  /** Opening stock for each size (or for the product when it has no sizes). */
  stock: number
  lowStockThreshold: number
}

export const SEED_CATEGORIES: SeedCategory[] = [
  {
    slug: 'clothing',
    name: 'Хувцас',
    description: 'Сургуулийн дүрэмт хувцас: hoodie, хүрэм, өмд.',
    hasSizes: true,
    sizePresets: CLOTHING_SIZES,
    order: 1,
  },
  { slug: 'book', name: 'Ном', description: 'Сурах бичиг, гарын авлага.', hasSizes: false, sizePresets: [], order: 2 },
  { slug: 'notebook', name: 'Дэвтэр', description: 'Тэмдэглэлийн болон ангийн дэвтэр.', hasSizes: false, sizePresets: [], order: 3 },
]

export const SEED_PRODUCTS: SeedProduct[] = [
  {
    slug: 'hoodie',
    name: 'Сургуулийн Hoodie',
    description: 'Ягаан өнгийн, цээжинд сургуулийн лого, ар талд NEST IT SCHOOL бичигтэй.',
    category: 'clothing',
    price: 59000,
    images: ['/products/hoodie-1.jpg', '/products/hoodie-2.jpg', '/products/hoodie-3.jpg'],
    sizes: CLOTHING_SIZES,
    stock: 10,
    lowStockThreshold: 3,
  },
  {
    slug: 'jacket',
    name: 'Сургуулийн бомбер хүрэм',
    description: 'Шар ба саарал өнгийн, цахилгаан товчтой, цээжинд сургуулийн тэмдэгтэй.',
    category: 'clothing',
    price: 69000,
    images: ['/products/jacket-1.jpg', '/products/jacket-2.jpg'],
    sizes: CLOTHING_SIZES,
    stock: 10,
    lowStockThreshold: 3,
  },
  {
    slug: 'trousers',
    name: 'Сургуулийн өмд',
    description: 'Шаргал хүрэн өнгийн, уян бүсэлхийтэй, өдөр тутмын сонгодог загвар.',
    category: 'clothing',
    price: 45000,
    images: ['/products/trousers-1.jpg'],
    sizes: CLOTHING_SIZES,
    stock: 10,
    lowStockThreshold: 3,
  },
  {
    slug: 'book-programming',
    name: 'Програмчлалын үндэс',
    description: 'Анхан шатны програмчлалын сурах бичиг, дасгал ажилтай.',
    category: 'book',
    price: 24000,
    images: ['/products/book-1.png'],
    stock: 30,
    lowStockThreshold: 5,
  },
  {
    slug: 'book-robotics',
    name: 'Роботик ба электроник',
    description: 'Роботик, электроникийн үндсийг тайлбарласан гарын авлага.',
    category: 'book',
    price: 28000,
    images: ['/products/book-2.png'],
    stock: 30,
    lowStockThreshold: 5,
  },
  {
    slug: 'notebook-a5',
    name: 'А5 тэмдэглэлийн дэвтэр',
    description: '48 хуудас, шугамтай, хатуу хавтастай.',
    category: 'notebook',
    price: 4500,
    images: ['/products/notebook-1.png'],
    stock: 100,
    lowStockThreshold: 15,
  },
  {
    slug: 'notebook-a4',
    name: 'А4 дэвтэр, 96 хуудас',
    description: 'Гэрийн болон ангийн ажлын том дэвтэр, шугамтай.',
    category: 'notebook',
    price: 6500,
    images: ['/products/notebook-1.png'],
    stock: 100,
    lowStockThreshold: 15,
  },
]
