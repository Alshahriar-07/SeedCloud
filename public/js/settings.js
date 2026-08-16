import { store } from './store.js';
import * as storage from './storage.js';
import { qs, h, formatBytes } from './ui.js';
import { icon, providerIcon } from './icons.js';

function settingsSection(title, iconName, rows) {
  return h('div', { class: 'settings-section' }, [
    h('div', { class: 'settings-section-title' }, [icon(iconName, { size: 15 }), title]),
    ...rows,
  ]);
}

function settingsRow({ iconName, title, desc, action, iconNode }) {
  return h('div', { class: 'settings-row' }, [
    iconNode || h('div', { class: 'settings-row-icon' }, [icon(iconName, { size: 16 })]),
    h('div', { class: 'settings-row-main' }, [
      h('div', { class: 'settings-row-title' }, [title]),
      desc ? h('div', { class: 'settings-row-desc' }, [desc]) : null,
    ]),
    action ? h('div', { class: 'settings-row-action' }, [action]) : null,
  ]);
}

export async function render() {
  const container = qs('#view-settings');
  container.replaceChildren();

  await storage.refresh();
  if (qs('#view-settings').hidden) return;

  container.append(
    h('div', { class: 'view-header' }, [
      h('div', {}, [
        h('h1', { class: 'view-title' }, ['Settings']),
        h('p', { class: 'view-sub' }, ['Configure how Seed Cloud works for you.']),
      ]),
    ])
  );

  const body = h('div', { class: 'page-body narrow' }, []);

  // Appearance
  body.append(
    settingsSection('Appearance', 'palette', [
      settingsRow({
        iconName: 'eye',
        title: 'Theme',
        desc: 'Seed Cloud uses a dark-first interface. Light theme is not available yet.',
        action: h('span', { class: 'badge badge-connected' }, ['Dark']),
      }),
      settingsRow({
        iconName: 'eye_off',
        title: 'Reduced motion',
        desc: 'Minimize interface animations.',
        action: h('button', { class: 'btn btn-sm', disabled: true }, ['Coming soon']),
      }),
    ])
  );

  // Account
  const name = (store.user && store.user.user_metadata && store.user.user_metadata.full_name) || '—';
  const email = (store.user && store.user.email) || '—';
  body.append(
    settingsSection('Account', 'user', [
      settingsRow({
        iconName: 'user',
        title: 'Display name',
        desc: name,
        action: h('button', { class: 'btn btn-secondary btn-sm', onclick: () => { window.location.href = '/profile'; } }, ['Manage']),
      }),
      settingsRow({
        iconName: 'mail',
        title: 'Email address',
        desc: email,
      }),
    ])
  );

  // Security
  body.append(
    settingsSection('Security', 'shield', [
      settingsRow({
        iconName: 'key',
        title: 'Password',
        desc: 'Manage your sign-in password.',
        action: h('button', { class: 'btn btn-secondary btn-sm', onclick: () => { window.location.href = '/profile'; } }, ['Manage']),
      }),
      settingsRow({
        iconName: 'lock',
        title: 'Two-factor authentication',
        desc: 'Not available yet.',
        action: h('button', { class: 'btn btn-sm', disabled: true }, ['Coming soon']),
      }),
      settingsRow({
        iconName: 'shield',
        title: 'Active sessions',
        desc: 'Review devices signed in to your account.',
        action: h('button', { class: 'btn btn-sm', disabled: true }, ['Coming soon']),
      }),
    ])
  );

  // Storage
  const s = store.seed;
  body.append(
    settingsSection('Storage', 'harddrive', [
      settingsRow({
        iconName: 'harddrive',
        title: 'Usage',
        desc: s.ready
          ? `${formatBytes(s.used)} used · ${formatBytes(s.available)} free of ${formatBytes(s.limit)}`
          : 'Seed Cloud storage is not configured yet.',
        action: h('button', { class: 'btn btn-secondary btn-sm', onclick: () => { window.location.href = '/storage'; } }, ['Details']),
      }),
      settingsRow({
        iconName: 'folder_open',
        title: 'Upload destination',
        desc: 'Files upload to your Seed Cloud storage.',
        action: h('span', { class: 'settings-value' }, ['Seed Cloud']),
      }),
    ])
  );

  // Connected clouds
  const providerRows = store.providers.length
    ? store.providers.map((p) =>
        settingsRow({
          iconNode: h('div', { class: 'settings-row-icon', style: 'padding:0;overflow:hidden' }, [providerIcon(p.id, { size: 34 })]),
          title: p.name,
          desc: p.status === 'connected' ? 'Connected and in use.' : p.available ? 'Not connected.' : 'Available soon.',
          action: p.status === 'connected'
            ? h('span', { class: 'badge badge-connected' }, [icon('check', { size: 11 }), 'Connected'])
            : h('button', { class: 'btn btn-secondary btn-sm', onclick: () => { window.location.href = '/clouds'; } }, ['Connect']),
        })
      )
    : [settingsRow({ iconName: 'cloud', title: 'No providers loaded', desc: 'Cloud providers could not be loaded.' })];
  body.append(settingsSection('Connected clouds', 'cloud', providerRows));

  container.append(body);
}