# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
# Start development (runs DB + backend + frontend concurrently)
make dev

# Run all tests
make test

# Run tests individually
cd backend && go test -v ./...                    # All backend tests
cd backend && go test -v ./internal/tokenizer/   # Single package
cd frontend && npm test                           # Frontend (watch mode)
cd frontend && npm run test:run                   # Frontend (single run)

# Build for production
make build

# Database management
make db-up      # Start PostgreSQL container
make db-down    # Stop PostgreSQL
make db-reset   # Reset database (destroys data)

# Benchmarks
cd backend && go test -bench=. ./internal/tokenizer/
```

## Architecture

This is an RSVP (Rapid Serial Visual Presentation) speed reading app with a Go backend and React/TypeScript frontend.

### Data Flow

```
User pastes text → Backend tokenizes → Tokens stored in chunks → Frontend fetches chunks → RSVPEngine displays words
```

### Backend (`backend/`)

**Entry point**: `cmd/api/main.go` - wires together all services

**Package dependencies** (build order):
1. `internal/config` - Environment configuration, constants (MaxPasteSize=1MB, ChunkSize=5000)
2. `internal/storage` - Token struct definition, ChunkStore for JSON file I/O
3. `internal/tokenizer` - Text processing: normalization, sentence splitting, pivot calculation, pause multipliers
4. `internal/documents` - Repository (PostgreSQL CRUD) + Service (orchestrates tokenization and storage)
5. `internal/http` - Chi router, handlers, middleware

**API Endpoints**:
- `POST /api/documents` - Create document (tokenizes text, writes chunks)
- `GET /api/documents/:id` - Get document metadata
- `GET /api/documents/:id/tokens?chunk=n` - Get token chunk
- `GET /api/documents/:id/reading-state` - Get saved position/WPM
- `PUT /api/documents/:id/reading-state` - Update reading progress

**Key design decisions**:
- Tokens are chunked into 5000-token JSON files in `data/doc_{id}/chunk_{n}.json`
- Pause multipliers: comma=1.3×, sentence=1.8×, paragraph=2.2×
- Pivot calculation: ~30% into word for optimal recognition point (ORP)

### Frontend (`frontend/`)

**Core engine**: `src/engine/RSVPEngine.ts` - Timing loop using `requestAnimationFrame` with pause multiplier support

**Component hierarchy**:
- `views/PasteInputView` - Text input with 1MB limit
- `views/ReaderView` - Main reader, manages RSVPEngine lifecycle
  - `components/RSVPDisplay` - Word display with pivot highlighting (red center letter)
  - `components/ControlBar` - Play/pause, WPM slider (100-1000), chunk mode (1-4 words)
  - `components/ProgressBar` - Seekable position indicator

**Key behaviors**:
- Prefetches next chunk at 80% through current chunk
- Auto-saves reading state every 5 seconds
- Keyboard: Space=toggle, Arrow keys=seek ±10 tokens

### Database Schema

Two tables in PostgreSQL:
- `documents`: id, title, status (pending/processing/ready/error), token_count, chunk_count
- `reading_state`: doc_id, token_index, wpm, chunk_size

## Configuration

Environment variables (see `backend/.env.example`):
- `PORT` (default: 8080)
- `DATABASE_URL` (default: postgres://speedreader:speedreader@localhost:5432/speedreader)
- `STORAGE_PATH` (default: ./data)

Frontend proxies `/api` to `localhost:8080` via Vite config.

## Performance Targets

- Tokenization: <200ms for 100k words (benchmarks at ~25ms)
- RSVP timing jitter: <16ms (using requestAnimationFrame)
- Chunk fetch: <50ms (pre-generated JSON files)
