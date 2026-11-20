/**
 * Verifikasi voter untuk voting: Google Sign-In atau OTP WhatsApp.
 *
 * Backend (server/src/controllers/OtpController.php) sudah menyediakan:
 * - POST /api/v1/public/{slug}/otp/send   {phone}        → 200 {expires_in_seconds, provider, dev_otp?} / 409 bila nomor sudah voting
 * - POST /api/v1/public/{slug}/otp/verify {phone, code}  → 200 {valid, verification_token} / 422 {detail}
 * Kode berlaku 5 menit, maksimal 3x percobaan salah (OTP_MAX_ATTEMPTS),
 * token verifikasi berlaku 15 menit di server.
 *
 * Bila server tidak terjangkau (mis. `npm run dev` tanpa `php -S` di
 * localhost:8000), pengiriman beralih ke MODE DEMO: kode dibuat di
 * browser dan ditampilkan di layar dengan label demo yang jelas, supaya
 * alur bisa diuji end-to-end. Mode demo BUKAN keamanan nyata — kode
 * sungguhan hanya terkirim bila server jalan dan provider WhatsApp
 * (mis. Fonnte) sudah dikonfigurasi dengan API key.
 */

const API_BASE = '/api/v1'
const VOTER_KEY = 'fa_voter'
const DEMO_KEY = 'fa_otp_demo'
const OTP_TTL_SECONDS = 300
const DEMO_MAX_ATTEMPTS = 3

export type VerifyMethod = 'google' | 'whatsapp'

/** Identitas voter yang sudah terverifikasi untuk satu link voting. */
export interface VerifiedVoter {
  method: VerifyMethod
  /** Kunci unik untuk cegah voting ganda: `google:<sub>` atau `wa:<nomor62>`. */
  key: string
  /** Label tampil (email, atau nomor tersamarkan) — bukan rahasia. */
  label: string
  /** Token verifikasi WhatsApp dari server (15 menit). Google tidak memakai token. */
  token?: string
  verifiedAt: string
  slug: string
}

export interface OtpSendResult {
  ok: boolean
  /** true bila kode datang dari mode demo (server tidak terjangkau / provider mock). */
  demo?: boolean
  /** Kode demo — hanya ada bila server mengembalikannya (provider mock/dev) atau mode demo lokal. */
  devOtp?: string
  expiresInSeconds?: number
  provider?: string
  error?: string
  /** true bila backend menjawab 409: nomor ini sudah pernah voting. */
  alreadyVoted?: boolean
}

export interface OtpVerifyResult {
  ok: boolean
  verificationToken?: string
  error?: string
  remainingAttempts?: number
}

/** Samakan dengan OTP::normalizePhoneNumber di backend: 08xx → 62xx, +62 → 62. */
export function normalizePhone(raw: string): string {
  const clean = raw.replace(/[^0-9]/g, '')
  if (clean.startsWith('0')) return '62' + clean.slice(1)
  if (clean.startsWith('8')) return '62' + clean
  return clean
}

export function validatePhone(raw: string): { phone?: string; error?: string } {
  const phone = normalizePhone(raw)
  if (!phone) return { error: 'Nomor WhatsApp wajib diisi.' }
  if (!phone.startsWith('62') || phone.length < 10 || phone.length > 15) {
    return { error: 'Nomor WhatsApp tidak valid. Contoh: 0812-3456-7890.' }
  }
  return { phone }
}

/** +62 812-****-789 — nomor tidak pernah ditampilkan utuh di layar. */
export function maskPhone(phone62: string): string {
  const rest = phone62.replace(/^62/, '')
  if (rest.length < 7) return `+62 ${rest}`
  return `+62 ${rest.slice(0, 3)}-****-${rest.slice(-3)}`
}

export function maskEmail(email: string): string {
  const [name, domain] = email.split('@')
  if (!domain) return email
  return `${name.slice(0, 1)}***@${domain}`
}

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)

