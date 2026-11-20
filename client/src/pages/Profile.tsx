import { useEffect, useState } from 'react'
import { useStore } from '../services/store'
import { BIO_MAX_LENGTH, bioLength, changeWindow, formatChangeDate } from '../services/profile'
import { requestEmailOtp, verifyEmailOtp } from '../services/emailOtpService'
import { MediaUpload } from '../components/MediaUpload'
import { Btn, Card, Field, inputCls } from '../components/ui'

/**
 * Halaman Profil — foto, bio, username, email, password, hapus akun, keluar.
 *
 * - Foto profil: upload (Cloudinary bila dikonfigurasi, bila tidak disimpan
 *   lokal sebagai data URL) atau hapus foto.
 * - Bio: maksimal 160 karakter, dengan penghitung sisa.
 * - Username & email: masing-masing hanya bisa diganti 1x dalam 7 hari.
 *   Ganti email wajib verifikasi ulang: kode OTP 5 digit dikirim ke
 *   email BARU dari forafagroup@gmail.com, lalu kode diverifikasi dan
 *   email diganti dengan token sekali pakai itu (tanpa kode demo —
 *   tanpa kode dari email sungguhan, email tidak bisa diganti).
 * - Ganti password: hanya untuk akun yang login pakai email + password.
 *   Akun Google tidak punya password lokal.
 * - Hapus akun: popup konfirmasi — wajib ketik username + (akun email)
 *   password saat ini. Semua link & respons milik akun ikut terhapus.
 * - Tombol Keluar ada di paling bawah halaman ini.
 */
