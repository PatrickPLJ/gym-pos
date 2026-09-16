# FORMA — workflow & panduan review

Dokumen ini memetakan enam foto referensi pemilik gym ke versi review yang bisa dicoba. Seluruh angka dan identitas demo fiktif. Nama gym, harga, kebijakan paket, dan aturan operasional final masih menunggu review pemilik gym.

## Yang dipelajari dari POS gym lain

Riset sumber resmi diperiksa 16 September 2026. Bagian “penerapan FORMA” adalah pilihan implementasi proyek ini, bukan klaim bahwa perilakunya sama persis dengan produk sumber.

| Sumber resmi | Pola yang relevan | Penerapan FORMA |
| --- | --- | --- |
| [GymMaster: POS & stock control](https://www.gymmaster.com/point-of-sale-and-stock-control/) | Penjualan produk di gym berkaitan dengan stok dan laporan; kasir dapat digunakan di berbagai perangkat. | Satu checkout untuk paket dan produk, stok berkurang setelah pembayaran tercatat, pembelian menambah stok, laporan per periode. |
| [GymMaster: member denied entry](https://www.gymmaster.com/help/help_member_denied_entry/) | Kelayakan akses bergantung pada membership; resepsionis memerlukan alasan penolakan yang jelas. | Check-in memeriksa masa aktif dan freeze, menolak duplikasi harian, dan memberi alasan. Integrasi pintu tidak dibuat. |
| [ABC Glofox: managing memberships](https://support.glofox.com/hc/en-us/articles/46429222731796-Resources-for-Managing-Memberships) | Pengelolaan membership memisahkan pause/unpause, pemberian paket, diskon, pembatalan, dan refund. | Profil member memiliki pembelian/perpanjangan, freeze/unfreeze, riwayat, dan diskon transaksi. Pembatalan demo dibatasi ke reversal penuh yang aman; refund parsial belum tersedia. |
| [Mindbody: business management](https://www.mindbodyonline.com/) | Booking, jadwal staf, pembayaran, dan laporan dipadukan dalam operasional layanan kebugaran. | PT menghubungkan member, trainer, jadwal 60 menit, dan kredit. Tab staf menyimpan data tim; izin login dan payroll belum dibuat. |
| [GymMaster: till report](https://www.gymmaster.com/user-manual/manual_reports_till_data/) | Laporan kas mencatat metode pembayaran, void, kas awal/akhir/ekspektasi, serta riwayat shift. | Buka shift, catat pemasukan/pengeluaran, hitung kas seharusnya, tutup dengan kas fisik dan alasan selisih. |

## Pemetaan enam foto

| Referensi pemilik gym | Yang tersedia |
| --- | --- |
| Foto 1: iuran, penjualan, total pendapatan harian/bulanan; tunai/QRIS/transfer | Dashboard dan laporan memisahkan membership, PT, daily pass, produk, serta metode bayar. Angka dihitung dari transaksi sesudah diskon dan void. |
| Foto 2: iuran, absensi gym/PT, penjualan, pembelian, biaya operasional | Kasir, Check-in, Personal Training, Stok, Kas & Shift. Semua memakai data member/produk yang sama. |
| Foto 3: laporan member, penjualan, pembelian, stok, biaya | Laporan bertab, filter periode untuk transaksi, dan ekspor CSV. Member serta stok menampilkan kondisi terkini. |
| Foto 4: total/aktif/nonaktif dan masa berlaku dekat habis | Status aktif, segera berakhir, habis, freeze, belum aktif; tanggal akhir dan hari tersisa di profil. Daftar reminder dapat ditinjau dan teks disalin. |
| Foto 5: pintasan data/transaksi/laporan dan panel ringkasan | Navigasi tetap, dashboard ringkas, tindakan operasional, dan tampilan responsif untuk desktop/tablet/ponsel. |
| Foto 6: paket, member, produk, pemasok, karyawan, pengumuman | Form tambah/edit seluruh master data tersebut. Produk memiliki SKU, modal, harga jual, stok minimum, dan status aktif. |

Bucket H−7/H−3/H−1 pada foto tidak ditiru sebagai angka statis. Versi review menampilkan member berakhir dalam tujuh hari beserta sisa hari individual; bentuk bucket final bisa dipilih setelah review.

## Alur operasional yang diterapkan

**Member baru:** daftar nama dan telepon → pilih paket di kasir → catat pembayaran → masa aktif atau kredit PT bertambah → buka profil/struk. Nomor telepon ganda ditolak. Pelanggan umum dapat membeli produk tanpa menjadi member.

**Perpanjangan:** paket 30/90/365 hari menggunakan jumlah hari, bukan bulan kalender. Jika masih aktif, durasi ditambahkan setelah tanggal akhir lama. Jika sudah habis, paket mulai hari ini. Tanggal berakhir inklusif: hari terakhir masih boleh check-in. Contoh paket 30 hari mulai 16 September berakhir 15 Oktober.

**Freeze:** member aktif dibekukan sejumlah hari; akses gym berhenti selama freeze. Masa berlaku diperpanjang sekali. Jika dibuka lebih awal, perpanjangan yang belum terpakai dikurangi. Daily pass tidak dapat dibekukan.

**Kunjungan:** cari member → cek status → check-in. Dicatat satu kunjungan per hari untuk setiap member. Angka kunjungan bukan jumlah orang yang saat ini berada di gym; tidak ada check-out/gate.

**Personal training:** beli kredit → pilih member, trainer aktif, tanggal/jam → booking mencadangkan satu kredit → selesai mengurangi satu kredit tepat sekali. Pembatalan booking melepas reservasi. Jadwal bentrok dalam jendela 60 menit ditolak untuk member maupun trainer. Sesi tidak bisa selesai sebelum waktunya mulai.

**Kasir dan stok:** pilih paket/produk → periksa member, qty, diskon, metode bayar → catat pembayaran → struk. Uang tunai kurang atau stok tidak cukup membatalkan seluruh operasi. QRIS/transfer perlu konfirmasi manual; aplikasi tidak memeriksa bank. Pembelian ke pemasok menaikkan stok dan mencatat kas keluar sesuai metode pembayaran.

**Tutup shift:** kas seharusnya = kas awal + penjualan tunai − biaya tunai − pembelian stok tunai. QRIS/transfer dilaporkan terpisah. Selisih kas fisik wajib diberi catatan. Bila shift melewati tengah malam, drawer tetap mengikuti shift; pendapatan harian mengikuti tanggal Jakarta.

**Pembatalan:** sertakan alasan; hanya transaksi shift yang masih terbuka. Stok dan benefit dipulihkan penuh hanya jika aman. Membership yang sudah dipakai check-in atau saldo yang sudah berubah menolak pembatalan otomatis. Catatan transaksi tetap ada dengan status dibatalkan. Ini tidak mengirim uang kembali ke rekening; refund parsial dan pembatalan setelah tutup shift belum dibuat.

## Checklist review — 10 skenario

1. **Dashboard:** bandingkan Hari ini dan Bulan ini, lalu cocokkan total dan metode bayar dengan Laporan. Semua angka harus berasal dari transaksi.
2. **Member baru:** tambahkan profil fiktif, coba telepon yang sama dua kali, beli paket 30 hari. Periksa tanggal akhir serta struk.
3. **Perpanjangan:** pilih member aktif, catat tanggal akhir, beli 30 hari lagi. Tanggal akhir bertambah 30 hari dari tanggal lama.
4. **Kasir produk:** beli dua air mineral, coba uang tunai kurang dahulu, lalu cukup. Stok berubah hanya setelah sukses; cek kembalian. QRIS/transfer menunggu konfirmasi pembayaran manual.
5. **Check-in:** member aktif berhasil sekali, percobaan kedua pada hari yang sama ditolak. Member habis atau freeze ditolak dengan alasan.
6. **Freeze:** bekukan member aktif, coba check-in, lalu aktifkan kembali. Periksa tanggal akhir dan sisa masa berlaku.
7. **PT:** beli paket PT, booking besok, coba jam bertabrakan untuk trainer/member yang sama, lalu batalkan. Kredit tersedia kembali. Penyelesaian sesi diuji setelah jam mulai; tes otomatis mencakup pemotongan tepat sekali.
8. **Stok dan biaya:** terima stok dari pemasok, catat biaya tunai, periksa stok serta kas seharusnya. Cocokkan Laporan Pembelian dan Pengeluaran.
9. **Void dan shift:** batalkan transaksi produk baru dengan alasan, periksa pemulihan stok/total. Tutup shift sesuai kas fisik; selisih wajib catatan. Transaksi baru perlu buka shift lagi.
10. **Cadangan dan laporan:** ekspor CSV dan backup JSON, refresh halaman untuk cek persistensi, lalu impor backup valid. Backup rusak harus ditolak tanpa menimpa data. Reset demo hanya setelah konfirmasi.

## Yang perlu ditentukan sebelum produksi

- Nama/cabang, daftar harga asli, paket kalender versus hari, aturan freeze, diskon, refund, pajak, dan komisi trainer.
- Database bersama, login serta izin owner/kasir/trainer, audit server, backup otomatis, pemulihan, dan penanganan dua kasir bersamaan.
- Migrasi data asli beserta saldo masa aktif, PT, dan stok; validasi terpisah sebelum mengganti sistem yang sedang dipakai.
- Payment gateway atau QRIS merchant resmi, verifikasi pembayaran, rekonsiliasi settlement, serta prosedur pengembalian dana.
- Printer termal, barcode/kartu member, gate, dan pesan WhatsApp bila memang diperlukan. Pengingat saat ini hanya teks untuk disalin.
- Stock opname/koreksi stok, retur, pembayaran pemasok bertempo, laporan laba, pajak, payroll, kelas grup, dan portal member belum tersedia.

Saat review gunakan satu tab aktif pada satu browser. Data belum tersinkron ke perangkat lain. Arus kas bersih yang tersedia tidak menghitung laba akuntansi, penyusutan, atau pendapatan membership yang diakui bertahap.
