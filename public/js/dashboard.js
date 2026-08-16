import { api } from './api.js';
import { store } from './store.js';
import * as storage from './storage.js';
import { navigate } from './router.js';
import { qs, h, formatBytes, timeAgo, fileIcon } from './ui.js';
import { icon, providerIcon } from './icons.js';

export async function render() {
  const container = qs('#view-dashboard');
  let recent = [];

  await storage.refresh();
  try {
    const data = await api.get('/api/files');
    recent = (data.files || []).slice(0, 5);
  } catch (err) {
    recent = [];
  }

  if (qs('#view-dashboard').hidden) return;
  container.replaceChildren();
  buildDom(container, recent);
}

function buildDom(container, recent) {
  container.append(
    h('div', { class: 'view-header' }, [
      h('div', {}, [
        h('h1', { class: 'view-title' }, ['Overview']),
        h('p', { class: 'view-sub' }, ['Your cloud storage at a glance.']),
      ]),
    ])
  );

  const body = h('div', { class: 'page-body narrow' }, []);
  body.append(storageSection());
  body.append(cloudsSection());
  body.append(recentSection(recent));
  container.append(body);
}

function storageSection() {
  const s = store.seed;
  const head = h('div', { class: 'section-head' }, [
    h('h2', { class: 'section-title' }, ['Seed Cloud Storage']),
    h('button', { class: 'section-action', onclick: () => navigate('/storage') }, ['Details']),
  ]);

  const body = s.ready
    ? h('div', { class: 'storage-overview-main' }, [
        h('div', { class: 'storage-amount' }, [
          h('span', { class: 'storage-used' }, [formatBytes(s.used)]),
          h('span', { class: 'storage-of' }, [`of ${formatBytes(s.limit)} used`]),
        ]),
        h('div', { class: 'storage-bar-lg' }, [
          h('span', { class: 'storage-bar-fill', style: `width:${Math.min(100, s.percentage).toFixed(1)}%` }),
        ]),
        h('div', { class: 'storage-free-line' }, [
          icon('check_circle', { size: 14 }),
          `${formatBytes(s.available)} free`,
        ]),
      ])
    : h('div', { class: 'notice info', style: 'margin:0' }, [
        icon('info', { size: 15 }),
        h('span', {}, ['Your Seed Cloud storage is not configured yet.']),
      ]);

  return h('section', { class: 'section' }, [head, h('div', { class: 'panel storage-overview' }, [body])]);
}

function cloudsSection() {
  const connected = store.providers.filter((p) => p.status === 'connected');
  const notConnected = store.providers.filter((p) => p.status !== 'connected');

  const head = h('div', { class: 'section-head' }, [
    h('h2', { class: 'section-title' }, ['Connected clouds']),
    h('button', { class: 'section-action', onclick: () => navigate('/clouds') }, ['Manage']),
  ]);

  const list = h('div', { class: 'cloud-list panel', style: 'overflow:hidden' }, []);

  if (!store.providers.length) {
    list.append(
      h('div', { class: 'cloud-list-item' }, [
        h('span', { class: 'cloud-name' }, ['Cloud providers could not be loaded.']),
      ])
    );
  }

  for (const p of connected) {
    const usage = store.storageByProvider[p.id];
    const cap = usage && usage.total ? `${formatBytes(usage.used || 0)} / ${formatBytes(usage.total)}` : '';
    list.append(
      h('div', { class: 'cloud-list-item' }, [
        providerIcon(p.id, { size: 28 }),
        h('span', { class: 'cloud-name' }, [p.name]),
        cap ? h('span', { class: 'cloud-cap' }, [cap]) : null,
        h('span', { class: 'cloud-state' }, [
          h('span', { class: 'badge badge-connected' }, [icon('check', { size: 11 }), 'Connected']),
        ]),
      ])
    );
  }

  for (const p of notConnected) {
    list.append(
      h('div', { class: 'cloud-list-item' }, [
        providerIcon(p.id, { size: 28 }),
        h('span', { class: 'cloud-name' }, [p.name]),
        h('span', { class: 'cloud-state' }, [
          h('span', { class: 'badge badge-disconnected' }, ['Not connected']),
        ]),
      ])
    );
  }

  if (connected.length === 0 && store.providers.length) {
    list.append(
      h('div', { class: 'cloud-list-item', style: 'justify-content:center;gap:10px' }, [
        h('span', { class: 'cloud-state' }, ['No cloud accounts connected yet.']),
        h('button', { class: 'btn btn-sm btn-primary', onclick: () => navigate('/clouds') }, ['Connect a cloud']),
      ])
    );
  }

  return h('section', { class: 'section' }, [head, list]);
}

function recentSection(recent) {
  const head = h('div', { class: 'section-head' }, [
    h('h2', { class: 'section-title' }, ['Recent files']),
    h('button', { class: 'section-action', onclick: () => navigate('/files') }, ['View all']),
  ]);

  const list = h('div', { class: 'recent-list panel', style: 'overflow:hidden' }, []);

  if (recent && recent.length) {
    for (const item of recent.slice(0, 5)) {
      list.append(
        h('div', { class: 'recent-row' }, [
          h('span', { class: 'file-icon' }, [fileIcon(item.name, item.isFolder)]),
          h('span', { class: 'recent-name', title: item.name }, [item.name]),
          h('span', { class: 'recent-size' }, [item.isFolder ? '—' : formatBytes(item.size)]),
          h('span', { class: 'recent-date' }, [timeAgo(item.modified)]),
        ])
      );
    }
  } else {
    list.append(
      h('div', { class: 'empty-state', style: 'padding:36px 24px' }, [
        h('span', { class: 'empty-icon' }, [icon('file', { size: 24 })]),
        h('p', { class: 'empty-title' }, ['No files yet']),
        h('p', { class: 'empty-body' }, ['Upload your first file to get started.']),
        h('div', { class: 'empty-action' }, [
          h('button', { class: 'btn btn-primary', onclick: () => navigate('/upload') }, [icon('upload', { size: 14 }), 'Upload files']),
        ]),
      ])
    );
  }

  return h('section', { class: 'section' }, [head, list]);
}