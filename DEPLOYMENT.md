# Production Deployment Plan for Speed-Reader

## Overview

Deploy the speed-reader application to production with the **cheapest possible setup** while maintaining reliability.

**Final Stack:**
- **Backend**: Railway (~$5-15/month)
- **Database**: Railway PostgreSQL (included)
- **Frontend**: Cloudflare Pages (free)
- **Telemetry**: Axiom.co (free tier - 500GB/month)
- **Auth**: Google OAuth + guest mode

**Estimated Total: ~$6-16/month**

---

## Implementation Steps

### Phase 1: Backend Dockerization

**Create `/backend/Dockerfile`:**
```dockerfile
# Build stage
FROM golang:1.20-alpine AS builder
WORKDIR /build
RUN apk add --no-cache git ca-certificates
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o api ./cmd/api
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o cleanup ./cmd/cleanup

# Runtime stage
FROM alpine:3.19
WORKDIR /app
RUN apk add --no-cache ca-certificates tzdata
COPY --from=builder /build/api /app/api
COPY --from=builder /build/cleanup /app/cleanup
COPY --from=builder /build/migrations /app/migrations
RUN mkdir -p /app/data
RUN adduser -D -u 1000 appuser && chown -R appuser:appuser /app
USER appuser
EXPOSE 8080
CMD ["/app/api"]
```

### Phase 2: Add Health Check Endpoint

**Modify `/backend/internal/http/router.go`:**

Add health check route inside the `/api` route group:
```go
// Health check (no auth required)
r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
    w.WriteHeader(http.StatusOK)
    w.Write([]byte("ok"))
})
```

### Phase 3: Create CI/CD Pipeline

**Create `/.github/workflows/deploy.yml`:**
```yaml
name: Deploy to Production

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: '1.20'
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json
      - name: Backend Tests
        working-directory: backend
        run: go test -v ./...
      - name: Frontend Tests
        working-directory: frontend
        run: npm ci && npm run test:run
      - name: Frontend Build
        working-directory: frontend
        run: npm run build

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install Railway CLI
        run: npm install -g @railway/cli
      - name: Deploy
        run: railway up
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
```

### Phase 4: Railway Project Setup

**Create `/railway.toml`:**
```toml
[build]
builder = "dockerfile"
dockerfilePath = "backend/Dockerfile"

[deploy]
healthcheckPath = "/api/health"
healthcheckTimeout = 30
restartPolicyType = "on_failure"
```

**Railway CLI commands:**
```bash
# Install CLI and login
npm install -g @railway/cli
railway login

# Create project
railway init

# Add PostgreSQL
railway add --database postgres

# Link project
railway link

# Set environment variables (see Phase 5)
```

### Phase 5: Environment Variables & Secrets

**Generate and set secrets:**
```bash
# Security secrets (generate strong values)
railway variables set JWT_SECRET=$(openssl rand -base64 32)
railway variables set CSRF_SECRET=$(openssl rand -base64 32)
railway variables set LOG_SALT=$(openssl rand -base64 16)

# Application config
railway variables set ENVIRONMENT=production
railway variables set SECURE_COOKIE=true
railway variables set STORAGE_PATH=/app/data
railway variables set LOG_LEVEL=info

# Frontend URL (update after first deploy to get actual URL)
railway variables set FRONTEND_URL=https://your-app.up.railway.app
railway variables set GOOGLE_REDIRECT_URL=https://your-app.up.railway.app/api/auth/google/callback

# Google OAuth (from Google Cloud Console)
railway variables set GOOGLE_CLIENT_ID=xxx
railway variables set GOOGLE_CLIENT_SECRET=xxx

# DATABASE_URL is auto-injected by Railway when Postgres is linked
```

### Phase 6: Frontend Deployment (Cloudflare Pages)

**Setup steps:**
1. Go to Cloudflare Dashboard > Pages > Create a project
2. Connect your GitHub repository
3. Configure build settings:
   - Build command: `cd frontend && npm install && npm run build`
   - Build output directory: `frontend/dist`
   - Root directory: `/` (leave empty)
4. Set environment variables:
   - `VITE_API_URL=https://your-backend.up.railway.app`

**Update backend CORS:**

Modify `/backend/internal/http/router.go` to add Cloudflare Pages domain to allowed origins:
```go
AllowedOrigins: []string{
    "http://localhost:5173",
    "http://localhost:3000",
    deps.FrontendURL,  // Set to Cloudflare Pages URL
},
```

