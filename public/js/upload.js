import { store } from './store.js';
import { qs, h, toast, promptModal, formatBytes, fileIcon } from './ui.js';
import { icon } from './icons.js';
import * as browser from './browser.js';
import { api } from './api.js';

const tasks = new Map();
let idCounter = 0;
let fileInput = null;

function storageReady() {
  return Boolean(store.seed && store.seed.ready);
}

function getAccessToken() {
  if (!store.supabase) return Promise.resolve(null);
  return store.supabase.auth.getSession().then(({ data }) => (data.session ? data.session.access_token : null));
}

export function init() {
  fileInput = h('input', { type: 'file', multiple: true, style: 'display:none' });
  fileInput.addEventListener('change', () => {
    handleFiles(fileInput.files);
    fileInput.value = '';
  });
  document.body.append(fileInput);

  qs('#upload-btn').addEventListener('click', () => fileInput.click());

  qs('#new-btn').addEventListener('click', () => {
    openNewMenu(qs('#new-btn'));
  });

  qs('#upload-panel-close').addEventListener('click', clearFinished);

  setupDropZone();
}

export function renderPage() {
  const container = qs('#view-upload');
  container.replaceChildren();

  container.append(
    h('div', { class: 'view-header' }, [
      h('div', {}, [
        h('h1', { class: 'view-title' }, ['Upload']),
        h('p', { class: 'view-sub' }, ['Add files to your Seed Cloud storage.']),
      ]),
    ])
  );

  const body = h('div', { class: 'page-body' }, []);

  if (!storageReady()) {
    body.append(
      h('div', { class: 'notice warn', style: 'margin-bottom:12px' }, [
        icon('alert', { size: 15 }),
        h('span', {}, ['Seed Cloud storage is not ready yet. Files cannot be uploaded.']),
      ])
    );
  }

  const drop = h('div', { class: 'upload-page-drop', id: 'upload-page-drop', onclick: () => fileInput && fileInput.click() }, [
    h('div', { class: 'upload-page-drop-icon' }, [icon('upload', { size: 22 })]),
    h('div', { class: 'upload-page-drop-title' }, ['Upload files']),
    h('div', { class: 'upload-page-drop-sub' }, ['Drag files here or choose from your computer']),
    h('button', { class: 'btn btn-primary', type: 'button' }, [icon('plus', { size: 14 }), 'Choose files']),
    h('div', { class: 'storage-sub', style: 'margin-top:14px' }, [
      'Files upload to your Seed Cloud storage (1 GB limit).',
    ]),
  ]);
  body.append(drop);

  body.append(h('h3', { class: 'upload-page-title' }, ['Current uploads']));
  const list = h('div', { class: 'upload-page-list', id: 'upload-page-list' });
  body.append(list);

  if (tasks.size === 0) {
    list.append(
      h('div', { class: 'upload-page-empty' }, ['Nothing is uploading right now.'])
    );
  } else {
    tasks.forEach(renderTask);
  }

  container.append(body);
}

function openNewMenu(anchor) {
  const menu = h('div', { class: 'context-menu' }, [
    h('button', { onclick: () => { hideMenu(menu); fileInput && fileInput.click(); } }, [icon('upload', { size: 14 }), 'Upload files']),
    h('button', { onclick: () => { hideMenu(menu); createFolder(); } }, [icon('folder', { size: 14 }), 'New folder']),
  ]);
  menu.style.left = '12px';
  menu.style.top = `${anchor.getBoundingClientRect().bottom + 8}px`;
  document.body.append(menu);
  const close = (e) => {
    if (menu.contains(e.target)) return;
    menu.remove();
    document.removeEventListener('mousedown', close);
  };
  document.addEventListener('mousedown', close);
}

function hideMenu(menu) {
  menu.remove();
}

function createFolder() {
  if (!storageReady()) {
    toast('Seed Cloud storage is not ready yet.', 'error');
    return;
  }
  promptModal({
    title: 'New folder',
    label: 'Folder name',
    value: '',
    onConfirm: (name) => {
      const parentId = browser.currentFolderId();
      api
        .post('/api/files/folders', { name, parentId })
        .then(() => {
          toast('Folder created', 'success');
          browser.refresh();
        })
        .catch((err) => toast(`Could not create folder: ${err.message}`, 'error'));
    },
  });
}

function setupDropZone() {
  const overlay = qs('#dropzone');
  let dragDepth = 0;

  const syncDropState = (active) => {
    const dropEl = qs('#upload-page-drop');
    if (dropEl) dropEl.classList.toggle('dragging', active);
  };

  window.addEventListener('dragenter', (e) => {
    if (!e.dataTransfer || !Array.from(e.dataTransfer.types).includes('Files')) return;
    dragDepth += 1;
    overlay.hidden = false;
    syncDropState(true);
  });
  window.addEventListener('dragleave', () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) {
      overlay.hidden = true;
      syncDropState(false);
    }
  });
  window.addEventListener('dragover', (e) => {
    if (!e.dataTransfer || !Array.from(e.dataTransfer.types).includes('Files')) return;
    e.preventDefault();
  });
  window.addEventListener('drop', (e) => {
    e.preventDefault();
    dragDepth = 0;
    overlay.hidden = true;
    syncDropState(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length) {
      handleFiles(e.dataTransfer.files);
    }
  });
}

