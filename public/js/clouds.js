import { api } from './api.js';
import { store, refreshProviders } from './store.js';
import * as storage from './storage.js';
import * as browser from './browser.js';
import { navigate } from './router.js';
import { qs, h, toast, formatBytes, openModal, closeModal } from './ui.js';
import { icon, providerIcon } from './icons.js';

// Local UI state for the connect/disconnect lifecycle. The server statuses are
// NOT_CONNECTED / CONNECTING / CONNECTED / ERROR / DISCONNECTING; we drive the
// transitional ones here because they only exist while a request is in flight.
const uiState = {
  connecting: {},
  disconnecting: {},
};

const GROUP_ORDER = ['supported', 'limited', 'unsupported'];
const GROUP_LABEL = {
  supported: 'Supported',
  limited: 'Limited',
  unsupported: 'Unavailable',
};

function refreshAll() {
  return refreshProviders()
    .then(() => storage.refresh())
    .then(() => browser.refresh())
    .then(() => renderSidebar());
}

function connectedConnections(provider) {
  return (provider.connections || []).filter((c) => c.status === 'connected');
}

function providerBadge(provider) {
  const connecting = uiState.connecting[provider.id];
  const disconnecting = connectedConnections(provider).some((c) => uiState.disconnecting[`${provider.id}:${c.id}`]);

  if (connecting) return h('span', { class: 'badge badge-connecting' }, [icon('refresh', { size: 11 }), 'Connecting…']);
  if (disconnecting) return h('span', { class: 'badge badge-connecting' }, [icon('refresh', { size: 11 }), 'Disconnecting…']);
  if (provider.status === 'connected') return h('span', { class: 'badge badge-connected' }, [icon('check', { size: 11 }), 'Connected']);
  if (provider.status === 'error') return h('span', { class: 'badge badge-danger' }, [icon('alert', { size: 11 }), 'Error']);
  return h('span', { class: 'badge badge-disconnected' }, ['Not connected']);
}

function connectProvider(id) {
  uiState.connecting[id] = true;
  render();
  api
    .get(`/api/oauth/${id}/start`)
    .then((data) => {
      window.location.href = data.url;
    })
    .catch((err) => {
      delete uiState.connecting[id];
      if (err.status === 503) {
        toast(err.message || 'This provider is not configured on this server yet.', 'error');
      } else {
        toast(`Could not start connection: ${err.message}`, 'error');
      }
      render();
    });
}

function confirmDisconnect(provider, conn) {
  const accountLabel = conn.email || conn.displayName || conn.providerAccountId || provider.name;
  const content = h('div', {}, [
    h('h3', {}, [`Disconnect this ${provider.name} account?`]),
    h('p', { class: 'modal-body' }, [
      `Your files will remain in ${provider.name}. Seed Cloud will simply stop accessing this connected account (${accountLabel}).`,
    ]),
    h('div', { class: 'modal-actions' }, [
      h('button', { class: 'btn', onclick: closeModal }, ['Cancel']),
      h('button', {
        class: 'btn btn-danger',
        onclick: () => {
          closeModal();
          doDisconnect(provider, conn);
        },
      }, ['Disconnect']),
    ]),
  ]);
  openModal(content);
}

function doDisconnect(provider, conn) {
  const key = `${provider.id}:${conn.id}`;
  uiState.disconnecting[key] = true;
  render();
  api
    .post(`/api/clouds/${conn.id}/disconnect`)
    .then(() => {
      toast(`${provider.name} disconnected`, 'success');
      return refreshAll();
    })
    .catch((err) => toast(`Could not disconnect: ${err.message}`, 'error'))
    .finally(() => {
      delete uiState.disconnecting[key];
      render();
    });
}

function connectionStorageLine(conn) {
  if (conn.storageUsed == null) return null;
  if (conn.storageTotal == null) return `${formatBytes(conn.storageUsed)} used`;
  return `${formatBytes(conn.storageUsed)} / ${formatBytes(conn.storageTotal)}`;
}

