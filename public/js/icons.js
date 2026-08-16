// Seed Cloud icon system.
// Lucide-style 24x24 line icons with a consistent stroke weight.
// Builds real <svg> nodes so styling (color, weight) comes from CSS.
// No emoji. No mixed icon styles.

const NS = 'http://www.w3.org/2000/svg';

// Each icon is an array of [tag, attrs] tuples. Root svg carries the shared
// stroke/fill presentation attributes, which children inherit.
const I = {
  // --- navigation ---
  dashboard: [
    ['rect', { x: '3', y: '3', width: '7', height: '9', rx: '1' }],
    ['rect', { x: '14', y: '3', width: '7', height: '5', rx: '1' }],
    ['rect', { x: '14', y: '12', width: '7', height: '9', rx: '1' }],
    ['rect', { x: '3', y: '16', width: '7', height: '5', rx: '1' }],
  ],
  folder: [
    ['path', { d: 'M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z' }],
  ],
  folder_open: [
    ['path', { d: 'm6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2' }],
  ],
  upload: [
    ['path', { d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' }],
    ['polyline', { points: '17 8 12 3 7 8' }],
    ['line', { x1: '12', y1: '3', x2: '12', y2: '15' }],
  ],
  download: [
    ['path', { d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' }],
    ['polyline', { points: '7 10 12 15 17 10' }],
    ['line', { x1: '12', y1: '15', x2: '12', y2: '3' }],
  ],
  share2: [
    ['circle', { cx: '18', cy: '5', r: '3' }],
    ['circle', { cx: '6', cy: '12', r: '3' }],
    ['circle', { cx: '18', cy: '19', r: '3' }],
    ['line', { x1: '8.59', y1: '13.51', x2: '15.42', y2: '17.49' }],
    ['line', { x1: '15.41', y1: '6.51', x2: '8.59', y2: '10.49' }],
  ],
  harddrive: [
    ['path', { d: 'M22 12H2' }],
    ['path', { d: 'M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z' }],
    ['line', { x1: '6', y1: '16', x2: '6.01', y2: '16' }],
    ['line', { x1: '10', y1: '16', x2: '10.01', y2: '16' }],
  ],
  cloud: [
    ['path', { d: 'M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z' }],
  ],
  user: [
    ['path', { d: 'M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2' }],
    ['circle', { cx: '12', cy: '7', r: '4' }],
  ],
  users: [
    ['path', { d: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' }],
    ['circle', { cx: '9', cy: '7', r: '4' }],
    ['path', { d: 'M22 21v-2a4 4 0 0 0-3-3.87' }],
    ['path', { d: 'M16 3.13a4 4 0 0 1 0 7.75' }],
  ],
  settings: [
    ['path', { d: 'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z' }],
    ['circle', { cx: '12', cy: '12', r: '3' }],
  ],

  // --- ui ---
  menu: [
    ['line', { x1: '4', y1: '6', x2: '20', y2: '6' }],
    ['line', { x1: '4', y1: '12', x2: '20', y2: '12' }],
    ['line', { x1: '4', y1: '18', x2: '20', y2: '18' }],
  ],
  search: [
    ['circle', { cx: '11', cy: '11', r: '8' }],
    ['path', { d: 'm21 21-4.3-4.3' }],
  ],
  plus: [
    ['path', { d: 'M5 12h14' }],
    ['path', { d: 'M12 5v14' }],
  ],
  x: [
    ['path', { d: 'M18 6 6 18' }],
    ['path', { d: 'm6 6 12 12' }],
  ],
  check: [
    ['path', { d: 'M20 6 9 17l-5-5' }],
  ],
  check_circle: [
    ['circle', { cx: '12', cy: '12', r: '10' }],
    ['path', { d: 'm9 12 2 2 4-4' }],
  ],
  chevron_down: [
    ['path', { d: 'm6 9 6 6 6-6' }],
  ],
  chevron_right: [
    ['path', { d: 'm9 18 6-6-6-6' }],
  ],
  chevrons_left: [
    ['path', { d: 'm11 17-5-5 5-5' }],
    ['path', { d: 'm18 17-5-5 5-5' }],
  ],
  chevrons_right: [
    ['path', { d: 'm6 17 5-5-5-5' }],
    ['path', { d: 'm13 17 5-5-5-5' }],
  ],
  more: [
    ['circle', { cx: '12', cy: '12', r: '1', fill: 'currentColor', stroke: 'none' }],
    ['circle', { cx: '19', cy: '12', r: '1', fill: 'currentColor', stroke: 'none' }],
    ['circle', { cx: '5', cy: '12', r: '1', fill: 'currentColor', stroke: 'none' }],
  ],
  arrow_right: [
    ['path', { d: 'M5 12h14' }],
    ['path', { d: 'm12 5 7 7-7 7' }],
  ],
  arrow_left: [
    ['path', { d: 'M19 12H5' }],
    ['path', { d: 'm12 19-7-7 7-7' }],
  ],
  external: [
    ['path', { d: 'M15 3h6v6' }],
    ['path', { d: 'M10 14 21 3' }],
    ['path', { d: 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6' }],
  ],
  copy: [
    ['rect', { width: '14', height: '14', x: '8', y: '8', rx: '2', ry: '2' }],
    ['path', { d: 'M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2' }],
  ],
  link: [
    ['path', { d: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71' }],
    ['path', { d: 'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71' }],
  ],
  lock: [
    ['rect', { width: '18', height: '11', x: '3', y: '11', rx: '2', ry: '2' }],
    ['path', { d: 'M7 11V7a5 5 0 0 1 10 0v4' }],
  ],
  mail: [
    ['rect', { width: '20', height: '16', x: '2', y: '4', rx: '2' }],
    ['path', { d: 'm22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7' }],
  ],
  shield: [
    ['path', { d: 'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1 1 0 0 1 1.52 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1z' }],
  ],
  refresh: [
    ['path', { d: 'M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8' }],
    ['path', { d: 'M21 3v5h-5' }],
  ],
  info: [
    ['circle', { cx: '12', cy: '12', r: '10' }],
    ['path', { d: 'M12 16v-4' }],
    ['path', { d: 'M12 8h.01' }],
  ],
  alert: [
    ['path', { d: 'm21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 20h16a2 2 0 0 0 1.73-2Z' }],
    ['path', { d: 'M12 9v4' }],
    ['path', { d: 'M12 17h.01' }],
  ],
  pencil: [
    ['path', { d: 'M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z' }],
    ['path', { d: 'm15 5 4 4' }],
  ],
  trash: [
    ['path', { d: 'M3 6h18' }],
    ['path', { d: 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6' }],
    ['path', { d: 'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2' }],
    ['line', { x1: '10', y1: '11', x2: '10', y2: '17' }],
    ['line', { x1: '14', y1: '11', x2: '14', y2: '17' }],
  ],
  move: [
    ['path', { d: 'M2 9V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-1' }],
    ['path', { d: 'M2 19h2' }],
    ['path', { d: 'm9 9-3 3 3 3' }],
    ['path', { d: 'M6 12h8' }],
  ],
  log_out: [
    ['path', { d: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4' }],
    ['polyline', { points: '16 17 21 12 16 7' }],
    ['line', { x1: '21', y1: '12', x2: '9', y2: '12' }],
  ],
  key: [
    ['path', { d: 'm21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4' }],
  ],
  palette: [
    ['circle', { cx: '13.5', cy: '6.5', r: '.5', fill: 'currentColor' }],
    ['circle', { cx: '17.5', cy: '10.5', r: '.5', fill: 'currentColor' }],
    ['circle', { cx: '8.5', cy: '7.5', r: '.5', fill: 'currentColor' }],
    ['circle', { cx: '6.5', cy: '12.5', r: '.5', fill: 'currentColor' }],
    ['path', { d: 'M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z' }],
  ],
  eye: [
    ['path', { d: 'M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z' }],
    ['circle', { cx: '12', cy: '12', r: '3' }],
  ],
  eye_off: [
    ['path', { d: 'M9.88 9.88a3 3 0 1 0 4.24 4.24' }],
    ['path', { d: 'M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68' }],
    ['path', { d: 'M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61' }],
    ['line', { x1: '2', y1: '2', x2: '22', y2: '22' }],
  ],
  bell: [
    ['path', { d: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9' }],
    ['path', { d: 'M10.3 21a1.94 1.94 0 0 0 3.4 0' }],
  ],

  // --- file types ---
  file: [
    ['path', { d: 'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z' }],
    ['path', { d: 'M14 2v4a2 2 0 0 0 2 2h4' }],
  ],
  file_text: [
    ['path', { d: 'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z' }],
    ['path', { d: 'M14 2v4a2 2 0 0 0 2 2h4' }],
    ['path', { d: 'M10 9H8' }],
    ['path', { d: 'M16 13H8' }],
    ['path', { d: 'M16 17H8' }],
  ],
  file_image: [
    ['path', { d: 'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z' }],
    ['path', { d: 'M14 2v4a2 2 0 0 0 2 2h4' }],
    ['circle', { cx: '9', cy: '9', r: '2' }],
    ['path', { d: 'm21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21' }],
  ],
  file_video: [
    ['path', { d: 'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z' }],
    ['path', { d: 'M14 2v4a2 2 0 0 0 2 2h4' }],
    ['path', { d: 'm10 11 5 3-5 3v-6Z' }],
  ],
  file_audio: [
    ['path', { d: 'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z' }],
    ['path', { d: 'M14 2v4a2 2 0 0 0 2 2h4' }],
    ['circle', { cx: '10', cy: '17', r: '2' }],
    ['path', { d: 'M12 17V9.5l4 2' }],
  ],
  file_archive: [
    ['path', { d: 'M10 12v-1' }],
    ['path', { d: 'M10 18v-2' }],
    ['path', { d: 'M10 7V6' }],
    ['path', { d: 'M14 2v4a2 2 0 0 0 2 2h4' }],
    ['path', { d: 'M15.5 22H18a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h3.5' }],
    ['path', { d: 'M14 15h.01' }],
    ['path', { d: 'M10 12h.01' }],
    ['path', { d: 'M10 18h.01' }],
    ['path', { d: 'M14 9h.01' }],
  ],
  file_code: [
    ['path', { d: 'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z' }],
    ['path', { d: 'M14 2v4a2 2 0 0 0 2 2h4' }],
    ['path', { d: 'm10 10-2 2 2 2' }],
    ['path', { d: 'm14 10 2 2-2 2' }],
  ],
  file_sheet: [
    ['path', { d: 'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z' }],
    ['path', { d: 'M14 2v4a2 2 0 0 0 2 2h4' }],
    ['line', { x1: '8', y1: '13', x2: '16', y2: '13' }],
    ['line', { x1: '8', y1: '17', x2: '16', y2: '17' }],
    ['line', { x1: '8', y1: '9', x2: '9', y2: '9' }],
  ],
  file_pdf: [
    ['path', { d: 'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z' }],
    ['path', { d: 'M14 2v4a2 2 0 0 0 2 2h4' }],
    ['path', { d: 'M10 8v8' }],
    ['path', { d: 'M10 12h2a1.5 1.5 0 0 1 0 3h-2' }],
    ['path', { d: 'M16 8v4' }],
    ['path', { d: 'M16 14a1 1 0 0 0-1-1h0a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1h0a1 1 0 0 0 1-1' }],
  ],
};

export function icon(name, opts = {}) {
  const size = opts.size || 16;
  const stroke = opts.stroke == null ? 2 : opts.stroke;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', String(stroke));
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  if (opts.class) svg.setAttribute('class', opts.class);
  const parts = I[name] || I.file;
  for (const [tag, attrs] of parts) {
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
    svg.append(el);
  }
  return svg;
}

export function iconHTML(name, opts = {}) {
  return icon(name, opts).outerHTML;
}

// Provider marks: honest monogram placeholders, not fake brand logos.
// Official brand SVG assets should replace these once sourced.
const PROVIDER_BRAND = {
  pcloud: { letter: 'p', color: '#34c3f0', bg: 'rgba(52,195,240,0.14)' },
  'google-drive': { letter: 'G', color: '#8ab4f8', bg: 'rgba(138,180,248,0.14)' },
  onedrive: { letter: 'O', color: '#52a8ff', bg: 'rgba(82,168,255,0.14)' },
  dropbox: { letter: 'D', color: '#61b8ff', bg: 'rgba(97,184,255,0.14)' },
  koofr: { letter: 'K', color: '#9aa7b8', bg: 'rgba(154,167,184,0.16)' },
  box: { letter: 'B', color: '#5c9ee5', bg: 'rgba(92,158,229,0.14)' },
  mega: { letter: 'M', color: '#d9264a', bg: 'rgba(217,38,74,0.14)' },
  mediafire: { letter: 'M', color: '#6a7efc', bg: 'rgba(106,126,252,0.14)' },
  'proton-drive': { letter: 'P', color: '#8a6cff', bg: 'rgba(138,108,255,0.14)' },
  degoo: { letter: 'D', color: '#4ade80', bg: 'rgba(74,222,128,0.14)' },
  icedrive: { letter: 'I', color: '#38bdf8', bg: 'rgba(56,189,248,0.14)' },
  idrive: { letter: 'I', color: '#f59e0b', bg: 'rgba(245,158,11,0.14)' },
  icloud: { letter: 'i', color: '#e2e8f0', bg: 'rgba(226,232,240,0.14)' },
  sync: { letter: 'S', color: '#94a3b8', bg: 'rgba(148,163,184,0.16)' },
  internxt: { letter: 'I', color: '#f472b6', bg: 'rgba(244,114,182,0.14)' },
};

export function providerIcon(id, opts = {}) {
  const size = opts.size || 28;
  const brand = PROVIDER_BRAND[id] || { letter: '?', color: '#a1a1aa', bg: 'rgba(161,161,170,0.12)' };
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 28 28');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('aria-hidden', 'true');
  const bg = document.createElementNS(NS, 'rect');
  bg.setAttribute('x', '0');
  bg.setAttribute('y', '0');
  bg.setAttribute('width', '28');
  bg.setAttribute('height', '28');
  bg.setAttribute('rx', '7');
  bg.setAttribute('fill', brand.bg);
  svg.append(bg);
  const text = document.createElementNS(NS, 'text');
  text.setAttribute('x', '14');
  text.setAttribute('y', '14');
  text.setAttribute('text-anchor', 'middle');
  text.setAttribute('dominant-baseline', 'central');
  text.setAttribute('font-family', 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif');
  text.setAttribute('font-size', '13');
  text.setAttribute('font-weight', '700');
  text.setAttribute('fill', brand.color);
  text.textContent = brand.letter;
  svg.append(text);
  return svg;
}

export function hasIcon(name) {
  return Boolean(I[name]);
}