export function handleFiles(fileList) {
  const files = Array.from(fileList);
  if (!files.length) return;
  ensurePanel(true);
  for (const file of files) {
    const id = ++idCounter;
    const task = { id, file, status: 'pending', controller: null, percent: 0 };
    tasks.set(id, task);
    renderTask(task);
    startUpload(task);
  }
}

function ensurePanel(show) {
  qs('#upload-panel').hidden = !show;
}

function startUpload(task) {
  if (!storageReady()) {
    task.status = 'error';
    task.error = 'Seed Cloud storage is not ready yet.';
    renderTask(task);
    return;
  }

  task.status = 'uploading';
  renderTask(task);

  const controller = new AbortController();
  task.controller = controller;

  getAccessToken().then((token) => {
    if (!token) {
      task.status = 'error';
      task.error = 'Session expired. Sign in again.';
      renderTask(task);
      return;
    }
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/files/upload');
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('x-file-name', encodeURIComponent(task.file.name));
    const folderId = browser.currentFolderId();
    if (folderId) xhr.setRequestHeader('x-folder-id', String(folderId));
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        task.percent = Math.round((e.loaded / e.total) * 100);
        renderTask(task);
      }
    });
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        task.status = 'success';
        task.percent = 100;
        renderTask(task);
        browser.refresh();
      } else {
        let message = `Upload failed (HTTP ${xhr.status})`;
        try {
          const json = JSON.parse(xhr.responseText);
          if (json.error) message = json.error;
        } catch {
          /* ignore */
        }
        task.status = 'error';
        task.error = message;
        renderTask(task);
      }
    });
    xhr.addEventListener('error', () => {
      task.status = 'error';
      task.error = 'Network error during upload.';
      renderTask(task);
    });
    xhr.addEventListener('abort', () => {
      task.status = 'cancelled';
      task.error = 'Cancelled.';
      renderTask(task);
    });
    controller.signal.addEventListener('abort', () => xhr.abort());
    xhr.send(task.file);
  });
}

function cancelTask(task) {
  if (task.controller) task.controller.abort();
}

function clearFinished() {
  for (const [id, task] of tasks) {
    if (task.status === 'success' || task.status === 'error' || task.status === 'cancelled') {
      tasks.delete(id);
    }
  }
  for (const sel of ['#upload-list', '#upload-page-list']) {
    const list = qs(sel);
    if (!list) continue;
    for (const row of Array.from(list.querySelectorAll('[data-task]'))) {
      if (!tasks.has(Number(row.dataset.task))) row.remove();
    }
  }
  if (tasks.size === 0) {
    ensurePanel(false);
    const pageList = qs('#upload-page-list');
    if (pageList) {
      pageList.replaceChildren(h('div', { class: 'upload-page-empty' }, ['Nothing is uploading right now.']));
    }
  } else {
    tasks.forEach(renderTask);
  }
}

function renderTask(task) {
  const statusText = {
    pending: 'Queued',
    uploading: `${task.percent}%`,
    success: 'Done',
    error: 'Failed',
    cancelled: 'Cancelled',
  }[task.status];

  const statusClass =
    task.status === 'success' ? 'ok' : task.status === 'error' ? 'err' : '';

  const bar =
    task.status === 'success' || task.status === 'error' || task.status === 'cancelled'
      ? null
      : h('div', { class: `upload-task-bar${task.status === 'error' ? ' err' : ''}` }, [
          h('span', { style: `width:${task.status === 'uploading' ? task.percent : 0}%` }),
        ]);

  const cancel = task.status === 'uploading' || task.status === 'pending'
    ? h('button', { class: 'upload-cancel', title: 'Cancel', 'aria-label': 'Cancel upload', onclick: () => cancelTask(task) }, [icon('x', { size: 13 })])
    : null;

  const retry = task.status === 'error'
    ? h('button', { class: 'upload-cancel', title: 'Retry', 'aria-label': 'Retry upload', onclick: () => retryTask(task) }, [icon('refresh', { size: 13 })])
    : null;

  const message =
    task.status === 'error' ? task.error || 'Failed'
      : task.status === 'cancelled' ? 'Cancelled.'
      : null;

  const content = h('div', { class: 'upload-task' }, [
    h('div', { class: 'upload-task-row' }, [
      h('span', { class: 'file-icon' }, [fileIcon(task.file.name, false)]),
      h('span', { class: 'upload-task-name', title: task.file.name }, [task.file.name]),
      h('span', { class: 'upload-task-meta' }, [formatBytes(task.file.size)]),
      cancel,
      retry,
      h('span', { class: `upload-task-status ${statusClass}` }, [statusText]),
    ]),
    message ? h('div', { class: 'upload-task-status err', style: 'font-size:11px' }, [message]) : null,
    bar,
  ]);

  const lists = ['#upload-list', '#upload-page-list'];
  for (const sel of lists) {
    const list = qs(sel);
    if (!list) continue;
    let row = list.querySelector(`[data-task="${task.id}"]`);
    if (!row) {
      row = h('div', { 'data-task': task.id });
      list.append(row);
    }
    row.replaceChildren(content);
  }

  const panel = qs('#upload-panel');
  if (panel && tasks.size > 0) panel.hidden = false;
}

function retryTask(task) {
  task.error = null;
  task.percent = 0;
  task.controller = null;
  startUpload(task);
}
