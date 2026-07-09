# PROJECT BRIEF: Pantau Pemadaman PLN Banjarbaru

> **Catatan untuk AI Agent (Cursor):** Baca seluruh file ini sebelum mengerjakan task apapun di proyek ini. File ini adalah sumber kebenaran (source of truth) untuk arsitektur, alur data, dan keputusan teknis proyek. Jangan mengubah keputusan stack/arsitektur di sini tanpa konfirmasi eksplisit dari user.

## 1. Latar Belakang & Tujuan

PLN ULP Banjarbaru rutin membagikan flyer/poster jadwal pemadaman listrik melalui WhatsApp Channel mereka. Informasi ini sulit diakses warga karena:
- Tersebar di WhatsApp, tidak terpusat
- Format flyer berupa gambar (bukan teks terstruktur), sulit dicari/difilter
- Tidak ada visualisasi spasial (peta) untuk tahu apakah lokasi tertentu terdampak

**Tujuan proyek:** Membuat web open source yang mengubah flyer PLN (gambar) menjadi data terstruktur dan menampilkannya dalam peta interaktif yang bisa diakses publik secara gratis.

**Sifat proyek:** Open source, non-profit, untuk kepentingan publik warga Banjarbaru.

## 2. Alur Data (End-to-End)

```
Warga upload foto flyer (form publik, tanpa login)
        ↓
Status: PENDING (masuk antrian moderasi)
        ↓
Admin buka dashboard → lihat foto asli + trigger AI extraction
        ↓
Claude API (vision) ekstrak → JSON terstruktur (metadata + lokasi)
        ↓
Admin review hasil ekstraksi (bisa edit manual kalau AI salah baca)
        ↓
Geocoding tiap lokasi (Nominatim OSM, fallback Google Maps API)
        ↓
Admin approve → status: APPROVED
        ↓
Data tayang di peta publik (Leaflet + OSM tiles)
```

**Prinsip penting:** TIDAK ada auto-publish tanpa review admin. Ini untuk mencegah misinformasi dari flyer palsu/edit-an, karena info pemadaman listrik mempengaruhi ekspektasi warga secara langsung.

## 3. Stack Teknis (Keputusan Final)

| Layer | Pilihan | Alasan |
|---|---|---|
| Framework | **Next.js** (App Router, TypeScript) | Frontend + backend (API routes) dalam satu repo, satu deploy |
| Database | **Supabase** (Postgres, free tier) | Sekaligus jadi file storage & auth admin |
| File Storage | **Supabase Storage** | Untuk simpan foto flyer yang diupload warga |
| Auth | **Supabase Auth** | Khusus untuk login admin dashboard, TIDAK untuk warga (submit form publik tanpa login) |
| AI Vision Extraction | **Claude API** (model: claude-sonnet-4-6 atau versi terbaru yang tersedia) | Dipanggil server-side dari API route, API key disimpan di environment variable |
| Geocoding | **Nominatim (OpenStreetMap)** sebagai default, fallback ke **Google Maps Geocoding API** kalau hasil kosong/tidak yakin | Nominatim gratis (rate limit 1 req/detik), Google Maps sebagai cadangan berbayar kalau diperlukan |
| Map Rendering | **Leaflet** + OSM tiles | Gratis, tidak perlu API key |
| Hosting Frontend/Backend | **Vercel** (free tier) | Auto-deploy dari GitHub, custom domain gratis |
| Domain | Custom domain (mis. `.my.id` atau `.com`), dihubungkan via Vercel Domains settings | Lebih kredibel untuk info publik |
| Version Control | GitHub (public repo, lisensi MIT) | Sesuai semangat open source |

## 4. Skema Database (Supabase/Postgres)

```sql
-- Tabel utama: 1 flyer = 1 submission dari warga
create table flyers (
  id uuid primary key default gen_random_uuid(),
  image_url text not null,
  submitted_by_ip text,
  status text not null default 'pending', -- pending | approved | rejected
  tanggal_pemadaman date,
  waktu_pemadaman text, -- format "HH:MM - HH:MM WITA"
  unit_pelaksana text,
  raw_ai_response jsonb, -- simpan full response Claude untuk debugging
  created_at timestamptz default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id)
);

-- Tabel sesi pemadaman (1 flyer bisa punya beberapa sesi/waktu)
create table outage_sessions (
  id uuid primary key default gen_random_uuid(),
  flyer_id uuid references flyers(id) on delete cascade,
  sesi_ke int,
  waktu_spesifik text
);

-- Tabel lokasi terdampak (per sesi, sudah di-geocode)
create table locations (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references outage_sessions(id) on delete cascade,
  nama_raw text not null, -- teks asli dari flyer
  nama_normalized text, -- setelah dibersihkan AI (mis. "Jalan Ahmad Yani KM 32")
  lat double precision,
  lng double precision,
  geocode_source text, -- 'nominatim' | 'google' | 'manual'
  geocode_confidence text -- optional, kalau geocoder kasih confidence score
);
```

