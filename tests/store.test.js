'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createStore } = require('../store.js');

function fixture() {
  let instant = new Date('2026-09-16T05:00:00.000Z');
  const entries = new Map();
  const storage = { getItem: key => entries.get(key) || null, setItem: (key, value) => entries.set(key, value) };
  const store = createStore({ storage, now: () => instant });
  return { store, entries, storage, travel: iso => { instant = new Date(iso); } };
}
const productOrder = (extra = {}) => ({ items: [{ type: 'product', id: 'prod-water', qty: 2 }], method: 'cash', cashReceived: 20000, ...extra });
const packageOrder = (memberId, id = 'pkg-month', extra = {}) => ({ memberId, items: [{ type: 'package', id, qty: 1 }], method: 'qris', confirmed: true, ...extra });
const fresh = store => store.saveMember({ name: 'Member Test', phone: '081255559999', email: 'test@example.test' });

test('seed is valid, fictional, and backup roundtrip preserves revenue', () => {
  const { store } = fixture(); const before = store.metrics();
  assert.equal(store.state.members.length, 22); assert.equal(store.state.products.length, 8);
  assert.equal(before.total, before.cash + before.qris + before.transfer);
  store.importBackup(store.exportBackup()); assert.deepEqual(store.metrics(), before);
});

test('cash insufficient, missing confirmation, stock oversell leave memory and disk untouched', () => {
  const { store, entries } = fixture(); const before = store.exportBackup(); const disk = [...entries.values()][0];
  assert.throws(() => store.checkout(productOrder({ cashReceived: 1000 })), /belum mencukupi/);
  assert.throws(() => store.checkout(productOrder({ method: 'qris' })), /Konfirmasi/);
  assert.throws(() => store.checkout(productOrder({ items: [{ type: 'product', id: 'prod-water', qty: 999 }] })), /Stok/);
  assert.equal(store.exportBackup(), before); assert.equal([...entries.values()][0], disk);
});

test('successful mixed sale reduces stock, renews from current end, and derives master prices', () => {
  const { store } = fixture(); const member = store.state.members.find(m => m.id === 'mem-001');
  const end = member.endDate; const stock = store.state.products[0].stock;
  const tx = store.checkout({ memberId: member.id, items: [{ type: 'package', id: 'pkg-month', qty: 1, price: 1 }, { type: 'product', id: 'prod-water', qty: 2 }], method: 'cash', cashReceived: 400000 });
  assert.equal(tx.total, 366000); assert.equal(tx.change, 34000); assert.equal(store.state.products[0].stock, stock - 2);
  assert.equal(store.state.members[0].endDate, store.addDays(end, 30));
  assert.throws(() => store.checkout(packageOrder(member.id, 'pkg-month', { items: [{ type: 'package', id: 'pkg-month', qty: 1 }, { type: 'package', id: 'pkg-day', qty: 1 }] })), /satu paket/);
});

test('expiry is inclusive; expired and new members start a 30-day term today', () => {
  const { store, travel } = fixture(); const m = fresh(store);
  store.checkout(packageOrder(m.id)); let member = store.state.members.find(x => x.id === m.id);
  assert.equal(member.startDate, '2026-09-16'); assert.equal(member.endDate, '2026-10-15');
  travel('2026-10-15T05:00:00.000Z'); assert.equal(store.status(member), 'expiring'); assert.equal(store.daysLeft(member), 0); store.checkIn(m.id);
  travel('2026-10-16T05:00:00.000Z'); assert.equal(store.status(member), 'expired'); assert.throws(() => store.checkIn(m.id), /sudah habis/);
  store.checkout(packageOrder(m.id)); member = store.state.members.find(x => x.id === m.id); assert.equal(member.endDate, '2026-11-14');
});

test('freeze extends once, blocks check-in and access sale, and early unfreeze returns unused days', () => {
  const { store, travel } = fixture(); const m = fresh(store); store.checkout(packageOrder(m.id));
  store.setFreeze(m.id, 7); let member = store.state.members.find(x => x.id === m.id);
  assert.equal(member.endDate, '2026-10-22'); assert.equal(store.status(member), 'frozen');
  assert.throws(() => store.setFreeze(m.id, 7), /belum dibekukan/);
  assert.throws(() => store.checkIn(m.id), /freeze/); assert.throws(() => store.checkout(packageOrder(m.id)), /freeze/);
  travel('2026-09-18T05:00:00.000Z'); store.unfreeze(m.id); member = store.state.members.find(x => x.id === m.id);
  assert.equal(member.endDate, '2026-10-17'); assert.equal(store.status(member), 'active');
});

