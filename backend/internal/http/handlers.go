package http

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/mikepersonal/speed-reader/backend/internal/auth"
	"github.com/mikepersonal/speed-reader/backend/internal/documents"
	"github.com/mikepersonal/speed-reader/backend/internal/logging"
	"github.com/mikepersonal/speed-reader/backend/internal/sharing"
	"golang.org/x/exp/slog"
)

// Handlers contains HTTP handlers for the API
type Handlers struct {
	docService     *documents.Service
	sharingService *sharing.Service
	logger         *slog.Logger
	sanitizer      *logging.Sanitizer
}

// NewHandlers creates a new Handlers instance
func NewHandlers(docService *documents.Service, sharingService *sharing.Service, logger *slog.Logger, sanitizer *logging.Sanitizer) *Handlers {
	return &Handlers{
		docService:     docService,
		sharingService: sharingService,
		logger:         logger,
		sanitizer:      sanitizer,
	}
}

// CreateDocumentRequest represents the request body for creating a document
type CreateDocumentRequest struct {
	Title   string `json:"title"`
	Content string `json:"content"`
}

// UpdateReadingStateRequest represents the request body for updating reading state
type UpdateReadingStateRequest struct {
	TokenIndex int `json:"tokenIndex"`
	WPM        int `json:"wpm"`
	ChunkSize  int `json:"chunkSize"`
}

// UpdateDocumentRequest represents the request body for updating a document
type UpdateDocumentRequest struct {
	Title string `json:"title"`
}

// SetVisibilityRequest represents the request body for setting document visibility
type SetVisibilityRequest struct {
	Visibility string `json:"visibility"`
}

// ErrorResponse represents an error response
type ErrorResponse struct {
	Error string `json:"error"`
}

// writeJSON writes a JSON response
func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

// writeError writes an error response
func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, ErrorResponse{Error: message})
}

// CreateDocument handles POST /api/documents
func (h *Handlers) CreateDocument(w http.ResponseWriter, r *http.Request) {
	we := logging.WideEventFromContext(r.Context())

	var req CreateDocumentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		if we != nil {
			we.AddError(err)
		}
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Title == "" {
		writeError(w, http.StatusBadRequest, "title is required")
		return
	}

	if req.Content == "" {
		writeError(w, http.StatusBadRequest, "content is required")
		return
	}

	// Log content metrics (sanitized)
	if we != nil {
		we.AddString("doc.title", h.sanitizer.DocumentTitle(req.Title))
		we.AddInt("doc.content_length", len(req.Content))
	}

	doc, err := h.docService.CreateDocument(r.Context(), req.Title, req.Content)
	if err != nil {
		if we != nil {
			we.AddError(err)
		}
		writeError(w, http.StatusInternalServerError, "failed to create document")
		return
	}

	// Log document metrics
	if we != nil {
		we.AddString("doc.id", doc.ID.String())
		we.AddInt("doc.token_count", doc.TokenCount)
		we.AddInt("doc.chunk_count", doc.ChunkCount)
	}

	writeJSON(w, http.StatusCreated, doc)
}

// GetDocument handles GET /api/documents/:id
func (h *Handlers) GetDocument(w http.ResponseWriter, r *http.Request) {
	we := logging.WideEventFromContext(r.Context())

	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid document ID")
		return
	}

	if we != nil {
		we.AddString("doc.id", id.String())
	}

	doc, err := h.docService.GetDocument(r.Context(), id)
	if err != nil {
		if we != nil {
			we.AddError(err)
		}
		writeError(w, http.StatusNotFound, "document not found")
		return
	}

	writeJSON(w, http.StatusOK, doc)
}

// GetTokens handles GET /api/documents/:id/tokens
func (h *Handlers) GetTokens(w http.ResponseWriter, r *http.Request) {
	we := logging.WideEventFromContext(r.Context())

	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid document ID")
		return
	}

	chunkStr := r.URL.Query().Get("chunk")
	if chunkStr == "" {
		chunkStr = "0"
	}

	chunkIndex, err := strconv.Atoi(chunkStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid chunk index")
		return
	}

	if we != nil {
		we.AddString("doc.id", id.String())
		we.AddInt("chunk.index", chunkIndex)
	}

	chunk, err := h.docService.GetTokens(r.Context(), id, chunkIndex)
	if err != nil {
		if we != nil {
			we.AddError(err)
		}
		writeError(w, http.StatusNotFound, err.Error())
		return
	}

	if we != nil {
		we.AddInt("chunk.token_count", len(chunk.Tokens))
	}

	writeJSON(w, http.StatusOK, chunk)
}

// GetReadingState handles GET /api/documents/:id/reading-state
func (h *Handlers) GetReadingState(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid document ID")
		return
	}

	state, err := h.docService.GetReadingState(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "document not found")
		return
	}

	writeJSON(w, http.StatusOK, state)
}

