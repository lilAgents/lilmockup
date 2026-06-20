// lilMockup: wrap a screenshot in drawn browser chrome or a real device
// frame PNG (laptop, phone) on a canvas and export it as a PNG. Fully
// client-side.

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* ---------- theme (OS-aware, matches the family) ---------- */
const MOON_SVG = '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path fill="currentColor" d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></svg>';
const SUN_SVG = '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4l1.4-1.4M18 6l1.4-1.4"/></g></svg>';

function setThemeIcon(btn, theme) {
  if (theme === 'dark') { btn.innerHTML = SUN_SVG; btn.setAttribute('aria-label', 'Switch to light mode'); }
  else { btn.innerHTML = MOON_SVG; btn.setAttribute('aria-label', 'Switch to dark mode'); }
}
function initTheme() {
  const btn = $('#ui-theme-btn');
  const current = () => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
  setThemeIcon(btn, current());
  btn.addEventListener('click', () => {
    const next = current() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('lilmockup-theme', next); } catch (e) {}
    setThemeIcon(btn, next);
  });
}

/* ---------- state + device frame assets ---------- */
const state = { frame: 'browser-light', orient: 'portrait', bg: 'none', bgColor: '#eceef2', grad1: '#5a74ee', grad2: '#2f3fb0', url: 'yoursite.com', bitmap: null };

// screen rects measured from the shipped PNGs (transparent cutouts)
const FRAME_DEFS = {
  laptop: { src: '/frames/laptop.png', screen: { x: 239, y: 69, w: 1542, h: 954 } },
  phone: { src: '/frames/phone.png', screen: { x: 364, y: 337, w: 772, h: 1370 } },
};
const frameImgs = {};

