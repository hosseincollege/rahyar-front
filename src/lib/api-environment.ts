/** Product-specific API destination. Keep this file out of cross-product sync. */
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, '') ||
  (process.env.NODE_ENV === 'production'
    ? 'https://rahyar-back-piuy.vercel.app'
    : 'http://localhost:3016');
