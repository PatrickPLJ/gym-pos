# FORMA — POS & operasional gym

**[Buka demo interaktif](https://patrickplj.github.io/gym-pos/)** — langsung coba dari browser, tanpa instalasi atau akun. FORMA adalah nama sementara yang bisa diganti di Pengaturan.

Demo ini dibuat untuk meninjau alur operasional gym: membership, kasir, kunjungan, personal training, stok, dan laporan. Semua data awal adalah contoh fiktif. **Gunakan nama, nomor telepon, dan transaksi fiktif selama mencoba; jangan masukkan data pribadi atau operasional asli.** Ini belum siap untuk operasional produksi.

## Coba dalam 5 langkah

1. Buka demo, lihat Dashboard, lalu bandingkan pendapatan Hari ini dan Bulan ini.
2. Buka Member, tambah member fiktif dengan nomor telepon contoh yang berbeda dari data yang ada.
3. Buka Kasir / POS, pilih member tadi, tambahkan paket membership, lalu catat pembayaran percobaan. Periksa masa aktif dan struk.
4. Buka Check-in untuk member tadi, kemudian coba beli produk dan lihat perubahan stok. QRIS/transfer hanya simulasi pencatatan manual; jangan melakukan pembayaran sungguhan.
5. Coba Personal Trainer, Kas & Pengeluaran, serta Laporan. Catat halaman, langkah, dan hasil yang ingin diperbaiki. Pengaturan menyediakan ekspor backup dan reset data demo dengan konfirmasi.

Checklist lengkap tersedia di [WORKFLOWS.md](./WORKFLOWS.md). Setiap browser mendapat data demo sendiri: perubahan teman tidak mengubah data orang lain.

## Yang bisa dicoba

- Dashboard pendapatan harian/bulanan dan rincian metode pembayaran.
- Kasir membership, personal training, daily pass, dan produk; diskon, kembalian, serta struk cetak browser.
- Profil member, perpanjangan, freeze, check-in, dan teks pengingat yang bisa disalin.
- Booking PT, pemeriksaan bentrok jadwal, serta pencadangan/pengurangan kredit sesi.
- Produk, stok, pembelian ke pemasok, staf, paket, dan pengumuman.
- Pengeluaran, buka/tutup shift, rekonsiliasi kas, laporan CSV, serta backup/impor JSON.

Data awal berisi **22 member fiktif**, 6 paket, 8 produk, 3 trainer, 3 pemasok, dan contoh transaksi. Tanggal demo mengikuti hari pertama data dibuat.

## Batas demo

Data tersimpan di localStorage **satu browser, satu perangkat, satu tab yang menulis**. Refresh mempertahankan data, tetapi menghapus data browser akan menghapus catatan lokal. Belum ada database server, sinkronisasi antarperangkat, login/izin staf, atau backup otomatis. Simpan backup jika hasil percobaan ingin dipertahankan.

Tunai, QRIS, dan transfer hanya pencatatan manual. Tidak ada pemrosesan pembayaran, QR pembayaran, verifikasi bank, penagihan otomatis, pengiriman WhatsApp, atau kontrol gate. Daftar staf belum memberikan pembatasan akses. Cetak menggunakan dialog browser; printer termal belum diintegrasikan.

Pembatalan hanya seluruh transaksi pada shift berjalan jika benefit member belum digunakan atau berubah. Tidak ada refund parsial, pengembalian dana ke bank, atau pembatalan transaksi historis contoh. Arus kas bersih di laporan bukan laba akuntansi.

## Pengembangan dan pengujian

Aplikasi menggunakan HTML, CSS, dan JavaScript tanpa framework, build step, atau dependensi npm. GitHub Pages menyajikan berkas statis dari branch `main`. Font Manrope dan Plus Jakarta Sans disimpan di `assets/fonts/` beserta lisensi OFL; aplikasi tidak memerlukan CDN atau Google Fonts saat berjalan.

Untuk menjalankan pengujian logika, gunakan Node.js dari folder repository:

```sh
node --test tests/store.test.js
```

Suite mencakup 16 tes untuk pembayaran, kegagalan simpan atomik, stok, masa aktif inklusif, freeze, duplikasi, kredit/jadwal PT, diskon, rekonsiliasi kas, pembatalan aman, backup rusak, dan pergantian hari Jakarta.

| File | Isi |
| --- | --- |
| `index.html`, `styles.css`, `app.js` | Tampilan dan interaksi aplikasi |
| `store.js` | Model data, aturan transaksi, validasi, penyimpanan |
| `tests/store.test.js` | Pengujian logika bisnis tanpa dependensi |
| `CORE-API.md` | Kontrak antara model data dan tampilan |
| `WORKFLOWS.md` | Riset workflow, cakupan fitur, checklist review |

Alur dikembangkan dari referensi operasional serta dokumentasi resmi GymMaster, ABC Glofox, dan Mindbody. Tautan sumber dan pilihan implementasi tersedia di dokumen workflow.
