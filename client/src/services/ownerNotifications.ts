import type { Response } from './store'

/**
 * Notifikasi masukan baru untuk pembuat link (owner workspace).
 *
 * Cerminan dari notifikasi balasan di sisi pengisi (`replyNotifications.ts`):
 * sebuah respons dianggap "baru" bila id-nya belum pernah ditandai dibaca.
 * Daftar yang sudah dibaca tersimpan di localStorage (`fa_seen_responses`)
 * per perangkat & browser — bukan per akun, karena data aplikasi ini
 * tersimpan lokal. Tidak ada push/email: respons yang masuk saat owner
 * tidak membuka workspace muncul sebagai baru saat workspace dibuka lagi.
 *
 * Data contoh: saat pertama dibaca, semua respons seed dianggap sudah
 * dibaca KECUALI empat yang terbaru (f5, f6, v30, v31) supaya lonceng
 * langsung menunjukkan 2 masukan baru untuk tiap pemilik contoh.
 */
const SEEN_KEY = 'fa_seen_responses'

/** Id respons seed yang dianggap sudah dibaca pada pemakaian pertama. */
const SEED_SEEN: string[] = [
  'v0', 'v1', 'v2', 'v3', 'v4', 'v5', 'v6', 'v7', 'v8', 'v9', 'v10', 'v11',
  'f1', 'f2', 'f3', 'f4',
  'a1', 'a2',
  'v20', 'v21', 'v22',
  'fb10',
]

export function loadSeenResponseIds(): string[] {
  try {
    const raw = localStorage.getItem(SEEN_KEY)
    if (raw === null) {
      localStorage.setItem(SEEN_KEY, JSON.stringify(SEED_SEEN))
      return [...SEED_SEEN]
    }
    const list = JSON.parse(raw) as string[]
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function saveSeenResponseIds(ids: string[]) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...new Set(ids)]))
  } catch {
    // Penyimpanan tidak tersedia — status dibaca hanya berlaku di sesi ini.
  }
}

/** Tandai satu respons sudah dibaca; mengembalikan daftar terbaru. */
export function markResponseSeen(id: string): string[] {
  const next = [...new Set([...loadSeenResponseIds(), id])]
  saveSeenResponseIds(next)
  return next
}

/** Tandai beberapa respons sudah dibaca; mengembalikan daftar terbaru. */
export function markResponsesSeen(ids: string[]): string[] {
  const next = [...new Set([...loadSeenResponseIds(), ...ids])]
  saveSeenResponseIds(next)
  return next
}

/** Respons yang belum dibaca di antara interaksi milik owner, urut terbaru dulu. */
export function unseenResponses(responses: Response[], ownerIids: Set<string>): Response[] {
  const seen = new Set(loadSeenResponseIds())
  return responses
    .filter((r) => ownerIids.has(r.iid) && !seen.has(r.id))
    .sort((a, b) => +new Date(b.at) - +new Date(a.at))
}
