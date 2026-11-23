/**
 * Aturan Profil — dipakai halaman Profil dan store.
 *
 * - Bio maksimal 160 karakter.
 * - Username & email masing-masing hanya bisa diganti 1x dalam 7 hari.
 *   Stempel perubahan disimpan di User.usernameChangedAt /
 *   User.emailChangedAt (ISO). Bila belum pernah diganti, boleh langsung.
 * - Ganti password hanya untuk akun yang login pakai email + password
 *   (provider 'password'). Akun Google tidak punya password lokal.
 */

export const BIO_MAX_LENGTH = 160
export const PROFILE_CHANGE_COOLDOWN_DAYS = 7
export const PROFILE_CHANGE_COOLDOWN_MS = PROFILE_CHANGE_COOLDOWN_DAYS * 24 * 3600 * 1000

export interface ChangeWindow {
  /** true bila field boleh diganti sekarang. */
  allowed: boolean
  /** Waktu paling cepat boleh ganti lagi (ISO), null bila sudah boleh. */
  nextAllowedAt: string | null
  /** Sisa hari (dibulatkan ke atas) sampai boleh ganti lagi; 0 bila boleh. */
  daysLeft: number
}

/** Hitung jendela ganti username/email dari stempel perubahan terakhir. */
export function changeWindow(changedAt: string | null | undefined, now = new Date()): ChangeWindow {
  if (!changedAt) return { allowed: true, nextAllowedAt: null, daysLeft: 0 }
  const changed = new Date(changedAt)
  if (Number.isNaN(changed.getTime())) return { allowed: true, nextAllowedAt: null, daysLeft: 0 }
  const next = new Date(changed.getTime() + PROFILE_CHANGE_COOLDOWN_MS)
  if (now.getTime() >= next.getTime()) return { allowed: true, nextAllowedAt: null, daysLeft: 0 }
  const daysLeft = Math.ceil((next.getTime() - now.getTime()) / (24 * 3600 * 1000))
  return { allowed: false, nextAllowedAt: next.toISOString(), daysLeft }
}

/** Tanggal Indonesia singkat, mis. "28 Nov 2026". */
export function formatChangeDate(iso: string | null | undefined): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Panjang bio dihitung per karakter (bukan per byte) supaya emoji dihitung 1. */
export function bioLength(bio: string): number {
  return Array.from(bio).length
}

export function isBioValid(bio: string): boolean {
  return bioLength(bio) <= BIO_MAX_LENGTH
}
