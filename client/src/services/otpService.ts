/**
 * Identitas voter terverifikasi (Google Sign-In).
 *
 * Verifikasi voter untuk voting dulu memakai Google atau OTP WhatsApp;
 * metode OTP WhatsApp sudah dihapus — verifikasi sekarang hanya lewat
 * Google Sign-In (`client/src/services/googleAuth.ts`). Backend juga
 * sudah tidak lagi menyediakan endpoint OTP (`/public/{slug}/otp/*`).
 *
 * Identitas yang sudah terverifikasi disimpan di localStorage
 * (`fa_voter_identities`) supaya dashboard pengisi (`#/riwayat`) bisa
 * menampilkan riwayat semua link yang pernah diisi identitas itu, dan
 * di sessionStorage per slug (`fa_voter`) selama tab masih terbuka.
 *
 * Identitas WhatsApp lama (kunci `wa:...`) yang tersimpan di perangkat
 * dari versi sebelumnya tetap dibaca — riwayatnya tidak hilang — tapi
 * identitas WhatsApp baru tidak bisa dibuat lagi.
 */

export type VerifyMethod = 'google' | 'whatsapp'

/** Identitas voter yang sudah terverifikasi untuk satu link voting. */
export interface VerifiedVoter {
  method: VerifyMethod
  /** Kunci unik untuk cegah voting ganda: `google:<sub>` (atau `wa:<nomor62>` untuk data lama). */
  key: string
  /** Label tampil (email, atau nomor tersamarkan untuk data lama) — bukan rahasia. */
  label: string
  /** Token verifikasi lama (OTP WhatsApp) — tidak dipakai lagi; Google tidak memakai token. */
  token?: string
  verifiedAt: string
  slug: string
}

const VOTER_KEY = 'fa_voter'

/**
 * Daftar identitas terverifikasi di perangkat ini (localStorage) — dipakai
 * dashboard pengisi (`#/riwayat`) untuk menampilkan riwayat semua link yang
 * pernah diisi identitas itu. Identitas ditambahkan otomatis setiap kali
 * voter terverifikasi di link mana pun (Google).
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
