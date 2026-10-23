'use client';

import { useEffect } from 'react';
import { fetchPublicBranding, resolvePublicLogoUrl } from '@/lib/public-branding';

export function OrganizationFavicon() {
  useEffect(() => {
    let disposed = false;
    let requestId = 0;

    const updateFavicon = async () => {
      const currentRequest = ++requestId;
      const branding = await fetchPublicBranding();
      if (disposed || currentRequest !== requestId || !branding?.logoUrl) return;

      const logoUrl = resolvePublicLogoUrl(branding.logoUrl);
      if (!logoUrl) return;

      let links = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]'));
      if (links.length === 0) {
        const link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
        links = [link];
      }

      for (const link of links) {
        link.removeAttribute('type');
        link.href = logoUrl;
      }
    };

    void updateFavicon();
    window.addEventListener('organization-branding-changed', updateFavicon);
    window.addEventListener('erp-preferences-changed', updateFavicon);
    return () => {
      disposed = true;
      window.removeEventListener('organization-branding-changed', updateFavicon);
      window.removeEventListener('erp-preferences-changed', updateFavicon);
    };
  }, []);

  return null;
}
