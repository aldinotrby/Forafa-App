import type { Kind, Response, Status } from './store'

/**
 * Riwayat pengisi dari backend (`GET /responses/mine`).
 *
 * Endpoint ini mengembalikan kiriman milik akun yang sedang login
 * (berdasarkan `user_id` yang diisi PublicController saat submit sambil
 * login). Karena itu riwayat server hanya berisi kiriman yang dibuat saat
 * pengguna masuk dengan akun Forafa di tab itu — kiriman tanpa sesi login
 * (hanya verifikasi Google di form publik) tidak tercatat user_id-nya dan
 * tetap hanya ada di riwayat lokal perangkat ini.
 *
 * Bila backend tidak terjangkau, token tidak ada, atau sesi habis,
 * `fetchMyResponses` mengembalikan null dan dashboard tetap menampilkan
 * riwayat lokal — tidak ada layar error.
 */

/** Satu kiriman dari server, dipetakan ke bentuk `Response` lokal. */
export interface ServerResponseItem extends Response {
  interactionTitle: string
  interactionSlug: string
  interactionKind: Kind
  fromServer: true
}

const API_BASE = '/api/v1'

/** Ambil riwayat milik akun login dari backend. Null bila tidak ada token
    atau pengambilan gagal (backend mati / sesi habis / respons tak dikenal). */
export async function fetchMyResponses(signal?: AbortSignal): Promise<ServerResponseItem[] | null> {
  let token: string | null = null
  try {
    token = sessionStorage.getItem('fa_token')
  } catch {
    return null
  }
  if (!token) return null
  try {
    const res = await fetch(`${API_BASE}/responses/mine?limit=200`, {
      headers: { Authorization: `Bearer ${token}` },
      signal,
    })
    if (!res.ok) return null
    const body: unknown = await res.json().catch(() => null)
    const rows = Array.isArray(body) ? body : Array.isArray((body as { data?: unknown } | null)?.data) ? (body as { data: unknown[] }).data : null
    if (!rows) return null
    return rows.map(normalizeServerResponse).filter((r): r is ServerResponseItem => r !== null)
  } catch {
    return null
  }
}

type AnyRecord = Record<string, unknown>

const isRecord = (v: unknown): v is AnyRecord => typeof v === 'object' && v !== null && !Array.isArray(v)

const asKind = (v: unknown, fallback: Kind): Kind =>
  v === 'vote' || v === 'feedback' || v === 'anon' ? v : fallback

/**
 * Petakan satu baris `GET /responses/mine` ke `Response` lokal.
 * - `iid` dari `interaction_id`; `at` dari `created_at`.
 * - `answers` (daftar `{question_id, choice}`) dipetakan ke `choices`.
 * - Judul/slug/jenis link ikut dari backend — kiriman dari perangkat lain
 *   tetap bisa ditampilkan meski linknya tidak ada di perangkat ini.
 * - Bila linknya sudah dihapus di server (judul/slug null), jenis
 *   ditebak dari isi: ada `choice` → voting, anonim → pesan anonim,
 *   selain itu kritik & saran.
 */
export function normalizeServerResponse(raw: unknown): ServerResponseItem | null {
  if (!isRecord(raw)) return null
  const id = String(raw.id ?? '')
  const iid = String(raw.iid ?? raw.interaction_id ?? '')
  if (!id || !iid) return null

  let choices: Record<string, string> | undefined
  if (Array.isArray(raw.answers)) {
    const map: Record<string, string> = {}
    for (const a of raw.answers) {
      if (isRecord(a) && a.question_id && a.choice) map[String(a.question_id)] = String(a.choice)
    }
    if (Object.keys(map).length > 0) choices = map
  } else if (isRecord(raw.choices)) {
    const map: Record<string, string> = {}
    for (const [k, v] of Object.entries(raw.choices)) if (typeof v === 'string') map[k] = v
    if (Object.keys(map).length > 0) choices = map
  }

  const choice = typeof raw.choice === 'string' && raw.choice ? raw.choice : undefined
  const isAnonymous = raw.is_anonymous === true || raw.is_anonymous === 1
  const kind = asKind(
    raw.interaction_kind ?? raw.kind,
    choice ? 'vote' : isAnonymous ? 'anon' : 'feedback',
  )

  return {
    id,
    iid,
    name: typeof raw.name === 'string' && raw.name ? raw.name : undefined,
    choice,
    choices,
    message: typeof raw.message === 'string' && raw.message ? raw.message : undefined,
    status: (raw.status as Status) || 'Baru',
    reply: typeof raw.reply === 'string' && raw.reply ? raw.reply : undefined,
    shared: Boolean(raw.shared),
    at: String(raw.at ?? raw.created_at ?? new Date().toISOString()),
    anonymous: isAnonymous ? true : undefined,
    interactionTitle: typeof raw.interaction_title === 'string' && raw.interaction_title ? raw.interaction_title : 'Link dihapus',
    interactionSlug: typeof raw.interaction_slug === 'string' ? raw.interaction_slug : '',
    interactionKind: kind,
    fromServer: true,
  }
}

/** Kiriman yang sama boleh muncul dua kali (lokal + server) karena
    id lokal (`uid()` acak) berbeda dengan id server (`r_...`). Dua baris
    dianggap kiriman yang sama bila: link sama, pilihan/pesan sama, dan
    waktunya berdekatan (submit lokal & server terjadi bersamaan). */
const DEDUPE_WINDOW_MS = 180_000

function sameSubmission(a: Response, b: Response): boolean {
  if (a.iid !== b.iid) return false
  const sameChoice = Boolean(a.choice) && a.choice === b.choice
  const sameMessage = Boolean(a.message) && a.message === b.message
  if (!sameChoice && !sameMessage) return false
  const ta = Date.parse(a.at)
  const tb = Date.parse(b.at)
  if (Number.isNaN(ta) || Number.isNaN(tb)) return false
  return Math.abs(ta - tb) <= DEDUPE_WINDOW_MS
}

/**
 * Gabungkan riwayat lokal dengan riwayat server, terbaru dulu.
 * Bila satu kiriman ada di keduanya, versi server yang dipakai (status &
 * balasan dari server lebih baru) — tapi `voterKey` lokal dipertahankan
 * supaya kiriman itu tetap masuk filter identitas yang dipilih.
 * Kiriman server yang tidak punya padanan lokal ditambahkan apa adanya
 * (mis. dibuat di perangkat lain).
 */
export function mergeHistories(local: Response[], server: ServerResponseItem[]): Response[] {
  const out: Response[] = [...local]
  for (const s of server) {
    const idx = out.findIndex((l) => sameSubmission(l, s))
    if (idx >= 0) {
      const kept = out[idx]
      out[idx] = {
        ...s,
        voterKey: kept.voterKey,
        verifiedVia: kept.verifiedVia,
        verificationLabel: kept.verificationLabel,
      }
    } else {
      out.push(s)
    }
  }
  return out.sort((a, b) => +new Date(b.at) - +new Date(a.at))
}
