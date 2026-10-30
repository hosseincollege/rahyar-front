# Rahyar Frontend

This is the standalone frontend for Rahyar, a Persian RTL multi-province system monitoring and fault-management application. Rahyar and ERP are independent products; this app uses Rahyar's API, deployments, organization identity, and data only.

Rahyar's product areas are:

- **Rahcom:** system inventory, maps, incidents, repair activities, traffic status, and imported service tickets.
- **Settings:** organization, member access and province assignments, roles, appearance, and product configuration.
- **Development:** site visit analytics and controlled development data setup.

## Run locally

```bash
npm install
npm run dev
```

The development server runs on port `3015`. It uses `http://localhost:3016` for the API unless `NEXT_PUBLIC_API_BASE_URL` is set. The production API URL is maintained in `src/lib/api-environment.ts` and points to the Rahyar backend.

## Build

```bash
npm run build
```

Keep API destinations and Vercel configuration specific to Rahyar. Do not synchronize frontend code or environment settings from ERP.
