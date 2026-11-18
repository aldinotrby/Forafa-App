/**
 * Bantuan memilih voting yang tepat — mesin rekomendasi lokal.
 *
 * Alurnya: pengunjung menjawab 2–3 pertanyaan kriteria (per jabatan:
 * Ketua, Wakil, Sekretaris, Bendahara, atau umum), lalu melihat hasil
 * rekomendasi dan memilih "Gunakan rekomendasi" atau "Pilih manual".
 *
 * PENTING — rekomendasi AI segera hadir. Opsi voting saat ini hanya
 * berupa label (nama kandidat) tanpa profil/kelebihan, jadi mesin lokal
 * belum bisa menilai kandidat dari kriterianya. Untuk sementara,
 * `recommendOption` memakai data suara yang sudah masuk (pilihan yang
 * paling banyak dipilih sejauh ini) dan merangkum kriteria pengunjung
 * sebagai panduan. Saat AI dibangun nanti, ganti isi `recommendOption`
 * (dan/atau `criteriaFor`) dengan pemanggilan AI — antarmuka
 * `VoteHelper` tidak perlu berubah.
 */

export interface HelperCriterionOption {
  label: string
  /** Tag kriteria yang diwakili jawaban ini (mis. 'pengalaman', 'kedekatan'). */
  tags: string[]
}
export interface HelperCriterion {
  id: string
  question: string
  options: HelperCriterionOption[]
}
export interface HelperAnswer {
  criterionId: string
  question: string
  answer: string
  tags: string[]
}
export interface Recommendation {
  label: string
  votes: number
  total: number
  /** Alasan rekomendasi yang ditampilkan ke pengunjung. */
  basis: string
}

const TAG_LABELS: Record<string, string> = {
  pengalaman: 'Pengalaman memimpin',
  kedekatan: 'Kedekatan dengan warga',
  gagasan: 'Gagasan & program baru',
  ketegasan: 'Ketegasan mengambil keputusan',
  ketelitian: 'Ketelitian & kerapian',
  amanah: 'Amanah & transparansi',
  komunikasi: 'Komunikasi yang baik',
  dukungan: 'Kemampuan mendukung & bekerja sama',
}

const KETUA: HelperCriterion[] = [
  {
    id: 'ketua-1',
    question: 'Apa yang paling Anda utamakan dari seorang Ketua?',
    options: [
      { label: 'Pengalaman memimpin organisasi', tags: ['pengalaman'] },
      { label: 'Dekat dan dikenal warga', tags: ['kedekatan'] },
      { label: 'Punya gagasan & program baru', tags: ['gagasan'] },
      { label: 'Tegas mengambil keputusan', tags: ['ketegasan'] },
    ],
  },
  {
    id: 'ketua-2',
    question: 'Seberapa penting pengalaman organisasi sebelumnya?',
    options: [
      { label: 'Sangat penting', tags: ['pengalaman'] },
      { label: 'Cukup penting', tags: ['pengalaman', 'kedekatan'] },
      { label: 'Tidak terlalu penting', tags: ['gagasan'] },
    ],
  },
  {
    id: 'ketua-3',
    question: 'Gaya kepemimpinan seperti apa yang Anda harapkan?',
    options: [
      { label: 'Merangkul dan mendengarkan', tags: ['kedekatan', 'komunikasi'] },
      { label: 'Tegas dan terarah', tags: ['ketegasan'] },
      { label: 'Inovatif dan berani berubah', tags: ['gagasan'] },
    ],
  },
]

const WAKIL: HelperCriterion[] = [
  {
    id: 'wakil-1',
    question: 'Apa peran terpenting seorang Wakil Ketua bagi Anda?',
    options: [
      { label: 'Mendukung dan melanjutkan program Ketua', tags: ['dukungan'] },
      { label: 'Menjadi jembatan dengan warga', tags: ['kedekatan', 'komunikasi'] },
      { label: 'Siap menggantikan Ketua bila berhalangan', tags: ['pengalaman'] },
      { label: 'Membawa gagasan baru', tags: ['gagasan'] },
    ],
  },
  {
    id: 'wakil-2',
    question: 'Seberapa penting pengalaman organisasi sebelumnya?',
    options: [
      { label: 'Sangat penting', tags: ['pengalaman'] },
      { label: 'Cukup penting', tags: ['pengalaman', 'dukungan'] },
      { label: 'Tidak terlalu penting', tags: ['gagasan'] },
    ],
  },
  {
    id: 'wakil-3',
    question: 'Kualitas apa yang paling Anda cari?',
    options: [
      { label: 'Mudah diajak bekerja sama', tags: ['dukungan', 'komunikasi'] },
      { label: 'Tegas dan bisa diandalkan', tags: ['ketegasan'] },
      { label: 'Dekat dengan warga', tags: ['kedekatan'] },
    ],
  },
]

