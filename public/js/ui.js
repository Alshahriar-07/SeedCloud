export function qs(sel, root = document) {
  return root.querySelector(sel);
}

export function qsa(sel, root = document) {
  return Array.from(root.querySelectorAll(sel));
}

export function h(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') el.className = value;
    else if (key === 'html') el.innerHTML = value;
    else if (key.startsWith('on')) el.addEventListener(key.slice(2), value);
    else if (value === true) el.setAttribute(key, '');
    else if (value !== false && value != null) el.setAttribute(key, value);
  }
  const kids = Array.isArray(children) ? children : [children];
  for (const child of kids) {
    if (child == null) continue;
    el.append(child.nodeType ? child : document.createTextNode(child));
  }
  return el;
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function formatBytes(bytes) {
  if (bytes === null || bytes === undefined) return '—';
  const n = Number(bytes);
  if (!isFinite(n) || n <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  const value = n / 1024 ** i;
  return `${value >= 100 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}

export function formatDate(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function timeAgo(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = startOfToday - startOfDay;
  if (diff === 0) return 'Today';
  if (diff === 86400000) return 'Yesterday';
  if (diff > 0 && diff < 7 * 86400000) return formatDate(ts);
  return formatDate(ts);
}

import { icon } from './icons.js';

const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'heic', 'avif', 'bmp'];
const VIDEO_EXTS = ['mp4', 'mkv', 'mov', 'avi', 'webm', 'm4v'];
const AUDIO_EXTS = ['mp3', 'wav', 'flac', 'ogg', 'm4a', 'aac', 'opus'];
const ARCHIVE_EXTS = ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'iso'];
const CODE_EXTS = ['js', 'ts', 'jsx', 'tsx', 'py', 'go', 'rs', 'rb', 'java', 'c', 'cpp', 'h', 'html', 'css', 'json', 'sh', 'yml', 'yaml', 'xml', 'sql', 'php'];
const SHEET_EXTS = ['xls', 'xlsx', 'csv', 'ods', 'numbers', 'tsv'];
const DOC_EXTS = ['doc', 'docx', 'txt', 'md', 'rtf', 'odt', 'pages'];
const PDF_EXTS = ['pdf'];
const CODE = 'code';

export function fileKind(name, isFolder) {
  if (isFolder) return 'folder';
  const ext = (name.split('.').pop() || '').toLowerCase();
  if (IMAGE_EXTS.includes(ext)) return 'image';
  if (VIDEO_EXTS.includes(ext)) return 'video';
  if (AUDIO_EXTS.includes(ext)) return 'audio';
  if (ARCHIVE_EXTS.includes(ext)) return 'archive';
  if (CODE_EXTS.includes(ext)) return CODE;
  if (SHEET_EXTS.includes(ext)) return 'sheet';
  if (PDF_EXTS.includes(ext)) return 'pdf';
  if (DOC_EXTS.includes(ext)) return 'doc';
  return 'file';
}

const FILE_ICON_NAME = {
  folder: 'folder',
  image: 'file-image',
  video: 'file-video',
  audio: 'file-audio',
  archive: 'file-archive',
  code: 'file-code',
  sheet: 'file-sheet',
  pdf: 'file-pdf',
  doc: 'file-text',
  file: 'file',
};

export function fileIcon(name, isFolder, size = 16) {
  return icon(FILE_ICON_NAME[fileKind(name, isFolder)] || 'file', { size });
}

export function emptyState({ icon: iconName = 'file', title, body, action }) {
  const parts = [h('span', { class: 'empty-icon' }, [icon(iconName, { size: 24 })]), h('p', { class: 'empty-title' }, [title])];
  if (body) parts.push(h('p', { class: 'empty-body' }, [body]));
  if (action) parts.push(h('div', { class: 'empty-action' }, [action]));
  return h('div', { class: 'empty-state' }, parts);
}

export function skeletonRows(count = 5) {
  const wrap = h('div', { class: 'loading-state' }, []);
  for (let i = 0; i < count; i += 1) {
    wrap.append(
      h('div', { class: 'skeleton-row' }, [
        h('div', { class: 'skeleton sk-ic' }),
        h('div', { class: 'skeleton sk-line' }),
        h('div', { class: 'skeleton sk-line w25' }),
        h('div', { class: 'skeleton sk-line w25' }),
      ])
    );
  }
  return wrap;
}

const TOAST_ICONS = {
  success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>',
};

function dismissToast(el) {
  if (!el || el.classList.contains('leaving')) return;
  el.classList.add('leaving');
  setTimeout(() => el.remove(), 190);
}

export function toast(message, type = 'info') {
  const wrap = qs('#toast-wrap');
  const el = h('div', { class: `toast ${type}` }, [
    h('span', { class: 'toast-icon', html: TOAST_ICONS[type] || TOAST_ICONS.info }),
    h('span', {}, [message]),
    h('button', {
      class: 'toast-close',
      type: 'button',
      'aria-label': 'Dismiss',
      html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
      onclick: () => dismissToast(el),
    }),
  ]);
  wrap.append(el);
  let timer = setTimeout(() => dismissToast(el), 4200);
  el.addEventListener('mouseenter', () => clearTimeout(timer));
  el.addEventListener('mouseleave', () => {
    timer = setTimeout(() => dismissToast(el), 1500);
  });
}

export function openModal(content) {
  const backdrop = qs('#modal-backdrop');
  const modal = qs('#modal');
  modal.replaceChildren(content);
  backdrop.hidden = false;
}

export function closeModal() {
  const backdrop = qs('#modal-backdrop');
  backdrop.hidden = true;
  qs('#modal').replaceChildren();
}

export function promptModal({ title, label, value, confirmText = 'Save', onConfirm }) {
  const input = h('input', { class: 'input', type: 'text', value: value || '' });
  const errorBox = h('div', { class: 'form-error', hidden: true });
  const doConfirm = () => {
    const next = input.value.trim();
    if (!next) {
      errorBox.textContent = 'Name cannot be empty.';
      errorBox.hidden = false;
      input.focus();
      return;
    }
    closeModal();
    onConfirm(next);
  };
  const actions = h('div', { class: 'modal-actions' }, [
    h('button', { class: 'btn', type: 'button', onclick: closeModal }, ['Cancel']),
    h('button', { class: 'btn btn-primary', type: 'button', onclick: doConfirm }, [confirmText]),
  ]);
  const content = h('div', {}, [
    h('h3', {}, [title]),
    h('div', { class: 'form-field' }, [h('label', {}, [label]), input, errorBox]),
    actions,
  ]);
  openModal(content);
  input.focus();
  input.select();
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doConfirm();
    if (e.key === 'Escape') closeModal();
  });
}

export function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}
