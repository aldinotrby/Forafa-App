import { useRef, useState } from 'react'
import { uploadMedia, generateMediaId, saveMediaAsset, type MediaAsset } from '../services/mediaService'
import { Btn } from './ui'

interface MediaUploadProps {
  type: 'profile' | 'banner'
  userId: string
  onUpload?: (asset: MediaAsset) => void
  currentUrl?: string
  label?: string
}

export function MediaUpload({ type, userId, onUpload, currentUrl, label }: MediaUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState(currentUrl || '')

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)
    setUploading(true)

    try {
      // Show preview
      const reader = new FileReader()
      reader.onload = (evt) => {
        setPreview(evt.target?.result as string)
      }
      reader.readAsDataURL(file)

      // Upload
      const result = await uploadMedia(file, type)

      if (result.success && result.url) {
        const asset: MediaAsset = {
          id: generateMediaId(type, userId),
          url: result.url,
          type,
          uploadedAt: new Date().toISOString(),
          size: file.size,
        }
        saveMediaAsset(asset)
        onUpload?.(asset)
        setError(null)
      } else {
        setError(result.error || 'Gagal upload file')
        setPreview('')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const size = type === 'profile' ? 'size-24' : 'h-32'
  const displayClass = type === 'profile' ? 'rounded-full' : 'rounded-lg'

  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold uppercase tracking-wider text-mute">
        {label || (type === 'profile' ? 'Foto Profil' : 'Banner/Thumbnail')}
      </label>

      <div className="flex items-end gap-3">
        {preview && (
          <img
            src={preview}
            alt="preview"
            className={`${size} ${displayClass} object-cover border-2 border-brand-soft`}
          />
        )}

        <div className="flex-1 space-y-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            disabled={uploading}
            className="hidden"
          />
          <Btn
            type="button"
            variant="ghost"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="w-full"
          >
            {uploading ? 'Uploading...' : preview ? 'Ubah Gambar' : '+ Pilih Gambar'}
          </Btn>
          <p className="text-xs text-mute">JPG, PNG atau WebP, max 5MB</p>
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          ⚠️ {error}
        </p>
      )}
    </div>
  )
}
