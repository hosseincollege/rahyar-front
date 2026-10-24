'use client';

import { useEffect } from 'react';
import { getCurrentOrganizationId } from '@/lib/api/shared/auth-api';

export function OrganizationFavicon() {
  useEffect(() => {
    let disposed = false;
    let requestId = 0;

    const updateFavicon = async () => {
      const currentRequest = ++requestId;
      const organizationId = getCurrentOrganizationId();
      if (disposed || currentRequest !== requestId) return;
      const faviconUrl = new URL('/favicon.ico', window.location.origin);
      if (organizationId) faviconUrl.searchParams.set('organizationId', organizationId);
      faviconUrl.searchParams.set('v', String(Date.now()));

      let links = Array.from(document.querySelectorAll<HTMLLinkElement>(
        'link[rel~="icon"], link[rel="shortcut icon"]',
      ));
      if (links.length === 0) {
        const link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
        links = [link];
      }

      for (const link of links) {
        link.href = `${faviconUrl.pathname}${faviconUrl.search}`;
      }
    };

    void updateFavicon();
    window.addEventListener('organization-branding-changed', updateFavicon);
    window.addEventListener('erp-preferences-changed', updateFavicon);
    window.addEventListener('auth:user-updated', updateFavicon);
    window.addEventListener('auth:logout', updateFavicon);
    return () => {
      disposed = true;
      window.removeEventListener('organization-branding-changed', updateFavicon);
      window.removeEventListener('erp-preferences-changed', updateFavicon);
      window.removeEventListener('auth:user-updated', updateFavicon);
      window.removeEventListener('auth:logout', updateFavicon);
    };
  }, []);

  return null;
}
