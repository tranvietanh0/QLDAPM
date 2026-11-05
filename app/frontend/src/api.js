import { tokenKey } from './portal.js';
const BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
export async function api(path, options = {}) {
  const token = localStorage.getItem(tokenKey);
  let response;
  try {
    response = await fetch(BASE + path, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {})
      }
    });
  } catch {
    throw new Error('Không thể kết nối Server. Hãy kiểm tra Spring Boot (cổng 8081) và kết nối mạng.');
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && token && !path.endsWith('/login')) {
      window.dispatchEvent(new Event('ims-session-expired'));
    }
    throw new Error(data?.error || `Server trả về lỗi ${response.status}`);
  }
  return data;
}
