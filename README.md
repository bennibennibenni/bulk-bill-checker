# BulkBillChecker 🇮🇩
> **Aplikasi Pengecekan Tagihan Utilitas Massal (Bulk Inquiry) Cepat, Akurat & Terintegrasi**

[![Node.js Version](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express-4.21.2-blue.svg)](https://expressjs.com/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.x-38bdf8.svg)](https://tailwindcss.com/)
[![Vercel Ready](https://img.shields.io/badge/Deployment-Vercel-black.svg)](https://vercel.com/)

**BulkBillChecker** adalah solusi web modern yang dirancang untuk pemilik kost/kontrakan, pengelola gedung/kantor, divisi keuangan/operasional, agen PPOB, maupun pengguna perorangan untuk mengecek tagihan utilitas puluhan hingga ratusan akun sekaligus dalam satu kali klik.

Mendukung 4 kategori utilitas utama di Indonesia:
- ⚡ **PLN Pascabayar**: Tagihan listrik bulanan, daya (VA), golongan tarif, stand meter & estimasi kWh.
- 💧 **PDAM**: Sambungan air bersih multi-wilayah (termasuk PAM Batam / Air Batam Hilir, PDAM Padang, DKI Jakarta PAM Jaya, Surabaya, Bandung, Medan, Semarang, dll.).
- 🌐 **Indihome / Telkom**: Layanan internet fiber, telepon rumah (PSTN), UseeTV / Indihome TV, deteksi status lunas/tagihan berjalan.
- 🩺 **BPJS Kesehatan**: Iuran bulanan mandiri / keluarga (Kelas 1, Kelas 2, Kelas 3), jumlah anggota keluarga, dan status pembayaran.

---

## 🌟 Fitur Utama

### 1. Multi-Biller Inquiry Massal (Hingga 500 Baris)
* Cek tagihan gabungan PLN, PDAM, Indihome, dan BPJS sekaligus dalam satu proses inquiry.
* Menggunakan antrean pemrosesan dengan batas konkurensi cerdas agar responsif dan andal.

### 2. Live Biller Gateway Engine
* Terintegrasi langsung dengan Live Gateway untuk pengecekan data riil: nama pelanggan resmi, periode tagihan berjalan, rincian biaya pokok, denda, dan biaya admin.
* Deteksi otomatis untuk akun yang sudah berstatus **LUNAS / NIHIL** atau tagihan belum terbit.

### 3. Dua Mode Input Fleksibel
* **Input Manual / Batch Text**: Salin dan tempel (copy-paste) puluhan baris nomor pelanggan langsung ke kotak input teks (pemisah koma, titik koma, atau spasi/tab).
* **Upload File Excel (.xlsx, .xls) & CSV (.csv)**: Drag-and-drop file spreadsheet dengan auto-mapping kolom pintar (mengenali berbagai format penamaan header seperti `Tipe`, `ID_Pelanggan`, `Wilayah`, `Catatan`).

### 4. 1-Klik Muat Data Contoh (Demo 15 Akun)
* Tombol uji coba instan dengan 15 akun contoh nyata lintas biller (PLN, PAM Batam, Indihome, BPJS) tanpa perlu menyiapkan file terlebih dahulu.

### 5. Download Template Resmi
* Unduh template siap pakai langsung dari aplikasi dalam format `.xlsx` (dilengkapi sheet referensi kode wilayah PDAM) atau `.csv`.

### 6. Dashboard Interaktif & Filter Canggih
* **5 Kartu KPI**: Total Tagihan Tertunggak, Breakdown Biaya Listrik PLN, Air PDAM, Internet Indihome, dan Iuran BPJS.
* **Filter Multidimensi**: Filter berdasarkan teks pencarian (ID/Nama/Catatan), kategori biller, dan status pembayaran (*Unpaid*, *Paid*, *Failed*).
* **Modal Rincian Tagihan**: Klik tombol aksi untuk melihat informasi rinci tiap akun (Tarif/Daya, Stand Meter, Jumlah Peserta BPJS, Rincian Denda & Admin).

### 7. Export Laporan ke Excel (.xlsx)
* Hasil inquiry dapat diexport kembali ke file Excel terformat rapi dengan kolom lengkap (*ID Pelanggan, Nama, Catatan/Unit, Periode, Tagihan Pokok, Denda, Admin, Total, Status*).

### 8. Cetak Laporan Resmi (Print to Landscape A4)
* Disediakan tombol **Print Table** dengan styling `@media print` khusus: menyembunyikan navigasi, menyesuaikan margin, format orientasi landscape, dan header laporan resmi siap cetak atau simpan sebagai PDF.

---

## 🚀 Panduan Memulai (Quick Start)

### Prasyarat
* **Node.js** v18.0.0 atau lebih baru terpasang di sistem Anda ([Unduh Node.js](https://nodejs.org/)).
* Terminal / PowerShell / Command Prompt.

### 1. Masuk ke Folder Proyek
```bash
cd bulk-bill-checker
```

### 2. Instal Dependensi
```bash
npm install
```

### 3. Konfigurasi Environment (Opsional)
Duplikasi file `.env.example` menjadi `.env` jika ingin mengubah port server:
```bash
cp .env.example .env
```
Isi konfigurasi `.env`:
```env
PORT=3000
BILLER_MODE=LIVE
```

### 4. Jalankan Aplikasi
* **Mode Produksi**:
  ```bash
  npm start
  ```
* **Mode Development (Hot-Reload)**:
  ```bash
  npm run dev
  ```

### 5. Buka di Browser
Akses URL berikut pada peramban Anda:
👉 **http://localhost:3000**

---

## 📂 Format Data Input

### A. Format File Excel (.xlsx / .xls) dan CSV (.csv)
Format kolom yang disarankan pada spreadsheet:

| Tipe | ID_Pelanggan | Wilayah_PDAM | Catatan |
|---|---|---|---|
| PLN | 531234567890 | | Kamar Kost 101 |
| PLN | 531234567891 | | Rumah Utama |
| PDAM | 1029384 | PDAM_JKT | Kantor Cabang Jakarta |
| PDAM | 2039485 | PDAM_SBY | Gudang Logistik Surabaya |
| INDIHOME | 122333444455 | | Wifi Kantor Utama |
| INDIHOME | 02187654321 | | Telepon Kabel PTSN |
| BPJS | 0001234567890 | | BPJS Keluarga Karyawan |

> **Catatan Header:** Sistem memiliki auto-mapping fleksibel. Nama header dapat berupa `Tipe`/`Category`/`Biller`, `ID`/`ID_Pelanggan`/`Nomor_Meter`/`No_Pelanggan`, `Wilayah`/`Region`, dan `Catatan`/`Note`/`Unit`.

### B. Format Manual / Batch Text
Pada tab *Manual Input*, masukkan satu baris per akun dengan format:
```text
KATEGORI, ID_PELANGGAN, [CATATAN / UNIT]
```
**Contoh Input:**
```text
PLN, 531234567890, Kamar Kost 101
PLN, 531234567891, Rumah Tinggal
PDAM, 1029384, Tagihan Air Kantor
INDIHOME, 122333444455, Wifi Lt 2
BPJS, 0001234567890, BPJS Mandiri
```

---

## 💧 Kode Wilayah PDAM yang Didukung

| Kode Wilayah | Nama PDAM / Penyedia | Provinsi |
|---|---|---|
| `PDAM_BTM` | PAM Batam (Air Batam Hilir) *(Live Endpoint)* | Kepulauan Riau |
| `PDAM_PDG` | PDAM Kota Padang *(Live Endpoint)* | Sumatera Barat |
| `PDAM_JKT` | PAM Jaya DKI Jakarta | DKI Jakarta |
| `PDAM_SBY` | Kota Surabaya (Surya Sembada) | Jawa Timur |
| `PDAM_BDG` | Kota Bandung (Tirtawening) | Jawa Barat |
| `PDAM_KAB_BDG` | Kab. Bandung (Tirta Raharja) | Jawa Barat |
| `PDAM_SMG` | Kota Semarang (Tirta Moedal) | Jawa Tengah |
| `PDAM_MDN` | Kota Medan (Tirtanadi) | Sumatera Utara |
| `PDAM_MKS` | Kota Makassar | Sulawesi Selatan |
| `PDAM_TNG` | Kota Tangerang (Tirta Benteng) | Banten |
| `PDAM_BKS` | Kota Bekasi (Tirta Patriot) | Jawa Barat |
| `PDAM_BGR` | Kab. Bogor (Tirta Kahuripan) | Jawa Barat |
| `PDAM_DPS` | Kota Denpasar | Bali |
| `PDAM_MLG` | Kota Malang (Tugu Tirta) | Jawa Timur |
| `PDAM_SLM` | Kab. Sleman (Tirta Marta) | DI Yogyakarta |
| `PDAM_PLB` | Kota Palembang (Tirta Musi) | Sumatera Selatan |
| `PDAM_BPN` | Kota Balikpapan | Kalimantan Timur |

---

## 🔌 Dokumentasi REST API

Aplikasi ini dilengkapi API backend yang dapat diintegrasikan dengan aplikasi lain:

| Endpoint | Method | Deskripsi | Parameter / Payload |
|---|---|---|---|
| `/api/inquiry/bulk` | `POST` | Melakukan inquiry massal hingga 500 akun | JSON body: `{ "items": [ { "type": "PLN", "customerId": "...", "region": "...", "note": "..." } ], "concurrency": 3 }` |
| `/api/upload` | `POST` | Mengunggah & membaca file Excel/CSV | `multipart/form-data` dengan field `file` |
| `/api/template/excel` | `GET` | Unduh template resmi Excel (.xlsx) | Dilengkapi sheet 1 (*Daftar Tagihan*) dan sheet 2 (*Kode Wilayah PDAM*) |
| `/api/template/csv` | `GET` | Unduh template standar CSV (.csv) | File teks CSV terstruktur |
| `/api/export/excel` | `POST` | Export hasil pengecekan ke file Excel (.xlsx) | JSON body: `{ "results": [...] }` |
| `/api/pdam-list` | `GET` | Mengambil daftar kode wilayah PDAM | Respons JSON daftar wilayah & provinsi |

---

## 📁 Struktur Direktori

```text
bulk-bill-checker/
├── api/
│   └── index.js              # Serverless entry point untuk Vercel
├── public/
│   └── index.html            # Antarmuka web (Tailwind CSS, Lucide icons, print layout)
├── services/
│   └── billerService.js      # Core logic inquiry (Live Gateway, parser, formatting)
├── .env.example              # Contoh konfigurasi environment
├── .gitignore                # Aturan file yang diabaikan git
├── package.json              # Metadata proyek & skrip npm
├── README.md                 # Dokumentasi proyek
├── server.js                 # Server Express & endpoint REST API
├── Template_Tagihan_Bulk_Contoh.xlsx  # Template input Excel
├── Template_Tagihan_Bulk_Contoh.csv   # Template input CSV
└── vercel.json               # Konfigurasi deployment Vercel
```

---

## ☁️ Deployment ke Vercel

Proyek ini sudah dilengkapi file konfigurasi `vercel.json` dan `api/index.js` untuk deployment zero-config:

1. Pastikan Anda memiliki akun [Vercel](https://vercel.com/) dan Vercel CLI (`npm i -g vercel`).
2. Jalankan perintah:
   ```bash
   vercel
   ```
3. Ikuti instruksi di terminal. Aplikasi akan langsung aktif secara daring di cloud serverless environment.

---

## 📄 Lisensi

Didistribusikan di bawah lisensi MIT. Bebas digunakan untuk keperluan pribadi, manajemen properti komersial, maupun pengembangan lanjutan.

