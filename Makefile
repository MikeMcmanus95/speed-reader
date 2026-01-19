.PHONY: all build run test clean dev db-up db-down observability-up observability-down observability-logs install

# Default target
all: build

# Install dependencies (monorepo)
install:
	pnpm install

# Build all packages and apps
build: build-backend build-frontend
	pnpm build

build-backend:
	cd backend && go build -o bin/api ./cmd/api

build-frontend:
	pnpm --filter @speed-reader/web build

build-extension:
	pnpm --filter @speed-reader/extension build

# Run in development mode
dev: db-up
	@echo "Starting development servers..."
	@make -j2 dev-backend dev-web

dev-backend:
	cd backend && go run ./cmd/api

dev-web:
	pnpm dev:web

dev-extension:
	pnpm dev:extension

# Run tests
test: test-backend test-frontend
	pnpm test

test-backend:
	cd backend && go test -v ./...

test-frontend:
	pnpm --filter @speed-reader/web test:run

test-tokenizer:
	pnpm --filter @speed-reader/tokenizer test

# Database commands
db-up:
	docker-compose up -d postgres
	@echo "Waiting for PostgreSQL to be ready..."
	@sleep 3

db-down:
	docker-compose down

db-reset: db-down
	docker volume rm speed-reader_postgres_data 2>/dev/null || true
	@make db-up

# Clean build artifacts
clean:
	rm -rf backend/bin
	rm -rf apps/web/dist
	rm -rf apps/extension/dist
	rm -rf packages/*/dist
	rm -rf data
	pnpm clean

# Install dependencies (legacy - kept for compatibility)
deps: deps-backend install

deps-backend:
	cd backend && go mod download

# Run with production build
run: build db-up
	./backend/bin/api

# Observability stack commands
o11y-up:
	docker-compose -f docker-compose.observability.yml up -d
	@echo "Observability stack started:"
	@echo "  Grafana:  http://localhost:3001 (admin/admin)"
	@echo "  Jaeger:   http://localhost:16686"
	@echo "  Loki:     http://localhost:3100"

o11y-down:
	docker-compose -f docker-compose.observability.yml down

o11y-logs:
	docker-compose -f docker-compose.observability.yml logs -f

# Type checking
typecheck:
	pnpm typecheck