test('check-in prevents daily duplicates; checkout idempotency prevents second charge', () => {
  const { store } = fixture(); const m = fresh(store); const tx = store.checkout(packageOrder(m.id, 'pkg-month', { idempotencyKey: 'one-payment' }));
  const before = store.exportBackup(); const repeated = store.checkout(packageOrder(m.id, 'pkg-month', { idempotencyKey: 'one-payment' }));
  assert.equal(tx.id, repeated.id); assert.equal(before, store.exportBackup());
  store.checkIn(m.id); assert.throws(() => store.checkIn(m.id), /sudah check-in/);
});

test('PT reservations, trainer/member overlaps, cancellation and exactly-once completion', () => {
  const { store, travel } = fixture(); const m = fresh(store); store.checkout(packageOrder(m.id, 'pkg-pt4'));
  const booking = store.bookPT({ memberId: m.id, trainerId: 'staff-adit', date: '2026-09-17', time: '09:00' });
  assert.throws(() => store.bookPT({ memberId: m.id, trainerId: 'staff-citra', date: '2026-09-17', time: '09:30' }), /bentrok/);
  assert.throws(() => store.bookPT({ memberId: 'mem-001', trainerId: 'staff-adit', date: '2026-09-17', time: '09:30' }), /bentrok/);
  assert.throws(() => store.completePT(booking.id), /belum dimulai/);
  const cancelled = store.bookPT({ memberId: m.id, trainerId: 'staff-adit', date: '2026-09-18', time: '09:00' }); store.cancelPT(cancelled.id);
  assert.equal(store.state.members.find(x => x.id === m.id).ptCredits, 4);
  store.bookPT({ memberId: m.id, trainerId: 'staff-adit', date: '2026-09-18', time: '09:00' });
  store.bookPT({ memberId: m.id, trainerId: 'staff-adit', date: '2026-09-19', time: '09:00' });
  store.bookPT({ memberId: m.id, trainerId: 'staff-adit', date: '2026-09-20', time: '09:00' });
  assert.throws(() => store.bookPT({ memberId: m.id, trainerId: 'staff-adit', date: '2026-09-21', time: '09:00' }), /seluruhnya dipesan/);
  travel('2026-09-17T03:30:00.000Z'); store.completePT(booking.id); assert.equal(store.state.members.find(x => x.id === m.id).ptCredits, 3);
  assert.throws(() => store.completePT(booking.id), /sudah selesai/);
});

test('cash close reconciles opening plus cash sales minus cash expenses and purchases', () => {
  const { store } = fixture(); const initial = store.shiftSummary().expectedCash;
  store.checkout(productOrder()); store.addExpense({ category: 'Kebersihan', amount: 20000, method: 'cash', description: 'Sabun lantai' });
  store.receiveStock({ productId: 'prod-water', supplierId: 'sup-hydra', qty: 5, unitCost: 4000, method: 'cash' });
  store.addExpense({ category: 'Internet', amount: 30000, method: 'transfer', description: 'Internet demo' });
  const expected = initial + 16000 - 20000 - 20000; assert.equal(store.shiftSummary().expectedCash, expected);
  assert.throws(() => store.closeShift({ closingCash: expected - 1000 }), /catatan/);
  const closed = store.closeShift({ closingCash: expected, notes: '' }); assert.equal(closed.variance, 0); assert.equal(store.shiftSummary().shift, null);
  assert.throws(() => store.checkout(productOrder()), /Buka shift/); store.openShift(100000); assert.throws(() => store.openShift(100000), /Masih ada shift/);
});

test('discount is allocated exactly to revenue categories and channels', () => {
  const { store } = fixture(); const m = fresh(store); const previous = store.metrics();
  const tx = store.checkout({ memberId: m.id, items: [{ type: 'package', id: 'pkg-month', qty: 1 }, { type: 'package', id: 'pkg-pt4', qty: 1 }, { type: 'product', id: 'prod-water', qty: 2 }], discount: 123457, method: 'transfer', confirmed: true });
  const metrics = store.metrics(); assert.equal(metrics.total - previous.total, tx.total);
  assert.equal(metrics.total, metrics.membership + metrics.pt + metrics.products + metrics.daypass);
  assert.equal(metrics.total, metrics.cash + metrics.qris + metrics.transfer);
});

