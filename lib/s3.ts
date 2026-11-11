import 'server-only'
import { randomUUID } from 'node:crypto'
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'

export const IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
}
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024

function keyPrefix() {
  const prefix = (process.env.S3_KEY_PREFIX || 'school-pos/').replace(/^\/+/, '')
  return prefix.endsWith('/') ? prefix : `${prefix}/`
}

let s3: S3Client | undefined

export function isS3Configured() {
  const { BUCKET_NAME, AWS_REGION, S3_ACCESS_KEY, S3_SECRET_ACCESS_KEY } = process.env
  return Boolean(BUCKET_NAME && AWS_REGION && S3_ACCESS_KEY && S3_SECRET_ACCESS_KEY)
}

function bucket() {
  const { BUCKET_NAME, AWS_REGION, S3_ACCESS_KEY, S3_SECRET_ACCESS_KEY } = process.env
  if (!BUCKET_NAME || !AWS_REGION || !S3_ACCESS_KEY || !S3_SECRET_ACCESS_KEY) throw new Error('S3 is not configured')
  s3 ??= new S3Client({
    region: AWS_REGION,
    credentials: { accessKeyId: S3_ACCESS_KEY, secretAccessKey: S3_SECRET_ACCESS_KEY },
  })
  return { client: s3, name: BUCKET_NAME }
}

/** Public base URL for uploaded files: CloudFront when set, otherwise the bucket endpoint. */
function publicBase() {
  const base = process.env.CLOUDFRONT_URL || process.env.S3_ENDPOINT || ''
  return (/^https?:\/\//.test(base) ? base : `https://${base}`).replace(/\/+$/, '')
}

/** `folder` groups uploads in the bucket, e.g. 'products'. */
export async function uploadImage(file: File, folder = 'products') {
  const ext = IMAGE_TYPES[file.type]
  if (!ext) throw new Error(`Unsupported image type: ${file.type}`)
  const { client, name } = bucket()
  const key = `${keyPrefix()}${folder}/${new Date().getFullYear()}/${randomUUID()}.${ext}`
  await client.send(
    new PutObjectCommand({
      Bucket: name,
      Key: key,
      Body: Buffer.from(await file.arrayBuffer()),
      ContentType: file.type,
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  )
  return `${publicBase()}/${key}`
}

/** Removes an image this app uploaded. Bundled /products/... files and other URLs are left alone. */
export async function deleteUploadedImage(url: string) {
  const prefix = `${publicBase()}/${keyPrefix()}`
  if (!url.startsWith(prefix)) return
  try {
    const { client, name } = bucket()
    await client.send(new DeleteObjectCommand({ Bucket: name, Key: url.slice(publicBase().length + 1) }))
  } catch (error) {
    console.error('[s3] Failed to delete', url, error)
  }
}