function connectionRow(provider, conn) {
  const accountLabel = conn.email || conn.displayName || conn.providerAccountId || 'Connected account';
  const busy = uiState.disconnecting[`${provider.id}:${conn.id}`];
  const actions = h('div', { class: 'conn-actions' }, [
    h('button', {
      class: 'btn btn-sm',
      disabled: busy,
      onclick: () => showManage(provider, conn),
    }, [icon('settings', { size: 12 }), 'Manage']),
    h('button', {
      class: 'btn btn-sm btn-danger',
      disabled: busy,
      onclick: () => confirmDisconnect(provider, conn),
    }, [icon('trash', { size: 12 }), 'Disconnect']),
  ]);
  return h('div', { class: 'cloud-conn-row' }, [
    h('div', { class: 'cloud-conn-main' }, [
      h('div', { class: 'cloud-conn-name', title: accountLabel }, [accountLabel]),
      h('div', { class: 'cloud-conn-cap' }, [
        busy ? 'Disconnecting…' : (connectionStorageLine(conn) || 'Capacity unknown'),
      ]),
    ]),
    actions,
  ]);
}

function showManage(provider, conn) {
  const used = conn.storageUsed;
  const total = conn.storageTotal;
  const available = used != null && total != null ? Math.max(0, total - used) : null;
  const connectedAt = conn.createdAt
    ? new Date(conn.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
    : '—';

  const rows = [
    ['Provider', provider.name],
    ['Account', conn.email || conn.displayName || conn.providerAccountId || '—'],
    ['Connection status', conn.status === 'connected' ? 'Connected' : conn.status],
    ['Storage used', used != null ? formatBytes(used) : '—'],
    ['Storage available', available != null ? formatBytes(available) : '—'],
    ['Connected', connectedAt],
  ];

  const list = h('ul', { class: 'detail-list' }, rows.map(([k, v]) =>
    h('li', {}, [h('span', { class: 'k' }, [k]), h('span', { class: 'v' }, [v])])
  ));

  const content = h('div', {}, [
    h('h3', {}, [provider.name, ' connection']),
    list,
    h('div', { class: 'modal-actions' }, [
      h('button', {
        class: 'btn btn-danger',
        onclick: () => {
          closeModal();
          confirmDisconnect(provider, conn);
        },
      }, [icon('trash', { size: 14 }), 'Disconnect']),
      h('button', { class: 'btn', onclick: closeModal }, ['Close']),
    ]),
  ]);
  openModal(content);
}

function canConnect(provider) {
  return provider.availability === 'supported' && provider.implemented;
}

function providerCard(provider) {
  const conns = provider.connections || [];
  const anyConnected = connectedConnections(provider).length > 0;

  const capLine = anyConnected
    ? h('div', { class: 'cloud-card-cap' }, ['Connected accounts: ', String(conns.filter((c) => c.status === 'connected').length)])
    : null;

  const connList = conns.length
    ? h('div', { class: 'cloud-conn-list' }, conns.map((c) => connectionRow(provider, c)))
    : null;

  let action;
  if (anyConnected) {
    action = h('button', {
      class: 'btn btn-sm',
      title: 'Connect another account',
      onclick: () => connectProvider(provider.id),
    }, [icon('plus', { size: 12 }), 'Connect another account']);
  } else if (canConnect(provider)) {
    action = h('button', {
      class: 'btn btn-sm btn-primary',
      onclick: () => connectProvider(provider.id),
    }, [`Connect ${provider.name}`]);
  } else if (provider.availability === 'supported') {
    action = h('button', { class: 'btn btn-sm', disabled: true, title: 'Coming soon' }, ['Coming soon']);
  } else if (provider.availability === 'limited') {
    action = h('button', { class: 'btn btn-sm', disabled: true, title: provider.limitedReason }, ['Limited']);
  } else {
    action = h('button', { class: 'btn btn-sm', disabled: true, title: provider.unavailableReason }, ['Unavailable']);
  }

  const note = provider.availability === 'limited' && provider.limitedReason
    ? h('div', { class: 'cloud-card-note' }, [provider.limitedReason])
    : provider.availability === 'unsupported' && provider.unavailableReason
      ? h('div', { class: 'cloud-card-note' }, [provider.unavailableReason])
      : null;

  return h('div', { class: 'cloud-card', 'data-availability': provider.availability }, [
    h('div', { class: 'cloud-card-head' }, [
      h('span', { class: 'cloud-icon' }, [providerIcon(provider.id, { size: 32 })]),
      h('div', { style: 'min-width:0' }, [
        h('div', { class: 'cloud-card-name' }, [provider.name]),
        h('div', { class: 'cloud-card-sub' }, [
          provider.description || 'Cloud storage',
          provider.freeTier ? ` · ${provider.freeTier}` : '',
        ]),
      ]),
    ]),
    note,
    capLine,
    connList,
    h('div', { class: 'cloud-card-foot' }, [
      providerBadge(provider),
      action,
    ]),
  ]);
}

function groupSection(group, providers) {
  const title = GROUP_LABEL[group];
  const cards = h('div', { class: 'cloud-grid' }, providers.map((p) => providerCard(p)));
  return h('section', { class: 'cloud-group' }, [
    h('div', { class: 'cloud-group-head' }, [
      h('h2', { class: 'cloud-group-title' }, [title]),
      h('span', { class: 'cloud-group-count' }, [`${providers.length} ${providers.length === 1 ? 'provider' : 'providers'}`]),
    ]),
    cards,
  ]);
}

export function renderSidebar() {
  const nav = qs('#sidebar-clouds');
  if (!nav) return;
  nav.replaceChildren();
  for (const provider of store.providers) {
    const connected = connectedConnections(provider).length > 0;
    const dot = h('span', { class: `dot ${connected ? 'connected' : 'not_connected'}` });
    const name = h('span', { class: 'cloud-name' }, [provider.name]);
    const row = h('button', {
      class: 'sidebar-cloud-row',
      title: connected
        ? provider.name
        : canConnect(provider)
          ? `Connect ${provider.name}`
          : provider.availability === 'limited'
            ? `${provider.name} — limited support`
            : provider.availability === 'unsupported'
              ? `${provider.name} — unavailable`
              : 'Coming soon',
    }, [dot, name]);
    if (canConnect(provider) || connected) {
      row.style.cursor = 'pointer';
      row.addEventListener('click', () => {
        if (connected) {
          navigate('/clouds');
        } else {
          connectProvider(provider.id);
        }
      });
      if (!connected) {
        row.append(h('span', { class: 'cloud-connect' }, ['Connect']));
      }
    }
    nav.append(row);
  }
}

export async function render() {
  const container = qs('#view-clouds');
  buildDom(container);
  try {
    await refreshAll();
  } catch (err) {
    toast(`Could not load cloud connections: ${err.message}`, 'error');
  }
  if (qs('#view-clouds').hidden) return;
  buildDom(container);
}

function buildDom(container) {
  container.replaceChildren();

  container.append(
    h('div', { class: 'view-header' }, [
      h('div', {}, [
        h('h1', { class: 'view-title' }, ['Clouds']),
        h('p', { class: 'view-sub' }, ['Connect your cloud accounts. Files stay in the provider.']),
      ]),
      h('a', { class: 'btn btn-sm', href: '/docs/cloud-connections', target: '_blank', rel: 'noopener' }, [
        icon('external', { size: 12 }),
        'Learn how it works',
      ]),
    ])
  );

  const body = h('div', { class: 'page-body' }, []);

  const groups = { supported: [], limited: [], unsupported: [] };
  for (const provider of store.providers) {
    const g = groups[provider.availability] || groups.unsupported;
    g.push(provider);
  }

  if (store.providers.length) {
    for (const group of GROUP_ORDER) {
      if (!groups[group].length) continue;
      body.append(groupSection(group, groups[group]));
    }
  } else {
    body.append(
      h('div', { class: 'empty-state', style: 'padding:48px 24px' }, [
        h('span', { class: 'empty-icon' }, [icon('cloud', { size: 24 })]),
        h('p', { class: 'empty-title' }, ['Providers could not be loaded.']),
        h('p', { class: 'empty-body' }, ['Please try again.']),
      ])
    );
  }

  const note = h('div', { class: 'notice info', style: 'margin-top:18px' }, [
    icon('lock', { size: 15 }),
    h('span', {}, [
      'Seed Cloud never asks for or stores your cloud password. Authentication happens on the provider’s website, and provider credentials stay server-side. Unsupported providers have no legitimate integration, so they cannot be connected.',
    ]),
  ]);
  body.append(note);
  container.append(body);
}