test('safe void restores stock and membership, retains audit; used benefit blocks void', () => {
  const { store } = fixture(); const m = fresh(store); const stock = store.state.products[0].stock;
  const tx = store.checkout({ ...packageOrder(m.id), items: [{ type: 'package', id: 'pkg-month', qty: 1 }, { type: 'product', id: 'prod-water', qty: 1 }] });
  store.voidTransaction(tx.id, 'Salah pilih member'); assert.equal(store.state.products[0].stock, stock); assert.equal(store.state.members.find(x => x.id === m.id).endDate, null);
  assert.equal(store.state.transactions.find(x => x.id === tx.id).status, 'void'); assert.ok(store.state.audit.some(a => a.action === 'sale.voided'));
  const used = store.checkout(packageOrder(m.id)); store.checkIn(m.id); const before = store.exportBackup();
  assert.throws(() => store.voidTransaction(used.id, 'Sudah dipakai'), /check-in/); assert.equal(store.exportBackup(), before);
});

test('void refuses changed benefits and PT dependency but allows cancelled reservation', () => {
  const { store } = fixture(); const m = fresh(store); const first = store.checkout(packageOrder(m.id)); store.checkout(packageOrder(m.id));
  assert.throws(() => store.voidTransaction(first.id, 'Salah'), /sudah berubah/);
  const pt = store.checkout(packageOrder(m.id, 'pkg-pt4')); const booking = store.bookPT({ memberId: m.id, trainerId: 'staff-adit', date: '2026-09-17', time: '13:00' });
  assert.throws(() => store.voidTransaction(pt.id, 'Salah'), /sesi PT/); store.cancelPT(booking.id); store.voidTransaction(pt.id, 'Booking dibatalkan');
  assert.equal(store.state.members.find(x => x.id === m.id).ptCredits, 0);
});

test('invalid backup cannot change state; validates finite numbers, ids, dates and relations', () => {
  const { store } = fixture(); const before = store.exportBackup();
  const cases = [
    s => { s.products[0].stock = -1; },
    s => { s.products[0].stock = 0.5; },
    s => { s.members[0].id = s.members[1].id; },
    s => { s.members[0].endDate = '2026-02-30'; },
    s => { s.members[0].packageId = 'missing'; },
    s => { s.transactions[0].total += 1; },
    s => { s.transactions[0].shiftId = 'missing'; },
    s => { s.shifts.find(x => x.closedAt).expectedCash += 12345; },
    s => { s.shifts.find(x => x.closedAt).variance += 111; },
    s => { s.ptSessions[0].trainerId = 'staff-owner'; },
    s => { s.shifts.push({ ...s.shifts.find(x => x.closedAt === null), id: 'another-open-shift' }); }
  ];
  for (const mutate of cases) { const invalid = JSON.parse(before); mutate(invalid); assert.throws(() => store.importBackup(JSON.stringify(invalid))); assert.equal(store.exportBackup(), before); }
  assert.throws(() => store.importBackup(before.replace('"stock": 42', '"stock": 1e309'))); assert.equal(store.exportBackup(), before);
});

test('backup rejects impossible reversal snapshots and leaves state intact', () => {
  const { store } = fixture(); const m = fresh(store); const tx = store.checkout(packageOrder(m.id)); const before = store.exportBackup();
  const invalid = JSON.parse(before); invalid.transactions.find(t => t.id === tx.id)._before = { ...invalid.transactions.find(t => t.id === tx.id)._after, startDate: '2026-10-01', endDate: '2026-09-01' };
  assert.throws(() => store.importBackup(JSON.stringify(invalid)), /Masa aktif/); assert.equal(store.exportBackup(), before);
});

test('corrupt storage is preserved and blocked until explicit recovery', () => {
  const { storage, entries } = fixture(); storage.setItem('forma.gym.pos.v1', '{broken');
  const store = createStore({ storage }); assert.match(store.storageError, /rusak/);
  assert.equal(entries.get('forma.gym.pos.v1'), '{broken'); assert.throws(() => store.checkout(productOrder()), /rusak/);
  store.resetDemo(); assert.equal(store.storageError, null); assert.doesNotThrow(() => JSON.parse(entries.get('forma.gym.pos.v1')));
});

