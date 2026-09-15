export async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(path, {
      ...options,
      headers: {'Content-Type': 'application/json', 'X-Dashboard-Request': '1', ...options.headers},
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('Unable to reach the server. Check your connection and try again.');
  }
  if (response.status === 401) window.dispatchEvent(new Event('session-expired'));
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { /* Proxies can return empty or HTML errors. */ }
  if (!response.ok) {
    const fallback = response.status === 429
      ? 'Too many requests. Please wait and try again.'
      : response.status >= 500
        ? 'The server is temporarily unavailable. Please try again shortly.'
        : `Request failed (${response.status}). Please try again.`;
    throw new Error(typeof data?.error === 'string' ? data.error : fallback);
  }
  if (response.status === 204) return null;
  if (data == null || typeof data !== 'object') {
    throw new Error('The server returned an invalid response. Please try again shortly.');
  }
  return data;
}
