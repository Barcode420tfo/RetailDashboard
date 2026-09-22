export function validateConfiguration(env) {
  if (!/^mongodb(?:\+srv)?:\/\//.test(env.MONGODB_URI || '')) {
    throw new Error('MONGODB_URI must start with mongodb:// or mongodb+srv://; supply only the connection string as its value.');
  }
  const port = Number(env.PORT || 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer between 1 and 65535');
  if (env.TRUST_PROXY_HOPS && (!/^\d+$/.test(env.TRUST_PROXY_HOPS) || !Number.isSafeInteger(Number(env.TRUST_PROXY_HOPS)))) {
    throw new Error('TRUST_PROXY_HOPS must be a nonnegative integer');
  }
  if (env.NODE_ENV === 'production') {
    let origin;
    try { origin = new URL(env.CLIENT_ORIGIN); } catch { /* handled below */ }
    if (!origin || origin.protocol !== 'https:' || origin.origin !== env.CLIENT_ORIGIN || env.COOKIE_SECURE !== 'true') {
      throw new Error('Production requires HTTPS CLIENT_ORIGIN without a trailing slash or path, and COOKIE_SECURE=true');
    }
  }
  return { port, host: env.HOST || (env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1') };
}
