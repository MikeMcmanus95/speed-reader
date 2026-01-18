.PHONY: all build run test clean dev db-up db-down frontend backend observability-up observability-down observability-logs

# Default target
all: build

# Build both frontend and backend
build: build-backend build-frontend

build-backend:
	cd backend && go build -o bin/api ./cmd/api

build-frontend:
	cd frontend && npm run build

# Run in development mode
dev: db-up
	@echo "Starting development servers..."
	@make -j2 dev-backend dev-frontend

dev-backend:
	cd backend && go run ./cmd/api

dev-frontend:
	cd frontend && npm run dev

# Run tests
test: test-backend test-frontend

test-backend:
	cd backend && go test -v ./...

test-frontend:
	cd frontend && npm test

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
	rm -rf frontend/dist
	rm -rf data

# Install dependencies
deps: deps-backend deps-frontend

deps-backend:
	cd backend && go mod download

deps-frontend:
	cd frontend && npm install

# Run with production build
run: build db-up
	./backend/bin/api

# Observability stack commands
observability-up:
	docker-compose -f docker-compose.observability.yml up -d
	@echo "Observability stack started:"
	@echo "  Grafana:  http://localhost:3001 (admin/admin)"
	@echo "  Jaeger:   http://localhost:16686"
	@echo "  Loki:     http://localhost:3100"

observability-down:
	docker-compose -f docker-compose.observability.yml down

observability-logs:
	docker-compose -f docker-compose.observability.yml logs -f
