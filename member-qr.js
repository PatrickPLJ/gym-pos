(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory(root, require('./assets/vendor/qrcode.js'), require('./assets/vendor/jsQR.js'));
  else root.MemberQR = factory(root, root.qrcode, root.jsQR);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root, qrcode, jsQR) {
  'use strict';
  const QUIET = 4;
  const MAX_FILE_BYTES = 10 * 1024 * 1024;
  const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  const BRAND_LOGO = './assets/royal-gym-logo.jpg?v=20260916-royal-gym';
  const text = value => String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 500).trim();

  function matrix(payload) {
    if (typeof payload !== 'string' || !payload.length || payload.length > 512 || /[^\x20-\x7e]/.test(payload)) throw new Error('Kode member tidak valid.');
    if (typeof qrcode !== 'function') throw new Error('Pembuat QR belum termuat. Muat ulang halaman.');
    const code = qrcode(0, 'Q');
    code.addData(payload, 'Byte');
    code.make();
    const count = code.getModuleCount();
    return Array.from({ length: count }, (_, row) => Array.from({ length: count }, (_, col) => code.isDark(row, col)));
  }

  function svg(payload, size = 240) {
    const cells = matrix(payload), count = cells.length + QUIET * 2;
    const pixels = Number.isFinite(size) ? Math.max(120, Math.min(1600, Math.round(size))) : 240;
    let path = '';
    cells.forEach((row, y) => row.forEach((dark, x) => { if (dark) path += 'M' + (x + QUIET) + ',' + (y + QUIET) + 'h1v1h-1z'; }));
    // Payload never enters markup; only numeric module coordinates are inserted.
    return '<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Kode QR member" width="' + pixels + '" height="' + pixels + '" viewBox="0 0 ' + count + ' ' + count + '" shape-rendering="crispEdges"><rect width="' + count + '" height="' + count + '" fill="#fff"/><path d="' + path + '" fill="#000"/></svg>';
  }

  function canvas(width, height) {
    if (!root.document || typeof root.document.createElement !== 'function') throw new Error('Fitur gambar memerlukan browser.');
    const el = root.document.createElement('canvas');
    el.width = width; el.height = height;
    const ctx = el.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Browser belum mendukung pembacaan gambar.');
    return { el, ctx };
  }

  function loadImage(source) {
    return new Promise((resolve, reject) => {
      const image = new root.Image();
      const timer = root.setTimeout(() => { image.onload = image.onerror = null; reject(new Error('Gambar terlalu lama dibuka. Coba gambar lain.')); }, 15000);
      image.onload = () => { root.clearTimeout(timer); resolve(image); };
      image.onerror = () => { root.clearTimeout(timer); reject(new Error('Gambar tidak dapat dibaca. Gunakan JPG, PNG, atau WebP.')); };
      image.src = source;
    });
  }

  function decodePixels(ctx, width, height) {
    if (typeof jsQR !== 'function') throw new Error('Pemindai QR belum termuat. Muat ulang halaman.');
    const result = jsQR(ctx.getImageData(0, 0, width, height).data, width, height, { inversionAttempts: 'attemptBoth' });
    return result && result.data ? result.data : null;
  }

  async function decodeFile(file) {
    if (!file || !IMAGE_TYPES.includes(file.type)) throw new Error('Pilih gambar JPG, PNG, atau WebP.');
    if (!file.size || file.size > MAX_FILE_BYTES) throw new Error('Ukuran gambar maksimal 10 MB.');
    const url = root.URL.createObjectURL(file);
    try {
      const image = await loadImage(url);
      if (!image.naturalWidth || !image.naturalHeight) throw new Error('Ukuran gambar tidak valid.');
      const scale = Math.min(1, 2048 / Math.max(image.naturalWidth, image.naturalHeight));
      const width = Math.max(1, Math.round(image.naturalWidth * scale)), height = Math.max(1, Math.round(image.naturalHeight * scale));
      const { el, ctx } = canvas(width, height);
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, width, height);
      ctx.drawImage(image, 0, 0, width, height);
      const result = decodePixels(ctx, width, height);
      el.width = el.height = 1;
      if (!result) throw new Error('QR tidak ditemukan. Pilih gambar kartu yang jelas dan utuh, atau masukkan ID member.');
      return result;
    } finally { root.URL.revokeObjectURL(url); }
  }

  function cameraError(error) {
    const name = error && error.name;
    if (name === 'NotAllowedError' || name === 'SecurityError') return new Error('Izin kamera ditolak. Izinkan kamera di pengaturan browser, atau gunakan unggah gambar / ID member.');
    if (name === 'NotFoundError' || name === 'OverconstrainedError') return new Error('Kamera tidak ditemukan. Gunakan unggah gambar kartu atau masukkan ID member.');
    if (name === 'NotReadableError' || name === 'AbortError') return new Error('Kamera sedang dipakai atau belum siap. Tutup aplikasi kamera lain, atau gunakan unggah gambar / ID member.');
    return new Error('Kamera tidak dapat dibuka. Gunakan unggah gambar kartu atau masukkan ID member.');
  }

  function startCamera(video, onResult, onError) {
    let stopped = false, notified = false, stream = null, timer = null;
    const stopTracks = media => { if (media) media.getTracks().forEach(track => track.stop()); };
    const stop = () => {
      if (stopped) return;
      stopped = true;
      if (timer !== null) root.clearTimeout(timer);
      stopTracks(stream);
      if (video && stream && video.srcObject === stream) { video.pause(); video.srcObject = null; }
    };
    const fail = error => {
      if (stopped || notified) return;
      notified = true; stop();
      if (typeof onError === 'function') onError(error);
    };
    // The handle is synchronous so closing a dialog can cancel a pending permission request.
    const ready = (async () => {
      if (!video) { fail(new Error('Tampilan kamera tidak tersedia.')); return; }
      if (root.isSecureContext === false) { fail(new Error('Kamera memerlukan HTTPS. Gunakan tautan demo resmi, unggah gambar, atau ID member.')); return; }
      if (!root.navigator || !root.navigator.mediaDevices || !root.navigator.mediaDevices.getUserMedia) { fail(new Error('Browser ini belum mendukung kamera. Gunakan unggah gambar kartu atau ID member.')); return; }
      try {
        stream = await root.navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' } } });
        if (stopped) { stopTracks(stream); return; }
        video.muted = true; video.autoplay = true; video.playsInline = true;
        video.setAttribute('playsinline', '');
        video.srcObject = stream;
        await video.play();
        if (stopped) return;
        const { el, ctx } = canvas(1, 1);
        const scan = () => {
          if (stopped) return;
          let result = null;
          try {
            if (video.readyState >= 2 && video.videoWidth && video.videoHeight) {
              const scale = Math.min(1, 1000 / Math.max(video.videoWidth, video.videoHeight));
              el.width = Math.max(1, Math.round(video.videoWidth * scale)); el.height = Math.max(1, Math.round(video.videoHeight * scale));
              ctx.drawImage(video, 0, 0, el.width, el.height);
              result = decodePixels(ctx, el.width, el.height);
            }
          } catch (error) { fail(cameraError(error)); return; }
          if (result) {
            notified = true; stop(); el.width = el.height = 1;
            if (typeof onResult === 'function') onResult(result);
          } else timer = root.setTimeout(scan, 125);
        };
        timer = root.setTimeout(scan, 0);
      } catch (error) { fail(cameraError(error)); }
    })();
    return { stop, ready };
  }

  function fitText(ctx, value, maxWidth) {
    let result = text(value);
    if (ctx.measureText(result).width <= maxWidth) return result;
    while (result.length && ctx.measureText(result + '…').width > maxWidth) result = result.slice(0, -1);
    return result + '…';
  }

  function dateText(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'Belum ditentukan';
    const [year, month, day] = value.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    return Number(day) + ' ' + (months[Number(month) - 1] || '') + ' ' + year;
  }

  function drawQR(ctx, cells, x, y, box) {
    const count = cells.length + QUIET * 2, unit = Math.floor(box / count), size = count * unit;
    const left = x + Math.floor((box - size) / 2), top = y + Math.floor((box - size) / 2);
    ctx.fillStyle = '#fff'; ctx.fillRect(x, y, box, box);
    ctx.fillStyle = '#000';
    cells.forEach((row, rowIndex) => row.forEach((dark, colIndex) => {
      if (dark) ctx.fillRect(left + (colIndex + QUIET) * unit, top + (rowIndex + QUIET) * unit, unit, unit);
    }));
  }

  async function cardPng({ member, settings = {}, statusLabel = '', payload } = {}) {
    if (!member) throw new Error('Data member tidak tersedia.');
    const cells = matrix(payload);
    const { el, ctx } = canvas(1440, 900);
    if (root.document.fonts && root.document.fonts.load) {
      await Promise.all([root.document.fonts.load('700 48px "Plus Jakarta Sans"'), root.document.fonts.load('400 26px "Manrope"')]);
    }
    const label = (value, x, y, width, size = 24, weight = 400, color = '#526070') => {
      ctx.fillStyle = color; ctx.font = weight + ' ' + size + 'px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(fitText(ctx, value, width), x, y);
    };
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 1440, 900);
    ctx.fillStyle = '#011226'; ctx.fillRect(0, 0, 1440, 206);
    // The public brand asset is fixed and local. Never load a URL supplied in a profile or backup.
    const logo = await loadImage(BRAND_LOGO);
    if (!logo.naturalWidth || !logo.naturalHeight) throw new Error('Logo gym gagal dibaca. Muat ulang halaman lalu coba unduh kembali.');
    ctx.fillStyle = '#fff'; ctx.fillRect(66, 27, 152, 152);
    const logoScale = Math.min(146 / logo.naturalWidth, 146 / logo.naturalHeight);
    const logoWidth = logo.naturalWidth * logoScale, logoHeight = logo.naturalHeight * logoScale;
    ctx.drawImage(logo, 69 + (146 - logoWidth) / 2, 30 + (146 - logoHeight) / 2, logoWidth, logoHeight);
    label(settings.gymName || 'Royal Gym', 244, 90, 790, 50, 700, '#fff');
    label(settings.branch || '', 246, 140, 788, 25, 400, '#b9c3d1');
    label('KARTU MEMBER', 1080, 95, 295, 23, 600, '#e3c168');
    ctx.fillStyle = '#e3c168'; ctx.fillRect(244, 190, 72, 6);
    let nameX = 66, nameWidth = 804;
    if (typeof member.photoDataUrl === 'string' && member.photoDataUrl.length <= 1000000 && /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(member.photoDataUrl)) {
      try {
        const photo = await loadImage(member.photoDataUrl);
        const side = Math.min(photo.naturalWidth, photo.naturalHeight), sx = (photo.naturalWidth - side) / 2, sy = (photo.naturalHeight - side) / 2;
        ctx.drawImage(photo, sx, sy, side, side, 66, 265, 148, 148);
        nameX = 242; nameWidth = 630;
      } catch (_) { /* The card remains usable if an optional stored photo cannot be decoded. */ }
    }
    label('NAMA MEMBER', nameX, 286, nameWidth, 19, 600);
    const words = text(member.name).split(/\s+/); let first = '', rest = '';
    ctx.font = '700 40px "Plus Jakarta Sans", sans-serif';
    words.forEach(word => { if (!rest && ctx.measureText((first ? first + ' ' : '') + word).width <= nameWidth) first += (first ? ' ' : '') + word; else rest += (rest ? ' ' : '') + word; });
    label(first || rest || 'Member', nameX, 343, nameWidth, 40, 700, '#011226');
    if (first && rest) label(rest, nameX, 394, nameWidth, 40, 700, '#011226');
    label('ID MEMBER', 66, 477, 800, 19, 600);
    label(member.id, 66, 522, 804, 28, 600, '#011226');
    ctx.fillStyle = '#e4e7eb'; ctx.fillRect(66, 553, 804, 1);
    label('BERLAKU MULAI', 66, 603, 380, 19, 600);
    label('BERLAKU SAMPAI', 480, 603, 385, 19, 600);
    label(dateText(member.startDate), 66, 653, 380, 31, 700, '#011226');
    label(dateText(member.endDate), 480, 653, 390, 31, 700, '#011226');
    label(statusLabel || 'Cek masa aktif di resepsionis', 66, 738, 805, 23, 600, '#011226');
    drawQR(ctx, cells, 936, 278, 420);
    label('PINDAI UNTUK CHECK-IN', 954, 743, 410, 20, 600, '#011226');
    ctx.fillStyle = '#e4e7eb'; ctx.fillRect(66, 784, 1308, 1);
    label('Tunjukkan kartu ini saat masuk gym.', 66, 836, 790, 22);
    label(settings.address || settings.branch || '', 66, 875, 1270, 18);
    label('MEMBERSHIP CARD', 1100, 836, 275, 18, 600);
    return new Promise((resolve, reject) => el.toBlob(blob => {
      el.width = el.height = 1;
      if (blob) resolve(blob); else reject(new Error('Kartu gagal disimpan. Coba unduh kembali.'));
    }, 'image/png'));
  }

  return Object.freeze({ svg, matrix, cardPng, decodeFile, startCamera });
});
