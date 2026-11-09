import { useEffect, useRef, useState } from 'react'
import { useStore } from '../services/store'
import { initGoogleSignIn, isGoogleConfigured } from '../services/googleAuth'
import { Btn, Field, Logo, fmtDate, inputCls } from '../components/ui'

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

export default function Auth() {
  const { login, register, loginWithGoogle, loginStatus, sessionHistory } = useStore()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [err, setErr] = useState<string | null>(null)
  const [f, setF] = useState({ id: '', username: '', email: '', password: '' })
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }))
  const googleConfigured = isGoogleConfigured()
  const googleBtnRef = useRef<HTMLDivElement>(null)
  const googleLoginRef = useRef(loginWithGoogle)
  googleLoginRef.current = loginWithGoogle

  // Tombol resmi Google dirender oleh Google Identity Services ke div ini.
  // Bila VITE_GOOGLE_CLIENT_ID belum diatur, tombol cadangan di bawah yang tampil.
  useEffect(() => {
    if (!googleConfigured) return
    let cleanup: (() => void) | undefined
    let cancelled = false
    initGoogleSignIn(({ profile, error }) => {
      if (error) setErr(error)
      else if (profile) setErr(googleLoginRef.current(profile))
    }, googleBtnRef.current)
      .then((fn) => {
        if (cancelled) fn()
        else cleanup = fn
      })
      .catch((e) => setErr(e instanceof Error ? e.message : 'Login Google gagal dimuat.'))
    return () => {
      cancelled = true
      cleanup?.()
    }
  }, [googleConfigured])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setErr(mode === 'login' ? login(f.id, f.password) : register({ username: f.username, email: f.email, password: f.password }))
  }

  const googleNotConfigured = () =>
    setErr('Login Google belum dikonfigurasi. Isi VITE_GOOGLE_CLIENT_ID di file .env (lihat .env.example), lalu muat ulang aplikasi.')

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden bg-ink p-14 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3"><Logo size={44} /><span className="font-display text-2xl font-extrabold">Forafa-App</span></div>
        <div>
          <h1 className="font-display text-6xl font-extrabold leading-[1.02] tracking-tight">Dengar suara<br />publik, <span className="text-[#7ee0cf]">tanpa ribet.</span></h1>
          <p className="mt-6 max-w-md text-lg text-white/70">Voting, Kritik &amp; Saran, dan Pesan Anonim lewat satu public link, dengan dashboard terintegrasi.</p>
          <div className="mt-10 flex gap-3 text-sm font-semibold">
            <span className="rounded-full bg-vote px-4 py-1.5">Voting</span>
            <span className="rounded-full bg-fb px-4 py-1.5">Kritik &amp; Saran</span>
            <span className="rounded-full bg-anon px-4 py-1.5">Anonymous</span>
          </div>
        </div>
        <p className="text-sm text-white/50">Participate · Communicate · Analyze</p>
        <div className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-brand/40 blur-3xl" />
      </section>

      <section className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm space-y-5">
          <div className="lg:hidden"><Logo /></div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-brand">
              {mode === 'login' ? 'Selamat datang' : 'Daftar akun baru'}
            </p>
            <h2 className="font-display text-3xl font-extrabold">
              {mode === 'login' ? 'Masuk ke Forafa-App' : 'Buat akun gratis'}
            </h2>
          </div>

          {mode === 'login' ? (
            <Field label="Email atau username">
              <input className={inputCls} value={f.id} onChange={(e) => set('id', e.target.value)} placeholder="rina" required />
            </Field>
          ) : (
            <>
              <Field label="Username">
                <input className={inputCls} value={f.username} onChange={(e) => set('username', e.target.value)} placeholder="rina_mekar" required />
              </Field>
              <Field label="Email">
                <input type="email" className={inputCls} value={f.email} onChange={(e) => set('email', e.target.value)} placeholder="nama@email.com" required />
              </Field>
            </>
          )}
          <Field label="Password" hint={mode === 'register' ? 'Minimal 8 karakter.' : undefined}>
            <input type="password" className={inputCls} value={f.password} onChange={(e) => set('password', e.target.value)} required />
          </Field>

          {err && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
          <Btn className="w-full py-2.5">{mode === 'login' ? 'Login' : 'Daftar'}</Btn>

          <div className="space-y-3">
            <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-mute" aria-hidden>
              <span className="h-px flex-1 bg-line" />atau lanjutkan dengan<span className="h-px flex-1 bg-line" />
            </div>
            {googleConfigured ? (
              <div className="flex justify-center">
                <div ref={googleBtnRef} aria-label="Login dengan Google" />
              </div>
            ) : (
              <button type="button" onClick={googleNotConfigured} className="flex w-full items-center justify-center gap-3 rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-ground">
                <GoogleIcon /> Lanjutkan dengan Google
              </button>
            )}
            <p className="text-center text-xs text-mute">Akun Google yang belum terdaftar otomatis dibuatkan akun User baru.</p>
          </div>

          <p className="text-center text-sm text-mute">
            {mode === 'login' ? 'Belum punya akun?' : 'Sudah punya akun?'}{' '}
            <button type="button" className="font-semibold text-brand hover:underline" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setErr(null) }}>
              {mode === 'login' ? 'Daftar sekarang' : 'Login'}
            </button>
          </p>
          {mode === 'login' && (
            <p className="rounded-lg bg-brand-soft px-3 py-2 text-xs text-brand">
              Demo User: <b>rina</b> / rina12345 &nbsp;·&nbsp; Admin: <b>admin</b> / admin12345
            </p>
          )}

          <div className="space-y-1 rounded-lg border border-line bg-white px-3 py-2.5 text-xs text-mute" role="status" aria-label="Status login pengguna">
            <p className="flex items-center gap-2">
              <span className={`size-2 shrink-0 rounded-full ${loginStatus === 'masuk' ? 'bg-emerald-500' : 'bg-red-400'}`} aria-hidden />
              Status login: <b className="text-ink">{loginStatus === 'masuk' ? 'Masuk' : 'Belum masuk'}</b>
            </p>
            {sessionHistory.lastLogoutAt && <p>Logout terakhir: {fmtDate(sessionHistory.lastLogoutAt)}</p>}
            {sessionHistory.lastTabClosedAt && <p>Tab aplikasi terakhir ditutup: {fmtDate(sessionHistory.lastTabClosedAt)} — sesi yang belum logout akan dipulihkan saat tab dibuka lagi.</p>}
          </div>
        </form>
      </section>
    </div>
  )
}
