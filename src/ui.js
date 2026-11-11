// ui.js: small shared helpers every screen uses.

// Make text safe to put inside HTML (so a food called "<b>" can't break the page).
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export const round = (n) => Math.round(Number(n) || 0);
export const num = (n) => round(n).toLocaleString('en-US');
export const oneDecimal = (n) => (Math.round((Number(n) || 0) * 10) / 10).toString();

export function niceDate(date, opts = { weekday: 'long', month: 'short', day: 'numeric' }) {
  return date.toLocaleDateString('en-US', opts);
}

// ---------- Icons (simple line drawings) ----------

const paths = {
  today: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  food: '<path d="M7 2v9a2 2 0 0 0 2 2v9M4 2v6a3 3 0 0 0 3 3M10 2v6a3 3 0 0 1-3 3M17 2c-2 1.500-3 4-3 7 0 2 1 3 3 3v10"/>',
  pantry: '<path d="M3 9h18l-1.500 10a2 2 0 0 1-2 1.700H6.500a2 2 0 0 1-2-1.700L3 9zM8 9l3-6M16 9l-3-6M9 13v4M15 13v4"/>',
  train: '<path d="M6.500 6.500v11M17.500 6.500v11M3 9v6M21 9v6M6.500 12h11"/>',
  body: '<path d="M3 20h18M5 16l4-5 4 3 6-8"/>',
  camera: '<path d="M4 8h3l1.500-2.500h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.500"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.400 13a7.600 7.600 0 0 0 0-2l2-1.500-2-3.400-2.300 1a7.600 7.600 0 0 0-1.700-1L15 3.500h-4l-.400 2.600a7.600 7.600 0 0 0-1.700 1l-2.300-1-2 3.400L6.600 11a7.600 7.600 0 0 0 0 2l-2 1.500 2 3.400 2.300-1a7.600 7.600 0 0 0 1.700 1l.400 2.600h4l.400-2.600a7.600 7.600 0 0 0 1.700-1l2.300 1 2-3.400-2-1.500z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  left: '<path d="M15 5l-7 7 7 7"/>',
  right: '<path d="M9 5l7 7-7 7"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  flame: '<path d="M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-6 1-9z"/>',
  drop: '<path d="M12 3c3 4 6 7 6 11a6 6 0 0 1-12 0c0-4 3-7 6-11z"/>',
  moon: '<path d="M20 14.500A8 8 0 1 1 9.500 4a6.500 6.500 0 0 0 10.500 10.500z"/>',
  scale: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M8 9a5.500 5.500 0 0 1 8 0M12 9.500l1.500-2"/>',
  receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3zM9 8h6M9 12h6"/>',
  spark: '<path d="M12 3l1.800 5.200L19 10l-5.200 1.800L12 17l-1.800-5.200L5 10l5.200-1.800L12 3zM19 16l.700 2.300L22 19l-2.300.700L19 22l-.700-2.300L16 19l2.300-.700L19 16z"/>',
  pencil: '<path d="M4 20h4L19 9l-4-4L4 16v4zM13.500 6.500l4 4"/>',
  repeat: '<path d="M4 12a8 8 0 0 1 14-5l2 2M20 5v4h-4M20 12a8 8 0 0 1-14 5l-2-2M4 19v-4h4"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5"/>',
  check: '<path d="M5 12.500l4.500 4.500L19 7"/>',
};

export function icon(name, size = 22) {
  return `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.800" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ''}</svg>`;
}

// ---------- Clicks ----------
// Buttons are marked like <button data-act="save">. This sends each click to
// the function with the matching name.

export function on(root, handlers) {
  root.addEventListener('click', (event) => {
    const el = event.target.closest('[data-act]');
    if (!el || !root.contains(el)) return;
    const fn = handlers[el.dataset.act];
    if (fn) fn(el, event);
  });
}

export function formValues(form) {
  const out = {};
  for (const el of form.querySelectorAll('[name]')) {
    if (el.type === 'checkbox') out[el.name] = el.checked;
    else if (el.type === 'radio') {
      if (el.checked) out[el.name] = el.value;
    } else if (el.type === 'number' || el.inputMode === 'decimal' || el.dataset.number !== undefined) {
      out[el.name] = el.value === '' ? null : Number(el.value);
    } else out[el.name] = el.value.trim();
  }
  return out;
}

// ---------- Sheets (panels that slide up from the bottom) ----------

const sheetRoot = () => document.getElementById('sheet-root');

export function openSheet({ title, html, onMount, onClose, wide = false }) {
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  wrap.innerHTML = `
    <div class="sheet-backdrop" data-sheet-close></div>
    <section class="sheet${wide ? ' sheet-wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <header class="sheet-head">
        <h2>${esc(title)}</h2>
        <button class="icon-btn" data-sheet-close aria-label="Close">${icon('close')}</button>
      </header>
      <div class="sheet-body"></div>
    </section>`;
  const body = wrap.querySelector('.sheet-body');
  const previousFocus = document.activeElement;
  let closed = false;

  const api = {
    el: body,
    setTitle(text) {
      wrap.querySelector('.sheet-head h2').textContent = text;
    },
    setBody(newHtml) {
      body.innerHTML = newHtml;
      body.scrollTop = 0;
    },
    close(result) {
      if (closed) return;
      closed = true;
      document.removeEventListener('keydown', onKey);
      wrap.classList.add('closing');
      setTimeout(() => wrap.remove(), 180);
      if (previousFocus?.focus) previousFocus.focus({ preventScroll: true });
      onClose?.(result);
    },
  };

  function onKey(event) {
    if (event.key === 'Escape' && wrap === sheetRoot().lastElementChild) api.close();
  }

  wrap.addEventListener('click', (event) => {
    if (event.target.closest('[data-sheet-close]')) api.close();
  });
  document.addEventListener('keydown', onKey);
  body.innerHTML = html || '';
  sheetRoot().appendChild(wrap);
  onMount?.(api);
  const first = body.querySelector('[autofocus]');
  if (first) setTimeout(() => first.focus(), 60);
  return api;
}

