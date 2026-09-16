# FORMA — POS & operasional gym

**[Buka demo interaktif](https://patrickplj.github.io/gym-pos/)** — langsung coba dari browser, tanpa instalasi atau akun. FORMA adalah nama sementara yang bisa diganti di Pengaturan.

Demo ini dibuat untuk meninjau alur operasional gym: membership, kasir, kunjungan, personal training, stok, dan laporan. Semua data awal adalah contoh fiktif. **Gunakan nama, nomor telepon, dan transaksi fiktif selama mencoba; jangan masukkan data pribadi atau operasional asli.** Ini belum siap untuk operasional produksi.

## Coba dalam 5 langkah

1. Buka demo, lihat Dashboard, lalu bandingkan pendapatan Hari ini dan Bulan ini.
2. Buka Member, tambah member fiktif dengan nomor WhatsApp contoh yang berbeda. Isi jenis pelanggan, foto opsional, paket, tanggal mulai, dan tanggal expired bila sudah memiliki akses. Pilih Non-member bila belum membeli akses.
3. Untuk pembayaran baru, buka Kasir / POS, pilih member, tambahkan paket membership, lalu catat pembayaran percobaan. Periksa masa aktif dan struk. Tanggal yang diisi lewat form member tidak menambah pendapatan.
4. Buka profil member → Kartu member → Unduh kartu PNG. Di Check-in, pilih gambar kartu tadi atau salin kode untuk mencoba check-in. Kamera dan scanner USB juga tersedia; member expired, dibekukan, dan check-in berulang pada hari yang sama ditolak. QRIS/transfer tetap pencatatan manual; jangan melakukan pembayaran sungguhan.
5. Coba Personal Trainer, Kas & Pengeluaran, serta Laporan. Catat halaman, langkah, dan hasil yang ingin diperbaiki. Pengaturan menyediakan ekspor backup dan reset data demo dengan konfirmasi.

Checklist lengkap tersedia di [WORKFLOWS.md](./WORKFLOWS.md). Setiap browser mendapat data demo sendiri: perubahan teman tidak mengubah data orang lain.

## Yang bisa dicoba

- Dashboard pendapatan harian/bulanan dan rincian metode pembayaran.
- Kasir membership, personal training, daily pass, dan produk; diskon, kembalian, serta struk cetak browser.
- Profil member dengan tanggal mulai/expired, jenis pelanggan, tanggal lahir, jenis kelamin, alamat, foto, serta perubahan masa aktif dengan alasan audit.
- Kartu member QR yang dapat diunduh PNG atau dicetak/disimpan PDF melalui dialog browser.
- Check-in lewat kode/ID, scanner USB, gambar QR, atau kamera; perpanjangan, freeze, dan pengingat yang bisa disalin.
- Booking PT, pemeriksaan bentrok jadwal, serta pencadangan/pengurangan kredit sesi.
- Produk, stok, pembelian ke pemasok, staf, paket, dan pengumuman.
- Pengeluaran, buka/tutup shift, rekonsiliasi kas, laporan CSV, serta backup/impor JSON.

Data awal berisi **22 member fiktif**, 6 paket, 8 produk, 3 trainer, 3 pemasok, dan contoh transaksi. Tanggal demo mengikuti hari pertama data dibuat.

## Batas demo

Data tersimpan di localStorage **satu browser, satu perangkat, satu tab yang menulis**. Refresh mempertahankan data, tetapi menghapus data browser akan menghapus catatan lokal. Belum ada database server, sinkronisasi antarperangkat, login/izin staf, atau backup otomatis. Simpan backup jika hasil percobaan ingin dipertahankan.

Tunai, QRIS, dan transfer hanya pencatatan manual. Tidak ada pemrosesan pembayaran, QR pembayaran, verifikasi bank, penagihan otomatis, pengiriman WhatsApp, atau kontrol gate. Daftar staf belum memberikan pembatasan akses. Cetak menggunakan dialog browser; printer termal belum diintegrasikan. QR member adalah identitas untuk pencatatan kunjungan oleh resepsionis, bukan QR pembayaran, login, atau kunci gate.

Pembatalan hanya seluruh transaksi pada shift berjalan jika benefit member belum digunakan atau berubah. Tidak ada refund parsial, pengembalian dana ke bank, atau pembatalan transaksi historis contoh. Arus kas bersih di laporan bukan laba akuntansi.

## Kartu member dan foto

QR hanya memuat token member; tidak berisi nama, nomor WhatsApp, alamat, atau tanggal lahir. Masa aktif diperiksa dari data terkini, sehingga kode tetap sama setelah perpanjangan. Tanggal pada kartu yang sudah diunduh tidak berubah otomatis: unduh ulang untuk memperbarui cetakannya.

Kartu dapat ditunjukkan dari ponsel atau hasil cetak, tetapi aplikasi resepsionis harus memiliki data member tersebut. Browser lain pada demo ini tidak otomatis mengenal member baru yang dibuat di perangkat berbeda. Gunakan ekspor/impor backup untuk memindahkan data percobaan secara sengaja.

Foto dipilih atau diambil atas tindakan pengguna, dikecilkan maksimal 480 piksel, lalu diubah menjadi JPEG agar metadata foto asli tidak ikut disimpan. Pemrosesan foto dan gambar QR berlangsung di browser, tanpa mengunggahnya ke layanan lain. Kamera hanya dimulai melalui tombol Scan dengan kamera dan berhenti setelah hasil terbaca, dialog ditutup, tab disembunyikan, atau halaman diganti. Jika izin ditolak, gunakan gambar QR atau kode manual.

Pemindaian kamera fisik dan scanner USB perlu dicoba pada perangkat gym sebelum digunakan; belum dianggap tervalidasi hanya dari tes decoder.

## Pengembangan dan pengujian

Aplikasi menggunakan HTML, CSS, dan JavaScript tanpa framework, build step, atau dependensi npm. GitHub Pages menyajikan berkas statis dari branch `main`. Font Manrope dan Plus Jakarta Sans disimpan di `assets/fonts/` beserta lisensi OFL; aplikasi tidak memerlukan CDN atau Google Fonts saat berjalan. Generator QR dan jsQR juga disimpan lokal dengan lisensi masing-masing di `assets/vendor/`.

Untuk menjalankan pengujian logika, gunakan Node.js dari folder repository:

```sh
node --test tests/*.test.js
```

Suite mencakup pembayaran, kegagalan simpan atomik, stok, masa aktif inklusif, freeze, duplikasi, kredit/jadwal PT, diskon, rekonsiliasi kas, pembatalan aman, backup rusak, pergantian hari Jakarta, migrasi profil lama, QR yang stabil, dan decoder QR.

| File | Isi |
| --- | --- |
| `index.html`, `styles.css`, `app.js` | Tampilan dan interaksi aplikasi |
| `store.js` | Model data, aturan transaksi, validasi, penyimpanan |
| `member-qr.js`, `assets/vendor/` | Generator, pembaca QR lokal, kartu PNG, serta pustaka dan lisensinya |
| `tests/*.test.js` | Pengujian logika bisnis dan modul QR |
| `CORE-API.md` | Kontrak antara model data dan tampilan |
| `WORKFLOWS.md` | Riset workflow, cakupan fitur, checklist review |

Alur dikembangkan dari referensi operasional serta dokumentasi resmi GymMaster, ABC Glofox, dan Mindbody. Tautan sumber dan pilihan implementasi tersedia di dokumen workflow.
