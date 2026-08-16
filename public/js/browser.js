import { api } from './api.js';
import { store } from './store.js';
import * as downloads from './downloads.js';
import { navigate } from './router.js';
import {
  qs,
  h,
  escapeHtml,
  formatBytes,
  timeAgo,
  fileIcon,
  emptyState,
  skeletonRows,
  toast,
  closeModal,
  promptModal,
  openModal,
} from './ui.js';
import { icon } from './icons.js';

let query = '';
let realFiles = null;
const selected = new Set();
let sortKey = 'name';
let sortDir = 'asc';
let folderPath = []; // stack of { id, name } for Seed Cloud folder navigation

function isFolder(item) {
  return Boolean(item.isFolder);
}

function typeName(item) {
  if (isFolder(item)) return 'Folder';
  const ext = (item.name.split('.').pop() || '').toLowerCase();
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'heic'].includes(ext)) return 'Image';
  if (['mp4', 'mkv', 'mov', 'avi', 'webm'].includes(ext)) return 'Video';
  if (['mp3', 'wav', 'flac', 'ogg', 'm4a'].includes(ext)) return 'Audio';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'Archive';
  if (['js', 'ts', 'py', 'go', 'rs', 'html', 'css', 'json', 'sh'].includes(ext)) return 'Code';
  if (item.mimeType && item.mimeType.startsWith('image/')) return 'Image';
  if (item.mimeType && item.mimeType.startsWith('video/')) return 'Video';
  if (item.mimeType && item.mimeType.startsWith('audio/')) return 'Audio';
  return 'File';
}

export function setSearchQuery(value) {
  query = value;
  renderFiles();
}

// The Seed Cloud folder the user is currently viewing (or null for the root).
// Used by the upload flow to place new files in the open folder.
export function currentFolderId() {
  return folderPath.length ? folderPath[folderPath.length - 1].id : null;
}

export function refresh() {
  const folderId = currentFolderId();
  const params = folderId ? `?folder=${encodeURIComponent(folderId)}` : '';
  api
    .get(`/api/files${params}`)
    .then((data) => {
      realFiles = data.files || [];
      renderFiles();
    })
    .catch((err) => {
      realFiles = null;
      renderFiles();
      toast(`Could not load files: ${err.message}`, 'error');
    });
}

export function render() {
  folderPath = [];
  refresh();
}

function goToFolder(item) {
  folderPath.push({ id: item.id, name: item.name });
  query = '';
  refresh();
}

function goUp() {
  folderPath.pop();
  query = '';
  refresh();
}

function applySort(items) {
  const dir = sortDir === 'desc' ? -1 : 1;
  const key = sortKey;
  const sorted = [...items];
  sorted.sort((a, b) => {
    let av;
    let bv;
    if (key === 'name') {
      av = a.name.toLowerCase();
      bv = b.name.toLowerCase();
    } else if (key === 'size') {
      av = isFolder(a) ? -1 : a.size || 0;
      bv = isFolder(b) ? -1 : b.size || 0;
    } else {
      av = a.modified || 0;
      bv = b.modified || 0;
    }
    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    return 0;
  });
  return sorted;
}