// UpdateReadingState handles PUT /api/documents/:id/reading-state
func (h *Handlers) UpdateReadingState(w http.ResponseWriter, r *http.Request) {
	we := logging.WideEventFromContext(r.Context())

	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid document ID")
		return
	}

	var req UpdateReadingStateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		if we != nil {
			we.AddError(err)
		}
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	state := &documents.ReadingState{
		DocID:      id,
		TokenIndex: req.TokenIndex,
		WPM:        req.WPM,
		ChunkSize:  req.ChunkSize,
	}

	// Log reading progress metrics
	if we != nil {
		we.AddString("doc.id", id.String())
		we.AddInt("reading.token_index", req.TokenIndex)
		we.AddInt("reading.wpm", req.WPM)
	}

	if err := h.docService.UpdateReadingState(r.Context(), state); err != nil {
		if we != nil {
			we.AddError(err)
		}
		writeError(w, http.StatusNotFound, "document not found")
		return
	}

	writeJSON(w, http.StatusOK, state)
}

// ListDocuments handles GET /api/documents
func (h *Handlers) ListDocuments(w http.ResponseWriter, r *http.Request) {
	docs, err := h.docService.ListDocuments(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list documents")
		return
	}

	writeJSON(w, http.StatusOK, docs)
}

// UpdateDocument handles PUT /api/documents/:id
func (h *Handlers) UpdateDocument(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid document ID")
		return
	}

	var req UpdateDocumentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Title == "" {
		writeError(w, http.StatusBadRequest, "title is required")
		return
	}

	if err := h.docService.UpdateDocumentTitle(r.Context(), id, req.Title); err != nil {
		writeError(w, http.StatusNotFound, "document not found")
		return
	}

	// Return the updated document
	doc, err := h.docService.GetDocument(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "document not found")
		return
	}

	writeJSON(w, http.StatusOK, doc)
}

// DeleteDocument handles DELETE /api/documents/:id
func (h *Handlers) DeleteDocument(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid document ID")
		return
	}

	if err := h.docService.DeleteDocument(r.Context(), id); err != nil {
		writeError(w, http.StatusNotFound, "document not found")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// GetShareInfo handles GET /api/documents/:id/share
func (h *Handlers) GetShareInfo(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	docID, err := uuid.Parse(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid document ID")
		return
	}

	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "not authenticated")
		return
	}

	info, err := h.sharingService.GetShareInfo(r.Context(), docID, userID)
	if err != nil {
		writeError(w, http.StatusNotFound, "document not found")
		return
	}

	writeJSON(w, http.StatusOK, info)
}

// GenerateShareToken handles POST /api/documents/:id/share
func (h *Handlers) GenerateShareToken(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	docID, err := uuid.Parse(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid document ID")
		return
	}

	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "not authenticated")
		return
	}

	info, err := h.sharingService.GenerateShareToken(r.Context(), docID, userID)
	if err != nil {
		writeError(w, http.StatusForbidden, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, info)
}

// RevokeShareToken handles DELETE /api/documents/:id/share
func (h *Handlers) RevokeShareToken(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	docID, err := uuid.Parse(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid document ID")
		return
	}

	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "not authenticated")
		return
	}

	if err := h.sharingService.RevokeShareToken(r.Context(), docID, userID); err != nil {
		writeError(w, http.StatusForbidden, err.Error())
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// SetVisibility handles PUT /api/documents/:id/visibility
func (h *Handlers) SetVisibility(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	docID, err := uuid.Parse(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid document ID")
		return
	}

	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "not authenticated")
		return
	}

	var req SetVisibilityRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Visibility != "private" && req.Visibility != "public" {
		writeError(w, http.StatusBadRequest, "visibility must be 'private' or 'public'")
		return
	}

	info, err := h.sharingService.SetVisibility(r.Context(), docID, userID, sharing.Visibility(req.Visibility))
	if err != nil {
		writeError(w, http.StatusForbidden, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, info)
}

// GetSharedDocument handles GET /api/shared/:token
func (h *Handlers) GetSharedDocument(w http.ResponseWriter, r *http.Request) {
	tokenStr := chi.URLParam(r, "token")
	token, err := uuid.Parse(tokenStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid share token")
		return
	}

	doc, err := h.sharingService.GetDocumentByShareToken(r.Context(), token)
	if err != nil {
		writeError(w, http.StatusNotFound, "shared document not found")
		return
	}

	writeJSON(w, http.StatusOK, doc)
}

// GetSharedDocumentTokens handles GET /api/shared/:token/tokens
func (h *Handlers) GetSharedDocumentTokens(w http.ResponseWriter, r *http.Request) {
	tokenStr := chi.URLParam(r, "token")
	token, err := uuid.Parse(tokenStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid share token")
		return
	}

	// Get the document first to verify it exists and get the ID
	doc, err := h.sharingService.GetDocumentByShareToken(r.Context(), token)
	if err != nil {
		writeError(w, http.StatusNotFound, "shared document not found")
		return
	}

	chunkStr := r.URL.Query().Get("chunk")
	if chunkStr == "" {
		chunkStr = "0"
	}

	chunkIndex, err := strconv.Atoi(chunkStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid chunk index")
		return
	}

	if chunkIndex < 0 || chunkIndex >= doc.ChunkCount {
		writeError(w, http.StatusBadRequest, "chunk index out of range")
		return
	}

	// Get chunks from the chunk store directly
	chunkStore := h.docService.GetChunkStore()
	chunk, err := chunkStore.ReadChunk(doc.ID.String(), chunkIndex)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, chunk)
}
