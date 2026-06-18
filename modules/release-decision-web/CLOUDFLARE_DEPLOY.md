# Cloudflare Container Deployment

This package now builds static React + Vite assets and serves them from nginx in the Docker image.

```powershell
npm ci
npm run build
docker build -t release-decision-web .
npx wrangler deploy
```

Runtime experiment data belongs to the FeatBit API/PostgreSQL schema. This frontend image does not run Prisma migrations.