interface DemoSession {
  slug: string
  phone: string
  code: string
  expiresAt: number
  attempts: number
}

function loadDemo(): DemoSession | null {
  try {
    const raw = sessionStorage.getItem(DEMO_KEY)
    return raw ? (JSON.parse(raw) as DemoSession) : null
  } catch {
    return null
  }
}

function saveDemo(s: DemoSession | null) {
  try {
    if (s) sessionStorage.setItem(DEMO_KEY, JSON.stringify(s))
    else sessionStorage.removeItem(DEMO_KEY)
  } catch {
    // Penyimpanan tidak tersedia — mode demo tidak bisa dipakai.
  }
}

function readError(res: Response, fallback: string): Promise<string> {
  return res
    .json()
    .then((j: unknown) => {
      const detail = (j as { detail?: unknown })?.detail
      return typeof detail === 'string' && detail ? detail : fallback
    })
    .catch(() => fallback)
}

/** Minta kode OTP. Backend dulu; bila server tidak terjangkau, mode demo. */
export async function requestOtp(slug: string, rawPhone: string): Promise<OtpSendResult> {
  const { phone, error } = validatePhone(rawPhone)
  if (!phone) return { ok: false, error }

  try {
    const res = await fetch(`${API_BASE}/public/${slug}/otp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    })
    if (res.ok) {
      const data = (await res.json()) as { expires_in_seconds?: number; provider?: string; dev_otp?: string | null }
      return {
        ok: true,
        demo: data.provider === 'mock' || !!data.dev_otp,
        devOtp: data.dev_otp ?? undefined,
        expiresInSeconds: data.expires_in_seconds ?? OTP_TTL_SECONDS,
        provider: data.provider,
      }
    }
    // 404 = rute OTP belum terdaftar di backend lama → alur tetap bisa diuji lewat demo.
    if (res.status === 404) return startDemo(slug, phone)
    const detail = await readError(res, 'Gagal mengirim kode OTP.')
    return { ok: false, error: detail, alreadyVoted: res.status === 409 }
  } catch {
    return startDemo(slug, phone)
  }
}

function startDemo(slug: string, phone: string): OtpSendResult {
  const code = String(Math.floor(100000 + Math.random() * 900000))
  saveDemo({ slug, phone, code, expiresAt: Date.now() + OTP_TTL_SECONDS * 1000, attempts: 0 })
  return { ok: true, demo: true, devOtp: code, expiresInSeconds: OTP_TTL_SECONDS, provider: 'demo' }
}

/** Verifikasi kode OTP. Sesi demo (bila ada) diverifikasi lokal; selain itu ke backend. */
export async function verifyOtp(slug: string, rawPhone: string, code: string): Promise<OtpVerifyResult> {
  const { phone, error } = validatePhone(rawPhone)
  if (!phone) return { ok: false, error }
  const cleanCode = code.replace(/[^0-9]/g, '')
  if (cleanCode.length !== 6) return { ok: false, error: 'Kode OTP terdiri dari 6 angka.' }

  const demo = loadDemo()
  if (demo && demo.slug === slug && demo.phone === phone) return verifyDemo(demo, cleanCode)

  try {
    const res = await fetch(`${API_BASE}/public/${slug}/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code: cleanCode }),
    })
    const data = (await res.json().catch(() => ({}))) as {
      valid?: boolean
      verification_token?: string
      detail?: string
      remaining_attempts?: number
    }
    if (res.ok && data.valid) return { ok: true, verificationToken: data.verification_token }
    return { ok: false, error: data.detail ?? 'Verifikasi OTP gagal.', remainingAttempts: data.remaining_attempts }
  } catch {
    return { ok: false, error: 'Tidak dapat menghubungi server verifikasi. Periksa koneksi lalu coba lagi.' }
  }
}

