let getToken = null;

export function setTokenProvider(fn) {
  getToken = fn;
}

async function request(path, { method = 'GET', body } = {}) {
  const options = { method, headers: {} };
  if (getToken) {
    const token = await getToken();
    if (token) options.headers.Authorization = `Bearer ${token}`;
  }
  if (body !== undefined) {
    options.headers['content-type'] = 'application/json';
    options.body = JSON.stringify(body);
  }
  const res = await fetch(path, options);
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const error = new Error((json && json.error) || `Request failed (${res.status})`);
    error.status = res.status;
    throw error;
  }
  return json;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  del: (path) => request(path, { method: 'DELETE' }),
};
