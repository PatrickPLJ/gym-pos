'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const QR = require('../member-qr.js');
const qrcode = require('../assets/vendor/qrcode.js');
const jsQR = require('../assets/vendor/jsQR.js');
const source = fs.readFileSync(path.join(__dirname, '../member-qr.js'), 'utf8');
const token = 'FORMA-MEMBER:1:0123456789abcdef0123456789abcdef';

function raster(svg, scale = 8) {
  const count = Number(svg.match(/viewBox="0 0 (\d+) /)[1]);
  const width = count * scale, data = new Uint8ClampedArray(width * width * 4).fill(255);
  for (const [, col, row] of svg.matchAll(/M(\d+),(\d+)h1v1h-1z/g)) {
    for (let y = Number(row) * scale; y < (Number(row) + 1) * scale; y++) {
      for (let x = Number(col) * scale; x < (Number(col) + 1) * scale; x++) {
        const i = (y * width + x) * 4; data[i] = data[i + 1] = data[i + 2] = 0;
      }
    }
  }
  return { data, width, height: width };
}

function browser({ media, decoder = jsQR, imagePixels = raster(QR.svg(token)), naturalWidth, naturalHeight, imageFails = false, play } = {}) {
  const timers = new Map(), track = { stopped: 0, stop() { this.stopped++; } };
  const stream = { getTracks: () => [track] }, revoked = [], drawCalls = [], canvases = [], imageSources = [];
  let nextTimer = 1;
  const video = { readyState: 2, videoWidth: 640, videoHeight: 480, srcObject: null, pauses: 0, play: play || (() => Promise.resolve()), pause() { this.pauses++; }, setAttribute() {} };
  const root = {
    qrcode, jsQR: decoder, isSecureContext: true,
    navigator: { mediaDevices: { getUserMedia: media || (() => Promise.resolve(stream)) } },
    setTimeout: fn => { const id = nextTimer++; timers.set(id, fn); return id; },
    clearTimeout: id => timers.delete(id),
    URL: { createObjectURL: () => 'blob:test-local', revokeObjectURL: value => revoked.push(value) },
    Image: class { constructor() { this.naturalWidth = naturalWidth || imagePixels.width; this.naturalHeight = naturalHeight || imagePixels.height; } set src(value) { this.source = value; imageSources.push(value); queueMicrotask(() => imageFails ? this.onerror() : this.onload()); } },
    document: { createElement(tag) {
      assert.equal(tag, 'canvas');
      const el = { width: 0, height: 0, getContext: () => ({ fillRect() {}, drawImage: (...args) => drawCalls.push(args), getImageData: () => ({ data: imagePixels.data }) }) };
      canvases.push(el); return el;
    } }
  };
  vm.runInNewContext(source, root);
  return { api: root.MemberQR, root, video, stream, track, timers, revoked, drawCalls, canvases, imageSources, tick() { const next = timers.entries().next().value; if (next) { timers.delete(next[0]); next[1](); } } };
}

test('real SVG QR encodes exact member tokens and dense IDs with a four-module quiet zone', () => {
  const payloads = [token, 'FORMA-MEMBER:1:' + 'f'.repeat(32), 'FORMA-MEMBER:1:' + '0'.repeat(32), 'mem-001', 'A'.repeat(512)];
  payloads.forEach(payload => {
    const svg = QR.svg(payload), pixels = raster(svg);
    const decoded = jsQR(pixels.data, pixels.width, pixels.height);
    assert.equal(decoded && decoded.data, payload);
    const coords = [...svg.matchAll(/M(\d+),(\d+)h1v1h-1z/g)].map(match => [Number(match[1]), Number(match[2])]);
    const count = Number(svg.match(/viewBox="0 0 (\d+) /)[1]);
    assert.ok(coords.every(([x, y]) => x >= 4 && y >= 4 && x < count - 4 && y < count - 4));
    assert.match(svg, /shape-rendering="crispEdges"/);
  });
});

test('SVG never interpolates payload HTML or untrusted size attributes', () => {
  const attack = '<script>alert("name")</script>';
  const svg = QR.svg(attack, '" onload="alert(1)');
  assert.ok(!svg.includes('<script')); assert.ok(!svg.includes('onload'));
  assert.match(svg, /width="240"/);
  const pixels = raster(svg); assert.equal(jsQR(pixels.data, pixels.width, pixels.height).data, attack);
  [null, '', 'x'.repeat(513), '\u0000', '😀'].forEach(value => assert.throws(() => QR.svg(value), /tidak valid/));
});

test('file decoding stays local, returns exact raw code, and revokes its image URL', async () => {
  const env = browser();
  assert.equal(await env.api.decodeFile({ type: 'image/png', size: 2000 }), token);
  assert.deepEqual(env.revoked, ['blob:test-local']);
  assert.ok(env.drawCalls.length === 1);
  assert.equal(env.canvases[0].width, 1);
});

test('file decoding rejects unsupported, empty, oversized, unreadable, or non-QR images', async () => {
  const env = browser({ decoder: () => null });
  await assert.rejects(env.api.decodeFile({ type: 'image/svg+xml', size: 2000 }), /JPG, PNG, atau WebP/);
  await assert.rejects(env.api.decodeFile({ type: 'image/png', size: 0 }), /maksimal 10 MB/);
  await assert.rejects(env.api.decodeFile({ type: 'image/png', size: 10 * 1024 * 1024 + 1 }), /maksimal 10 MB/);
  await assert.rejects(env.api.decodeFile({ type: 'image/jpeg', size: 2000 }), /QR tidak ditemukan/);
  assert.deepEqual(env.revoked, ['blob:test-local']);
  const failed = browser({ imageFails: true });
  await assert.rejects(failed.api.decodeFile({ type: 'image/webp', size: 2000 }), /tidak dapat dibaca/);
  assert.deepEqual(failed.revoked, ['blob:test-local']);
});

test('file canvas is capped at 2048 pixels on its longest side', async () => {
  const env = browser({ naturalWidth: 8192, naturalHeight: 4096, decoder: () => ({ data: token }) });
  await env.api.decodeFile({ type: 'image/jpeg', size: 9000 });
  assert.equal(env.drawCalls[0][3], 2048); assert.equal(env.drawCalls[0][4], 1024);
});

test('member card draws the whole local Royal Gym logo, preserves readable QR and rejects remote profile/logo sources', async () => {
  const width = 1440, height = 900, pixels = new Uint8ClampedArray(width * height * 4).fill(255), paintedText = [];
  const env = browser();
  const ctx = {
    fillStyle: '#fff', font: '',
    measureText: value => ({ width: value.length * 21 }),
    fillText: value => paintedText.push(value),
    drawImage: (...args) => {
      assert.equal(args[0].source, './assets/royal-gym-logo.jpg?v=20260916-royal-gym');
      assert.equal(args.length, 5, 'Whole image must be drawn without source cropping');
      assert.ok(args[3] >= 100 && args[4] >= 100, 'Brand logo should remain legible');
      assert.ok(args[2] + args[4] < 206, 'Logo remains inside header and outside QR quiet zone');
      env.drawCalls.push(args);
    },
    fillRect(x, y, w, h) {
      const hex = this.fillStyle.slice(1), full = hex.length === 3 ? [...hex].map(char => char + char).join('') : hex;
      const rgb = [0, 2, 4].map(offset => parseInt(full.slice(offset, offset + 2), 16));
      for (let row = Math.max(0, y); row < Math.min(height, y + h); row++) {
        for (let col = Math.max(0, x); col < Math.min(width, x + w); col++) {
          const i = (row * width + col) * 4; pixels[i] = rgb[0]; pixels[i + 1] = rgb[1]; pixels[i + 2] = rgb[2];
        }
      }
    }
  };
  env.root.document.createElement = () => ({ width, height, getContext: () => ctx, toBlob: (callback, type) => callback(new Blob([pixels], { type })) });
  const blob = await env.api.cardPng({
    payload: token,
    member: { id: 'mem-test', name: '<script>synthetic</script>', startDate: '2026-09-16', endDate: '2026-10-15', phone: 'PRIVATE_PHONE', dateOfBirth: 'PRIVATE_DOB', address: 'PRIVATE_ADDRESS', photoDataUrl: 'https://example.invalid/private.jpg' },
    settings: { gymName: 'Royal Gym', branch: 'Demo', address: 'Gym business address' }, statusLabel: 'Aktif', logoUrl: 'https://example.invalid/tracking-logo.jpg'
  });
  assert.equal(blob.type, 'image/png');
  assert.equal(jsQR(pixels, width, height).data, token);
  assert.deepEqual(env.imageSources, ['./assets/royal-gym-logo.jpg?v=20260916-royal-gym']);
  assert.equal(env.drawCalls.length, 1); assert.ok(paintedText.includes('Royal Gym'));
  assert.ok(paintedText.some(value => value.includes('script')));
  assert.ok(!paintedText.some(value => /PRIVATE_/.test(value)));
  assert.ok(paintedText.includes('16 Sep 2026')); assert.ok(paintedText.includes('15 Okt 2026'));
});

test('closing before camera permission resolves stops late tracks without callbacks or playback', async () => {
  let allow, results = 0, errors = 0;
  const env = browser({ media: () => new Promise(resolve => { allow = resolve; }) });
  const camera = env.api.startCamera(env.video, () => results++, () => errors++);
  assert.equal(typeof camera.stop, 'function'); camera.stop(); camera.stop();
  allow(env.stream); await camera.ready;
  assert.equal(env.track.stopped, 1); assert.equal(env.video.srcObject, null);
  assert.equal(env.timers.size, 0); assert.equal(results, 0); assert.equal(errors, 0);
});

test('camera permission denial is friendly, occurs once, and does not reject ready', async () => {
  const errors = []; const env = browser({ media: () => Promise.reject({ name: 'NotAllowedError' }) });
  const camera = env.api.startCamera(env.video, () => assert.fail('No camera result expected'), error => errors.push(error.message));
  await camera.ready; camera.stop();
  assert.equal(errors.length, 1); assert.match(errors[0], /Izin kamera ditolak/); assert.equal(env.timers.size, 0);
});

test('camera stops stream before delivering a result and never scans it twice', async () => {
  const results = [], constraints = []; let env;
  env = browser({ media: request => { constraints.push(request); return Promise.resolve(env.stream); }, decoder: () => ({ data: token }) });
  const camera = env.api.startCamera(env.video, data => { assert.equal(env.track.stopped, 1); results.push(data); }, () => assert.fail('Unexpected camera error'));
  await camera.ready; env.tick(); env.tick(); camera.stop();
  assert.deepEqual(results, [token]); assert.equal(env.timers.size, 0);
  assert.equal(env.video.srcObject, null); assert.equal(env.video.playsInline, true); assert.equal(env.video.muted, true);
  assert.equal(constraints[0].audio, false); assert.equal(constraints[0].video.facingMode.ideal, 'environment');
});

test('cancel while video.play is pending cleans up, and late completion cannot restart scan', async () => {
  let playing; const env = browser({ play: () => new Promise(resolve => { playing = resolve; }) });
  const camera = env.api.startCamera(env.video, () => assert.fail('Canceled scan'), () => assert.fail('Canceled error'));
  await new Promise(setImmediate); camera.stop(); playing(); await camera.ready;
  assert.equal(env.track.stopped, 1); assert.equal(env.video.srcObject, null); assert.equal(env.timers.size, 0);
});

test('camera uses actionable fallbacks for insecure context, absent API, and unavailable device', async () => {
  for (const [configure, message] of [
    [env => { env.root.isSecureContext = false; }, /HTTPS/],
    [env => { delete env.root.navigator.mediaDevices; }, /belum mendukung kamera/],
    [env => { env.root.navigator.mediaDevices.getUserMedia = () => Promise.reject({ name: 'NotFoundError' }); }, /Kamera tidak ditemukan/]
  ]) {
    const env = browser(), errors = []; configure(env);
    await env.api.startCamera(env.video, () => assert.fail(), error => errors.push(error.message)).ready;
    assert.equal(errors.length, 1); assert.match(errors[0], message);
  }
});
