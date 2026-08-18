import { v2 as cloudinary } from 'cloudinary'
import crypto from 'crypto'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'n9fgemea',
  api_key: process.env.CLOUDINARY_API_KEY || '587186263567254',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'p6auY1cSEsSPjVE56Ii19gBzQ_k',
  secure: true,
})

export function isCloudinaryConfigured() {
  const name = process.env.CLOUDINARY_CLOUD_NAME || 'n9fgemea'
  const key = process.env.CLOUDINARY_API_KEY || '587186263567254'
  const secret = process.env.CLOUDINARY_API_SECRET || 'p6auY1cSEsSPjVE56Ii19gBzQ_k'
  return !!(name && key && secret)
}

const rand = () => crypto.randomBytes(6).toString('hex')

export async function uploadToCloudinary({ buffer, originalName, mimeType, folder = 'bjp_localbody' }) {
  if (!isCloudinaryConfigured()) throw new Error('CLOUDINARY_NOT_CONFIGURED')

  const isVideo = (mimeType || '').startsWith('video/')
  const isImage = (mimeType || '').startsWith('image/')
  const resourceType = isVideo ? 'video' : isImage ? 'image' : 'raw'

  const publicId = `${folder}/${Date.now()}_${rand()}`

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: publicId.split('/').pop(),
        resource_type: resourceType,
        overwrite: true,
      },
      (error, result) => {
        if (error) {
          console.error('[Cloudinary Upload Error]', error)
          return reject(error)
        }
        resolve({
          url: result.secure_url || result.url,
          public_id: result.public_id,
          format: result.format,
          bytes: result.bytes,
          resource_type: result.resource_type,
        })
      }
    )

    uploadStream.end(buffer)
  })
}
