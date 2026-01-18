package http

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"unicode"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/mikepersonal/speed-reader/backend/internal/auth"
	"github.com/mikepersonal/speed-reader/backend/internal/documents"
	"github.com/mikepersonal/speed-reader/backend/internal/sharing"
)

// Handlers contains HTTP handlers for the API
type Handlers struct {
	docService     *documents.Service
	sharingService *sharing.Service
}

// NewHandlers creates a new Handlers instance
func NewHandlers(docService *documents.Service, sharingService *sharing.Service) *Handlers {
	return &Handlers{
		docService:     docService,
		sharingService: sharingService,
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

// generateTitleFromContent creates a title from the first few words of content
func generateTitleFromContent(content string, maxWords int) string {
	// Split content into words
	words := strings.FieldsFunc(content, func(r rune) bool {
		return unicode.IsSpace(r)
	})

	if len(words) == 0 {
		return "Untitled Document"
	}

	// Take up to maxWords
	if len(words) > maxWords {
		words = words[:maxWords]
	}

	title := strings.Join(words, " ")

	// Truncate if too long (max 100 chars)
	if len(title) > 100 {
		title = title[:97] + "..."
	} else if len(words) == maxWords {
		title += "..."
	}

	return title
}

// CreateDocument handles POST /api/documents
func (h *Handlers) CreateDocument(w http.ResponseWriter, r *http.Request) {
	var req CreateDocumentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Content == "" {
		writeError(w, http.StatusBadRequest, "content is required")
		return
	}

	// Auto-generate title from content if not provided
	title := strings.TrimSpace(req.Title)
	if title == "" {
		title = generateTitleFromContent(req.Content, 6)
	}

	doc, err := h.docService.CreateDocument(r.Context(), title, req.Content)
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
