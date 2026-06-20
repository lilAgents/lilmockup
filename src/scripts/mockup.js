// lilMockup: wrap a screenshot in browser chrome or a phone frame on a
// canvas and export it as a PNG. Fully client-side.

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

/* ---------- state ---------- */
const state = { frame: 'browser-light', bg: 'none', bgColor: '#eceef2', url: 'yoursite.com', bitmap: null };

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* ---------- rendering ---------- */
function render() {
  if (!state.bitmap) return;
  const img = state.bitmap;
  const W = img.width, H = img.height;
  const canvas = $('#canvas');
  const ctx2 = () => canvas.getContext('2d');

  const phone = state.frame === 'phone';
  const dark = state.frame === 'browser-dark';

  // frame metrics scale with the screenshot so exports stay crisp
  const barH = phone ? 0 : Math.min(96, Math.max(44, Math.round(W * 0.052)));
  const bezel = phone ? Math.min(48, Math.max(20, Math.round(W * 0.045))) : 0;
  const radius = phone ? Math.min(88, Math.max(36, Math.round(W * 0.085))) : Math.round(barH * 0.28);

  const frameW = W + bezel * 2;
  const frameH = H + (phone ? bezel * 2 : barH);
  const pad = state.bg === 'none' ? Math.round(frameW * 0.04) : Math.round(frameW * 0.085);

  canvas.width = frameW + pad * 2;
  canvas.height = frameH + pad * 2;
  const ctx = ctx2();
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // backdrop
  if (state.bg === 'gradient') {
    const g = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    g.addColorStop(0, '#5a74ee');
    g.addColorStop(1, '#2f3fb0');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else if (state.bg === 'color') {
    ctx.fillStyle = state.bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // soft shadow under the frame
  ctx.save();
  ctx.shadowColor = 'rgba(10, 14, 30, 0.35)';
  ctx.shadowBlur = Math.round(frameW * 0.025);
  ctx.shadowOffsetY = Math.round(frameW * 0.008);
  ctx.fillStyle = phone ? '#15171c' : dark ? '#2b2e33' : '#f1f3f4';
  rr(ctx, pad, pad, frameW, frameH, radius);
  ctx.fill();
  ctx.restore();

  if (phone) {
    // screen
    ctx.save();
    rr(ctx, pad + bezel, pad + bezel, W, H, Math.max(10, Math.round(radius * 0.45)));
    ctx.clip();
    ctx.drawImage(img, pad + bezel, pad + bezel, W, H);
    ctx.restore();
    // notch pill
    const pillW = Math.round(W * 0.3), pillH = Math.max(10, Math.round(bezel * 0.42));
    ctx.fillStyle = '#15171c';
    rr(ctx, pad + bezel + (W - pillW) / 2, pad + bezel + Math.round(pillH * 0.6), pillW, pillH, pillH / 2);
    ctx.fill();
  } else {
    // traffic lights
    const cy = pad + barH / 2;
    const r = Math.max(5, Math.round(barH * 0.13));
    const startX = pad + Math.round(barH * 0.55);
    ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(startX + i * r * 2.9, cy, r, 0, Math.PI * 2);
      ctx.fill();
    });
    // url pill
    const pillX = startX + 3 * r * 2.9 + Math.round(barH * 0.35);
    const pillW = Math.round(frameW * 0.52);
    const pillH = Math.round(barH * 0.58);
    ctx.fillStyle = dark ? '#1c1f24' : '#ffffff';
    rr(ctx, pillX, cy - pillH / 2, pillW, pillH, pillH / 2);
    ctx.fill();
    ctx.fillStyle = dark ? '#9aa3b0' : '#5f6368';
    ctx.font = `${Math.round(pillH * 0.52)}px -apple-system, "Segoe UI", Arial, sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.fillText(state.url || 'yoursite.com', pillX + Math.round(pillH * 0.6), cy + 1, pillW - pillH);
    // screenshot below the bar (squared bottom corners stay inside the frame radius)
    ctx.save();
    rr(ctx, pad, pad, frameW, frameH, radius);
    ctx.clip();
    ctx.drawImage(img, pad, pad + barH, W, H);
    ctx.restore();
  }
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

  $$('[data-frame]').forEach((b) => b.addEventListener('click', () => {
    state.frame = b.dataset.frame;
    $$('[data-frame]').forEach((x) => x.classList.toggle('is-active', x === b));
    $('#url-field').classList.toggle('is-hidden', state.frame === 'phone');
    render();
  }));
  $$('[data-bg]').forEach((b) => b.addEventListener('click', () => {
    state.bg = b.dataset.bg;
    $$('[data-bg]').forEach((x) => x.classList.toggle('is-active', x === b));
    $('#bgcolor-field').classList.toggle('is-hidden', state.bg !== 'color');
    render();
  }));
  $('#f-bgcolor').addEventListener('input', (e) => { state.bgColor = e.target.value; render(); });
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
