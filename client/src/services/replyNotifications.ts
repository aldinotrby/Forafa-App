import type { Response } from './store'

/**
 * Notifikasi balasan untuk pengisi link.
 *
 * Data di aplikasi ini tersimpan lokal di perangkat, jadi tidak ada push
 * atau email: balasan dianggap "baru" bila sebuah respons milik identitas
 * terverifikasi sudah dibalas pembuat link (`reply` terisi) dan id respons
 * itu belum pernah ditandai dibaca. Daftar yang sudah dibaca tersimpan di
 * localStorage (`fa_seen_replies`) per perangkat & browser.
 *
 * Dipakai di dua tempat: banner di dashboard Riwayat Saya (`#/riwayat`)
 * dan banner di halaman publik kritik & saran saat pengisi membuka lagi
 * link yang sama. Membuka detail balasan menandai balasan itu dibaca.
 */
const SEEN_KEY = 'fa_seen_replies'

export function loadSeenReplyIds(): string[] {
  try {
    const list = JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]') as string[]
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function saveSeenReplyIds(ids: string[]) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...new Set(ids)]))
  } catch {
    // Penyimpanan tidak tersedia — status dibaca hanya berlaku di sesi ini.
  }
}

/** Tandai satu balasan sudah dibaca; mengembalikan daftar terbaru. */
export function markReplySeen(id: string): string[] {
  const next = [...new Set([...loadSeenReplyIds(), id])]
  saveSeenReplyIds(next)
  return next
}

/** Tandai beberapa balasan sudah dibaca; mengembalikan daftar terbaru. */
export function markRepliesSeen(ids: string[]): string[] {
  const next = [...new Set([...loadSeenReplyIds(), ...ids])]
  saveSeenReplyIds(next)
  return next
}

/** Balasan yang belum dibaca untuk satu identitas, urut terbaru dulu. */
export function unseenReplies(identityKey: string, responses: Response[]): Response[] {
  const seen = new Set(loadSeenReplyIds())
  return responses
    .filter((r) => r.voterKey === identityKey && r.reply && !seen.has(r.id))
    .sort((a, b) => +new Date(b.at) - +new Date(a.at))
}
