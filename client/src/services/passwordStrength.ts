/**
 * Syarat & kekuatan password untuk pendaftaran akun baru.
 *
 * Syarat minimal (wajib dipenuhi saat daftar):
 * - minimal 8 karakter
 * - minimal 1 huruf kapital (A-Z)
 * - minimal 1 angka (0-9)
 * - minimal 1 simbol (bukan huruf/angka, mis. ! @ # $ % ^ & *)
 *
 * Kekuatan (meter di form daftar):
 * - Lemah (merah): ada syarat yang belum terpenuhi.
 * - Lumayan (kuning): semua syarat terpenuhi, panjang 8-11 karakter.
 * - Kuat (hijau): semua syarat terpenuhi dan panjang >= 12 karakter.
 *
 * Aturan yang sama dipakai di tiga tempat supaya tidak bisa dilewati:
 * form daftar (`Auth.tsx`), `store.register`, dan backend
 * (`AuthController::register`) — pesannya disamakan lewat
 * `PASSWORD_REQUIREMENTS_MESSAGE`.
 */

export interface PasswordRequirements {
  minLength: boolean
  hasUppercase: boolean
  hasNumber: boolean
  hasSymbol: boolean
  /** true bila semua syarat terpenuhi. */
  valid: boolean
}

export function checkPasswordRequirements(password: string): PasswordRequirements {
  const minLength = password.length >= 8
  const hasUppercase = /[A-Z]/.test(password)
  const hasNumber = /[0-9]/.test(password)
  const hasSymbol = /[^A-Za-z0-9]/.test(password)
  return {
    minLength,
    hasUppercase,
    hasNumber,
    hasSymbol,
    valid: minLength && hasUppercase && hasNumber && hasSymbol,
  }
}

export type PasswordStrength = 'lemah' | 'lumayan' | 'kuat'

export function passwordStrength(password: string): PasswordStrength {
  if (!checkPasswordRequirements(password).valid) return 'lemah'
  return password.length >= 12 ? 'kuat' : 'lumayan'
}

/** Pesan error yang dipakai form daftar, store, dan backend. */
export const PASSWORD_REQUIREMENTS_MESSAGE =
  'Password harus minimal 8 karakter dan mengandung minimal 1 huruf kapital, 1 angka, dan 1 simbol.'
