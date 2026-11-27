/** Product-specific API destination. Keep this file out of cross-product sync. */
const isLocalServerPage =
  typeof window !== 'undefined' &&
  window.location.port === '3115' &&
  ['localhost', '127.0.0.1'].includes(window.location.hostname);

export const API_BASE_URL = isLocalServerPage
  ? `http://${window.location.hostname}:3116`
  : process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, '') ||
    (process.env.NODE_ENV === 'production'
      ? 'https://rahyar-back-piuy.vercel.app'
      : 'http://localhost:3016');

/** Server-side proxy routes should use the loopback API on the Windows host. */
export const SERVER_API_BASE_URL =
  process.env.RAHYAR_SERVER_MODE === '1'
    ? 'http://127.0.0.1:3116'
    : process.env.RAHYAR_INTERNAL_API_BASE_URL?.replace(/\/+$/, '') ||
      process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, '') ||
      (process.env.NODE_ENV === 'production'
        ? 'https://rahyar-back-piuy.vercel.app'
        : 'http://localhost:3016');
