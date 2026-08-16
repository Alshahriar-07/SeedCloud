import { api } from './api.js';
import { qs, h, escapeHtml, formatDate, fileIcon, emptyState } from './ui.js';
import { icon } from './icons.js';

const ACCESS_TYPE_LABEL = { view: 'View', edit: 'Edit', comment: 'Comment' };

export async function render() {
  const container = qs('#view-access');
  container.replaceChildren();

  container.append(
    h('div', { class: 'view-header' }, [
      h('div', {}, [
        h('h1', { class: 'view-title' }, ['Access']),
        h('p', { class: 'view-sub' }, ['Files shared with you and files you shared.']),
      ]),
    ])
  );

  let data = { sharedByMe: [], sharedWithMe: [] };
  try {
    data = await api.get('/api/shares');
  } catch (err) {
    data = { sharedByMe: [], sharedWithMe: [], error: err.message };
  }
  if (qs('#view-access').hidden) return;

  const body = h('div', { class: 'page-body narrow' }, []);

  if (data.error) {
    body.append(
      emptyState({
        icon: 'link',
        title: 'Sharing data is not available yet',
        body: 'Apply the database schema to enable sharing.',
      })
    );
    container.append(body);
    return;
  }

  const wrap = h('div', {}, []);

  wrap.append(section('Shared with me', data.sharedWithMe, 'with-me'));
  wrap.append(section('Shared by me', data.sharedByMe, 'by-me'));

  body.append(wrap);
  container.append(body);
}

function section(title, items, key) {
  const box = h('div', { class: 'access-section' }, [h('h3', { class: 'access-title' }, [title])]);

  if (!items.length) {
    box.append(
      h('div', { class: 'access-empty' }, [
        key === 'with-me' ? 'Nothing has been shared with you yet.' : 'You have not shared any files yet.',
      ])
    );
    return box;
  }

  const table = h('table', { class: 'file-table' }, [
    h('thead', {}, [
      h('tr', {}, [
        h('th', { class: 'col-name' }, ['File']),
        h('th', { style: 'width:130px' }, ['Owner']),
        h('th', { style: 'width:110px' }, ['Provider']),
        h('th', { style: 'width:110px' }, ['Shared']),
        h('th', { style: 'width:100px' }, ['Access']),
        h('th', { style: 'width:110px' }, ['Expiry']),
        h('th', { style: 'width:110px' }, ['Status']),
      ]),
    ]),
  ]);
  const tbody = h('tbody', {});
  table.append(tbody);

  for (const item of items) {
    const owner =
      key === 'by-me'
        ? (item.shared_with_email || 'Link')
        : (item.shared_with_email || '—');
    const accessType = ACCESS_TYPE_LABEL[item.access_type] || item.access_type || 'View';
    tbody.append(
      h('tr', {}, [
        h('td', { class: 'col-name', title: item.file_name }, [
          h('span', { class: 'row-primary' }, [
            h('span', { class: 'file-icon' }, [fileIcon(item.file_name || 'file', false)]),
            h('span', { class: 'row-name' }, [escapeHtml(item.file_name || 'Unnamed')]),
          ]),
        ]),
        h('td', { 'data-label': 'Owner' }, [escapeHtml(owner)]),
        h('td', { 'data-label': 'Provider' }, [escapeHtml(item.provider || '—')]),
        h('td', { 'data-label': 'Shared' }, [formatDate(item.created_at)]),
        h('td', { 'data-label': 'Access' }, [escapeHtml(accessType)]),
        h('td', { 'data-label': 'Expiry' }, [item.expires_at ? formatDate(item.expires_at) : 'Never']),
        h('td', { 'data-label': 'Status' }, [
          h('span', { class: `badge ${item.status === 'active' ? 'badge-connected' : 'badge-disconnected'}` }, [
            item.status === 'active' ? 'Active' : escapeHtml(item.status || '—'),
          ]),
        ]),
      ])
    );
  }

  box.append(h('div', { class: 'file-table-wrap' }, [table]));
  return box;
}
