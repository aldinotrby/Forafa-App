/**
 * Media Service - Handle file upload ke Cloudinary Free Tier
 * 
 * Fitur:
 * - Upload gambar profil pengguna
 * - Upload thumbnail/banner interaksi
 * - Kompresi otomatis
 * - URL persistent
 * 
 * Konfigurasi Cloudinary:
 * - VITE_CLOUDINARY_CLOUD_NAME: cloud_name dari dashboard Cloudinary
 * - VITE_CLOUDINARY_UPLOAD_PRESET: unsigned upload preset (generated di dashboard)
 */

export interface UploadResponse {
  success: boolean
  url?: string
  error?: string
}

export interface MediaAsset {
  id: string
  url: string
  type: 'profile' | 'banner'
  uploadedAt: string
  size: number
}

// Cloudinary configuration
const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'demo'
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'forafa_unsigned'
const CLOUDINARY_API_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`

/**
 * Upload file ke Cloudinary
 * @param file - File object dari input
 * @param type - Tipe asset: 'profile' atau 'banner'
 * @returns Promise dengan URL hasil upload
 */
export async function uploadToCloudinary(
  file: File,
  type: 'profile' | 'banner' = 'profile'
): Promise<UploadResponse> {
  try {
    // Validasi file
    if (!file) {
      return { success: false, error: 'File tidak dipilih.' }
    }

    if (!file.type.startsWith('image/')) {
      return { success: false, error: 'Hanya file gambar yang diizinkan (JPG, PNG, WebP).' }
    }

    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      return { success: false, error: 'Ukuran file maksimal 5MB.' }
    }

    // Prepare FormData
    const formData = new FormData()
    formData.append('file', file)
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET)
    formData.append('folder', `forafa/${type}`)
    formData.append('resource_type', 'auto')
    formData.append('transformation', JSON.stringify([
      {
        quality: 'auto',
        fetch_format: 'auto',
        width: type === 'profile' ? 200 : 800,
        height: type === 'profile' ? 200 : 400,
        crop: 'thumb',
        gravity: 'face'
      }
    ]))

    // Upload ke Cloudinary
    const response = await fetch(CLOUDINARY_API_URL, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`)
    }

    const data = await response.json()

    return {
      success: true,
      url: data.secure_url || data.url
    }
  } catch (error) {
    console.error('Media upload error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Gagal upload file. Coba lagi atau gunakan media lokal.'
    }
  }
}

/**
 * Upload dengan fallback ke base64 (local storage)
 * Jika Cloudinary tidak tersedia, simpan sebagai base64
 */
export async function uploadMedia(
  file: File,
  type: 'profile' | 'banner' = 'profile'
): Promise<UploadResponse> {
  // Coba Cloudinary dulu (jika konfigurasi tersedia)
  if (CLOUDINARY_CLOUD_NAME !== 'demo') {
    const cloudinaryResult = await uploadToCloudinary(file, type)
    if (cloudinaryResult.success) {
      return cloudinaryResult
    }
    // Fallback ke base64 jika Cloudinary gagal
  }

  // Fallback: Convert ke base64 dan simpan di localStorage
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const base64 = e.target?.result as string
      if (base64.length > 1024 * 1024) { // >1MB
        resolve({
          success: false,
          error: 'File terlalu besar untuk disimpan lokal. Konfigurasi Cloudinary untuk upload ke cloud.'
        })
      } else {
        resolve({
          success: true,
          url: base64
        })
      }
    }
    reader.onerror = () => {
      resolve({
        success: false,
        error: 'Gagal membaca file.'
      })
    }
    reader.readAsDataURL(file)
  })
}

/**
 * Delete media dari Cloudinary (memerlukan auth token)
 * Untuk MVP, cukup hapus dari state lokal
 */
export async function deleteMedia(publicId: string): Promise<boolean> {
  // Implementasi delete memerlukan server-side auth
  // Untuk sekarang, hanya hapus dari lokal
  return true
}

/**
 * Get media assets dari localStorage
 */
export function getMediaAssets(type?: 'profile' | 'banner'): MediaAsset[] {
  try {
    const stored = localStorage.getItem('fa_media')
    const all: MediaAsset[] = stored ? JSON.parse(stored) : []
    return type ? all.filter(m => m.type === type) : all
  } catch {
    return []
  }
}

/**
 * Save media asset ke localStorage
 */
export function saveMediaAsset(asset: MediaAsset): void {
  const assets = getMediaAssets()
  const existing = assets.find(m => m.id === asset.id)
  if (existing) {
    Object.assign(existing, asset)
  } else {
    assets.push(asset)
  }
  localStorage.setItem('fa_media', JSON.stringify(assets))
}

/**
 * Generate unique ID untuk media asset
 */
export function generateMediaId(type: 'profile' | 'banner', userId: string): string {
  return `${type}_${userId}_${Date.now()}`
}
