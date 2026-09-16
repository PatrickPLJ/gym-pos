(function (root) {
  'use strict';
  const KEY = 'forma.gym.pos.v1';
  const METHODS = ['cash', 'qris', 'transfer'];
  const COLLECTIONS = ['members', 'packages', 'products', 'suppliers', 'staff', 'announcements', 'transactions', 'checkins', 'ptSessions', 'expenses', 'purchases', 'shifts', 'audit'];
  const clone = value => JSON.parse(JSON.stringify(value));
  const fail = message => { throw new Error(message); };
  const clean = value => String(value == null ? '' : value).trim();
  const finite = (value, label, minimum = 0, integer = false) => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || (integer && !Number.isSafeInteger(value))) fail(label + ' tidak valid.');
    return value;
  };
  const required = (value, label, max = 200) => {
    if (typeof value !== 'string' || !value.trim() || value.length > max) fail(label + ' wajib diisi dan maksimal ' + max + ' karakter.');
    return value.trim();
  };
  const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value + 'T00:00:00Z')) && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value;
  const dateCheck = (value, label = 'Tanggal') => { if (!validDate(value)) fail(label + ' tidak valid.'); return value; };
  const isoCheck = value => { if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) fail('Waktu rekaman tidak valid.'); };
  const addDays = (date, n) => {
    dateCheck(date); finite(Math.abs(n), 'Jumlah hari', 0, true);
    return new Date(Date.parse(date + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
  };
  const diffDays = (from, to) => Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86400000);
  const dayAt = date => {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
    const p = Object.fromEntries(parts.map(x => [x.type, x.value])); return p.year + '-' + p.month + '-' + p.day;
  };
  const money = n => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
  const benefits = member => ({ packageId: member.packageId, startDate: member.startDate, endDate: member.endDate, frozenUntil: member.frozenUntil, ptCredits: member.ptCredits, freezeStarted: member.freezeStarted || null, freezeDays: member.freezeDays || 0 });
  const methodCheck = method => { if (!METHODS.includes(method)) fail('Pilih metode pembayaran yang valid.'); return method; };
  const find = (state, type, id) => state[type].find(item => item.id === id) || fail('Data ' + type + ' tidak ditemukan.');
  const activeShift = state => state.shifts.find(s => !s.closedAt);
  const requireShift = state => activeShift(state) || fail('Buka shift kasir dahulu sebelum mencatat transaksi.');

  function seed(today, now) {
    const state = { version: 1, settings: { gymName: 'FORMA', branch: 'Surabaya', address: 'Jl. Graha Kebugaran No. 18, Surabaya', phone: '081200001888' } };
    COLLECTIONS.forEach(type => { state[type] = []; });
    state.packages = [
      { id: 'pkg-month', name: 'All Access · 30 Hari', kind: 'membership', price: 350000, days: 30, sessions: 0, description: 'Akses gym setiap hari, termasuk loker.', active: true },
      { id: 'pkg-quarter', name: 'All Access · 90 Hari', kind: 'membership', price: 950000, days: 90, sessions: 0, description: 'Latihan konsisten dengan paket tiga bulan.', active: true },
      { id: 'pkg-year', name: 'All Access · 365 Hari', kind: 'membership', price: 3300000, days: 365, sessions: 0, description: 'Keanggotaan tahunan.', active: true },
      { id: 'pkg-day', name: 'Daily Pass', kind: 'daypass', price: 50000, days: 1, sessions: 0, description: 'Akses gym satu hari.', active: true },
      { id: 'pkg-pt4', name: 'Personal Training · 4 Sesi', kind: 'pt', price: 700000, days: 0, sessions: 4, description: 'Empat sesi personal training, 60 menit per sesi.', active: true },
      { id: 'pkg-pt8', name: 'Personal Training · 8 Sesi', kind: 'pt', price: 1300000, days: 0, sessions: 8, description: 'Delapan sesi personal training, 60 menit per sesi.', active: true }
    ];
    state.products = [
      ['prod-water', 'Air Mineral 600 ml', 'Minuman', 8000, 4000, 42, 12, 'FM001'],
      ['prod-isotonic', 'Isotonik Lemon', 'Minuman', 15000, 9500, 8, 10, 'FM002'],
      ['prod-protein', 'Protein Shake Chocolate', 'Suplemen', 35000, 19000, 24, 8, 'FS001'],
      ['prod-bar', 'Protein Bar Almond', 'Snack', 28000, 17000, 6, 8, 'FS002'],
      ['prod-towel', 'Handuk FORMA', 'Merchandise', 65000, 35000, 15, 5, 'FA001'],
      ['prod-shaker', 'Shaker Bottle 700 ml', 'Merchandise', 85000, 45000, 12, 4, 'FA002'],
      ['prod-coffee', 'Cold Brew Original', 'Minuman', 25000, 12000, 18, 6, 'FM003'],
      ['prod-glove', 'Training Gloves', 'Aksesori', 125000, 75000, 7, 3, 'FA003']
    ].map(p => ({ id: p[0], name: p[1], category: p[2], price: p[3], cost: p[4], stock: p[5], minStock: p[6], sku: p[7], active: true }));
    state.staff = [
      { id: 'staff-owner', name: 'Nadia Prameswari', role: 'owner', phone: '081200001001', active: true },
      { id: 'staff-cashier', name: 'Rara Anggraini', role: 'cashier', phone: '081200001002', active: true },
      { id: 'staff-adit', name: 'Adit Pratama', role: 'trainer', phone: '081200001003', active: true },
      { id: 'staff-citra', name: 'Citra Maharani', role: 'trainer', phone: '081200001004', active: true },
      { id: 'staff-rizky', name: 'Rizky Saputra', role: 'trainer', phone: '081200001005', active: true }
    ];
    state.suppliers = [{ id: 'sup-hydra', name: 'Hydra Distribusi', phone: '0317000001' }, { id: 'sup-fit', name: 'Fit Nutrition Surabaya', phone: '0317000002' }, { id: 'sup-active', name: 'Active Apparel', phone: '0317000003' }];
    state.announcements = [{ id: 'ann-1', title: 'Selamat datang di FORMA', body: 'Versi demo operasional. Seluruh member, transaksi, dan nomor kontak adalah data fiktif.' }, { id: 'ann-2', title: 'Latihan bareng, makin konsisten', body: 'Paket 90 hari tersedia. Tanyakan rekomendasi program kepada trainer di resepsionis.' }];
    const names = ['Andi Pratama', 'Dewi Lestari', 'Bima Santoso', 'Nadia Putri', 'Kevin Wijaya', 'Siska Amelia', 'Fajar Ramadhan', 'Ayu Permata', 'Rizal Hakim', 'Clara Tan', 'Dimas Saputra', 'Intan Maharani', 'Yusuf Hidayat', 'Tania Kusuma', 'Raka Aditya', 'Maya Anggraini', 'Bagas Wicaksono', 'Felicia Hartono', 'Reza Mahendra', 'Nabila Azzahra', 'Gilang Setiawan', 'Vina Oktavia'];
    const offsets = [21, 6, 2, 0, -1, 14, 25, 1, -3, 9, 4, 17, -7, 30, 12, 3, -16, 26, 5, -30, null, null];
    names.forEach((name, i) => {
      const endDate = offsets[i] === null ? null : addDays(today, offsets[i]);
      state.members.push({ id: 'mem-' + String(i + 1).padStart(3, '0'), name, phone: '08120000' + String(2000 + i), email: '', joinedAt: addDays(today, -120 - i * 3), packageId: endDate ? 'pkg-month' : null, startDate: endDate ? addDays(endDate, i === 13 ? -34 : -29) : null, endDate, frozenUntil: i === 13 ? addDays(today, 5) : null, freezeStarted: i === 13 ? today : null, freezeDays: i === 13 ? 5 : 0, ptCredits: [0, 1, 3, 5, 7, 9, 11, 14].includes(i) ? 4 : 0, notes: i === 13 ? 'Freeze perjalanan dinas.' : '' });
    });
    let serial = 1;
    // Riwayat pembayaran membership sesuai masa berlaku seed. Saldo awal stok dan kredit adalah baseline demo.
    state.members.filter(m => m.endDate && m.startDate <= today).forEach(member => {
      const date = member.startDate + 'T02:00:00.000Z';
      state.transactions.push({ id: 'tx-seed-' + serial, number: 'FM-' + member.startDate.replace(/-/g, '') + '-' + String(serial++).padStart(4, '0'), date, day: member.startDate, memberId: member.id, memberName: member.name, items: [{ type: 'package', id: 'pkg-month', name: state.packages[0].name, kind: 'membership', qty: 1, price: 350000, total: 350000 }], subtotal: 350000, discount: 0, total: 350000, method: serial % 3 === 0 ? 'transfer' : serial % 2 === 0 ? 'qris' : 'cash', cashReceived: serial % 3 !== 0 && serial % 2 !== 0 ? 350000 : 0, change: 0, status: 'paid', shiftId: 'shift-seed-' + member.startDate, notes: 'Pembayaran awal demo.', _seed: true });
    });
    for (let n = 13; n >= 0; n--) {
      const day = addDays(today, -n);
      const product = state.products[n % 4];
      const qty = n % 3 + 1;
      const method = METHODS[n % 3];
      state.transactions.push({ id: 'tx-seed-' + serial, number: 'FM-' + day.replace(/-/g, '') + '-' + String(serial++).padStart(4, '0'), date: day + 'T03:15:00.000Z', day, memberId: state.members[n % 10].id, memberName: state.members[n % 10].name, items: [{ type: 'product', id: product.id, name: product.name, qty, price: product.price, total: product.price * qty }], subtotal: product.price * qty, discount: 0, total: product.price * qty, method, cashReceived: method === 'cash' ? product.price * qty : 0, change: 0, status: 'paid', shiftId: 'shift-seed-' + day, notes: '', _seed: true });
    }
    [['mem-001', 'pkg-month', 'qris'], ['mem-015', 'pkg-pt4', 'transfer']].forEach(([memberId, packageId, method]) => {
      const m = state.members.find(x => x.id === memberId); const p = state.packages.find(x => x.id === packageId);
      if (p.kind === 'membership') m.endDate = addDays(m.endDate, p.days); else m.ptCredits += p.sessions;
      state.transactions.push({ id: 'tx-seed-' + serial, number: 'FM-' + today.replace(/-/g, '') + '-' + String(serial++).padStart(4, '0'), date: today + 'T02:30:00.000Z', day: today, memberId, memberName: m.name, items: [{ type: 'package', id: p.id, name: p.name, kind: p.kind, qty: 1, price: p.price, total: p.price }], subtotal: p.price, discount: 0, total: p.price, method, cashReceived: 0, change: 0, status: 'paid', shiftId: 'shift-seed-' + today, notes: 'Pembayaran demo.', _seed: true });
    });
    const shiftDays = Array.from(new Set(state.transactions.map(t => t.day))).sort();
    if (!shiftDays.includes(today)) shiftDays.push(today);
    shiftDays.forEach(day => {
      const sales = state.transactions.filter(t => t.day === day && t.method === 'cash').reduce((sum, t) => sum + t.total, 0);
      state.shifts.push({ id: 'shift-seed-' + day, openedAt: day + 'T00:00:00.000Z', closedAt: day === today ? null : day + 'T14:00:00.000Z', openingCash: 300000, closingCash: day === today ? null : 300000 + sales, expectedCash: day === today ? null : 300000 + sales, variance: day === today ? null : 0, notes: 'Shift demo' });
    });
    [0, 1, 2, 3, 5, 6, 7, 9].forEach((i, j) => state.checkins.push({ id: 'check-seed-' + j, memberId: state.members[i].id, name: state.members[i].name, date: today + 'T' + String(1 + Math.floor(j / 2)).padStart(2, '0') + ':' + (j % 2 ? '30' : '00') + ':00.000Z', day: today }));
    state.ptSessions = [{ id: 'pt-seed-1', memberId: 'mem-002', trainerId: 'staff-adit', date: today, time: '16:00', status: 'booked', notes: 'Strength · lower body', createdAt: addDays(today, -1) + 'T03:00:00.000Z' }, { id: 'pt-seed-2', memberId: 'mem-004', trainerId: 'staff-citra', date: today, time: '17:00', status: 'booked', notes: 'Mobility & core', createdAt: addDays(today, -1) + 'T04:00:00.000Z' }, { id: 'pt-seed-3', memberId: 'mem-006', trainerId: 'staff-rizky', date: addDays(today, 1), time: '09:00', status: 'booked', notes: 'Program pemula', createdAt: now }];
    state.audit.push({ id: 'audit-seed', date: now, action: 'demo.created', description: 'Data demo fiktif dibuat. Saldo awal stok dan kredit PT telah dimasukkan.' });
    return state;
  }

  function validateState(state) {
    if (!state || typeof state !== 'object' || Array.isArray(state) || state.version !== 1) fail('Format backup atau versi tidak didukung.');
    if (!state.settings || typeof state.settings !== 'object') fail('Pengaturan backup tidak lengkap.');
    required(state.settings.gymName, 'Nama gym'); required(state.settings.branch, 'Cabang');
    ['address', 'phone'].forEach(k => { if (typeof state.settings[k] !== 'string') fail('Pengaturan backup tidak valid.'); });
    const ids = {};
    COLLECTIONS.forEach(type => {
      if (!Array.isArray(state[type]) || state[type].length > 100000) fail('Koleksi ' + type + ' tidak valid.');
      ids[type] = new Set();
      state[type].forEach(item => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) fail('Rekaman ' + type + ' tidak valid.');
        required(item.id, 'ID', 100);
        if (ids[type].has(item.id)) fail('ID duplikat pada ' + type + '.');
        ids[type].add(item.id);
      });
    });
    const ref = (type, id, optional = false) => { if (optional && id === null) return; if (!ids[type].has(id)) fail('Referensi ' + type + ' tidak ditemukan dalam backup.'); };
    const bool = value => { if (typeof value !== 'boolean') fail('Status aktif tidak valid.'); };
    const textFields = (obj, fields) => fields.forEach(k => { if (typeof obj[k] !== 'string' || obj[k].length > 10000) fail('Teks ' + k + ' tidak valid.'); });
    const validateBenefit = m => {
      ref('packages', m.packageId, true);
      ['startDate', 'endDate', 'frozenUntil'].forEach(k => { if (m[k] !== null) dateCheck(m[k]); });
      if (!!m.startDate !== !!m.endDate || (m.startDate && m.startDate > m.endDate) || (!!m.endDate !== !!m.packageId)) fail('Masa aktif member tidak valid.');
      if (m.packageId && find(state, 'packages', m.packageId).kind === 'pt') fail('Paket akses member tidak boleh paket PT.');
      finite(m.ptCredits, 'Kredit PT', 0, true);
      if (m.freezeStarted != null) dateCheck(m.freezeStarted); if (m.freezeDays != null) finite(m.freezeDays, 'Durasi freeze', 0, true);
      if (m.frozenUntil && (!m.endDate || !m.freezeStarted || !m.freezeDays || addDays(m.freezeStarted, m.freezeDays) !== m.frozenUntil || m.frozenUntil > m.endDate)) fail('Riwayat freeze tidak valid.');
      if (!m.frozenUntil && (m.freezeStarted || m.freezeDays)) fail('Riwayat freeze tidak konsisten.');
    };
    state.packages.forEach(p => {
      required(p.name, 'Nama paket'); if (!['membership', 'pt', 'daypass'].includes(p.kind)) fail('Jenis paket tidak valid.');
      finite(p.price, 'Harga paket', 0, true); finite(p.days, 'Durasi paket', 0, true); finite(p.sessions, 'Sesi paket', 0, true); bool(p.active); textFields(p, ['description']);
      if (p.kind === 'pt' && (p.sessions < 1 || p.days !== 0) || p.kind === 'membership' && (p.days < 1 || p.sessions !== 0) || p.kind === 'daypass' && (p.days !== 1 || p.sessions !== 0)) fail('Durasi atau sesi paket tidak sesuai jenisnya.');
    });
    state.products.forEach(p => {
      required(p.name, 'Nama produk'); textFields(p, ['category', 'sku']); bool(p.active);
      ['price', 'cost', 'stock', 'minStock'].forEach(k => finite(p[k], k, 0, true));
    });
    const skus = state.products.map(p => p.sku).filter(Boolean); if (new Set(skus).size !== skus.length) fail('SKU produk duplikat.');
    state.members.forEach(m => {
      required(m.name, 'Nama member'); required(m.phone, 'Telepon member'); textFields(m, ['email', 'notes']); dateCheck(m.joinedAt); validateBenefit(m);
    });
    state.suppliers.forEach(s => { required(s.name, 'Nama pemasok'); textFields(s, ['phone']); });
    state.staff.forEach(s => { required(s.name, 'Nama staf'); if (!['owner', 'cashier', 'trainer', 'manager'].includes(s.role)) fail('Peran staf tidak valid.'); textFields(s, ['phone']); bool(s.active); });
    state.announcements.forEach(a => { required(a.title, 'Judul'); required(a.body, 'Pengumuman', 10000); });
    if (state.shifts.filter(s => !s.closedAt).length > 1) fail('Backup memiliki lebih dari satu shift terbuka.');
    state.shifts.forEach(s => {
      isoCheck(s.openedAt); finite(s.openingCash, 'Kas awal', 0, true); textFields(s, ['notes']);
      if (s.closedAt !== null) { isoCheck(s.closedAt); if (s.closedAt < s.openedAt) fail('Urutan waktu shift salah.'); finite(s.closingCash, 'Kas akhir', 0, true); finite(s.expectedCash, 'Ekspektasi kas', -Number.MAX_SAFE_INTEGER, true); finite(s.variance, 'Selisih kas', -Number.MAX_SAFE_INTEGER, true); }
      else if (s.closingCash !== null || s.expectedCash !== null || s.variance !== null) fail('Shift terbuka tidak boleh memiliki hasil tutup.');
    });
    const txNumbers = new Set(); const idem = new Set();
    state.transactions.forEach(t => {
      required(t.number, 'Nomor transaksi'); if (txNumbers.has(t.number)) fail('Nomor transaksi duplikat.'); txNumbers.add(t.number);
      isoCheck(t.date); dateCheck(t.day); if (dayAt(new Date(t.date)) !== t.day) fail('Tanggal transaksi tidak konsisten.');
      ref('members', t.memberId, true); ref('shifts', t.shiftId); textFields(t, ['memberName', 'notes']); methodCheck(t.method);
      if (!['paid', 'void'].includes(t.status) || !Array.isArray(t.items) || !t.items.length) fail('Transaksi tidak valid.');
      ['subtotal', 'discount', 'total', 'cashReceived', 'change'].forEach(k => finite(t[k], k, 0, true));
      let subtotal = 0; let accessCount = 0;
      t.items.forEach(item => {
        if (!['package', 'product'].includes(item.type)) fail('Tipe item tidak valid.'); ref(item.type === 'package' ? 'packages' : 'products', item.id); required(item.name, 'Nama item');
        finite(item.qty, 'Kuantitas item', 1, true); finite(item.price, 'Harga item', 0, true); finite(item.total, 'Total item', 0, true);
        if (item.total !== item.qty * item.price) fail('Perhitungan item tidak sesuai.'); subtotal += item.total;
        if (item.type === 'package') { if (!t.memberId || !['membership', 'pt', 'daypass'].includes(item.kind)) fail('Paket transaksi tidak valid.'); if (item.kind !== 'pt') accessCount += item.qty; }
      });
      if (accessCount > 1 || t.subtotal !== subtotal || t.discount > subtotal || t.total !== subtotal - t.discount) fail('Perhitungan transaksi tidak sesuai.');
      if (t.method === 'cash' && (t.cashReceived < t.total || t.change !== t.cashReceived - t.total) || t.method !== 'cash' && (t.cashReceived !== 0 || t.change !== 0)) fail('Perhitungan pembayaran tidak sesuai.');
      if (t.idempotencyKey != null) { required(t.idempotencyKey, 'Kunci transaksi', 200); if (idem.has(t.idempotencyKey)) fail('Kunci transaksi duplikat.'); idem.add(t.idempotencyKey); }
      if (!!t._before !== !!t._after) fail('Metadata pembatalan tidak lengkap.');
      [t._before, t._after].filter(Boolean).forEach(validateBenefit);
      if (t._before && (!t.memberId || !t.items.some(i => i.type === 'package'))) fail('Metadata benefit tidak sesuai transaksi.');
      if (t.status === 'void') { required(t.voidReason, 'Alasan pembatalan', 1000); isoCheck(t.voidedAt); }
    });
    const visits = new Set();
    state.checkins.forEach(c => { ref('members', c.memberId); required(c.name, 'Nama absensi'); isoCheck(c.date); dateCheck(c.day); if (dayAt(new Date(c.date)) !== c.day) fail('Tanggal absensi tidak konsisten.'); const key = c.day + c.memberId; if (visits.has(key)) fail('Absensi harian duplikat.'); visits.add(key); });
    state.ptSessions.forEach(s => {
      ref('members', s.memberId); ref('staff', s.trainerId); if (find(state, 'staff', s.trainerId).role !== 'trainer') fail('Sesi PT harus memiliki trainer.');
      dateCheck(s.date); if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(s.time)) fail('Jam PT tidak valid.');
      if (!['booked', 'completed', 'cancelled'].includes(s.status)) fail('Status PT tidak valid.'); textFields(s, ['notes']); isoCheck(s.createdAt);
      if (s.status === 'completed') isoCheck(s.completedAt);
    });
    state.members.forEach(m => { if (state.ptSessions.filter(s => s.memberId === m.id && s.status === 'booked').length > m.ptCredits) fail('Reservasi PT melebihi saldo member.'); });
    const liveSessions = state.ptSessions.filter(s => s.status !== 'cancelled');
    liveSessions.forEach((s, i) => { if (liveSessions.slice(i + 1).some(other => other.date === s.date && (other.memberId === s.memberId || other.trainerId === s.trainerId) && Math.abs(timeMinutes(other.time) - timeMinutes(s.time)) < 60)) fail('Jadwal PT bentrok dalam backup.'); });
    state.expenses.forEach(e => { dateCheck(e.date); required(e.category, 'Kategori biaya'); finite(e.amount, 'Biaya', 1, true); methodCheck(e.method); required(e.description, 'Keterangan biaya', 1000); ref('shifts', e.shiftId); });
    state.purchases.forEach(p => { dateCheck(p.date); ref('products', p.productId); ref('suppliers', p.supplierId); ref('shifts', p.shiftId); finite(p.qty, 'Qty pembelian', 1, true); finite(p.unitCost, 'Harga beli', 0, true); finite(p.total, 'Total pembelian', 0, true); if (p.total !== p.qty * p.unitCost) fail('Total pembelian salah.'); methodCheck(p.method); });
    state.shifts.filter(s => s.closedAt !== null).forEach(s => {
      const cashSales = state.transactions.filter(t => t.shiftId === s.id && t.method === 'cash' && t.status === 'paid').reduce((sum, t) => sum + t.total, 0);
      const cashExpenses = state.expenses.filter(e => e.shiftId === s.id && e.method === 'cash').reduce((sum, e) => sum + e.amount, 0);
      const cashPurchases = state.purchases.filter(p => p.shiftId === s.id && p.method === 'cash').reduce((sum, p) => sum + p.total, 0);
      const expected = s.openingCash + cashSales - cashExpenses - cashPurchases;
      finite(expected, 'Rekonsiliasi kas', -Number.MAX_SAFE_INTEGER, true);
      if (s.expectedCash !== expected || s.variance !== s.closingCash - expected) fail('Rekonsiliasi shift dalam backup tidak sesuai transaksi.');
    });
    state.audit.forEach(a => { isoCheck(a.date); required(a.action, 'Aksi audit'); required(a.description, 'Deskripsi audit', 10000); });
    return state;
  }

  const timeMinutes = time => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));

  function createStore(options = {}) {
    const clock = options.now || (() => new Date());
    const today = () => dayAt(clock());
    const now = () => clock().toISOString();
    let storage; let storageError = null; let sequence = 0;
    if (Object.prototype.hasOwnProperty.call(options, 'storage')) storage = options.storage;
    else { try { storage = root.localStorage; } catch (_) { storage = null; } }
    let current;
    try {
      const raw = storage ? storage.getItem(KEY) : null;
      current = raw ? validateState(JSON.parse(raw)) : seed(today(), now());
      if (!raw && storage) storage.setItem(KEY, JSON.stringify(current));
      if (!storage && typeof window !== 'undefined') storageError = 'Penyimpanan browser tidak tersedia. Izinkan localStorage agar data dapat disimpan.';
    } catch (_) {
      current = seed(today(), now());
      storageError = 'Data lokal tidak bisa dibaca atau rusak. Data asli tetap dipertahankan. Impor backup valid atau reset demo secara eksplisit sebelum melanjutkan.';
    }
    const id = prefix => prefix + '-' + Date.now().toString(36) + '-' + (++sequence).toString(36) + '-' + Math.random().toString(36).slice(2, 7);
    const audit = (s, action, description) => { s.audit.push({ id: id('audit'), date: now(), action, description }); };
    const commit = (draft, allowRecovery = false) => {
      if (storageError && !allowRecovery) fail(storageError);
      validateState(draft);
      try { if (storage) storage.setItem(KEY, JSON.stringify(draft)); else if (typeof window !== 'undefined') fail('Penyimpanan browser tidak tersedia.'); }
      catch (_) { fail('Data gagal disimpan. Penyimpanan browser mungkin penuh atau diblokir. Transaksi belum dicatat.'); }
      current = draft; storageError = null;
      if (root.dispatchEvent && typeof root.CustomEvent === 'function') root.dispatchEvent(new root.CustomEvent('gym:change'));
    };
    const mutate = action => { if (storageError) fail(storageError); const draft = clone(current); const result = action(draft); commit(draft); return result; };
    const status = member => {
      if (member.frozenUntil && member.frozenUntil > today()) return 'frozen';
      if (!member.endDate || !member.startDate || member.startDate > today()) return 'new';
      const left = diffDays(today(), member.endDate);
      return left < 0 ? 'expired' : left <= 7 ? 'expiring' : 'active';
    };
    const daysLeft = member => member.endDate ? diffDays(today(), member.endDate) : null;
    const summary = (s, shift = activeShift(s)) => {
      if (!shift) return { shift: null, openingCash: 0, cashSales: 0, cashExpenses: 0, cashPurchases: 0, expectedCash: 0, qrisSales: 0, transferSales: 0 };
      const tx = s.transactions.filter(t => t.shiftId === shift.id && t.status === 'paid');
      const sales = method => tx.filter(t => t.method === method).reduce((sum, t) => sum + t.total, 0);
      const cashExpenses = s.expenses.filter(e => e.shiftId === shift.id && e.method === 'cash').reduce((sum, e) => sum + e.amount, 0);
      const cashPurchases = s.purchases.filter(p => p.shiftId === shift.id && p.method === 'cash').reduce((sum, p) => sum + p.total, 0);
      return { shift, openingCash: shift.openingCash, cashSales: sales('cash'), cashExpenses, cashPurchases, expectedCash: shift.openingCash + sales('cash') - cashExpenses - cashPurchases, qrisSales: sales('qris'), transferSales: sales('transfer') };
    };
    const api = {
      get state() { return current; }, get storageError() { return storageError; },
      today, addDays, status, daysLeft, money,
      saveMember(input) {
        return mutate(s => {
          const name = required(clean(input.name), 'Nama member'); const phone = required(clean(input.phone), 'Telepon member', 25);
          if (!/^\+?[0-9 ()-]{8,25}$/.test(phone)) fail('Nomor telepon minimal 8 digit, gunakan angka.');
          const normalized = phone.replace(/\D/g, '').replace(/^62/, '0');
          if (s.members.some(m => m.id !== input.id && m.phone.replace(/\D/g, '').replace(/^62/, '0') === normalized)) fail('Nomor telepon sudah digunakan member lain.');
          const email = clean(input.email); if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('Format email tidak valid.');
          let member = input.id ? find(s, 'members', input.id) : { id: id('mem'), joinedAt: today(), packageId: null, startDate: null, endDate: null, frozenUntil: null, freezeStarted: null, freezeDays: 0, ptCredits: 0 };
          Object.assign(member, { name, phone, email, notes: clean(input.notes).slice(0, 10000) });
          if (!input.id) s.members.push(member); audit(s, input.id ? 'member.updated' : 'member.created', name); return member;
        });
      },
      setFreeze(memberId, days) {
        return mutate(s => {
          finite(days, 'Durasi freeze', 1, true); if (days > 365) fail('Freeze maksimal 365 hari.');
          const m = find(s, 'members', memberId); if (!['active', 'expiring'].includes(status(m))) fail('Freeze hanya tersedia untuk membership yang aktif dan belum dibekukan.');
          if (find(s, 'packages', m.packageId).kind === 'daypass') fail('Daily pass tidak dapat dibekukan.');
          m.endDate = addDays(m.endDate, days); m.freezeStarted = today(); m.freezeDays = days; m.frozenUntil = addDays(today(), days);
          audit(s, 'member.frozen', m.name + ': ' + days + ' hari.'); return m;
        });
      },
      unfreeze(memberId) {
        return mutate(s => {
          const m = find(s, 'members', memberId); if (!m.frozenUntil) fail('Member tidak sedang dibekukan.');
          const unused = Math.max(0, diffDays(today(), m.frozenUntil));
          m.endDate = addDays(m.endDate, -unused); m.frozenUntil = null; m.freezeStarted = null; m.freezeDays = 0;
          audit(s, 'member.unfrozen', m.name + ': ' + unused + ' hari freeze belum terpakai dikembalikan.'); return m;
        });
      },
      saveEntity(type, input) {
        return mutate(s => {
          if (!['packages', 'products', 'suppliers', 'staff', 'announcements', 'settings'].includes(type)) fail('Jenis master data tidak dikenal.');
          if (type === 'settings') { s.settings = { gymName: required(clean(input.gymName), 'Nama gym'), branch: required(clean(input.branch), 'Cabang'), address: clean(input.address), phone: clean(input.phone) }; audit(s, 'settings.updated', 'Pengaturan gym diperbarui.'); return s.settings; }
          const existing = input.id ? find(s, type, input.id) : null;
          const obj = { ...(existing || {}), ...input, id: existing ? existing.id : id(type.slice(0, 3)) };
          if (type !== 'announcements') obj.name = required(clean(obj.name), 'Nama');
          if (type === 'packages') { obj.description = clean(obj.description); obj.active = obj.active !== false; obj.price = Number(obj.price); obj.days = Number(obj.days || 0); obj.sessions = Number(obj.sessions || 0); if (existing && obj.kind !== existing.kind && s.transactions.some(t => t.items.some(i => i.type === 'package' && i.id === obj.id))) fail('Jenis paket yang sudah digunakan tidak boleh diubah.'); }
          if (type === 'products') {
            ['price', 'cost', 'stock', 'minStock'].forEach(k => { obj[k] = Number(obj[k] || 0); }); obj.category = clean(obj.category); obj.sku = clean(obj.sku); obj.active = obj.active !== false;
            if (existing && obj.stock !== existing.stock) fail('Ubah stok melalui Penerimaan stok agar riwayat tetap tercatat.');
          }
          if (type === 'suppliers' || type === 'staff') obj.phone = clean(obj.phone);
          if (type === 'staff') { obj.active = obj.active !== false; if (existing && existing.role === 'trainer' && obj.role !== 'trainer' && s.ptSessions.some(p => p.trainerId === obj.id)) fail('Trainer yang memiliki riwayat sesi tidak dapat diganti perannya.'); }
          if (type === 'announcements') { obj.title = required(clean(obj.title), 'Judul'); obj.body = required(clean(obj.body), 'Pengumuman', 10000); }
          if (existing) Object.assign(existing, obj); else s[type].push(obj);
          validateState(s); audit(s, type + '.saved', obj.name || obj.title); return existing || obj;
        });
      },
      checkout(input) {
        if (input.idempotencyKey) {
          required(input.idempotencyKey, 'Kunci transaksi', 200);
          const previous = current.transactions.find(t => t.idempotencyKey === input.idempotencyKey);
          if (previous) return previous;
        }
        return mutate(s => {
          const shift = requireShift(s); methodCheck(input.method);
          if (!Array.isArray(input.items) || !input.items.length) fail('Keranjang masih kosong.');
          const member = input.memberId ? find(s, 'members', input.memberId) : null;
          const grouped = new Map();
          input.items.forEach(item => {
            if (!item || !['package', 'product'].includes(item.type)) fail('Item keranjang tidak valid.'); finite(item.qty, 'Jumlah item', 1, true);
            const key = item.type + ':' + item.id; const previous = grouped.get(key); if (previous) previous.qty += item.qty; else grouped.set(key, { type: item.type, id: item.id, qty: item.qty });
          });
          const items = Array.from(grouped.values()).map(item => {
            const master = find(s, item.type === 'package' ? 'packages' : 'products', item.id);
            if (!master.active) fail(master.name + ' sedang tidak dijual.');
            if (item.type === 'package' && !member) fail('Pilih member sebelum membeli paket.');
            if (item.type === 'product' && master.stock < item.qty) fail('Stok ' + master.name + ' tidak mencukupi.');
            return { ...item, name: master.name, ...(item.type === 'package' ? { kind: master.kind } : {}), price: master.price, total: master.price * item.qty };
          });
          const access = items.filter(i => i.type === 'package' && i.kind !== 'pt');
          if (access.reduce((sum, i) => sum + i.qty, 0) > 1) fail('Satu transaksi hanya boleh memiliki satu paket membership atau daily pass.');
          if (access.length && status(member) === 'frozen') fail('Akhiri freeze sebelum memperpanjang membership.');
          const subtotal = items.reduce((sum, i) => sum + i.total, 0); finite(subtotal, 'Subtotal', 0, true);
          const discount = input.discount == null ? 0 : input.discount; finite(discount, 'Diskon', 0, true); if (discount > subtotal) fail('Diskon tidak boleh melebihi subtotal.');
          const total = subtotal - discount;
          const cashReceived = input.method === 'cash' ? input.cashReceived : 0;
          if (input.method === 'cash') { finite(cashReceived, 'Uang diterima', 0, true); if (cashReceived < total) fail('Uang tunai yang diterima belum mencukupi.'); }
          else if (input.confirmed !== true) fail('Konfirmasi bahwa pembayaran ' + (input.method === 'qris' ? 'QRIS' : 'transfer') + ' sudah diterima.');
          const before = member && items.some(i => i.type === 'package') ? benefits(member) : null;
          items.forEach(item => {
            if (item.type === 'product') find(s, 'products', item.id).stock -= item.qty;
            else {
              const pkg = find(s, 'packages', item.id);
              if (pkg.kind === 'pt') member.ptCredits += pkg.sessions * item.qty;
              else {
                const previousEnd = member.endDate;
                const renewing = previousEnd && previousEnd >= today();
                member.startDate = renewing ? (member.startDate || today()) : today();
                member.endDate = renewing ? addDays(previousEnd, pkg.days) : addDays(today(), pkg.days - 1);
                member.packageId = pkg.id; member.frozenUntil = null; member.freezeStarted = null; member.freezeDays = 0;
              }
            }
          });
          const invoicePrefix = 'FM-' + today().replace(/-/g, '') + '-';
          let invoiceSerial = s.transactions.filter(t => t.day === today()).length + 1;
          while (s.transactions.some(t => t.number === invoicePrefix + String(invoiceSerial).padStart(4, '0'))) invoiceSerial++;
          const tx = { id: id('tx'), number: invoicePrefix + String(invoiceSerial).padStart(4, '0'), date: now(), day: today(), memberId: member ? member.id : null, memberName: member ? member.name : 'Walk-in', items, subtotal, discount, total, method: input.method, cashReceived, change: input.method === 'cash' ? cashReceived - total : 0, status: 'paid', shiftId: shift.id, notes: clean(input.notes), ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}), ...(before ? { _before: before, _after: benefits(member) } : {}) };
          s.transactions.push(tx); audit(s, 'sale.created', tx.number + ' · ' + money(total)); return tx;
        });
      },
      checkIn(memberId) {
        return mutate(s => {
          const m = find(s, 'members', memberId); if (!['active', 'expiring'].includes(status(m))) fail(status(m) === 'frozen' ? 'Membership sedang freeze. Akhiri freeze sebelum check-in.' : 'Membership belum aktif atau sudah habis. Perpanjang dahulu.');
          if (s.checkins.some(c => c.memberId === memberId && c.day === today())) fail(m.name + ' sudah check-in hari ini.');
          const item = { id: id('check'), memberId, name: m.name, date: now(), day: today() }; s.checkins.push(item); audit(s, 'checkin.created', m.name); return item;
        });
      },
      bookPT(input) {
        return mutate(s => {
          const m = find(s, 'members', input.memberId); const trainer = find(s, 'staff', input.trainerId);
          if (trainer.role !== 'trainer' || !trainer.active) fail('Pilih trainer yang aktif.');
          dateCheck(input.date); if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time || '')) fail('Jam sesi tidak valid.');
          if (input.date < today() || Date.parse(input.date + 'T' + input.time + ':00+07:00') < clock().getTime()) fail('Sesi baru harus dijadwalkan pada waktu yang akan datang.');
          if (timeMinutes(input.time) > 23 * 60) fail('Sesi 60 menit harus selesai pada hari yang sama.');
          const reserved = s.ptSessions.filter(p => p.memberId === m.id && p.status === 'booked').length;
          if (m.ptCredits <= reserved) fail('Sisa kredit PT sudah habis atau seluruhnya dipesan.');
          if (s.ptSessions.some(p => p.status !== 'cancelled' && p.date === input.date && Math.abs(timeMinutes(p.time) - timeMinutes(input.time)) < 60 && (p.memberId === m.id || p.trainerId === trainer.id))) fail('Jadwal bentrok. Member atau trainer memiliki sesi pada jam tersebut.');
          const p = { id: id('pt'), memberId: m.id, trainerId: trainer.id, date: input.date, time: input.time, status: 'booked', notes: clean(input.notes), createdAt: now() }; s.ptSessions.push(p); audit(s, 'pt.booked', m.name + ' · ' + trainer.name + ' · ' + p.date + ' ' + p.time); return p;
        });
      },
      completePT(sessionId) {
        return mutate(s => {
          const session = find(s, 'ptSessions', sessionId); if (session.status !== 'booked') fail('Sesi ini sudah selesai atau dibatalkan.');
          if (Date.parse(session.date + 'T' + session.time + ':00+07:00') > clock().getTime()) fail('Sesi belum dimulai. Selesaikan setelah jadwal sesi dimulai.');
          const m = find(s, 'members', session.memberId); if (m.ptCredits < 1) fail('Kredit PT tidak mencukupi.');
          m.ptCredits--; session.status = 'completed'; session.completedAt = now(); audit(s, 'pt.completed', m.name + ' · 1 kredit digunakan.'); return session;
        });
      },
      cancelPT(sessionId) {
        return mutate(s => {
          const p = find(s, 'ptSessions', sessionId); if (p.status !== 'booked') fail('Hanya sesi yang masih dipesan yang bisa dibatalkan.');
          p.status = 'cancelled'; p.cancelledAt = now(); audit(s, 'pt.cancelled', find(s, 'members', p.memberId).name); return p;
        });
      },
      receiveStock(input) {
        return mutate(s => {
          const shift = requireShift(s); const product = find(s, 'products', input.productId); find(s, 'suppliers', input.supplierId);
          finite(input.qty, 'Jumlah stok', 1, true); finite(input.unitCost, 'Harga beli', 0, true); methodCheck(input.method);
          const total = input.qty * input.unitCost; finite(total, 'Total pembelian', 0, true);
          if (input.method === 'cash' && total > summary(s).expectedCash) fail('Saldo kas shift tidak cukup untuk pembelian ini.');
          const p = { id: id('buy'), date: today(), productId: product.id, supplierId: input.supplierId, qty: input.qty, unitCost: input.unitCost, total, method: input.method, shiftId: shift.id };
          product.cost = Math.round((product.stock * product.cost + total) / (product.stock + input.qty)); product.stock += input.qty; s.purchases.push(p); audit(s, 'stock.received', product.name + ' +' + input.qty); return p;
        });
      },
      addExpense(input) {
        return mutate(s => {
          const shift = requireShift(s); finite(input.amount, 'Nominal biaya', 1, true); methodCheck(input.method); required(clean(input.category), 'Kategori'); required(clean(input.description), 'Keterangan biaya', 1000);
          if (input.method === 'cash' && input.amount > summary(s).expectedCash) fail('Saldo kas shift tidak cukup untuk pengeluaran ini.');
          const item = { id: id('exp'), date: today(), category: clean(input.category), amount: input.amount, method: input.method, description: clean(input.description), shiftId: shift.id }; s.expenses.push(item); audit(s, 'expense.created', item.category + ' · ' + money(item.amount)); return item;
        });
      },
      openShift(openingCash) {
        return mutate(s => {
          if (activeShift(s)) fail('Masih ada shift terbuka. Tutup shift dahulu.'); finite(openingCash, 'Kas awal', 0, true);
          const item = { id: id('shift'), openedAt: now(), closedAt: null, openingCash, closingCash: null, expectedCash: null, variance: null, notes: '' }; s.shifts.push(item); audit(s, 'shift.opened', 'Kas awal ' + money(openingCash)); return item;
        });
      },
      shiftSummary() { return summary(current); },
      closeShift(input) {
        return mutate(s => {
          const shift = requireShift(s); finite(input.closingCash, 'Kas fisik akhir', 0, true); const expectedCash = summary(s).expectedCash; const variance = input.closingCash - expectedCash;
          if (variance !== 0 && !clean(input.notes)) fail('Isi catatan untuk menjelaskan selisih kas.');
          Object.assign(shift, { closedAt: now(), closingCash: input.closingCash, expectedCash, variance, notes: clean(input.notes) }); audit(s, 'shift.closed', 'Kas fisik ' + money(shift.closingCash) + ' · Selisih ' + money(variance)); return shift;
        });
      },
      voidTransaction(transactionId, reason) {
        return mutate(s => {
          required(clean(reason), 'Alasan pembatalan', 1000); const shift = requireShift(s); const tx = find(s, 'transactions', transactionId);
          if (tx.status !== 'paid') fail('Transaksi sudah dibatalkan.'); if (tx.shiftId !== shift.id) fail('Pembatalan hanya tersedia untuk transaksi shift yang sedang terbuka.');
          if (tx.items.some(i => i.type === 'package')) {
            if (!tx._before || !tx._after) fail('Transaksi historis demo tidak dapat dibatalkan.');
            const m = find(s, 'members', tx.memberId);
            if (JSON.stringify(benefits(m)) !== JSON.stringify(tx._after)) fail('Benefit member sudah berubah atau digunakan. Pembatalan otomatis tidak aman.');
            const membershipChanged = tx.items.some(i => i.type === 'package' && i.kind !== 'pt');
            if (membershipChanged && s.checkins.some(c => c.memberId === m.id && c.date >= tx.date)) fail('Membership sudah digunakan untuk check-in. Transaksi tidak dapat dibatalkan.');
            if (s.ptSessions.some(p => p.memberId === m.id && p.status !== 'cancelled' && p.createdAt >= tx.date)) fail('Kredit member sudah terkait sesi PT. Batalkan booking dahulu.');
            if (s.ptSessions.filter(p => p.memberId === m.id && p.status === 'booked').length > tx._before.ptCredits) fail('Saldo sebelum transaksi tidak cukup untuk reservasi PT yang ada.');
            Object.assign(m, tx._before);
          }
          if (tx.method === 'cash' && summary(s).expectedCash < tx.total) fail('Saldo kas tidak cukup untuk mengembalikan pembayaran tunai.');
          tx.items.filter(i => i.type === 'product').forEach(i => { find(s, 'products', i.id).stock += i.qty; });
          tx.status = 'void'; tx.voidReason = clean(reason); tx.voidedAt = now(); audit(s, 'sale.voided', tx.number + ' · ' + tx.voidReason); return tx;
        });
      },
      metrics(fromDate = today(), toDate = today()) {
        dateCheck(fromDate); dateCheck(toDate); if (fromDate > toDate) fail('Tanggal awal harus sebelum tanggal akhir.');
        const result = { total: 0, membership: 0, pt: 0, products: 0, daypass: 0, cash: 0, qris: 0, transfer: 0, count: 0, expenses: 0, purchases: 0, netCashflow: 0 };
        current.transactions.filter(t => t.status === 'paid' && t.day >= fromDate && t.day <= toDate).forEach(t => {
          result.total += t.total; result[t.method] += t.total; result.count++;
          // Largest remainder allocation keeps every rupiah attributed exactly once.
          const allocated = t.items.map(i => { const exact = t.subtotal ? i.total * t.total / t.subtotal : 0; return { item: i, amount: Math.floor(exact), remainder: exact - Math.floor(exact) }; });
          let leftover = t.total - allocated.reduce((sum, a) => sum + a.amount, 0);
          allocated.slice().sort((a, b) => b.remainder - a.remainder).forEach(a => { if (leftover > 0) { a.amount++; leftover--; } });
          allocated.forEach(a => { result[a.item.type === 'product' ? 'products' : a.item.kind] += a.amount; });
        });
        result.expenses = current.expenses.filter(e => e.date >= fromDate && e.date <= toDate).reduce((sum, e) => sum + e.amount, 0);
        result.purchases = current.purchases.filter(p => p.date >= fromDate && p.date <= toDate).reduce((sum, p) => sum + p.total, 0);
        result.netCashflow = result.total - result.expenses - result.purchases; return result;
      },
      revenueSeries(days = 7) { finite(days, 'Jumlah hari', 1, true); if (days > 366) fail('Grafik maksimal 366 hari.'); return Array.from({ length: days }, (_, i) => { const date = addDays(today(), i - days + 1); return { date, total: api.metrics(date, date).total }; }); },
      exportBackup() { return JSON.stringify(current, null, 2); },
      importBackup(text) {
        if (typeof text !== 'string' || text.length > 20000000) fail('File backup tidak valid atau terlalu besar.');
        let draft; try { draft = JSON.parse(text); } catch (_) { fail('File backup bukan JSON yang valid.'); }
        validateState(draft); audit(draft, 'backup.imported', 'Backup valid diimpor.'); commit(draft, true); return current;
      },
      resetDemo() { const draft = seed(today(), now()); commit(draft, true); return current; }
    };
    return api;
  }
  const store = createStore();
  if (typeof module !== 'undefined' && module.exports) { module.exports = store; module.exports.createStore = createStore; }
  root.GymStore = store;
})(typeof window !== 'undefined' ? window : globalThis);
