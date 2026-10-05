import { useState } from 'react'
import { useStore, type Role } from './store'
import { Btn, Field, Logo, inputCls } from './ui'

export default function Auth() {
  const { login, register } = useStore()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [err, setErr] = useState<string | null>(null)
  const [f, setF] = useState({ id: '', username: '', email: '', password: '', role: 'User' as Role })
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setErr(mode === 'login' ? login(f.id, f.password) : register(f))
  }

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
            <p className="text-xs font-bold uppercase tracking-widest text-brand">Langkah 1</p>
            <h2 className="font-display text-3xl font-extrabold">{mode === 'login' ? 'Masuk ke Forafa-App' : 'Buat akun baru'}</h2>
          </div>

          {mode === 'login' ? (
            <>
              <Field label="Email atau username"><input className={inputCls} value={f.id} onChange={(e) => set('id', e.target.value)} placeholder="rina" required /></Field>
            </>
          ) : (
            <>
              <Field label="Username"><input className={inputCls} value={f.username} onChange={(e) => set('username', e.target.value)} placeholder="rina_mekar" required /></Field>
              <Field label="Email"><input type="email" className={inputCls} value={f.email} onChange={(e) => set('email', e.target.value)} placeholder="nama@email.com" required /></Field>
              <Field label="Role">
                <select className={inputCls} value={f.role} onChange={(e) => set('role', e.target.value)}>
                  <option>User</option><option>Administrator</option>
                </select>
              </Field>
            </>
          )}
          <Field label="Password" hint={mode === 'register' ? 'Minimal 8 karakter. Di-hash (bcrypt) oleh backend.' : undefined}>
            <input type="password" className={inputCls} value={f.password} onChange={(e) => set('password', e.target.value)} required />
          </Field>

          {err && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
          <Btn className="w-full py-2.5">{mode === 'login' ? 'Login' : 'Daftar'}</Btn>

          <p className="text-center text-sm text-mute">
            {mode === 'login' ? 'Belum punya akun?' : 'Sudah punya akun?'}{' '}
            <button type="button" className="font-semibold text-brand hover:underline" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setErr(null) }}>
              {mode === 'login' ? 'Daftar' : 'Login'}
            </button>
          </p>
          {mode === 'login' && <p className="rounded-lg bg-brand-soft px-3 py-2 text-xs text-brand">Demo: <b>rina</b> / rina12345 (User) · <b>admin</b> / admin12345 (Administrator)</p>}
        </form>
      </section>
    </div>
  )
}
