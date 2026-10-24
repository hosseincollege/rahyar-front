import { API_BASE_URL } from '@/lib/api-environment';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const organizationId = new URL(request.url).searchParams.get('organizationId');
    const brandingUrl = new URL(`${API_BASE_URL}/settings/public-branding`);
    if (organizationId) brandingUrl.searchParams.set('organizationId', organizationId);

    const brandingResponse = await fetch(brandingUrl, { cache: 'no-store' });
    if (!brandingResponse.ok) return new Response(null, { status: 404 });
    const branding = await brandingResponse.json() as { logoUrl?: string | null };
    if (!branding.logoUrl) return new Response(null, { status: 404 });

    const dataImage = /^data:(image\/(?:png|jpeg|webp|svg\+xml))(;base64)?,([\s\S]*)$/i.exec(branding.logoUrl);
    if (dataImage) {
      const [, mediaType, base64Marker, payload] = dataImage;
      if (payload.length > 5 * 1024 * 1024 || (base64Marker && !/^[\da-z+/]*={0,2}$/i.test(payload))) {
        return new Response(null, { status: 404 });
      }
      const bytes = base64Marker
        ? Buffer.from(payload, 'base64')
        : Buffer.from(decodeURIComponent(payload), 'utf8');
      const headers = new Headers({
        'Content-Type': mediaType.toLowerCase(),
        'Cache-Control': 'no-store, max-age=0, must-revalidate',
        'X-Content-Type-Options': 'nosniff',
      });
      if (mediaType.toLowerCase() === 'image/svg+xml') {
        headers.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
      }
      return new Response(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, { headers });
    }

    const logoUrl = new URL(branding.logoUrl, `${API_BASE_URL}/`);
    const apiOrigin = new URL(API_BASE_URL).origin;
    if (logoUrl.origin !== apiOrigin || !logoUrl.pathname.startsWith('/uploads/logos/')) {
      return new Response(null, { status: 404 });
    }

    const imageResponse = await fetch(logoUrl, { cache: 'no-store', redirect: 'error' });
    const contentType = imageResponse.headers.get('content-type')?.split(';')[0] ?? '';
    if (!imageResponse.ok || !['image/png', 'image/jpeg', 'image/webp'].includes(contentType)) {
      return new Response(null, { status: 404 });
    }

    return new Response(await imageResponse.arrayBuffer(), {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-store, max-age=0, must-revalidate',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}