function ensureFrames() {
  for (const [name, def] of Object.entries(FRAME_DEFS)) {
    fetch(def.src)
      .then((r) => r.blob())
      .then((b) => createImageBitmap(b))
      .then((bmp) => { frameImgs[name] = bmp; render(); })
      .catch(() => {});
  }
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawBackdrop(ctx, canvas) {
  if (state.bg === 'gradient') {
    const g = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    g.addColorStop(0, state.grad1);
    g.addColorStop(1, state.grad2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else if (state.bg === 'color') {
    ctx.fillStyle = state.bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

// draw img to cover the given rect, center-cropped (caller clips)
function coverDraw(ctx, img, x, y, w, h) {
  const s = Math.max(w / img.width, h / img.height);
  const dw = img.width * s, dh = img.height * s;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

/* ---------- rendering ---------- */
function render() {
  if (!state.bitmap) return;
  // the checkerboard is a CSS hint for transparency; hide it once the
  // backdrop is opaque so no sliver of it peeks out at fractional sizes
  $('#canvas').classList.toggle('canvas--opaque', state.bg !== 'none');
  if (FRAME_DEFS[state.frame]) renderDevice();
  else renderBrowser();
}

function renderBrowser() {
  const img = state.bitmap;
  const W = img.width, H = img.height;
  const canvas = $('#canvas');
  const dark = state.frame === 'browser-dark';

  // frame metrics scale with the screenshot so exports stay crisp
  const barH = Math.min(96, Math.max(44, Math.round(W * 0.052)));
  const radius = Math.round(barH * 0.28);
  const frameW = W;
  const frameH = H + barH;
  const pad = state.bg === 'none' ? Math.round(frameW * 0.04) : Math.round(frameW * 0.085);

  // Compose the framed unit square-cornered on its own layer, then cut the
  // rounded corners once with destination-in. clip() is not anti-aliased
  // reliably (Skia), and clipping over the already-painted chrome fill
  // leaves a light fringe around the curve on dark backdrops; masking the
  // layer yields one clean alpha edge that composites over anything.
  const off = document.createElement('canvas');
  off.width = frameW;
  off.height = frameH;
  const o = off.getContext('2d');
  o.fillStyle = dark ? '#2b2e33' : '#f1f3f4';
  o.fillRect(0, 0, frameW, frameH);

  // traffic lights
  const cy = barH / 2;
  const r = Math.max(5, Math.round(barH * 0.13));
  const startX = Math.round(barH * 0.55);
  ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => {
    o.fillStyle = c;
    o.beginPath();
    o.arc(startX + i * r * 2.9, cy, r, 0, Math.PI * 2);
    o.fill();
  });
  // url pill
  const pillX = startX + 3 * r * 2.9 + Math.round(barH * 0.35);
  const pillW = Math.round(frameW * 0.52);
  const pillH = Math.round(barH * 0.58);
  o.fillStyle = dark ? '#1c1f24' : '#ffffff';
  rr(o, pillX, cy - pillH / 2, pillW, pillH, pillH / 2);
  o.fill();
  o.fillStyle = dark ? '#9aa3b0' : '#5f6368';
  o.font = `${Math.round(pillH * 0.52)}px -apple-system, "Segoe UI", Arial, sans-serif`;
  o.textBaseline = 'middle';
  o.fillText(state.url || 'yoursite.com', pillX + Math.round(pillH * 0.6), cy + 1, pillW - pillH);
  // screenshot below the bar
  o.drawImage(img, 0, barH, W, H);
  // round the corners of the whole unit in one pass
  o.globalCompositeOperation = 'destination-in';
  rr(o, 0, 0, frameW, frameH, radius);
  o.fill();
  o.globalCompositeOperation = 'source-over';

  canvas.width = frameW + pad * 2;
  canvas.height = frameH + pad * 2;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackdrop(ctx, canvas);

  // soft shadow cast from the unit's own alpha
  ctx.save();
  ctx.shadowColor = 'rgba(10, 14, 30, 0.35)';
  ctx.shadowBlur = Math.round(frameW * 0.025);
  ctx.shadowOffsetY = Math.round(frameW * 0.008);
  ctx.drawImage(off, pad, pad);
  ctx.restore();
}

function renderDevice() {
  const img = state.bitmap;
  const def = FRAME_DEFS[state.frame];
  const fimg = frameImgs[state.frame];
  if (!fimg) return; // ensureFrames re-renders once the PNG arrives
  const landscape = state.frame === 'phone' && state.orient === 'landscape';

  // scale the frame so the screenshot keeps its pixels, capped so the
  // bezel art does not get stretched to mush
  const screenW = landscape ? def.screen.h : def.screen.w;
  const scale = Math.min(2.5, Math.max(1, img.width / screenW));
  const fw = Math.round(fimg.width * scale), fh = Math.round(fimg.height * scale);
  const outW = landscape ? fh : fw, outH = landscape ? fw : fh;

  // compose in the frame's own portrait space, then rotate onto the canvas
  const off = document.createElement('canvas');
  off.width = fw;
  off.height = fh;
  const octx = off.getContext('2d');
  const rx = def.screen.x * scale, ry = def.screen.y * scale;
  const rw = def.screen.w * scale, rh = def.screen.h * scale;
  const bleed = 2 * scale; // overdraw a hair so the cutout edge never shows a gap
  const bx = rx - bleed, by = ry - bleed, bw = rw + bleed * 2, bh = rh + bleed * 2;
  octx.save();
  octx.beginPath();
  octx.rect(bx, by, bw, bh);
  octx.clip();
  if (landscape) {
    // counter-rotate the screenshot so it reads upright once the device lies on its side
    octx.translate(rx + rw / 2, ry + rh / 2);
    octx.rotate(Math.PI / 2);
    coverDraw(octx, img, -bh / 2, -bw / 2, bh, bw);
  } else {
    coverDraw(octx, img, bx, by, bw, bh);
  }
  octx.restore();
  octx.drawImage(fimg, 0, 0, fw, fh);

  const canvas = $('#canvas');
  const pad = state.bg === 'none' ? Math.round(outW * 0.04) : Math.round(outW * 0.085);
  canvas.width = outW + pad * 2;
  canvas.height = outH + pad * 2;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackdrop(ctx, canvas);

  ctx.save();
  ctx.shadowColor = 'rgba(10, 14, 30, 0.3)';
  ctx.shadowBlur = Math.round(outW * 0.02);
  ctx.shadowOffsetY = Math.round(outW * 0.008);
  if (landscape) {
    ctx.translate(pad + outW / 2, pad + outH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.drawImage(off, -fw / 2, -fh / 2);
  } else {
    ctx.drawImage(off, pad, pad);
  }
  ctx.restore();
}

/* ---------- wire-up ---------- */
function loadFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  createImageBitmap(file).then((bmp) => {
    if (state.bitmap && state.bitmap.close) state.bitmap.close();
    state.bitmap = bmp;
    $('#drop').classList.add('is-hidden');
    $('#stage').classList.remove('is-hidden');
    render();
  }).catch(() => { /* not decodable; ignore */ });
}

function initMockup() {
  initTheme();
  ensureFrames();

  $$('[data-frame]').forEach((b) => b.addEventListener('click', () => {
    state.frame = b.dataset.frame;
    $$('[data-frame]').forEach((x) => x.classList.toggle('is-active', x === b));
    $('#url-field').classList.toggle('is-hidden', !state.frame.startsWith('browser'));
    $('#orient-field').classList.toggle('is-hidden', state.frame !== 'phone');
    render();
  }));
  $$('[data-orient]').forEach((b) => b.addEventListener('click', () => {
    state.orient = b.dataset.orient;
    $$('[data-orient]').forEach((x) => x.classList.toggle('is-active', x === b));
    render();
  }));
  $$('[data-bg]').forEach((b) => b.addEventListener('click', () => {
    state.bg = b.dataset.bg;
    $$('[data-bg]').forEach((x) => x.classList.toggle('is-active', x === b));
    $('#bgcolor-field').classList.toggle('is-hidden', state.bg !== 'color');
    $('#grad-field').classList.toggle('is-hidden', state.bg !== 'gradient');
    render();
  }));
  $('#f-bgcolor').addEventListener('input', (e) => { state.bgColor = e.target.value; render(); });
  $('#f-grad1').addEventListener('input', (e) => { state.grad1 = e.target.value; render(); });
  $('#f-grad2').addEventListener('input', (e) => { state.grad2 = e.target.value; render(); });
  $('#f-url').addEventListener('input', (e) => { state.url = e.target.value.trim(); render(); });

  $('#f-file').addEventListener('change', (e) => loadFile(e.target.files[0]));

  // paste a screenshot from the clipboard, anywhere on the page
  document.addEventListener('paste', (e) => {
    if (!e.clipboardData) return;
    for (const item of e.clipboardData.items) {
      if (item.type && item.type.startsWith('image/')) {
        const f = item.getAsFile();
        if (f) { e.preventDefault(); loadFile(f); }
        return;
      }
    }
  });

  const drop = $('#drop');
  ['dragover', 'dragenter'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('is-over'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('is-over'); }));
  drop.addEventListener('drop', (e) => { if (e.dataTransfer && e.dataTransfer.files.length) loadFile(e.dataTransfer.files[0]); });

  $('#dl-btn').addEventListener('click', (e) => {
    const btn = e.currentTarget;
    $('#canvas').toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'mockup.png';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      const prev = btn.textContent;
      btn.textContent = 'Saved';
      setTimeout(() => { btn.textContent = prev; }, 1100);
    }, 'image/png');
  });
  $('#reset-btn').addEventListener('click', () => {
    $('#stage').classList.add('is-hidden');
    $('#drop').classList.remove('is-hidden');
    $('#f-file').value = '';
  });
}

export { initMockup };
