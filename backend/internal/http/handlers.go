package http

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/mikepersonal/speed-reader/backend/internal/documents"
)

// Handlers contains HTTP handlers for the API
type Handlers struct {
	docService *documents.Service
}

// NewHandlers creates a new Handlers instance
func NewHandlers(docService *documents.Service) *Handlers {
	return &Handlers{docService: docService}
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
	var req CreateDocumentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
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

	doc, err := h.docService.CreateDocument(r.Context(), req.Title, req.Content)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create document")
		return
	}

	writeJSON(w, http.StatusCreated, doc)
}

// GetDocument handles GET /api/documents/:id
func (h *Handlers) GetDocument(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid document ID")
		return
	}

	doc, err := h.docService.GetDocument(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "document not found")
		return
	}

	writeJSON(w, http.StatusOK, doc)
}

// GetTokens handles GET /api/documents/:id/tokens
func (h *Handlers) GetTokens(w http.ResponseWriter, r *http.Request) {
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

	chunk, err := h.docService.GetTokens(r.Context(), id, chunkIndex)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
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
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid document ID")
		return
	}

	var req UpdateReadingStateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	state := &documents.ReadingState{
		DocID:      id,
		TokenIndex: req.TokenIndex,
		WPM:        req.WPM,
		ChunkSize:  req.ChunkSize,
	}

	if err := h.docService.UpdateReadingState(r.Context(), state); err != nil {
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
