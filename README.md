# Pantau Pemadaman PLN Banjarbaru

Aplikasi web open source untuk memantau jadwal pemadaman listrik PLN ULP Banjarbaru, dibangun dari flyer/poster resmi yang diproses menggunakan AI menjadi data terstruktur, lalu ditampilkan dalam bentuk dashboard, peta, dan ringkasan laporan dampak dari warga.

**Live:** [pantaupln.warga.io](https://pantaupln.warga.io)

## Latar Belakang

PLN ULP Banjarbaru rutin membagikan informasi jadwal pemadaman listrik melalui WhatsApp Channel dalam bentuk poster/gambar. Informasi ini sulit diakses secara terpusat, sulit dicari, dan tidak ada visualisasi spasial untuk mengetahui area mana saja yang terdampak. Proyek ini lahir untuk menjawab masalah tersebut secara sederhana dan terbuka.

## Fitur

- **Ekstraksi otomatis** — poster pemadaman diproses menggunakan Claude Vision API untuk mengambil metadata waktu dan daftar lokasi terdampak secara terstruktur
- **Normalisasi lokasi** — pembersihan typo dan penggabungan variasi penulisan nama jalan secara otomatis
- **Geocoding** — konversi nama lokasi menjadi koordinat peta (Nominatim/OpenStreetMap, dengan cache dan fallback estimasi AI ketika data tidak tersedia)
- **Dashboard publik** — ringkasan pemadaman hari ini, statistik area terdampak, area yang paling sering/lama padam, dan peta interaktif
- **#SuaraWarga** — warga dapat melaporkan dampak pemadaman (kerugian usaha, gangguan WFH, dll), dengan ringkasan otomatis harian menggunakan AI
- **Panel admin** — verifikasi manual sebelum data tayang publik, dengan opsi auto-approve

## Stack Teknis

- **Framework:** Next.js (App Router, TypeScript)
- **Database & Storage:** Supabase (Postgres, Storage, Auth)
- **AI:** Claude API (ekstraksi gambar, normalisasi teks, ringkasan laporan warga)
- **Peta:** Leaflet + OpenStreetMap
- **Geocoding:** Nominatim (OpenStreetMap)
- **Styling:** Tailwind CSS
- **Hosting:** Vercel

## Menjalankan Secara Lokal

### Prasyarat

- Node.js 18+
- Akun [Supabase](https://supabase.com) (gratis)
- API key [Anthropic](https://console.anthropic.com)

### Instalasi

```bash
git clone https://github.com/hakikishandika/pantau-pln.git
cd pantau-pln
npm install
```

### Environment Variables

Salin `.env.local.example` menjadi `.env.local`, lalu isi:

```
ANTHROPIC_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GOOGLE_MAPS_API_KEY=
CRON_SECRET=
```

### Setup Database

Jalankan skema SQL yang tersedia di `PROJECT_BRIEF.md` melalui Supabase SQL Editor untuk membuat seluruh tabel dan Row Level Security policy yang dibutuhkan.

### Jalankan Dev Server

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000).

## Struktur Proyek

Lihat `PROJECT_BRIEF.md` untuk dokumentasi lengkap arsitektur, skema database, dan alur data.

## Kontribusi

Proyek ini terbuka untuk kontribusi. Silakan buka issue atau pull request. Beberapa arah pengembangan yang masih terbuka:

- Perbaikan akurasi geocoding untuk wilayah dengan cakupan OpenStreetMap terbatas
- Otomasi ingest poster dari WhatsApp Channel
- Perluasan ke wilayah PLN lain di luar Banjarbaru

## Lisensi

Proyek ini menggunakan lisensi MIT — lihat file [LICENSE](./LICENSE) untuk detail lengkap.

## Disclaimer

Data pada aplikasi ini diekstrak dari poster PLN menggunakan bantuan AI dan divalidasi manual oleh admin sebelum tayang, namun tetap ada kemungkinan kekeliruan. Gunakan sebagai referensi, bukan acuan mutlak — untuk kepastian silakan hubungi PLN ULP Banjarbaru secara langsung.

## Kredit

Dikembangkan secara mandiri oleh [@shandikaraja](https://www.linkedin.com/in/shandikaraja/), tidak berkaitan dengan institusi tempat penulis bekerja.
