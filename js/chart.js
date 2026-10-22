// Einfacher Linienchart als SVG: eine Reihe, Fläche darunter, Antippen zeigt den Wert.
// Optionen: unit (Einheit im Antipp-Text), target (gestrichelte Ziellinie), variant ('sos' | 'schlaf' für die Farbe),
// decimals (Nachkommastellen im Antipp-Text).
import { esc } from './util.js';

const W = 300, H = 150, L = 26, R = 292, T = 10, B = 124;

// Obergrenze als Vielfaches der Gitterweite (step); ohne step: gerade Zahl mit Mittellinie
function niceMax(values, target = 0, step = 0) {
  const top = Math.max(...values, target, 0);
  return step ? Math.max(step * 2, Math.ceil(top / step) * step) : Math.max(4, Math.ceil(top / 2) * 2);
}

const xAt = (i, n) => (n === 1 ? (L + R) / 2 : L + i * (R - L) / (n - 1));

export function lineChart(id, values, labels, { unit = 'Klicks', target = null, variant = 'sos', decimals = 0, step = 0 } = {}) {
  const max = niceMax(values, target || 0, step);
  const n = values.length;
  const y = v => B - (v / max) * (B - T);
  const pts = values.map((v, i) => [xAt(i, n), y(v)]);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const ticks = step ? Array.from({ length: max / step + 1 }, (_, i) => i * step) : [0, max / 2, max];
  const vgrid = n > 1 && n <= 31 ? pts.map(p => `<line x1="${p[0]}" x2="${p[0]}" y1="${T}" y2="${B}" class="ch-vgrid"/>`).join('') : '';
  const grid = vgrid + ticks.map(v => `
    <line x1="${L}" x2="${R}" y1="${y(v)}" y2="${y(v)}" class="ch-grid${v ? '' : ' ch-base'}"/>
    <text x="${L - 6}" y="${y(v) + 4}" text-anchor="end" class="ch-axis">${Math.round(v)}</text>`).join('');
  const goal = target ? `
    <line x1="${L}" x2="${R}" y1="${y(target)}" y2="${y(target)}" class="ch-target"/>
    <text x="${L + 4}" y="${y(target) - 4}" class="ch-target-label">Ziel</text>` : '';
  const last = pts[n - 1];
  const dots = n <= 14 ? pts.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="2.5" class="ch-point"/>`).join('') : '';
  return `
    <div class="chart chart-${variant}" data-chart="${id}" data-values="${values.join(',')}" data-labels="${esc(labels.join('|'))}"
      data-unit="${esc(unit)}" data-target="${target || 0}" data-decimals="${decimals}" data-step="${step}">
      <div class="row-between chart-readout"><span class="sub" data-readout-label>Tippe auf die Linie</span><strong data-readout-value></strong></div>
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Linienchart, ${n} Werte">
        ${grid}${goal}
        <path d="${line} L${pts[n - 1][0]} ${B} L${pts[0][0]} ${B} Z" class="ch-area"/>
        <path d="${line}" class="ch-line"/>
        ${dots}
        <circle cx="${last[0]}" cy="${last[1]}" r="4" class="ch-dot"/>
        <line class="ch-cross" y1="${T}" y2="${B}" x1="0" x2="0" visibility="hidden"/>
        <circle class="ch-hover" r="5" visibility="hidden"/>
        <text x="${L}" y="${H - 6}" class="ch-axis">${esc(labels[0])}</text>
        <text x="${R}" y="${H - 6}" text-anchor="end" class="ch-axis">${esc(labels[n - 1])}</text>
        <rect x="${L - 8}" y="0" width="${R - L + 16}" height="${B + 6}" fill="transparent" class="ch-hit"/>
      </svg>
    </div>`;
}

// Einmal global anmelden: reagiert auf alle Charts der Seite
export function bindCharts(root = document) {
  root.addEventListener('pointermove', onPointer);
  root.addEventListener('pointerdown', onPointer);
}

function onPointer(e) {
  const chart = e.target.closest?.('.chart');
  if (!chart) return;
  const svg = chart.querySelector('svg');
  const values = chart.dataset.values.split(',').map(Number);
  const labels = chart.dataset.labels.split('|');
  const r = svg.getBoundingClientRect();
  const px = (e.clientX - r.left) * W / r.width;
  const n = values.length;
  const max = niceMax(values, Number(chart.dataset.target) || 0, Number(chart.dataset.step) || 0);
  let i = n === 1 ? 0 : Math.round((px - L) / ((R - L) / (n - 1)));
  i = Math.max(0, Math.min(n - 1, i));
  const cx = xAt(i, n);
  const cy = B - (values[i] / max) * (B - T);
  const cross = svg.querySelector('.ch-cross'), dot = svg.querySelector('.ch-hover');
  cross.setAttribute('x1', cx); cross.setAttribute('x2', cx); cross.setAttribute('visibility', 'visible');
  dot.setAttribute('cx', cx); dot.setAttribute('cy', cy); dot.setAttribute('visibility', 'visible');
  const d = Number(chart.dataset.decimals) || 0;
  chart.querySelector('[data-readout-label]').textContent = labels[i];
  chart.querySelector('[data-readout-value]').textContent =
    `${values[i].toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d })} ${chart.dataset.unit}`;
}