function verifyDemo(demo: DemoSession, code: string): OtpVerifyResult {
  if (Date.now() >= demo.expiresAt) {
    saveDemo(null)
    return { ok: false, error: 'Kode OTP telah kedaluwarsa. Silakan minta kode baru.' }
  }
  if (demo.attempts >= DEMO_MAX_ATTEMPTS) {
    saveDemo(null)
    return { ok: false, error: 'Batas percobaan OTP telah terlampaui. Silakan minta kode OTP baru.' }
  }
  if (code !== demo.code) {
    const attempts = demo.attempts + 1
    const remaining = Math.max(0, DEMO_MAX_ATTEMPTS - attempts)
    saveDemo(attempts >= DEMO_MAX_ATTEMPTS ? null : { ...demo, attempts })
    return {
      ok: false,
      error: `Kode OTP salah. Sisa kesempatan: ${remaining} kali.`,
      remainingAttempts: remaining,
    }
  }
  saveDemo(null)
  return { ok: true, verificationToken: `demo_${uid()}` }
}

/**
 * Daftar identitas terverifikasi di perangkat ini (localStorage) — dipakai
 * dashboard pengisi (`#/riwayat`) untuk menampilkan riwayat semua link yang
 * pernah diisi identitas itu. Identitas ditambahkan otomatis setiap kali
 * voter terverifikasi di link mana pun (Google / WhatsApp).
 *
 * TIDAK ada identitas demo/seed: dashboard kosong sampai pengisi benar-benar
 * verifikasi di sebuah link. Kunci demo lama (bila pernah tersimpan di
 * perangkat ini dari versi sebelumnya) dibuang saat dibaca, supaya nomor
 * demo & akun Google demo tidak muncul lagi di riwayat.
 */
const IDENTITY_KEY = 'fa_voter_identities'
const DEMO_IDENTITY_KEYS = new Set([
  'wa:628123456789',
  'google:110012345678901234567',
])

export function loadIdentities(): VerifiedVoter[] {
  try {
    const raw = localStorage.getItem(IDENTITY_KEY)
    if (raw === null) return []
    const list = JSON.parse(raw) as VerifiedVoter[]
    if (!Array.isArray(list)) return []
    const cleaned = list.filter((v) => v && !DEMO_IDENTITY_KEYS.has(v.key))
    if (cleaned.length !== list.length) {
      localStorage.setItem(IDENTITY_KEY, JSON.stringify(cleaned))
    }
    return cleaned
  } catch {
    return []
  }
}

export function saveIdentity(v: VerifiedVoter) {
  const list = [v, ...loadIdentities().filter((x) => x.key !== v.key)]
  try {
    localStorage.setItem(IDENTITY_KEY, JSON.stringify(list))
  } catch {
    // Penyimpanan tidak tersedia — identitas hanya berlaku di sesi ini.
  }
}

export function removeIdentity(key: string) {
  const list = loadIdentities().filter((x) => x.key !== key)
  try {
    localStorage.setItem(IDENTITY_KEY, JSON.stringify(list))
  } catch {
    // Penyimpanan tidak tersedia — tidak ada yang perlu dihapus.
  }
}

/** Voter terverifikasi disimpan di sessionStorage: tab ditutup → verifikasi hangus. */
export function loadVoter(slug: string): VerifiedVoter | null {
  try {
    const raw = sessionStorage.getItem(VOTER_KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as VerifiedVoter
    return v.slug === slug ? v : null
  } catch {
    return null
  }
}

export function saveVoter(v: VerifiedVoter) {
  try {
    sessionStorage.setItem(VOTER_KEY, JSON.stringify(v))
  } catch {
    // Penyimpanan tidak tersedia — verifikasi hanya berlaku di memori halaman ini.
  }
}

export function clearVoter() {
  try {
    sessionStorage.removeItem(VOTER_KEY)
  } catch {
    // Tidak ada yang perlu dibersihkan.
  }
}
