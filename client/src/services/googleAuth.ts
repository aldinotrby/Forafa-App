/**
 * Google Sign-In — Google Identity Services (GIS) untuk frontend standalone.
 *
 * Alur:
 * 1. Script GIS dimuat dari https://accounts.google.com/gsi/client
 * 2. Pengguna memilih akun di tombol/prompt resmi Google → Google mengembalikan
 *    ID token (JWT) lewat callback.
 * 3. ID token di-decode dan klaim dasarnya divalidasi di sini:
 *    issuer Google, belum kedaluwarsa, dan audience == VITE_GOOGLE_CLIENT_ID.
 * 4. Profil (sub, email, nama, foto) diserahkan ke store untuk login/registrasi.
 *
 * Konfigurasi: buat OAuth 2.0 Client ID (Web) di Google Cloud Console,
 * daftarkan origin aplikasi (mis. http://localhost:5173) sebagai
 * Authorized JavaScript origin, lalu isi VITE_GOOGLE_CLIENT_ID di .env.
 *
 * Catatan keamanan: validasi di browser ini hanya untuk frontend standalone.
 * Untuk production, ID token WAJIB diverifikasi ulang di server
 * (signature + audience) sebelum sesi dibuat — jangan percaya klaim
 * yang hanya di-decode di client.
 */

export interface GoogleProfile {
  /** Subject ID unik akun Google (klaim `sub`). */
  googleId: string
  email: string
  name: string
  picture?: string
  emailVerified: boolean
}

interface GoogleCredentialResponse {
  credential?: string
  select_by?: string
}

interface GoogleAccountsId {
  initialize: (config: {
    client_id: string
    callback: (response: GoogleCredentialResponse) => void
    auto_select?: boolean
    cancel_on_tap_outside?: boolean
  }) => void
  renderButton: (
    parent: HTMLElement,
    options: { theme?: string; size?: string; text?: string; shape?: string; width?: number },
  ) => void
  prompt: () => void
  disableAutoSelect: () => void
  cancel: () => void
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleAccountsId } }
  }
}

export const GOOGLE_CLIENT_ID: string = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''
export const isGoogleConfigured = () => GOOGLE_CLIENT_ID.trim().length > 0

const GIS_SRC = 'https://accounts.google.com/gsi/client'
let gisPromise: Promise<GoogleAccountsId> | null = null

function loadGis(): Promise<GoogleAccountsId> {
  if (window.google?.accounts.id) return Promise.resolve(window.google.accounts.id)
  if (!gisPromise) {
    gisPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = GIS_SRC
      script.async = true
      script.defer = true
      script.onload = () => {
        if (window.google?.accounts.id) resolve(window.google.accounts.id)
        else reject(new Error('Library Google Sign-In gagal dimuat.'))
      }
      script.onerror = () => {
        gisPromise = null
        reject(new Error('Library Google Sign-In gagal dimuat. Periksa koneksi internet Anda.'))
      }
      document.head.appendChild(script)
    })
  }
  return gisPromise
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const part = token.split('.')[1]
  if (!part) throw new Error('Token Google tidak valid.')
  const base64 = part.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
  const json = decodeURIComponent(
    atob(padded)
      .split('')
      .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
      .join(''),
  )
  return JSON.parse(json) as Record<string, unknown>
}

/**
 * Decode + validasi klaim dasar ID token Google.
 * Melempar Error dengan pesan Bahasa Indonesia bila token tidak layak pakai.
 */
export function parseGoogleCredential(credential: string): GoogleProfile {
  const claims = decodeJwtPayload(credential)

  const iss = String(claims.iss ?? '')
  if (iss !== 'https://accounts.google.com' && iss !== 'accounts.google.com') {
    throw new Error('Token Google tidak berasal dari Google.')
  }
  if (isGoogleConfigured() && claims.aud !== GOOGLE_CLIENT_ID) {
    throw new Error('Token Google bukan untuk aplikasi ini (audience tidak cocok).')
  }
  const exp = Number(claims.exp ?? 0)
  if (!exp || exp * 1000 <= Date.now()) {
    throw new Error('Sesi Google sudah kedaluwarsa. Silakan coba lagi.')
  }

  const email = String(claims.email ?? '')
  const googleId = String(claims.sub ?? '')
  if (!email || !googleId) throw new Error('Profil Google tidak lengkap (email tidak tersedia).')

  return {
    googleId,
    email,
    name: String(claims.name ?? email.split('@')[0]),
    picture: claims.picture ? String(claims.picture) : undefined,
    emailVerified: claims.email_verified === true || claims.email_verified === 'true',
  }
}

export type GoogleSignInHandler = (result: { profile?: GoogleProfile; error?: string }) => void

/**
 * Inisialisasi GIS dan (opsional) render tombol resmi Google ke elemen target.
 * Mengembalikan fungsi cleanup.
 */
export async function initGoogleSignIn(handler: GoogleSignInHandler, buttonEl?: HTMLElement | null): Promise<() => void> {
  if (!isGoogleConfigured()) return () => {}
  const id = await loadGis()
  id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    auto_select: false,
    cancel_on_tap_outside: true,
    callback: (response) => {
      if (!response.credential) {
        handler({ error: 'Login Google dibatalkan atau tidak mengembalikan kredensial.' })
        return
      }
      try {
        handler({ profile: parseGoogleCredential(response.credential) })
      } catch (e) {
        handler({ error: e instanceof Error ? e.message : 'Login Google gagal.' })
      }
    },
  })
  if (buttonEl) {
    id.renderButton(buttonEl, { theme: 'outline', size: 'large', text: 'continue_with', shape: 'rectangular', width: 320 })
  }
  return () => id.cancel()
}

/** Matikan auto-select Google agar setelah logout pengguna tidak langsung masuk lagi via One Tap. */
export function disableGoogleAutoSelect() {
  try {
    window.google?.accounts.id.disableAutoSelect()
  } catch {
    // GIS belum dimuat — tidak ada yang perlu dimatikan.
  }
}
