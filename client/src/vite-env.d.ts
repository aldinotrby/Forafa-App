/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Google OAuth 2.0 Client ID (Web) untuk tombol "Lanjutkan dengan Google". */
  readonly VITE_GOOGLE_CLIENT_ID?: string
  readonly VITE_CLOUDINARY_CLOUD_NAME?: string
  readonly VITE_CLOUDINARY_UPLOAD_PRESET?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
