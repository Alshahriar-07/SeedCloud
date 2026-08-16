import { qs, h, escapeHtml, formatBytes, formatDate, fileIcon, emptyState } from './ui.js';
import { icon } from './icons.js';

const STORAGE_KEY = 'sc_downloads';
const STATUS_LABEL = { downloading: 'Downloading', completed: 'Completed', failed: 'Failed', cancelled: 'Cancelled' };

let entries = [];
try {
  const raw = localStorage.getItem(STORAGE_KEY);
  entries = raw ? JSON.parse(raw) : [];
} catch (e) {
  entries = [];
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, 200)));
  } catch (e) {
    /* ignore */
  }
}

function record({ name, provider, size }) {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  entries.unshift({ id, name, provider, size: size || null, status: 'downloading', percent: 0, error: null, date: Date.now() });
  persist();
  rerenderIfVisible();
  return id;
}

function update(id, patch) {
  const entry = entries.find((e) => e.id === id);
  if (!entry) return;
  Object.assign(entry, patch);
  persist();
  rerenderIfVisible();
}

function rerenderIfVisible() {
  const view = qs('#view-downloads');
  if (view && !view.hidden) render();
}

// Downloads a file to the browser with real progress, then records the outcome.
export function downloadFile({ name, provider, size, url, headers }) {
  const id = record({ name, provider, size });
  const controller = new AbortController();

  (async () => {
    try {
      const res = await fetch(url, { headers, signal: controller.signal });
      if (!res.ok) throw new Error(`Download failed (HTTP ${res.status})`);

      const total = size || Number(res.headers.get('content-length')) || 0;
      if (!res.body) {
        const blob = await res.blob();
        triggerSave(blob, name, res.headers.get('content-type'));
        update(id, { status: 'completed', percent: 100 });
        return;
      }

      const reader = res.body.getReader();
      const chunks = [];
      let received = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.byteLength;
        if (total) update(id, { status: 'downloading', percent: Math.round((received / total) * 100) });
      }
      const blob = new Blob(chunks, { type: res.headers.get('content-type') || 'application/octet-stream' });
      triggerSave(blob, name);
      update(id, { status: 'completed', percent: 100 });
    } catch (err) {
      if (controller.signal.aborted) {
        update(id, { status: 'cancelled' });
      } else {
        update(id, { status: 'failed', error: err.message || 'Download failed' });
      }
    }
  })();

  return {
    cancel: () => controller.abort(),
  };
}

function triggerSave(blob, name, type) {
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function render() {
  const container = qs('#view-downloads');
  container.replaceChildren();

  container.append(
    h('div', { class: 'view-header' }, [
      h('div', {}, [
        h('h1', { class: 'view-title' }, ['Downloads']),
        h('p', { class: 'view-sub' }, ["Files you've downloaded from your clouds."]),
      ]),
      entries.length
        ? h('button', { class: 'btn btn-ghost btn-sm', onclick: clearAll }, [icon('trash', { size: 13 }), 'Clear history'])
        : null,
    ])
  );

  const body = h('div', { class: 'page-body' }, []);

  if (!entries.length) {
    body.append(
      emptyState({
        icon: 'download',
        title: 'No downloads yet',
        body: 'Files you download will appear here.',
      })
    );
    container.append(body);
    return;
  }

  const table = h('table', { class: 'file-table' }, [
    h('thead', {}, [
      h('tr', {}, [
        h('th', { class: 'col-name' }, ['File']),
        h('th', { style: 'width:120px' }, ['Provider']),
        h('th', { style: 'width:90px' }, ['Size']),
        h('th', { style: 'width:130px' }, ['Status']),
        h('th', { style: 'width:120px' }, ['Date']),
      ]),
    ]),
  ]);
  const tbody = h('tbody', {});
  table.append(tbody);

  for (const entry of entries.slice(0, 100)) {
    const statusClass =
      entry.status === 'completed' ? 'ok'
        : entry.status === 'downloading' ? 'pending'
        : entry.status === 'failed' ? 'err'
        : 'muted';
    tbody.append(
      h('tr', {}, [
        h('td', { class: 'col-name', title: entry.name }, [
          h('span', { class: 'row-primary' }, [
            h('span', { class: 'file-icon' }, [fileIcon(entry.name, false)]),
            h('span', { class: 'row-name' }, [escapeHtml(entry.name)]),
          ]),
        ]),
        h('td', { 'data-label': 'Provider' }, [escapeHtml(entry.provider || '—')]),
        h('td', { 'data-label': 'Size' }, [entry.size ? formatBytes(entry.size) : '—']),
        h('td', { 'data-label': 'Status' }, [
          h('span', { class: `dl-status ${statusClass}` }, [
            entry.status === 'downloading' && entry.percent
              ? `${entry.percent}%`
              : STATUS_LABEL[entry.status] || entry.status,
          ]),
        ]),
        h('td', { 'data-label': 'Date' }, [formatDate(entry.date)]),
      ])
    );
  }

  body.append(h('div', { class: 'file-table-wrap' }, [table]));
  container.append(body);
}

function clearAll() {
  entries = [];
  persist();
  render();
}