test('disk write failure is atomic and never reports a successful sale', () => {
  const { store, storage } = fixture(); const before = store.exportBackup(); storage.setItem = () => { throw Error('Quota'); };
  assert.throws(() => store.checkout(productOrder()), /gagal disimpan/); assert.equal(store.exportBackup(), before);
});

test('Asia Jakarta boundary and open shift across midnight keep drawer and daily totals separate', () => {
  const { store, travel } = fixture(); const shiftId = store.shiftSummary().shift.id;
  travel('2026-09-16T17:01:00.000Z'); assert.equal(store.today(), '2026-09-17');
  const cashBefore = store.shiftSummary().cashSales; store.checkout(productOrder());
  assert.equal(store.metrics().total, 16000); assert.equal(store.shiftSummary().cashSales, cashBefore + 16000); assert.equal(store.shiftSummary().shift.id, shiftId);
});

const memberById = (store, id) => store.state.members.find(m => m.id === id);
const editMember = (store, id, patch) => store.saveMember({ ...memberById(store, id), ...patch });
const manualMember = (store, patch = {}) => store.saveMember({ name: 'Laras Demo', phone: '081200009991', packageId: 'pkg-month', startDate: '2026-09-01', endDate: '2026-09-30', ...patch });
const pngPhoto = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
const stripNewFields = state => {
  state.members.forEach(m => ['qrToken', 'dateOfBirth', 'gender', 'address', 'photoDataUrl', 'accessRevision'].forEach(key => { delete m[key]; }));
  state.transactions.forEach(t => { delete t._accessRevision; });
  return state;
};

test('legacy stored data migrates once without changing history, revenue, benefits, or shifts', () => {
  const { store, storage } = fixture();
  const oldState = stripNewFields(JSON.parse(store.exportBackup()));
  storage.setItem('forma.gym.pos.v1', JSON.stringify(oldState));
  const migrated = createStore({ storage, now: () => new Date('2026-09-16T05:00:00.000Z') });
  assert.equal(migrated.storageError, null);
  assert.deepEqual(stripNewFields(JSON.parse(migrated.exportBackup())), oldState);
  assert.equal(new Set(migrated.state.members.map(m => m.qrToken)).size, oldState.members.length);
  migrated.state.members.forEach(m => assert.match(m.qrToken, /^[a-f0-9]{32}$/));
  const persisted = storage.getItem('forma.gym.pos.v1');
  const reloaded = createStore({ storage, now: () => new Date('2026-09-16T05:00:00.000Z') });
  assert.deepEqual(reloaded.state, migrated.state);
  assert.equal(storage.getItem('forma.gym.pos.v1'), persisted);
});

test('Royal Gym replaces only the exact default brand, persists once, and retains all data and QR tokens', () => {
  const { store, storage, entries } = fixture();
  const oldState = JSON.parse(store.exportBackup());
  oldState.settings = { ...oldState.settings, gymName: 'FORMA', branch: 'Cabang pilihan', address: 'Alamat gym pilihan', phone: '081233334444' };
  oldState.products.find(p => p.id === 'prod-towel').name = 'Handuk FORMA';
  oldState.announcements[0].title = 'Selamat datang di FORMA';
  storage.setItem('forma.gym.pos.v1', JSON.stringify(oldState));
  const write = storage.setItem; let writes = 0;
  storage.setItem = (key, value) => { assert.equal(key, 'forma.gym.pos.v1'); writes++; write(key, value); };
  const migrated = createStore({ storage, now: () => new Date('2026-09-16T05:00:00.000Z') });
  const expected = JSON.parse(JSON.stringify(oldState)); expected.settings.gymName = 'Royal Gym';
  assert.equal(migrated.storageError, null); assert.deepEqual(migrated.state, expected); assert.equal(writes, 1);
  assert.deepEqual([...entries.keys()], ['forma.gym.pos.v1']);
  oldState.members.forEach(m => assert.equal(migrated.memberQrPayload(m.id), 'FORMA-MEMBER:1:' + m.qrToken));
  const reloaded = createStore({ storage, now: () => new Date('2026-09-16T05:00:00.000Z') });
  assert.deepEqual(reloaded.state, expected); assert.equal(writes, 1);
});

