import type { NextConfig } from "next";
import packageJson from "./package.json";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    '/api/provinces/isfahan/systems': ['./src/provinces/isfahan/isfahan-systems.xlsx'],
    '/api/rahcom/bill-identifiers': ['./متفرقه/شناسه_های-قبض-گروه 01 - تکمیل شده.xlsx'],
  },
  env: {
    NEXT_PUBLIC_APP_VERSION: packageJson.version,
    NEXT_PUBLIC_APP_BUILD_DATE: new Date().toISOString().slice(0, 10),
  },
  async redirects() {
    return [
      { source: '/dashboard/notifications', destination: '/dashboard/events', permanent: true },
      { source: '/dashboard/messages', destination: '/dashboard/events?tab=announcements', permanent: true },
      { source: '/dashboard/history', destination: '/dashboard/events?tab=history', permanent: true },
      { source: '/dashboard/activity', destination: '/dashboard/events?tab=activity', permanent: true },
      { source: '/supply', destination: '/commerce', permanent: true },
      { source: '/supply/:path*', destination: '/commerce/:path*', permanent: true },
      { source: '/commercial/:path*', destination: '/commerce/:path*', permanent: true },
      { source: '/hr/:path*', destination: '/human-resources/:path*', permanent: true },
      { source: '/tickets/:path*', destination: '/support/:path*', permanent: true },
      { source: '/crm', destination: '/commerce', permanent: true },
      { source: '/crm/sales', destination: '/commerce/sales', permanent: true },
      { source: '/inventory', destination: '/commerce/inventory', permanent: true },
      { source: '/inventory/purchasing', destination: '/commerce/purchasing', permanent: true },
      { source: '/purchases', destination: '/commerce/purchasing', permanent: true },
      { source: '/sales', destination: '/commerce/sales', permanent: true },
      { source: '/analysis', destination: '/statistics', permanent: true },
      { source: '/reports', destination: '/statistics/reports', permanent: true },
      { source: '/reports/:path*', destination: '/statistics/reports/:path*', permanent: true },
      { source: '/business-intelligence', destination: '/statistics/business-intelligence', permanent: true },
      { source: '/business-intelligence/:path*', destination: '/statistics/business-intelligence/:path*', permanent: true },
    ];
  },
};

export default nextConfig;
