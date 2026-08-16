import { api } from './api.js';
import { store, refreshSeedStorage } from './store.js';
import { navigate } from './router.js';
import { qs, h, formatBytes, formatStorageBytes, emptyState, toast } from './ui.js';
import { icon, providerIcon } from './icons.js';

// The Storage page shows the user's Seed Cloud logical quota (512 MB) — the
// backend Google Drive account's own capacity is never surfaced. It also keeps
// the "By provider" breakdown for the user's personal cloud connections.

async function refreshProviderUsage() {
  store.storageByProvider = {};
  const jobs = [];
  for (const p of store.providers) {
    for (const conn of p.connections || []) {
      if (conn.status !== 'connected') continue;
      jobs.push(
        api
          .post(`/api/clouds/${conn.id}/refresh`)
          .then((data) => {
            conn.storageUsed = data.storageUsed;
            conn.storageTotal = data.storageTotal;
          })
          .catch(() => {})
      );
    }
  }
  await Promise.all(jobs);

  for (const p of store.providers) {
    const usages = (p.connections || [])
      .filter((c) => c.status === 'connected')
      .map((c) => ({ used: c.storageUsed, total: c.storageTotal }))
      .filter((u) => u.used != null);
    if (usages.length) {
      store.storageByProvider[p.id] = {
        name: p.name,
        used: usages.reduce((sum, u) => sum + (u.used || 0), 0),
        total: usages.reduce((sum, u) => sum + (u.total || 0), 0),
      };
    }
  }
}

export async function refresh() {
  await refreshSeedStorage();
  await refreshProviderUsage();
  renderSidebar();
}

export function refreshSidebar() {
  renderSidebar();
}

export function connectedUsage() {
  return store.providers
    .filter((p) => p.status === 'connected' && store.storageByProvider[p.id] && !store.storageByProvider[p.id].error)
    .map((p) => ({ id: p.id, name: p.name, ...store.storageByProvider[p.id] }));
}

export function totals() {
  const usages = connectedUsage();
  let used = 0;
  let total = 0;
  let any = false;
  for (const u of usages) {
    if (u.used == null) continue;
    any = true;
    used += u.used;
    if (u.total) total += u.total;
  }
  return { any, used, total };
}

export function renderSidebar() {
  const fill = qs('#storage-bar-fill');
  const meta = qs('#storage-meta');
  if (store.seed.ready && store.seed.limit) {
    fill.style.width = Math.min(100, store.seed.percentage).toFixed(1) + '%';
    meta.replaceChildren(h('div', {}, [`${formatStorageBytes(store.seed.used)} / ${formatStorageBytes(store.seed.limit)}`]));
  } else {
    fill.style.width = '0%';
    meta.replaceChildren(h('div', {}, ['Storage not configured']));
  }
}

// Starts the OAuth consent for Seed Cloud's owner Google Drive account. This is
// backend infrastructure — it is intentionally NOT shown on the Clouds page.
export function authorizeBackendStorage() {
  api
    .get('/api/storage/google/start')
    .then((data) => {
      window.location.href = data.url;
    })
    .catch((err) => toast(err.message || 'Could not start storage authorization', 'error'));
}

export async function render() {
  const container = qs('#view-storage');
  buildDom(container);
  await refresh();
  if (qs('#view-storage').hidden) return;
  buildDom(container);
}