**Create `/frontend/.env.production`:**
```
VITE_API_URL=https://your-backend.up.railway.app
```

**Update frontend API client** to use the environment variable:
The API client at `/frontend/src/api/client.ts` should use `import.meta.env.VITE_API_URL` as the base URL for production

### Phase 7: Cleanup Job (Cron)

**Create separate Railway service for cleanup:**
```bash
railway add --service cleanup
```

Configure with cron schedule in Railway dashboard:
- Schedule: `0 3 * * *` (daily at 3 AM UTC)
- Command: `/app/cleanup`

### Phase 8: Monitoring Setup (Axiom + UptimeRobot)

**1. Axiom.co Setup (free tier - 500GB/month):**

1. Create account at axiom.co
2. Create a new dataset (e.g., "speedreader-prod")
3. Go to Settings > API Tokens > Create token with ingest permissions
4. Get OTLP endpoint: `https://api.axiom.co/v1/traces`

**Add Axiom environment variables to Railway:**
```bash
railway variables set OTLP_ENDPOINT=https://api.axiom.co/v1/traces
railway variables set AXIOM_TOKEN=xaat-xxxxx
railway variables set AXIOM_DATASET=speedreader-prod
```

**Update backend telemetry** (`/backend/internal/telemetry/otel.go`):
- The existing OTLP exporter works with Axiom
- Add Axiom token header to OTLP requests

**2. Free uptime monitoring (UptimeRobot):**
- Create free account at uptimerobot.com
- Add HTTP(s) monitor for `https://your-backend.up.railway.app/api/health`
- Set 5-minute check interval
- Configure email/Slack alerts

### Phase 9: Custom Domain (Optional)

1. Purchase domain (~$10-15/year)
2. In Railway: Settings > Domains > Add Custom Domain
3. Add DNS records per Railway instructions
4. Update `FRONTEND_URL` and `GOOGLE_REDIRECT_URL`

---

## Files to Create

| File | Purpose |
|------|---------|
| `/backend/Dockerfile` | Multi-stage Docker build |
| `/.github/workflows/deploy.yml` | CI/CD pipeline (backend to Railway) |
| `/railway.toml` | Railway configuration |
| `/frontend/.env.production` | Production API URL for Cloudflare Pages |

## Files to Modify

| File | Change |
|------|--------|
| `/backend/internal/http/router.go` | Add `/api/health` endpoint |
| `/backend/internal/telemetry/otel.go` | Add Axiom authorization header |
| `/frontend/src/api/client.ts` | Use `VITE_API_URL` env var for API base URL |

---

## Security Checklist

- [ ] Generate strong 256-bit secrets for JWT_SECRET, CSRF_SECRET
- [ ] Set `SECURE_COOKIE=true` (requires HTTPS)
- [ ] Set `ENVIRONMENT=production`
- [ ] Configure Google OAuth with production redirect URLs
- [ ] Verify DATABASE_URL uses SSL (`sslmode=require`)
- [ ] Set LOG_SALT for PII pseudonymization
- [ ] Never commit secrets to git

---

## Verification Steps

1. **Deploy backend**: `railway up` and check Railway logs for startup
2. **Health check**: `curl https://your-backend.up.railway.app/api/health`
3. **Deploy frontend**: Push to main, verify Cloudflare Pages build succeeds
4. **CORS test**: Open frontend in browser, check network tab for CORS errors
5. **Create guest user**: Test POST to `/api/auth/guest` from frontend
6. **Create document**: Test document creation and reading flow
7. **OAuth flow**: Test Google login end-to-end (redirect should work)
8. **Axiom traces**: Check Axiom dashboard for incoming traces
9. **Monitoring**: Verify UptimeRobot shows green status

---

## Future Scaling Path

When traffic grows beyond Railway's limits:

1. **Horizontal scaling**: Migrate chunk storage from filesystem to Cloudflare R2 (S3-compatible, no egress fees)
2. **Database**: Upgrade to dedicated Postgres or migrate to Neon Pro
3. **Multi-region**: Move to Fly.io for edge deployment
4. **Full observability**: Self-host or use managed Grafana Cloud

---

## Estimated Total Monthly Cost

| Component | Cost |
|-----------|------|
| Railway (backend + Postgres + volume) | $5-15 |
| Cloudflare Pages (frontend) | $0 |
| Axiom (telemetry) | $0 (free tier) |
| UptimeRobot (monitoring) | $0 |
| Domain (optional) | ~$1 |
| **Total** | **$5-16/month** |