// ---------- Toasts (short messages at the bottom) ----------

export function toast(message, { action, onAction, ms = 3200 } = {}) {
  const root = document.getElementById('toast-root');
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span>${esc(message)}</span>${action ? `<button>${esc(action)}</button>` : ''}`;
  if (action) {
    el.querySelector('button').addEventListener('click', () => {
      onAction?.();
      el.remove();
    });
  }
  root.appendChild(el);
  setTimeout(() => el.remove(), action ? 6000 : ms);
}

// ---------- Photos ----------

// Opens the phone's camera / photo picker and gives back the chosen file.
export function pickImage() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    input.addEventListener('change', () => {
      resolve(input.files?.[0] || null);
      input.remove();
    });
    input.addEventListener('cancel', () => {
      resolve(null);
      input.remove();
    });
    document.body.appendChild(input);
    input.click();
  });
}

// Shrinks a photo so it uploads fast and costs less to read.
export async function shrinkImage(file, maxSide = 1568, quality = 0.82) {
  const bitmap = await loadBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  return { dataUrl, base64: dataUrl.split(',')[1] };
}

async function loadBitmap(file) {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      // fall through to the <img> way
    }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That file could not be opened as a photo.'));
    };
    img.src = url;
  });
}

// ---------- Charts ----------

// points: [{ label, value }] in order. Draws a simple line chart as SVG.
export function lineChart(points, { height = 170, unit = '', trend = null } = {}) {
  if (points.length < 2) return '';
  const W = 340;
  const H = height;
  const pad = { l: 8, r: 44, t: 14, b: 22 };
  const values = points.map((p) => p.value).concat(trend ? trend.map((p) => p.value) : []);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (max - min < 1) {
    max += 1;
    min -= 1;
  }
  const span = max - min;
  min -= span * 0.08;
  max += span * 0.08;
  const x = (i) => pad.l + (i / (points.length - 1)) * (W - pad.l - pad.r);
  const y = (v) => pad.t + (1 - (v - min) / (max - min)) * (H - pad.t - pad.b);
  const path = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ');
  const last = points[points.length - 1];
  const ticks = [max - (max - min) * 0.08, (max + min) / 2, min + (max - min) * 0.08];
  return `
  <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Chart from ${esc(points[0].label)} to ${esc(last.label)}. Latest ${oneDecimal(last.value)}${esc(unit)}.">
    ${ticks.map((t) => `<line class="grid" x1="${pad.l}" x2="${W - pad.r}" y1="${y(t).toFixed(1)}" y2="${y(t).toFixed(1)}"/><text class="tick" x="${W - pad.r + 6}" y="${(y(t) + 4).toFixed(1)}">${oneDecimal(t)}</text>`).join('')}
    ${trend ? `<path class="trend" d="${path(trend)}"/>` : ''}
    <path class="line" d="${path(points)}"/>
    ${points.length <= 40 ? points.map((p, i) => `<circle class="dot" cx="${x(i).toFixed(1)}" cy="${y(p.value).toFixed(1)}" r="2.500"/>`).join('') : ''}
    <circle class="dot-last" cx="${x(points.length - 1).toFixed(1)}" cy="${y(last.value).toFixed(1)}" r="5"/>
    <text class="tick" x="${pad.l}" y="${H - 5}">${esc(points[0].label)}</text>
    <text class="tick" x="${W - pad.r}" y="${H - 5}" text-anchor="end">${esc(last.label)}</text>
  </svg>`;
}

// bars: [{ label, value, hit }]. Draws small upright bars with a target line.
export function barChart(bars, { target = 0, unit = '' } = {}) {
  const max = Math.max(target * 1.15, ...bars.map((b) => b.value), 1);
  return `
  <div class="bars" role="img" aria-label="${esc(bars.map((b) => `${b.label}: ${round(b.value)}${unit}`).join(', '))}">
    ${target ? `<div class="bars-target" style="bottom:calc(${(target / max) * 100}% * 0.82 + 18px)"></div>` : ''}
    ${bars
      .map(
        (b) => `
      <div class="bar-col">
        <div class="bar-track"><div class="bar-fill${b.hit ? ' hit' : ''}" style="height:${Math.max(b.value ? 3 : 0, (b.value / max) * 100)}%"></div></div>
        <div class="bar-label">${esc(b.label)}</div>
      </div>`,
      )
      .join('')}
  </div>`;
}

// A horizontal progress bar with a label, used for calories and macros.
export function meter(label, value, target, unit, tone) {
  const pct = target ? Math.min(100, (value / target) * 100) : 0;
  return `
  <div class="meter meter-${tone}">
    <div class="meter-top"><span>${esc(label)}</span><span><strong>${num(value)}</strong> of ${num(target)}${unit}</span></div>
    <div class="meter-track" role="progressbar" aria-label="${esc(label)}" aria-valuemin="0" aria-valuemax="${round(target)}" aria-valuenow="${round(value)}"><div class="meter-fill" style="width:${pct}%"></div></div>
  </div>`;
}