test('brand migration and legacy member normalization both run without short-circuiting', () => {
  const { store, storage } = fixture(); const originalToken = store.state.members[0].qrToken;
  const legacy = stripNewFields(JSON.parse(store.exportBackup())); legacy.settings.gymName = 'FORMA'; legacy.members[0].qrToken = originalToken;
  storage.setItem('forma.gym.pos.v1', JSON.stringify(legacy));
  const migrated = createStore({ storage, now: () => new Date('2026-09-16T05:00:00.000Z') });
  assert.equal(migrated.storageError, null); assert.equal(migrated.state.settings.gymName, 'Royal Gym');
  assert.equal(migrated.state.members[0].qrToken, originalToken);
  migrated.state.members.forEach(m => { assert.match(m.qrToken, /^[a-f0-9]{32}$/); assert.equal(m.accessRevision, 0); assert.equal(m.photoDataUrl, null); });
  const restored = stripNewFields(JSON.parse(migrated.exportBackup())); restored.settings.gymName = 'FORMA'; restored.members[0].qrToken = originalToken;
  assert.deepEqual(restored, legacy);
  const oldBackup = JSON.stringify(legacy); migrated.importBackup(oldBackup);
  assert.equal(migrated.state.settings.gymName, 'Royal Gym'); assert.equal(migrated.state.members[0].qrToken, originalToken);
  assert.equal(new Set(migrated.state.members.map(m => m.qrToken)).size, legacy.members.length);
});

test('brand migration preserves custom gym names on load and import; former default backups retain history and tokens', () => {
  const { store, storage } = fixture(); const seedState = JSON.parse(store.exportBackup());
  for (const gymName of ['Gym Mandiri', 'FORMA Studio', 'forma', ' FORMA ', 'Royal Gym']) {
    const backup = JSON.parse(JSON.stringify(seedState)); backup.settings.gymName = gymName;
    storage.setItem('forma.gym.pos.v1', JSON.stringify(backup));
    const loaded = createStore({ storage, now: () => new Date('2026-09-16T05:00:00.000Z') });
    assert.deepEqual(loaded.state, backup);
    loaded.importBackup(JSON.stringify(backup));
    const imported = JSON.parse(loaded.exportBackup()); imported.audit.pop(); assert.deepEqual(imported, backup);
  }
  const oldBackup = JSON.parse(JSON.stringify(seedState)); oldBackup.settings.gymName = 'FORMA';
  store.importBackup(JSON.stringify(oldBackup));
  const imported = JSON.parse(store.exportBackup()); imported.audit.pop(); oldBackup.settings.gymName = 'Royal Gym';
  assert.deepEqual(imported, oldBackup);
});

test('Royal Gym normalization does not allow an invalid backup to overwrite stored data', () => {
  const { store, storage } = fixture(); const before = store.exportBackup(), disk = storage.getItem('forma.gym.pos.v1');
  const invalid = JSON.parse(before); invalid.settings.gymName = 'FORMA'; invalid.members[0].qrToken = null;
  assert.throws(() => store.importBackup(JSON.stringify(invalid)));
  assert.equal(store.exportBackup(), before); assert.equal(storage.getItem('forma.gym.pos.v1'), disk);
});

test('manual initial access and profile store no sale, preserve optional fields, and derive customer type', () => {
  const { store } = fixture(); const revenue = store.metrics(); const transactions = store.state.transactions.length;
  const m = manualMember(store, { dateOfBirth: '1994-06-12', gender: 'female', address: 'Jalan Contoh Fiktif 8', notes: 'Profil demo', photoDataUrl: pngPhoto, customerType: 'monthly' });
  assert.equal(store.status(m), 'active'); assert.equal(store.getCustomerType(m), 'monthly');
  assert.deepEqual(store.metrics(), revenue); assert.equal(store.state.transactions.length, transactions);
  const changed = store.saveMember({ id: m.id, name: 'Laras Demo Baru', phone: m.phone });
  ['dateOfBirth', 'gender', 'address', 'notes', 'photoDataUrl', 'qrToken', 'startDate', 'endDate'].forEach(k => assert.equal(changed[k], m[k]));
  assert.equal(store.state.audit.find(a => a.action === 'member.access.updated').description.includes('Pendaftaran / masa aktif awal'), true);
  const other = fresh(store); assert.equal(store.getCustomerType(other), 'nonmember');
  const tx = store.checkout(packageOrder(other.id, 'pkg-day')); assert.equal(store.getCustomerType(memberById(store, other.id)), 'daily');
  store.voidTransaction(tx.id, 'Salah paket demo'); assert.equal(store.getCustomerType(memberById(store, other.id)), 'nonmember');
});

