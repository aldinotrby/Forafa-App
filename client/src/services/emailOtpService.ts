/**
 * Verifikasi email pendaftaran — kode OTP 5 digit dari forafagroup@gmail.com.
 *
 * Alur (backend `server/`):
 * 1. `requestEmailOtp(email)` → POST /auth/email-otp/send
 *    Backend membuat kode 5 digit (berlaku 10 menit) dan mengirimnya lewat
 *    SMTP Gmail. Kirim ulang paling cepat 60 detik setelah kirim sebelumnya.
 * 2. `verifyEmailOtp(email, code)` → POST /auth/email-otp/verify
 *    Bila kode benar (maks. 3x salah), backend mengembalikan
 *    `verification_token` sekali pakai (berlaku 15 menit) yang dipakai
 *    `store.register` untuk menyelesaikan pendaftaran.
 *
 * TIDAK ADA kode demo: tidak ada `dev_otp`, tidak ada fallback lokal.
 * Bila backend tidak terjangkau atau SMTP belum dikonfigurasi, kedua
 * fungsi mengembalikan `{ ok: false, error }` dengan pesan backend —
 * pendaftaran tidak bisa dilanjutkan sampai masalahnya diperbaiki
 * (lihat docs/email-otp-setup.md).
 */

const API_BASE = '/api/v1'

export interface EmailOtpSendResult {
  ok: boolean
  error?: string
  /** Detik sampai kode kedaluwarsa (10 menit = 600). */
  expiresInSeconds?: number
  /** Detik sampai boleh kirim ulang (60). */
  resendAfterSeconds?: number
}

export interface EmailOtpVerifyResult {
  ok: boolean
  error?: string
  /** Token sekali pakai untuk menyelesaikan pendaftaran. */
  verificationToken?: string
}

interface ApiPayload {
  detail?: string
  message?: string
  expires_in_seconds?: number
  resend_after_seconds?: number
  verification_token?: string
}

async function readPayload(res: Response): Promise<ApiPayload> {
  try {
    return (await res.json()) as ApiPayload
  } catch {
    return {}
  }
}

const BACKEND_DOWN_ERROR =
  'Backend tidak terjangkau. Jalankan server PHP dulu: masuk folder server lalu `php -S localhost:8000 router.php`, dan pastikan MySQL jalan.'

export async function requestEmailOtp(email: string): Promise<EmailOtpSendResult> {
  let res: Response
  try {
    res = await fetch(`${API_BASE}/auth/email-otp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
  } catch {
    return { ok: false, error: BACKEND_DOWN_ERROR }
  }
  const data = await readPayload(res)
  if (!res.ok) {
    return { ok: false, error: data.detail || data.message || `Gagal mengirim kode (HTTP ${res.status}).` }
  }
  return {
    ok: true,
    expiresInSeconds: data.expires_in_seconds,
    resendAfterSeconds: data.resend_after_seconds,
  }
}

export async function verifyEmailOtp(email: string, code: string): Promise<EmailOtpVerifyResult> {
  let res: Response
  try {
    res = await fetch(`${API_BASE}/auth/email-otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code }),
    })
  } catch {
    return { ok: false, error: BACKEND_DOWN_ERROR }
  }
  const data = await readPayload(res)
  if (!res.ok) {
    return { ok: false, error: data.detail || data.message || `Verifikasi gagal (HTTP ${res.status}).` }
  }
  if (!data.verification_token) {
    return { ok: false, error: 'Server tidak mengembalikan token verifikasi. Coba minta kode baru.' }
  }
  return { ok: true, verificationToken: data.verification_token }
}
