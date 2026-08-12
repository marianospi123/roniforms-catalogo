const API_BASE = import.meta.env.VITE_API_BASE || '';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, { cache: 'no-store', ...options });
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message = typeof payload === 'object' && payload?.error
      ? payload.error
      : `Error ${response.status}`;
    throw new Error(message);
  }

  return payload;
}

export const api = {
  getCatalog: () => request('/api/catalog'),
  getRates: () => request('/api/rate'),
  validateAdmin: (token) => request(`/api/admin/${encodeURIComponent(token)}/validate`),
  getAdminProducts: (token) => request(`/api/admin/${encodeURIComponent(token)}/products`),
  createProduct: (token, body) => request(`/api/admin/${encodeURIComponent(token)}/products`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  }),
  updateProduct: (token, id, body) => request(`/api/admin/${encodeURIComponent(token)}/products/${id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  }),
  deleteProduct: (token, id) => request(`/api/admin/${encodeURIComponent(token)}/products/${id}`, {
    method: 'DELETE'
  }),
  uploadImage: async (token, id, file) => {
    const form = new FormData();
    form.append('image', file);
    return request(`/api/admin/${encodeURIComponent(token)}/products/${id}/image`, {
      method: 'POST', body: form
    });
  },
  setManualRate: (token, body) => request(`/api/admin/${encodeURIComponent(token)}/rate/manual`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  }),
  setPricing: (token, body) => request(`/api/admin/${encodeURIComponent(token)}/pricing`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  }),
  refreshRates: (token) => request(`/api/admin/${encodeURIComponent(token)}/rate/refresh`, {
    method: 'POST'
  })
};