test('invalid dates, missing access fields, future birthday, and customer type errors are atomic', () => {
  const { store, storage } = fixture(); const before = store.exportBackup(); const disk = storage.getItem('forma.gym.pos.v1');
  const invalid = [
    { startDate: '2026-10-01', endDate: '2026-09-01' },
    { startDate: '2026-02-30' },
    { startDate: '' },
    { packageId: null },
    { endDate: null },
    { packageId: 'pkg-pt4' },
    { dateOfBirth: '2026-09-17' },
    { dateOfBirth: '1999-02-29' },
    { customerType: 'daily' },
    { gender: 'unknown' },
    { address: 123 }
  ];
  for (const patch of invalid) {
    assert.throws(() => manualMember(store, patch));
    assert.equal(store.exportBackup(), before); assert.equal(storage.getItem('forma.gym.pos.v1'), disk);
  }
});

test('manual date correction requires audit reason, retains PT, and blocks unsafe rollback even after restoring dates', () => {
  const { store } = fixture(); const m = fresh(store); const tx = store.checkout(packageOrder(m.id));
  store.checkout(packageOrder(m.id, 'pkg-pt4')); const initial = memberById(store, m.id); const before = store.exportBackup();
  assert.throws(() => editMember(store, m.id, { endDate: '2026-10-20' }), /Alasan perubahan/);
  assert.equal(store.exportBackup(), before);
  editMember(store, m.id, { endDate: '2026-10-20', membershipReason: 'Koreksi tanggal demo' });
  editMember(store, m.id, { endDate: initial.endDate, membershipReason: 'Kembalikan tanggal demo' });
  assert.equal(memberById(store, m.id).ptCredits, 4);
  assert.equal(memberById(store, m.id).qrToken, initial.qrToken);
  assert.throws(() => store.voidTransaction(tx.id, 'Tanggal sudah kembali'), /diubah manual/);
  const logs = store.state.audit.filter(a => a.action === 'member.access.updated');
  assert.equal(logs.length, 2); assert.match(logs[0].description, /2026-10-15.*2026-10-20.*Koreksi tanggal demo/);
});

test('frozen member can edit profile but cannot manually change package or dates', () => {
  const { store } = fixture(); const m = manualMember(store); store.setFreeze(m.id, 5);
  const frozen = memberById(store, m.id);
  editMember(store, m.id, { address: 'Alamat contoh diperbarui', photoDataUrl: pngPhoto });
  const before = store.exportBackup();
  assert.throws(() => editMember(store, m.id, { endDate: '2026-10-15', membershipReason: 'Koreksi' }), /Akhiri freeze/);
  assert.throws(() => editMember(store, m.id, { packageId: null, startDate: null, endDate: null, membershipReason: 'Hapus akses' }), /Akhiri freeze/);
  assert.equal(store.exportBackup(), before);
  assert.equal(memberById(store, m.id).endDate, frozen.endDate);
  assert.equal(memberById(store, m.id).qrToken, frozen.qrToken);
});

test('QR resolves private stable token, raw token and exact ID; rejects unknown, malformed and URL codes', () => {
  const { store } = fixture(); const m = manualMember(store); const payload = store.memberQrPayload(m.id);
  assert.match(payload, /^FORMA-MEMBER:1:[a-f0-9]{32}$/);
  assert.equal(payload.includes(m.name), false); assert.equal(payload.includes(m.phone), false);
  [payload, m.qrToken, m.id].forEach(code => assert.equal(store.resolveMemberCode(code).id, m.id));
  const before = store.exportBackup();
  ['', null, 'a'.repeat(129), 'FORMA-MEMBER:1:bad', 'FORMA-MEMBER:2:' + m.qrToken, 'f'.repeat(32), 'mem-missing', 'https://example.test/' + payload, 'javascript:alert(1)', 'data:text/plain,' + payload, 'FORMA-MEMBER:1:\n' + m.qrToken].forEach(code => assert.throws(() => store.checkInCode(code)));
  assert.equal(store.exportBackup(), before);
});