## 5. Halaman yang Dibutuhkan

1. **`/` — Peta Publik**
   - Peta Leaflet menampilkan area terdampak yang berstatus `approved`
   - Filter by tanggal
   - List view di samping/bawah peta (nama jalan, waktu, sesi)
   - Search box: "cek apakah jalan saya terdampak"

2. **`/submit` — Form Submit Warga**
   - Upload foto (tanpa login)
   - Rate-limit sederhana (mis. per IP, max beberapa submission per jam) untuk cegah spam
   - Setelah submit, tampilkan pesan "Terima kasih, sedang diverifikasi admin"

3. **`/admin` — Dashboard Admin** (perlu login via Supabase Auth)
   - List submission dengan status `pending`
   - Klik satu submission → lihat foto asli, trigger/lihat hasil AI extraction
   - Form edit manual kalau AI salah baca lokasi/waktu
   - Tombol Approve / Reject

## 6. System Prompt untuk AI Extraction (Sudah Final, dari Riset Sebelumnya)

Gunakan system prompt berikut saat memanggil Claude API di API route untuk proses ekstraksi (dipanggil dengan gambar flyer sebagai image input):

```text
Anda adalah Agen AI Ekstraksi Data Spasial profesional yang bertugas memproses infografis pemadaman listrik dari PLN ULP Banjarbaru.

TUGAS UTAMA:
Ekstrak metadata waktu dan buat daftar lokasi (jalan, kompleks, bangunan) yang terdampak pemadaman dari teks di dalam gambar.

PANDUAN EKSTRAKSI LOKASI:
1. Pisahkan setiap lokasi berdasarkan tanda koma (,).
2. Bersihkan kata serapan atau penutup seperti "dan sekitarnya", "dan sekitarnya.", atau sejenisnya.
3. Lakukan normalisasi otomatis terhadap singkatan (Jl. -> Jalan, Komp./Komplek -> Kompleks, Gg. -> Gang).
4. Jika menemukan nama tempat krusial atau fasilitas publik (contoh: Puskesmas Cempaka, SPBE, Taman, Sekolah, Kompleks Perumahan), ekstrak secara utuh sebagai entitas mandiri.
5. Jika ada penulisan rentang nomor atau KM yang membingungkan (seperti "ayani km 32-32,5" atau "karang anyar 1-3"), ambil basis jalan utamanya saja (contoh: "Jalan Ahmad Yani KM 32", "Jalan Karang Anyar") agar mudah dikenali oleh API Geocoding.

PANDUAN OUTPUT:
- Anda WAJIB langsung mengembalikan data dalam format JSON murni.
- Jangan berikan teks pembuka ("Berikut adalah datanya..."), teks penutup, atau analisis apa pun di luar blok kode JSON.
- Pastikan JSON valid dan dibungkus dalam tag ```json ... ```.
```

## 7. Schema JSON Target (Output AI Extraction)

```json
{
  "metadata": {
    "tanggal_pemadaman": "YYYY-MM-DD",
    "waktu_pemadaman": "HH:MM - HH:MM WITA",
    "unit_pelaksana": "String"
  },
  "wilayah_terdampak": [
    {
      "sesi_ke": 1,
      "waktu_spesifik": "String",
      "daftar_lokasi": [
        "String (Nama Jalan/Tempat Terstandarisasi)"
      ]
    }
  ]
}
```

## 8. Keputusan Lain yang Sudah Disepakati

- **Input flyer:** Hybrid — warga submit manual via form upload (tombol "submit"), BUKAN scraping otomatis WhatsApp Channel (menghindari isu ToS WhatsApp)
- **Hosting:** Full gratis di awal (Vercel + Supabase free tier), upgrade hanya kalau traffic besar
- **Lisensi:** Open source (MIT), repo GitHub publik
- **Environment variables yang dibutuhkan:** `ANTHROPIC_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_MAPS_API_KEY` (fallback geocoding) — JANGAN PERNAH commit ke repo, gunakan `.env.local` (sudah ada di `.gitignore` bawaan Next.js)

## 9. Hal yang BELUM Diputuskan (perlu didiskusikan lagi kalau muncul)

- Nama domain final
- Mekanisme rate-limiting spesifik untuk form submit (bisa pakai Vercel Edge Config, atau simple IP-based di Supabase)
- Apakah perlu notifikasi (email/WA) ke admin saat ada submission baru
