import { useEffect, useRef, useState } from 'react'
import { useStore } from '../services/store'
import { initGoogleSignIn, isGoogleConfigured } from '../services/googleAuth'
import {
  loadIdentities,
  saveIdentity,
  type VerifiedVoter,
} from '../services/otpService'
import { Card, Logo } from '../components/ui'

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z" />
    </svg>
  )
}

/**
 * Layar login dashboard pengisi (`#/riwayat`): masuk dengan akun Google,
 * dengan mode Masuk / Daftar seperti halaman login utama (`Auth.tsx`).
 *
 * - Mode Masuk: identitas harus sudah dikenal di perangkat ini — tersimpan
 *   sebagai identitas terverifikasi, atau ada kiriman lokal (`voterKey`)
 *   atas namanya. Bila tidak ada, pengguna diarahkan ke mode Daftar.
 * - Mode Daftar: verifikasi Google, lalu identitas baru dibuat dan
 *   disimpan — kiriman lama di perangkat ini yang memakai `voterKey`
 *   yang sama langsung ikut tampil di riwayat (tidak mulai dari 0).
 *
 * Dulu ada juga metode OTP WhatsApp; metode itu sudah dihapus — login
 * dan daftar pengisi sekarang hanya lewat Google.
 */
export default function VoterLogin({ onLoggedIn, onCancel }: {
  onLoggedIn: (v: VerifiedVoter) => void
  onCancel?: () => void
}) {
  const { responses } = useStore()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [error, setError] = useState<string | null>(null)
  const googleBtnRef = useRef<HTMLDivElement>(null)
  const googleConfigured = isGoogleConfigured()

  // State terbaru untuk callback Google (efek GIS tidak di-init ulang
  // setiap kali mode/responses berubah).
  const latestRef = useRef({ mode, responses })
  latestRef.current = { mode, responses }

  // Tombol resmi Google dirender oleh Google Identity Services ke div ini.
  useEffect(() => {
    if (!googleConfigured) return
    let cleanup: (() => void) | undefined
    let cancelled = false
    initGoogleSignIn(({ profile, error: err }) => {
      if (err) {
        setError(err)
        return
      }
      if (!profile) return
      const v: VerifiedVoter = {
        method: 'google',
        key: `google:${profile.googleId}`,
        label: profile.email,
        verifiedAt: new Date().toISOString(),
        slug: '',
      }
      const { mode: m, responses: rs } = latestRef.current
      if (m === 'login' && !identityKnown(v.key, rs)) {
        setError('Akun Google ini belum terdaftar sebagai pengisi di perangkat ini. Silakan daftar dulu sebagai pengisi baru.')
        return
      }
      finishLogin(v)
    }, googleBtnRef.current)
      .then((fn) => {
        if (cancelled) fn()
        else cleanup = fn
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Login Google gagal dimuat.'))
    return () => {
      cancelled = true
      cleanup?.()
    }
    // finishLogin & identityKnown stabil (hanya setState + localStorage).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleConfigured])

  /** Identitas dikenal bila tersimpan, atau ada kiriman lokal atas namanya. */
  function identityKnown(key: string, rs: typeof responses) {
    return loadIdentities().some((v) => v.key === key) || rs.some((r) => r.voterKey === key)
  }

  function finishLogin(v: VerifiedVoter) {
    saveIdentity(v)
    setError(null)
    onLoggedIn(v)
  }

  const switchMode = (m: 'login' | 'register') => {
    setMode(m)
    setError(null)
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <Card className="space-y-5 p-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-brand">
            {mode === 'login' ? 'Masuk dashboard pengisi' : 'Daftar sebagai pengisi'}
          </p>
          <h2 className="font-display text-2xl font-extrabold">
            {mode === 'login' ? 'Masuk ke Riwayat Saya' : 'Buat akun pengisi'}
          </h2>
          <p className="mt-1 text-sm text-mute">
            {mode === 'login'
              ? 'Masuk dengan akun Google yang pernah Anda pakai mengisi link — riwayat voting, kritik & saran, dan balasan yang sudah ada akan tampil lagi.'
              : 'Daftar dengan akun Google. Setelah itu setiap link yang Anda isi dengan identitas ini tercatat di Riwayat Saya beserta status & balasannya.'}
          </p>
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {error}
          </p>
        )}

        <div className="space-y-3">
          {googleConfigured ? (
            <>
              <div className="flex justify-center">
                <div ref={googleBtnRef} aria-label="Login dengan Google" />
              </div>
              <p className="text-center text-xs text-mute">
                {mode === 'register'
                  ? 'Akun Google yang belum terdaftar otomatis dibuatkan identitas pengisi baru.'
                  : 'Login Google hanya dipakai untuk mengenali identitas Anda dan menampilkan riwayatnya.'}
              </p>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setError('Login Google belum dikonfigurasi. Isi VITE_GOOGLE_CLIENT_ID di file .env (lihat .env.example), lalu muat ulang aplikasi.')}
                className="flex w-full items-center justify-center gap-3 rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-ground"
              >
                <GoogleIcon /> Lanjutkan dengan Google
              </button>
              <p className="text-center text-xs text-mute">
                Tombol Google belum aktif karena Client ID Google belum diatur. Isi VITE_GOOGLE_CLIENT_ID di file .env (lihat .env.example), lalu muat ulang aplikasi.
              </p>
            </>
          )}
        </div>

        <p className="text-center text-sm text-mute">
          {mode === 'login' ? 'Belum punya akun pengisi?' : 'Sudah punya akun pengisi?'}{' '}
          <button type="button" className="font-semibold text-brand hover:underline" onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}>
            {mode === 'login' ? 'Daftar sekarang' : 'Masuk'}
          </button>
        </p>
        <p className="text-center text-sm">
          {onCancel
            ? <button type="button" className="font-semibold text-brand hover:underline" onClick={onCancel}>← Kembali ke dashboard</button>
            : <a href="#/" className="font-semibold text-brand hover:underline">← Kembali ke beranda</a>}
        </p>
      </Card>
      <p className="mt-4 flex items-center justify-center gap-2 text-xs text-mute"><Logo size={20} /><span>Forafa-App · Dashboard Pengisi</span></p>
    </div>
  )
}