test('QR check-in allows final day inclusive and rejects expired, future-start, frozen, and duplicates', () => {
  const { store, travel } = fixture(); const m = manualMember(store, { endDate: '2026-09-16' }); const payload = store.memberQrPayload(m.id);
  store.checkInCode(payload); assert.throws(() => store.checkInCode(payload), /sudah check-in/);
  travel('2026-09-17T05:00:00.000Z'); assert.throws(() => store.checkInCode(payload), /sudah habis/);
  const future = manualMember(store, { name: 'Banyu Demo', phone: '081200009992', startDate: '2026-09-18', endDate: '2026-10-17' });
  assert.throws(() => store.checkInCode(store.memberQrPayload(future.id)), /belum aktif/);
  const frozen = manualMember(store, { name: 'Kirana Demo', phone: '081200009993' }); store.setFreeze(frozen.id, 4);
  assert.throws(() => store.checkInCode(store.memberQrPayload(frozen.id)), /freeze/);
});

test('same QR survives renewal, profile edits, freeze and unfreeze; ordinary save cannot override token', () => {
  const { store } = fixture(); const m = manualMember(store); const payload = store.memberQrPayload(m.id);
  store.checkout(packageOrder(m.id));
  editMember(store, m.id, { name: 'Laras Edit Demo', qrToken: '0'.repeat(32) });
  store.setFreeze(m.id, 7); store.unfreeze(m.id);
  assert.equal(store.memberQrPayload(m.id), payload);
  assert.equal(store.resolveMemberCode(payload).name, 'Laras Edit Demo');
});

test('backup roundtrip preserves profile photo and QR; legacy backup gets stable new QR without losing history', () => {
  const { store, storage } = fixture(); const m = manualMember(store, { dateOfBirth: '1995-05-12', gender: 'unspecified', address: 'Alamat contoh', photoDataUrl: pngPhoto });
  const payload = store.memberQrPayload(m.id); const before = JSON.parse(store.exportBackup());
  store.importBackup(JSON.stringify(before)); assert.equal(store.memberQrPayload(m.id), payload);
  assert.deepEqual(memberById(store, m.id), m);
  const legacy = stripNewFields(before); store.importBackup(JSON.stringify(legacy));
  const migrated = JSON.parse(store.exportBackup()); const restored = stripNewFields(JSON.parse(store.exportBackup())); restored.audit.pop();
  assert.deepEqual(restored, legacy);
  const reloaded = createStore({ storage, now: () => new Date('2026-09-16T05:00:00.000Z') });
  assert.deepEqual(reloaded.state, migrated);
});

test('invalid explicit QR and profile fields reject backup atomically instead of normalizing them away', () => {
  const { store, storage } = fixture(); const before = store.exportBackup(); const disk = storage.getItem('forma.gym.pos.v1');
  const changes = [
    s => { s.members[0].qrToken = s.members[1].qrToken; },
    s => { s.members[0].qrToken = null; },
    s => { s.members[0].qrToken = 'A'.repeat(32); },
    s => { s.members[0].photoDataUrl = 'data:image/svg+xml;base64,PHN2Zy8+'; },
    s => { s.members[0].photoDataUrl = 'data:image/png;base64,AAAA'; },
    s => { s.members[0].photoDataUrl = 'data:image/png;base64,' + Buffer.concat([Buffer.from('\x89PNG\r\n\x1a\n', 'binary'), Buffer.alloc(180 * 1024)]).toString('base64'); },
    s => { s.members[0].dateOfBirth = '2026-09-17'; },
    s => { s.members[0].gender = null; },
    s => { s.members[0].accessRevision = -1; },
    s => { s.members[0].customerType = 'daily'; }
  ];
  for (const change of changes) {
    const invalid = JSON.parse(before); change(invalid); assert.throws(() => store.importBackup(JSON.stringify(invalid)));
    assert.equal(store.exportBackup(), before); assert.equal(storage.getItem('forma.gym.pos.v1'), disk);
  }
});

test('legacy payment snapshots can still void safely after migration and identity update', () => {
  const { store } = fixture(); const m = fresh(store); const tx = store.checkout(packageOrder(m.id));
  store.importBackup(JSON.stringify(stripNewFields(JSON.parse(store.exportBackup()))));
  editMember(store, m.id, { name: 'Member Demo Diperbarui', address: 'Jalan contoh', photoDataUrl: pngPhoto });
  const token = memberById(store, m.id).qrToken;
  store.voidTransaction(tx.id, 'Salah pembayaran demo');
  const after = memberById(store, m.id);
  assert.equal(after.endDate, null); assert.equal(after.name, 'Member Demo Diperbarui');
  assert.equal(after.photoDataUrl, pngPhoto); assert.equal(after.qrToken, token);
});