function renderFiles() {
  const container = qs('#view-files');
  container.replaceChildren();

  container.append(
    h('div', { class: 'view-header' }, [
      h('div', {}, [
        h('h1', { class: 'view-title' }, ['My Files']),
        h('p', { class: 'view-sub' }, ['Files stored in your Seed Cloud storage.']),
      ]),
      h('span', { class: 'badge badge-connected' }, [icon('harddrive', { size: 11 }), 'Seed Cloud Storage']),
    ])
  );

  const body = h('div', { class: 'page-body' }, []);

  if (folderPath.length) {
    const current = folderPath[folderPath.length - 1];
    body.append(
      h('div', { class: 'folder-path' }, [
        h('button', { class: 'btn btn-ghost btn-sm', onclick: goUp }, [icon('arrow_left', { size: 13 }), 'Up']),
        h('span', { class: 'folder-path-name', title: current.name }, [escapeHtml(current.name)]),
      ])
    );
  }

  if (!realFiles) {
    body.append(skeletonRows(6));
    container.append(body);
    return;
  }

  const visible = applySort(realFiles).filter((item) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return item.name.toLowerCase().includes(q) || typeName(item).toLowerCase().includes(q);
  });

  if (!visible.length) {
    body.append(
      emptyState({
        icon: query ? 'search' : 'folder_open',
        title: query ? 'No files match your search' : 'Your Seed Cloud storage is empty.',
        body: query
          ? 'Try a different search or clear the filter.'
          : 'Upload your first file to get started. You have 512 MB of Seed Cloud storage.',
        action: query
          ? null
          : h('button', { class: 'btn btn-primary', onclick: () => navigate('/upload') }, [icon('upload', { size: 14 }), 'Upload files']),
      })
    );
    container.append(body);
    return;
  }

  const sortHeader = (label, key, cls) =>
    h(
      'th',
      { class: (cls || '') + ' sortable', onclick: () => setSort(key) },
      [
        label,
        sortKey === key ? h('span', { class: 'sort-arrow' }, [sortDir === 'asc' ? '↑' : '↓']) : '',
      ]
    );

  const table = h('table', { class: 'file-table has-check' }, [
    h('thead', {}, [
      h('tr', {}, [
        h('th', { style: 'width:36px' }, ['']),
        sortHeader('Name', 'name', 'col-name'),
        h('th', { style: 'width:110px' }, ['Location']),
        sortHeader('Size', 'size'),
        sortHeader('Modified', 'modified'),
        h('th', { style: 'width:60px;text-align:right' }, ['']),
      ]),
    ]),
  ]);
  const tbody = h('tbody', {});
  table.append(tbody);

  for (const item of visible) {
    const row = h('tr', { 'data-id': item.id }, [
      h('td', {}, [
        h('input', {
          type: 'checkbox',
          class: 'checkbox',
          'aria-label': `Select ${item.name}`,
          checked: selected.has(item.id),
          onchange: (e) => {
            if (e.target.checked) selected.add(item.id);
            else selected.delete(item.id);
            row.classList.toggle('selected', e.target.checked);
          },
        }),
      ]),
      h('td', { class: 'col-name' }, [
        h('span', { class: 'row-primary' }, [
          h('span', { class: 'file-icon' }, [fileIcon(item.name, isFolder(item))]),
          h('span', { class: 'row-name', title: item.name }, [escapeHtml(item.name)]),
        ]),
      ]),
      h('td', { 'data-label': 'Location' }, ['Seed Cloud Storage']),
      h('td', { 'data-label': 'Size' }, [isFolder(item) ? '—' : formatBytes(item.size)]),
      h('td', { 'data-label': 'Modified' }, [timeAgo(item.modified)]),
      h('td', {}, [
        h('div', { class: 'row-actions' }, [
          h('button', {
            class: 'icon-btn',
            title: 'Actions',
            'aria-label': `Actions for ${item.name}`,
            onclick: (e) => showContextMenu(e.currentTarget.getBoundingClientRect().right - 8, e.currentTarget.getBoundingClientRect().bottom + 6, item),
          }, [icon('more', { size: 16 })]),
        ]),
      ]),
    ]);
    row.addEventListener('dblclick', () => {
      if (isFolder(item)) goToFolder(item);
    });
    row.addEventListener('click', (e) => {
      if (e.target.closest('input[type="checkbox"]')) return;
      if (e.target.closest('.icon-btn')) return;
      if (isFolder(item)) {
        goToFolder(item);
        return;
      }
      const nowSelected = !selected.has(item.id);
      if (nowSelected) selected.add(item.id);
      else selected.delete(item.id);
      row.classList.toggle('selected', nowSelected);
      const cb = row.querySelector('input[type="checkbox"]');
      if (cb) cb.checked = nowSelected;
    });
    row.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showContextMenu(e.clientX, e.clientY, item);
    });
    tbody.append(row);
  }

  const wrap = h('div', { class: 'file-table-wrap' }, [table]);
  body.append(wrap);
  container.append(body);
}

