# GymStore — kontrak UI

`store.js` mengekspos `window.GymStore`. Semua operasi synchronous, mengembalikan record hasil (atau state untuk import/reset), menyimpan satu transaksi atomic ke localStorage, lalu memancarkan `gym:change`. Kesalahan melempar `Error` dengan pesan Bahasa Indonesia; UI harus menangkapnya. Baca state melalui `GymStore.state` setiap render, jangan memodifikasi langsung.

- Koleksi dan field mengikuti brief: settings, members, packages, products, suppliers, staff, announcements, transactions, checkins, ptSessions, expenses, purchases, shifts, audit.
- `today()`, `addDays(date,n)`, `daysLeft(member)`, `status(member)`, `money(amount)` tersedia. Semua hari memakai Asia/Jakarta. Tanggal membership berakhir **inklusif**; hari terakhir tetap boleh masuk. `frozenUntil` eksklusif.
- `status` adalah `active`, `expiring`, `expired`, `frozen`, atau `new`. `active` dan `expiring` sama-sama boleh check-in. `daysLeft` mengembalikan `null` bila belum membeli akses; jangan membandingkan `null >= 0` untuk filter pengingat. Gunakan status `expiring`.
- `saveMember({id?,name,phone,email?,notes?})`; `setFreeze(memberId,days)`; `unfreeze(memberId)`.
- `saveEntity(type,object)`: type plural `packages`, `products`, `suppliers`, `staff`, `announcements`, atau `settings`. Return record tersimpan. Produk baru membutuhkan stock/minStock; perubahan stok produk lama lewat `receiveStock` (bukan form edit produk).
- `checkout({memberId,items:[{type:'package'|'product',id,qty}],discount,method,cashReceived,confirmed,notes,idempotencyKey})` → transaction. Method `cash`, `qris`, `transfer`; noncash perlu `confirmed:true`. Membership/daypass maksimal satu item qty 1; PT qty boleh lebih dari 1. Paket selalu memerlukan member. Harga dihitung dari master data. Shift harus terbuka. Idempotency key sama mengembalikan transaksi sama tanpa perubahan kedua.
- `checkIn(memberId)` → checkin; satu kali per hari.
- `bookPT({memberId,trainerId,date,time,notes})`, `completePT(id)`, `cancelPT(id)` → ptSession. Trainer adalah staff role `trainer`; durasi slot satu jam, overlap trainer/member dicegah. Kredit dipesan saat booking dan dipotong saat selesai. Paket PT tidak mensyaratkan membership gym aktif.
- `receiveStock({productId,supplierId,qty,unitCost,method})`, `addExpense({category,amount,method,description})` → record.
- `openShift(openingCash)`, `shiftSummary()` → `{shift,openingCash,cashSales,cashExpenses,cashPurchases,expectedCash,qrisSales,transferSales}`, `closeShift({closingCash,notes})` → shift. `shiftSummary().shift` null bila belum buka shift.
- `voidTransaction(id,reason)` → transaction. Hanya transaksi shift berjalan; menolak benefit member yang sudah dipakai/berubah. Audit dan record transaksi tetap tersimpan.
- `metrics(fromDate=today(),toDate=today())` → `{total,membership,pt,products,daypass,cash,qris,transfer,count,expenses,purchases,netCashflow}`; diskon dialokasikan proporsional dalam rupiah bulat.
- `revenueSeries(days=7)` → `[{date,total}]`.
- `exportBackup()` → JSON string; `importBackup(text)` validasi lengkap sebelum mengganti; `resetDemo()` reset eksplisit (UI konfirmasi dahulu).
- `storageError` getter: null atau pesan error data lokal. Bila data lama rusak, raw tetap disimpan, preview menggunakan seed di memori, dan mutasi diblokir sampai import valid/reset eksplisit. Tampilkan banner agar tidak diam-diam menimpa data. Bila localStorage tak tersedia, mutasi memberi error alih-alih mengaku tersimpan.

Data seed seluruhnya fiktif, tanggal bergerak mengikuti hari pertama seed dibuat. Tidak ada payment gateway, autentikasi, atau sinkronisasi server. Backup menyimpan `{version:1,...state}`; transaction memiliki metadata internal `_before`, `_after`, `idempotencyKey` untuk reversal aman. Member boleh memiliki `freezeStarted`/`freezeDays`; PT session `createdAt`/`completedAt`.

Konvensi field:

- `members`: `id,name,phone,email,joinedAt,packageId,startDate,endDate,frozenUntil,ptCredits,notes`. Belum aktif: packageId/startDate/endDate null. `joinedAt` tanggal.
- `packages`: `id,name,kind,price,days,sessions,description,active`. `kind` membership/pt/daypass; PT days=0; membership sessions=0; daypass days=1.
- `products`: `id,name,category,price,cost,stock,minStock,sku,active`.
- `suppliers`: `id,name,phone`; `staff`: tambah `role,active`; role owner/cashier/trainer/manager. `announcements`: `id,title,body`.
- `transactions`: `id,number,date,day,memberId,memberName,items,subtotal,discount,total,method,cashReceived,change,status,shiftId,notes`. `date` ISO UTC, `day` tanggal Jakarta, `status` paid/void. `items` berisi `type,id,name,kind?,qty,price,total`. Pembatalan menambahkan `voidReason,voidedAt`.
- `checkins`: `id,memberId,name,date,day`; `ptSessions`: `id,memberId,trainerId,date,time,status,notes,createdAt` (date tanggal; time HH:mm).
- `expenses`: `id,date,category,amount,method,description,shiftId`; `purchases`: `id,date,productId,supplierId,qty,unitCost,total,method,shiftId`.
- `shifts`: `id,openedAt,closedAt,openingCash,closingCash,expectedCash,variance,notes`. `closedAt` dan ketiga hasil penutupan null saat terbuka.
- `audit`: `id,date,action,description`.

Semua nominal rupiah dan qty harus integer aman. Shift boleh melewati tengah malam: drawer mengikuti shiftId, pendapatan dashboard mengikuti day. Pengeluaran/pembelian tunai melebihi saldo laci ditolak. Selisih kas saat tutup wajib diberi catatan. Absensi satu kali per hari adalah catatan kunjungan, bukan pelacakan keluar-masuk gate atau okupansi real time. PT tidak dapat ditandai selesai sebelum waktu mulai.

LocalStorage ini untuk **satu kasir di satu tab aktif**. Dua tab/perangkat menulis bersamaan belum memiliki mekanisme konflik; jangan dipakai untuk operasional produksi. Harga historis transaksi dipertahankan ketika master harga diedit. Harga beli produk memakai rata-rata tertimbang sederhana saat stok diterima; netCashflow adalah arus uang, bukan laba bersih atau akuntansi akrual.

Node: `require('./store.js').createStore({storage, now})` untuk instance test terisolasi. `storage` memiliki `getItem/setItem`; `now` function → Date. Nama key browser: `forma.gym.pos.v1`.