export default function Profile() {
  const { user, logout, updateProfile, changePassword, deleteOwnAccount } = useStore()
  const [username, setUsername] = useState(user!.username)
  const [email, setEmail] = useState(user!.email)
  const [bio, setBio] = useState(user!.bio ?? '')
  const [saved, setSaved] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const [oldPw, setOldPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [newPw2, setNewPw2] = useState('')
  const [pwMsg, setPwMsg] = useState<string | null>(null)
  const [pwErr, setPwErr] = useState<string | null>(null)

  const [showDelete, setShowDelete] = useState(false)
  const [delName, setDelName] = useState('')
  const [delPw, setDelPw] = useState('')
  const [delErr, setDelErr] = useState<string | null>(null)

  // Verifikasi ulang saat ganti email: kode OTP 5 digit dikirim ke email
  // BARU (dari forafagroup@gmail.com). Selama langkah kode, kolom email
  // dikunci supaya target kode tidak berubah di tengah jalan.
  const [emailOtpStep, setEmailOtpStep] = useState<'idle' | 'code'>('idle')
  const [emailOtpTarget, setEmailOtpTarget] = useState('')
  const [emailCode, setEmailCode] = useState('')
  const [emailOtpErr, setEmailOtpErr] = useState<string | null>(null)
  const [emailOtpBusy, setEmailOtpBusy] = useState(false)
  const [expiresAt, setExpiresAt] = useState(0)
  const [resendAt, setResendAt] = useState(0)
  const [now, setNow] = useState(() => Date.now())

  // Hitung mundur masa berlaku kode & jeda kirim ulang (langkah kode saja).
  useEffect(() => {
    if (emailOtpStep !== 'code') return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [emailOtpStep])

  const fmtCountdown = (ms: number) => {
    const s = Math.max(0, Math.ceil(ms / 1000))
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  }
  const emailCodeLeftMs = expiresAt - now
  const emailResendLeftMs = resendAt - now

  /** Kirim kode OTP 5 digit ke email baru yang diketik. */
  const sendEmailOtp = async () => {
    setEmailOtpErr(null)
    const target = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target)) {
      setEmailOtpErr('Format email baru tidak valid.')
      return
    }
    if (target === user!.email) {
      setEmailOtpErr('Email baru sama dengan email saat ini.')
      return
    }
    setEmailOtpBusy(true)
    const r = await requestEmailOtp(target)
    setEmailOtpBusy(false)
    if (!r.ok) {
      setEmailOtpErr(r.error ?? 'Gagal mengirim kode verifikasi.')
      return
    }
    setEmailOtpTarget(target)
    setExpiresAt(Date.now() + (r.expiresInSeconds ?? 600) * 1000)
    setResendAt(Date.now() + (r.resendAfterSeconds ?? 60) * 1000)
    setEmailCode('')
    setEmailOtpStep('code')
  }

  /** Verifikasi kode, lalu ganti email dengan token sekali pakai itu. */
  const verifyEmailOtpCode = async () => {
    setEmailOtpErr(null)
    if (!/^\d{5}$/.test(emailCode)) {
      setEmailOtpErr('Kode verifikasi harus 5 angka.')
      return
    }
    setEmailOtpBusy(true)
    const v = await verifyEmailOtp(emailOtpTarget, emailCode)
    setEmailOtpBusy(false)
    if (!v.ok) {
      setEmailOtpErr(v.error ?? 'Verifikasi gagal.')
      return
    }
    const e = updateProfile({ email: emailOtpTarget, emailVerificationToken: v.verificationToken })
    if (e) {
      setEmailOtpErr(e)
      return
    }
    setEmailOtpStep('idle')
    setEmailCode('')
    setSaved('Email berhasil diganti dan terverifikasi.')
  }

  const resendEmailOtp = async () => {
    setEmailOtpErr(null)
    setEmailOtpBusy(true)
    const r = await requestEmailOtp(emailOtpTarget)
    setEmailOtpBusy(false)
    if (!r.ok) {
      setEmailOtpErr(r.error ?? 'Gagal mengirim ulang kode.')
      return
    }
    setExpiresAt(Date.now() + (r.expiresInSeconds ?? 600) * 1000)
    setResendAt(Date.now() + (r.resendAfterSeconds ?? 60) * 1000)
    setEmailCode('')
  }

  if (!user) return null
  const isGoogle = user.provider === 'google'
  const usernameWindow = changeWindow(user.usernameChangedAt)
  const emailWindow = changeWindow(user.emailChangedAt)

  const saveProfile = () => {
    setErr(null)
    setSaved(null)
    const e = updateProfile({ username: username.trim(), email: email.trim(), bio })
    if (e) {
      setErr(e)
      return
    }
    setSaved('Profil berhasil disimpan.')
  }

  const savePassword = () => {
    setPwErr(null)
    setPwMsg(null)
    if (newPw !== newPw2) {
      setPwErr('Konfirmasi password baru tidak cocok.')
      return
    }
    const e = changePassword(oldPw, newPw)
    if (e) {
      setPwErr(e)
      return
    }
    setOldPw('')
    setNewPw('')
    setNewPw2('')
    setPwMsg('Password berhasil diganti.')
  }

  const confirmDelete = () => {
    setDelErr(null)
    if (delName.trim() !== user.username) {
      setDelErr(`Ketik username Anda (${user.username}) untuk mengonfirmasi.`)
      return
    }
    const e = deleteOwnAccount(isGoogle ? undefined : delPw)
    if (e) {
      setDelErr(e)
      return
    }
    // Sesi berakhir & akun terhapus — Router kembali ke halaman login.
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold">Profil saya</h1>
        <p className="mt-1 text-sm text-mute">
          {user.role} · {isGoogle ? 'Login dengan Google' : 'Login dengan email'}
        </p>
      </div>

      <Card className="space-y-5 p-5">
        <h2 className="font-display text-lg font-bold">Foto &amp; bio</h2>
        <MediaUpload
          type="profile"
          userId={user.id}
          currentUrl={user.avatar}
          label="Foto profil"
          onUpload={(asset) => {
            const e = updateProfile({ avatar: asset.url })
            setErr(e)
            setSaved(e ? null : 'Foto profil berhasil diganti.')
          }}
        />
        {user.avatar && (
          <button
            type="button"
            className="text-sm font-semibold text-red-700 hover:underline"
            onClick={() => {
              const e = updateProfile({ avatar: null })
              setErr(e)
              setSaved(e ? null : 'Foto profil dihapus.')
            }}
          >
            Hapus foto profil
          </button>
        )}
        <Field label="Bio" hint={`${bioLength(bio)}/${BIO_MAX_LENGTH} karakter`}>
          <textarea
            className={inputCls}
            rows={3}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Ceritakan sedikit tentang Anda…"
          />
        </Field>
        <p className={`text-xs ${bioLength(bio) > BIO_MAX_LENGTH ? 'font-semibold text-red-700' : 'text-mute'}`}>
          {bioLength(bio) > BIO_MAX_LENGTH
            ? `Bio melebihi batas ${BIO_MAX_LENGTH} karakter — kurangi ${bioLength(bio) - BIO_MAX_LENGTH} karakter.`
            : `Sisa ${BIO_MAX_LENGTH - bioLength(bio)} karakter.`}
        </p>
      </Card>

      <Card className="space-y-5 p-5">
        <h2 className="font-display text-lg font-bold">Akun</h2>
        <Field
          label="Username"
          hint={
            usernameWindow.allowed
              ? 'Bisa diganti 1x dalam 7 hari.'
              : `Terakhir diganti — bisa diganti lagi pada ${formatChangeDate(usernameWindow.nextAllowedAt)} (${usernameWindow.daysLeft} hari lagi).`
          }
        >
          <input className={inputCls} value={username} onChange={(e) => setUsername(e.target.value)} disabled={!usernameWindow.allowed} />
        </Field>
        <Field
          label="Email"
          hint={
            emailWindow.allowed
              ? 'Bisa diganti 1x dalam 7 hari. Email baru wajib diverifikasi dengan kode 5 digit yang dikirim ke email baru itu.'
              : `Terakhir diganti — bisa diganti lagi pada ${formatChangeDate(emailWindow.nextAllowedAt)} (${emailWindow.daysLeft} hari lagi).`
          }
        >
          <input
            type="email"
            className={inputCls}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={!emailWindow.allowed || emailOtpStep === 'code'}
          />
        </Field>
        {emailWindow.allowed && email.trim() !== user.email && emailOtpStep === 'idle' && (
          <div>
            <Btn variant="ghost" onClick={() => void sendEmailOtp()} disabled={emailOtpBusy}>
              {emailOtpBusy ? 'Mengirim kode…' : 'Kirim kode verifikasi ke email baru'}
            </Btn>
            {emailOtpErr && <p role="alert" className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{emailOtpErr}</p>}
          </div>
        )}
        {emailOtpStep === 'code' && (
          <div className="space-y-3 rounded-xl border border-line bg-ground p-4">
            <p className="rounded-lg bg-brand-soft px-3 py-2 text-sm text-brand">
              Kode verifikasi 5 digit dikirim ke <b>{emailOtpTarget}</b> dari <b>forafagroup@gmail.com</b>.
              Periksa inbox (dan folder spam). Kode berlaku <b>{fmtCountdown(emailCodeLeftMs)}</b>.
            </p>
            <Field label="Kode verifikasi (5 digit)">
              <input
                className={`${inputCls} text-center text-2xl tracking-[0.5em]`}
                value={emailCode}
                onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
                placeholder="12345"
                inputMode="numeric"
                autoComplete="one-time-code"
              />
            </Field>
            {emailOtpErr && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{emailOtpErr}</p>}
            <div className="flex flex-wrap items-center gap-2">
              <Btn onClick={() => void verifyEmailOtpCode()} disabled={emailOtpBusy}>
                {emailOtpBusy ? 'Memverifikasi…' : 'Verifikasi & ganti email'}
              </Btn>
              <button
                type="button"
                className="text-sm font-semibold text-brand hover:underline disabled:text-mute disabled:no-underline"
                disabled={emailOtpBusy || emailResendLeftMs > 0}
                onClick={() => void resendEmailOtp()}
              >
                {emailResendLeftMs > 0 ? `Kirim ulang dalam ${fmtCountdown(emailResendLeftMs)}` : 'Kirim ulang kode'}
              </button>
              <button
                type="button"
                className="text-sm font-semibold text-mute hover:underline"
                onClick={() => { setEmailOtpStep('idle'); setEmailOtpErr(null); setEmailCode('') }}
              >
                Batal
              </button>
            </div>
          </div>
        )}
        {err && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
        {saved && <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{saved}</p>}
        <Btn onClick={saveProfile}>Simpan profil</Btn>
      </Card>

      <Card className="space-y-5 p-5">
        <h2 className="font-display text-lg font-bold">Password</h2>
        {isGoogle ? (
          <p className="rounded-lg bg-brand-soft px-3 py-2 text-sm text-brand">
            Akun ini login dengan Google, jadi tidak ada password lokal yang bisa diganti di sini. Untuk mengganti password, ubah password akun Google Anda.
          </p>
        ) : (
          <>
            <Field label="Password lama">
              <input type="password" className={inputCls} value={oldPw} onChange={(e) => setOldPw(e.target.value)} autoComplete="current-password" />
            </Field>
            <Field label="Password baru" hint="Minimal 8 karakter, harus berbeda dari password lama.">
              <input type="password" className={inputCls} value={newPw} onChange={(e) => setNewPw(e.target.value)} autoComplete="new-password" />
            </Field>
            <Field label="Konfirmasi password baru">
              <input type="password" className={inputCls} value={newPw2} onChange={(e) => setNewPw2(e.target.value)} autoComplete="new-password" />
            </Field>
            {pwErr && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{pwErr}</p>}
            {pwMsg && <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{pwMsg}</p>}
            <Btn onClick={savePassword}>Ganti password</Btn>
          </>
        )}
      </Card>

      <Card className="space-y-3 border-red-200 p-5">
        <h2 className="font-display text-lg font-bold text-red-700">Hapus akun</h2>
        <p className="text-sm text-mute">
          Menghapus akun akan menghapus <b>semua link</b> (voting, kritik &amp; saran, pesan anonim) dan <b>semua respons</b> yang masuk ke link Anda. Tindakan ini tidak bisa dibatalkan.
        </p>
        <Btn variant="danger" onClick={() => { setShowDelete(true); setDelErr(null); setDelName(''); setDelPw('') }}>
          Hapus akun saya…
        </Btn>
      </Card>

      <div className="border-t border-line pt-5">
        <Btn variant="ghost" className="w-full py-2.5" onClick={logout}>
          Keluar
        </Btn>
        <p className="mt-2 text-center text-xs text-mute">Keluar dari akun {user.username} di perangkat ini.</p>
      </div>

      {showDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="delete-title">
          <div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-xl">
            <h3 id="delete-title" className="font-display text-xl font-extrabold text-red-700">Yakin ingin menghapus akun?</h3>
            <p className="text-sm text-mute">
              Akun <b className="text-ink">@{user.username}</b> beserta semua link dan respons yang masuk akan dihapus <b>permanen</b> dan tidak bisa dikembalikan. Pastikan Anda benar-benar yakin.
            </p>
            <Field label={`Ketik username Anda (${user.username}) untuk mengonfirmasi`}>
              <input className={inputCls} value={delName} onChange={(e) => setDelName(e.target.value)} placeholder={user.username} />
            </Field>
            {!isGoogle && (
              <Field label="Password saat ini">
                <input type="password" className={inputCls} value={delPw} onChange={(e) => setDelPw(e.target.value)} autoComplete="current-password" />
              </Field>
            )}
            {delErr && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{delErr}</p>}
            <div className="flex gap-2">
              <Btn variant="ghost" className="flex-1" onClick={() => setShowDelete(false)}>Batal</Btn>
              <button
                type="button"
                onClick={confirmDelete}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700"
              >
                Ya, hapus akun saya
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