function setSort(key) {
  if (sortKey === key) {
    sortDir = sortDir === 'asc' ? 'desc' : 'asc';
  } else {
    sortKey = key;
    sortDir = 'asc';
  }
  renderFiles();
}

function showContextMenu(x, y, item) {
  const menu = qs('#context-menu');

  const button = (label, iconName, disabled, onclick, danger) =>
    h('button', { disabled, onclick, class: danger ? 'danger' : '' }, [icon(iconName, { size: 14 }), label]);

  const actions = h('div', {}, [
    button(isFolder(item) ? 'Open' : 'Open', 'external', !isFolder(item), isFolder(item) ? () => goToFolder(item) : null),
    button('Download', 'download', isFolder(item), () => downloadItem(item), false),
    button('Share', 'link', true, null, false),
    h('div', { class: 'menu-sep' }),
    button('Rename', 'pencil', false, () => renameItem(item), false),
    button('Move', 'move', true, null),
    button('Delete', 'trash', false, () => deleteItem(item), true),
    h('div', { class: 'menu-sep' }),
    button('Details', 'info', false, () => showDetails(item)),
  ]);
  menu.replaceChildren(actions);

  menu.hidden = false;
  menu.style.left = Math.min(x, window.innerWidth - 210) + 'px';
  menu.style.top = Math.min(y, window.innerHeight - 280) + 'px';

  document.addEventListener('mousedown', hideMenuOnClickOutside, { once: true });
  window.addEventListener('blur', hideMenu, { once: true });
}

function hideMenu() {
  qs('#context-menu').hidden = true;
}

function hideMenuOnClickOutside(e) {
  const menu = qs('#context-menu');
  if (menu.contains(e.target)) return;
  hideMenu();
  document.addEventListener('mousedown', hideMenuOnClickOutside, { once: true });
}

function getAccessToken() {
  return store.supabase.auth.getSession().then(({ data }) => (data.session ? data.session.access_token : null));
}

function downloadItem(item) {
  getAccessToken().then((token) => {
    if (!token) {
      toast('Session expired. Sign in again.', 'error');
      return;
    }
    downloads.downloadFile({
      name: item.name,
      provider: 'Seed Cloud Storage',
      size: isFolder(item) ? null : item.size,
      url: `/api/files/${encodeURIComponent(item.id)}/download`,
      headers: { Authorization: `Bearer ${token}` },
    });
  });
}

function renameItem(item) {
  promptModal({
    title: 'Rename',
    label: 'New name',
    value: item.name,
    confirmText: 'Rename',
    onConfirm: (newName) => {
      api
        .patch(`/api/files/${encodeURIComponent(item.id)}`, { name: newName, isFolder: isFolder(item) })
        .then(() => {
          toast('Renamed', 'success');
          refresh();
        })
        .catch((err) => toast(`Rename failed: ${err.message}`, 'error'));
    },
  });
}

function deleteItem(item) {
  api
    .del(`/api/files/${encodeURIComponent(item.id)}`)
    .then(() => {
      selected.delete(item.id);
      toast('Deleted', 'success');
      refresh();
    })
    .catch((err) => toast(`Delete failed: ${err.message}`, 'error'));
}

function showDetails(item) {
  const rows = [
    ['Name', item.name],
    ['Type', isFolder(item) ? 'Folder' : item.mimeType || typeName(item)],
    ['Size', isFolder(item) ? '—' : formatBytes(item.size)],
    ['Location', 'Seed Cloud Storage'],
    ['Modified', item.modified ? new Date(item.modified).toLocaleString() : '—'],
    ['ID', item.id],
  ];
  openModal(
    h('div', {}, [
      h('h3', {}, ['Details']),
      h('ul', { class: 'detail-list' }, rows.map(([k, v]) => h('li', {}, [h('span', { class: 'k' }, [k]), h('span', { class: 'v' }, [escapeHtml(v)])]))),
      h('div', { class: 'modal-actions' }, [h('button', { class: 'btn', onclick: closeModal }, ['Close'])]),
    ])
  );
}