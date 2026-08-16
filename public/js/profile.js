import { api } from './api.js';
import { store, refreshProfile, refreshSeedStorage, isEmailConfirmed } from './store.js';
import { qs, h, toast, openModal, closeModal, escapeHtml, formatStorageBytes } from './ui.js';
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
  const container = qs('#view-profile');
  container.replaceChildren();

  try {
    store.profile = await refreshProfile();
  } catch (err) {
    store.profile = null;
  }
  await refreshSeedStorage().catch(() => {});
  if (qs('#view-profile').hidden) return;

  const user = store.user;
  const profile = store.profile;
  const name = profile && profile.name ? profile.name : (user.user_metadata && user.user_metadata.full_name) || '';
  const email = (profile && profile.email) || user.email || '';
  const confirmed = profile ? profile.emailVerified : isEmailConfirmed(user);
  const created = (profile && profile.createdAt) || user.created_at || null;

  container.append(
    h('div', { class: 'view-header' }, [
      h('div', {}, [
        h('h1', { class: 'view-title' }, ['Profile']),
        h('p', { class: 'view-sub' }, ['Your account details and security.']),
      ]),
      confirmed
        ? h('span', { class: 'badge badge-connected' }, [icon('check', { size: 11 }), 'Email confirmed'])
        : h('span', { class: 'badge badge-disconnected' }, ['Email not confirmed']),
    ])
  );

  const body = h('div', { class: 'page-body narrow' }, []);

  // Profile header
  const headSection = h('div', { class: 'settings-section' }, [
    h('div', { class: 'profile-head' }, [
      h('div', { class: 'profile-avatar' }, [(name.trim() ? name.trim().charAt(0) : email.charAt(0)).toUpperCase()]),
      h('div', { style: 'min-width:0' }, [
        h('div', { class: 'profile-name' }, [escapeHtml(name || 'Seed Cloud user')]),
        h('div', { class: 'profile-email' }, [escapeHtml(email || '')]),
      ]),
    ]),
    h('div', { class: 'profile-meta settings-row' }, [
      h('div', { class: 'settings-row-main' }, [
        h('div', { class: 'settings-row-title' }, ['Member since']),
      ]),
      h('div', { class: 'settings-value' }, [created ? new Date(created).toLocaleDateString() : '—']),
    ]),
  ]);
  body.append(headSection);

  // Account details
  body.append(
    settingsSection('Account', 'user', [
      settingsRow({
        iconName: 'user',
        title: 'Display name',
        desc: 'Shown across the app and in shared links.',
        action: h('div', { class: 'form-inline' }, [
          h('input', { class: 'input', id: 'profile-name-input', type: 'text', maxlength: '60', value: name, style: 'width:220px' }),
          h('button', { class: 'btn btn-primary btn-sm', id: 'profile-save-btn' }, ['Save']),
        ]),
      }),
      settingsRow({
        iconName: 'mail',
        title: 'Email address',
        desc: 'Used to sign in. Cannot be changed here yet.',
        action: h('div', { class: 'settings-value' }, [escapeHtml(email)]),
      }),
    ])
  );

  // Storage
  const s = store.seed;
  body.append(
    settingsSection('Storage', 'harddrive', [
      settingsRow({
        iconName: 'harddrive',
        title: 'Seed Cloud Storage',
        desc: s.ready
          ? `${formatStorageBytes(s.used)} used of ${formatStorageBytes(s.limit)}`
          : 'Storage information is unavailable right now.',
        action: h('button', { class: 'btn btn-secondary btn-sm', onclick: () => { window.location.href = '/storage'; } }, ['Details']),
      }),
    ])
  );

  // Security
  body.append(
    settingsSection('Security', 'shield', [
      settingsRow({
        iconName: 'key',
        title: 'Password',
        desc: 'Change the password you use to sign in.',
        action: h('button', { class: 'btn btn-secondary btn-sm', id: 'profile-password-btn' }, ['Change password']),
      }),
      settingsRow({
        iconName: 'log_out',
        title: 'Sign out',
        desc: 'End this session on this device.',
        action: h('button', { class: 'btn btn-danger btn-sm', id: 'profile-signout-btn' }, ['Sign out']),
      }),
    ])
  );

  // Connected accounts
  const providerRows = store.providers.length
    ? store.providers.map((p) =>
        settingsRow({
          iconNode: h('div', { class: 'settings-row-icon', style: 'padding:0;overflow:hidden' }, [providerIcon(p.id, { size: 34 })]),
          title: p.name,
          desc: p.status === 'connected' ? 'Connected and in use.' : p.available ? 'Not connected.' : 'Available soon.',
          action: h('div', { class: 'provider-row-connect' }, [
            p.status === 'connected'
              ? h('span', { class: 'badge badge-connected' }, [icon('check', { size: 11 }), 'Connected'])
              : h('span', { class: 'badge badge-disconnected' }, ['Not connected']),
          ]),
        })
      )
    : [settingsRow({ iconName: 'cloud', title: 'No providers loaded', desc: 'Cloud providers could not be loaded.' })];
  body.append(settingsSection('Connected accounts', 'cloud', providerRows));

  // Preferences (not yet implemented — do not fake)
  body.append(
    settingsSection('Preferences', 'palette', [
      settingsRow({
        iconName: 'eye',
        title: 'Theme',
        desc: 'Only the dark theme is available right now.',
        action: h('span', { class: 'badge badge-disconnected' }, ['Dark']),
      }),
      settingsRow({
        iconName: 'bell',
        title: 'Notifications',
        desc: 'Coming soon.',
        action: h('button', { class: 'btn btn-sm', disabled: true }, ['Coming soon']),
      }),
    ])
  );

  container.append(body);

  qs('#profile-save-btn').addEventListener('click', () => {
    const nameInput = qs('#profile-name-input');
    const next = nameInput.value.trim();
    if (!next) {
      toast('Name cannot be empty.', 'error');
      nameInput.focus();
      return;
    }
    store.supabase.auth
      .updateUser({ data: { full_name: next } })
      .then((res) => {
        if (res.error) throw res.error;
        store.user = res.data.user;
        const nameEl = qs('#account-name');
        const avatarEl = qs('#account-avatar');
        if (nameEl) nameEl.textContent = next;
        if (avatarEl) avatarEl.textContent = next.trim().charAt(0);
        toast('Profile updated', 'success');
        render();
      })
      .catch((err) => toast(`Could not save changes: ${err.message}`, 'error'));
  });

  qs('#profile-password-btn').addEventListener('click', changePassword);

  qs('#profile-signout-btn').addEventListener('click', () => {
    try {
      localStorage.removeItem('sc_pending_email');
    } catch (e) {}
    store.supabase.auth.signOut();
  });
}

function changePassword() {
  const input = h('input', { class: 'input', type: 'password', autocomplete: 'new-password', placeholder: 'New password' });
  const errorBox = h('div', { class: 'form-error', hidden: true });
  const doChange = () => {
    const pw = input.value;
    if (!pw || pw.length < 6) {
      errorBox.textContent = 'Password must be at least 6 characters.';
      errorBox.hidden = false;
      input.focus();
      return;
    }
    store.supabase.auth
      .updateUser({ password: pw })
      .then((res) => {
        if (res.error) throw res.error;
        closeModal();
        toast('Password updated', 'success');
      })
      .catch((err) => toast(`Could not change password: ${err.message}`, 'error'));
  };
  openModal(
    h('div', {}, [
      h('h3', {}, ['Change password']),
      h('div', { class: 'form-field' }, [
        h('label', {}, ['New password']),
        input,
        errorBox,
      ]),
      h('div', { class: 'modal-actions' }, [
        h('button', { class: 'btn', onclick: closeModal }, ['Cancel']),
        h('button', { class: 'btn btn-primary', onclick: doChange }, ['Update password']),
      ]),
    ])
  );
  input.focus();
}