const SEKRETARIS: HelperCriterion[] = [
  {
    id: 'sekretaris-1',
    question: 'Apa yang paling Anda utamakan dari seorang Sekretaris?',
    options: [
      { label: 'Teliti dan rapi dalam administrasi', tags: ['ketelitian'] },
      { label: 'Cepat dan jelas dalam komunikasi', tags: ['komunikasi'] },
      { label: 'Dekat dan dikenal warga', tags: ['kedekatan'] },
    ],
  },
  {
    id: 'sekretaris-2',
    question: 'Seberapa penting pengalaman mengurus surat & arsip?',
    options: [
      { label: 'Sangat penting', tags: ['pengalaman', 'ketelitian'] },
      { label: 'Cukup penting', tags: ['ketelitian'] },
      { label: 'Tidak terlalu penting', tags: ['komunikasi'] },
    ],
  },
  {
    id: 'sekretaris-3',
    question: 'Cara kerja seperti apa yang Anda harapkan?',
    options: [
      { label: 'Rapi, tertib, dan terdokumentasi', tags: ['ketelitian'] },
      { label: 'Responsif dan mudah dihubungi', tags: ['komunikasi'] },
      { label: 'Inisiatif dan membawa ide baru', tags: ['gagasan'] },
    ],
  },
]

const BENDAHARA: HelperCriterion[] = [
  {
    id: 'bendahara-1',
    question: 'Apa yang paling Anda utamakan dari seorang Bendahara?',
    options: [
      { label: 'Amanah dan bisa dipercaya', tags: ['amanah'] },
      { label: 'Teliti dalam menghitung dan mencatat', tags: ['ketelitian'] },
      { label: 'Transparan dalam laporan keuangan', tags: ['amanah', 'komunikasi'] },
    ],
  },
  {
    id: 'bendahara-2',
    question: 'Seberapa penting pengalaman mengelola uang organisasi?',
    options: [
      { label: 'Sangat penting', tags: ['pengalaman', 'amanah'] },
      { label: 'Cukup penting', tags: ['amanah'] },
      { label: 'Tidak terlalu penting', tags: ['ketelitian'] },
    ],
  },
  {
    id: 'bendahara-3',
    question: 'Hal apa yang paling meyakinkan Anda?',
    options: [
      { label: 'Laporan keuangan terbuka tiap bulan', tags: ['amanah', 'komunikasi'] },
      { label: 'Pencatatan rapi dan bisa diaudit', tags: ['ketelitian'] },
      { label: 'Punya gagasan pengelolaan dana yang baik', tags: ['gagasan'] },
    ],
  },
]

const UMUM: HelperCriterion[] = [
  {
    id: 'umum-1',
    question: 'Apa yang paling Anda utamakan dari pilihan ini?',
    options: [
      { label: 'Pengalaman', tags: ['pengalaman'] },
      { label: 'Kedekatan dengan warga', tags: ['kedekatan'] },
      { label: 'Gagasan baru', tags: ['gagasan'] },
      { label: 'Ketegasan', tags: ['ketegasan'] },
    ],
  },
  {
    id: 'umum-2',
    question: 'Seberapa penting rekam jejak sebelumnya?',
    options: [
      { label: 'Sangat penting', tags: ['pengalaman'] },
      { label: 'Cukup penting', tags: ['pengalaman', 'kedekatan'] },
      { label: 'Tidak terlalu penting', tags: ['gagasan'] },
    ],
  },
  {
    id: 'umum-3',
    question: 'Cara kerja seperti apa yang Anda harapkan?',
    options: [
      { label: 'Merangkul dan mendengarkan', tags: ['kedekatan', 'komunikasi'] },
      { label: 'Tegas dan terarah', tags: ['ketegasan'] },
      { label: 'Inovatif dan berani berubah', tags: ['gagasan'] },
    ],
  },
]

/**
 * Daftar pertanyaan kriteria berdasarkan judul pertanyaan voting.
 * Urutan penting: "Wakil Ketua" mengandung kata "Ketua", jadi 'wakil'
 * harus diperiksa lebih dulu.
 */
export function criteriaFor(title: string): HelperCriterion[] {
  const t = title.toLowerCase()
  if (t.includes('wakil')) return WAKIL
  if (t.includes('sekretaris')) return SEKRETARIS
  if (t.includes('bendahara')) return BENDAHARA
  if (t.includes('ketua')) return KETUA
  return UMUM
}

/** Ringkasan kriteria yang paling sering muncul dari jawaban pengunjung (maks. 3). */
export function summarizeCriteria(answers: HelperAnswer[]): string[] {
  const count = new Map<string, number>()
  for (const a of answers) for (const tag of a.tags) count.set(tag, (count.get(tag) ?? 0) + 1)
  return [...count.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([tag]) => TAG_LABELS[tag] ?? tag)
}

/**
 * Rekomendasi lokal: pilihan aktif yang paling banyak dipilih sejauh ini
 * (seri → urutan pertama di daftar). Jujur soal dasarnya lewat `basis`.
 */
export function recommendOption(options: string[], counts: Record<string, number>, total: number): Recommendation | null {
  if (options.length === 0) return null
  let best = options[0]
  let bestVotes = counts[best] ?? 0
  for (const o of options.slice(1)) {
    const v = counts[o] ?? 0
    if (v > bestVotes) {
      best = o
      bestVotes = v
    }
  }
  return {
    label: best,
    votes: bestVotes,
    total,
    basis:
      bestVotes > 0
        ? `Dipilih ${bestVotes} dari ${total} pengisi sejauh ini`
        : 'Belum ada suara masuk untuk pertanyaan ini — menampilkan pilihan pertama dari daftar',
  }
}
