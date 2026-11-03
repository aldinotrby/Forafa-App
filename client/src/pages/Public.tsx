import { useState } from 'react'
import { useStore } from '../services/store'
import { Btn, Card, Field, KIND, KindBadge, Logo, inputCls } from '../components/ui'

export default function Public({ slug }: { slug: string }) {
  const { interactions, submit } = useStore()
  const it = interactions.find((i) => i.slug === slug)
  const [name, setName] = useState('')
  const [choice, setChoice] = useState('')
  const [msg, setMsg] = useState('')
  const [topic, setTopic] = useState('')
  const [done, setDone] = useState(false)

  const today = new Date().toISOString().slice(0, 10)
  const closed = !!it && (!it.active || (it.start && today < it.start) || (it.end && today > it.end))

  const send = (e: React.FormEvent) => {
    e.preventDefault()
    if (!it) return
    if (it.kind === 'vote') submit({ iid: it.id, name, choice })
    else if (it.kind === 'feedback') submit({ iid: it.id, name, message: topic ? `[${topic}] ${msg}` : msg })
    else submit({ iid: it.id, message: msg })
    setDone(true)
  }

  const m = it && KIND[it.kind]
  return (
    <div className="min-h-screen bg-ground">
      <header className="border-b border-line bg-white"><div className="mx-auto flex max-w-xl items-center gap-2 px-5 py-3"><Logo size={28} /><b className="font-display">Forafa-App</b><span className="ml-auto rounded-full bg-ground px-3 py-1 text-xs text-mute">Pengunjung · tanpa akun</span></div></header>
      <main className="mx-auto max-w-xl px-5 py-10">
        {!it ? (
          <Card className="p-8 text-center"><h1 className="font-display text-2xl font-bold">Link tidak ditemukan</h1><p className="mt-2 text-mute">Public link ini tidak ada atau sudah dihapus.</p></Card>
        ) : (
          <Card className="overflow-hidden">
            <div className={`h-2 ${m!.bg}`} />
            <div className="space-y-6 p-7">
              <div className="space-y-2"><KindBadge k={it.kind} /><h1 className="font-display text-3xl font-extrabold leading-tight">{it.title}</h1><p className="text-mute">{it.description}</p></div>
              {closed ? (
                <p className="rounded-lg bg-ground p-4 text-sm font-medium text-mute">Interaksi ini sedang tidak aktif atau di luar periode.</p>
              ) : done ? (
                <div className="space-y-3 rounded-xl bg-brand-soft p-6 text-center">
                  <p className="font-display text-xl font-bold text-brand">{it.kind === 'vote' ? 'Suara Anda tercatat' : it.kind === 'anon' ? 'Pesan terkirim secara anonim' : 'Terima kasih atas masukan Anda'}</p>
                  <Btn variant="ghost" onClick={() => { setDone(false); setName(''); setChoice(''); setMsg(''); setTopic('') }}>Kirim lagi</Btn>
                </div>
              ) : (
                <form onSubmit={send} className="space-y-4">
                  {it.kind !== 'anon' && <Field label="Nama"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} required placeholder="Nama Anda" /></Field>}
                  {it.kind === 'vote' && (
                    <fieldset className="space-y-2">
                      <legend className="mb-1 text-xs font-semibold uppercase tracking-wider text-mute">Pilih salah satu</legend>
                      {it.options.map((o) => (
                        <label key={o} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition-colors ${choice === o ? 'border-vote bg-vote-soft' : 'border-line hover:bg-ground'}`}>
                          <input type="radio" name="opt" className="accent-vote" checked={choice === o} onChange={() => setChoice(o)} required />{o}
                        </label>
                      ))}
                    </fieldset>
                  )}
                  {it.kind === 'feedback' && it.options.length > 0 && (
                    <Field label="Topik"><select className={inputCls} value={topic} onChange={(e) => setTopic(e.target.value)}><option value="">Umum</option>{it.options.map((o) => <option key={o}>{o}</option>)}</select></Field>
                  )}
                  {it.kind !== 'vote' && <Field label={it.kind === 'anon' ? 'Tulis pesan' : 'Kritik / saran'} hint={it.kind === 'anon' ? 'Identitas, IP, dan perangkat Anda tidak ditampilkan kepada pemilik link.' : undefined}><textarea className={inputCls} rows={5} value={msg} onChange={(e) => setMsg(e.target.value)} required /></Field>}
                  <Btn className={`w-full py-2.5 ${m!.bg} hover:opacity-90`}>{it.kind === 'vote' ? 'Kirim Vote' : 'Kirim'}</Btn>
                </form>
              )}
            </div>
          </Card>
        )}
        <p className="mt-6 text-center text-xs text-mute"><a href="#/" className="font-semibold text-brand hover:underline">Buat interaksi Anda sendiri di Forafa-App</a></p>
      </main>
    </div>
  )
}