function buildDom(container) {
  container.replaceChildren();

  container.append(
    h('div', { class: 'view-header' }, [
      h('div', {}, [
        h('h1', { class: 'view-title' }, ['Storage']),
        h('p', { class: 'view-sub' }, ['Your Seed Cloud storage quota.']),
      ]),
    ])
  );

  const body = h('div', { class: 'page-body narrow' }, []);
  const s = store.seed;

  const summary = h('div', { class: 'panel panel-pad' }, []);
  if (s.ready) {
    const free = s.available;
    const pct = Math.min(100, s.percentage);
    summary.append(
      h('div', { class: 'storage-title-row' }, [
        h('span', { class: 'storage-total' }, [formatStorageBytes(s.limit)]),
        h('span', { class: 'storage-name' }, ['Seed Cloud Storage']),
      ]),
      h('div', { class: 'storage-sub' }, [
        `${formatStorageBytes(s.used)} used · ${formatStorageBytes(free)} available · ${pct.toFixed(1)}%`,
      ]),
      h('div', { class: 'storage-bar-lg', style: 'margin-top:14px' }, [
        h('span', { class: 'storage-bar-fill', style: `width:${pct.toFixed(1)}%` }),
      ])
    );
    if (s.overQuota) {
      summary.append(
        h('div', { class: 'notice warn', style: 'margin-top:12px' }, [
          icon('alert', { size: 15 }),
          h('span', {}, ['You are over your 512 MB storage limit. Uploads are paused until you free up space.']),
        ])
      );
    }
  } else {
    summary.append(
      h('div', { class: 'notice warn', style: 'margin:0' }, [
        icon('alert', { size: 15 }),
        h('span', {}, [
          store.googleConfigured
            ? 'Seed Cloud storage is not authorized yet.'
            : 'Seed Cloud storage is not configured on this server yet.',
        ]),
      ])
    );
    if (store.googleConfigured) {
      summary.append(
        h('div', { class: 'empty-action', style: 'margin-top:12px' }, [
          h('button', { class: 'btn btn-primary', onclick: authorizeBackendStorage }, [
            icon('harddrive', { size: 14 }),
            'Authorize Seed Cloud storage',
          ]),
        ])
      );
    }
  }

  body.append(h('section', { class: 'section' }, [
    h('div', { class: 'section-head' }, [h('h2', { class: 'section-title' }, ['Overview'])]),
    summary,
  ]));

  if (s.ready && s.used === 0) {
    body.append(
      emptyState({
        icon: 'upload',
        title: 'Your Seed Cloud storage is empty.',
        body: 'Upload your first file to get started. You have 512 MB of Seed Cloud storage.',
        action: h('button', { class: 'btn btn-primary', onclick: () => navigate('/upload') }, [icon('upload', { size: 14 }), 'Upload files']),
      })
    );
  }

  const breakdown = h('div', { class: 'panel', style: 'overflow:hidden' }, []);
  breakdown.append(h('div', { class: 'settings-section-title' }, [icon('harddrive', { size: 15 }), 'Connected cloud providers']));

  const providers = store.providers.length ? store.providers : [];

  if (!providers.length) {
    breakdown.append(
      h('div', { class: 'storage-sub', style: 'padding:12px 16px' }, ['Providers could not be loaded.'])
    );
  }

  for (const provider of providers) {
    const usage = store.storageByProvider[provider.id];
    if (provider.status !== 'connected' || !usage) {
      breakdown.append(
        h('div', { class: 'provider-usage' }, [
          h('div', { class: 'pu-name' }, [providerIcon(provider.id, { size: 24 }), provider.name]),
          h('div', { class: 'pu-value' }, ['Not connected']),
        ])
      );
      continue;
    }
    const usedN = usage.used ?? 0;
    const totalN = usage.total;
    const pctN = totalN ? Math.min(100, (usedN / totalN) * 100) : 0;
    breakdown.append(
      h('div', { class: 'provider-usage' }, [
        h('div', { class: 'pu-name' }, [providerIcon(provider.id, { size: 24 }), provider.name]),
        h('div', { class: 'pu-value' }, [
          totalN ? `${formatBytes(usedN)} / ${formatBytes(totalN)}` : 'Capacity unknown',
        ]),
        totalN
          ? h('div', { class: 'pu-bar' }, [h('span', { style: `width:${pctN}%` })])
          : null,
      ])
    );
  }

  body.append(h('section', { class: 'section' }, [
    h('div', { class: 'section-head' }, [h('h2', { class: 'section-title' }, ['By provider'])]),
    breakdown,
  ]));

  container.append(body);
}