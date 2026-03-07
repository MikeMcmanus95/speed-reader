package settings

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"

	"github.com/google/uuid"
	"github.com/mikepersonal/speed-reader/backend/internal/auth"
	"github.com/mikepersonal/speed-reader/backend/internal/logging"
	"golang.org/x/exp/slog"
)

type settingsService interface {
	GetSettings(ctx context.Context, userID uuid.UUID) (*Settings, error)
	UpdateSettings(ctx context.Context, userID uuid.UUID, update *UpdateSettingsRequest) (*Settings, error)
}

// Handlers contains HTTP handlers for settings
type Handlers struct {
	service   settingsService
	logger    *slog.Logger
	sanitizer *logging.Sanitizer
}

// NewHandlers creates a new settings Handlers instance
func NewHandlers(service settingsService, logger *slog.Logger, sanitizer *logging.Sanitizer) *Handlers {
	return &Handlers{
		service:   service,
		logger:    logger,
		sanitizer: sanitizer,
	}
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

// GetSettings handles GET /api/settings
func (h *Handlers) GetSettings(w http.ResponseWriter, r *http.Request) {
	we := logging.WideEventFromContext(r.Context())

	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "not authenticated")
		return
	}

	if we != nil {
		we.AddString("user.id", h.sanitizer.UserID(userID.String()))
	}

	settings, err := h.service.GetSettings(r.Context(), userID)
	if err != nil {
		if we != nil {
			we.AddError(err)
		}
		if errors.Is(err, ErrUserNotFound) {
			writeError(w, http.StatusNotFound, "user not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to get settings")
		return
	}

	writeJSON(w, http.StatusOK, settings)
}

// UpdateSettings handles PUT /api/settings
func (h *Handlers) UpdateSettings(w http.ResponseWriter, r *http.Request) {
	we := logging.WideEventFromContext(r.Context())

	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "not authenticated")
		return
	}

	if we != nil {
		we.AddString("user.id", h.sanitizer.UserID(userID.String()))
	}

	var req UpdateSettingsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		if we != nil {
			we.AddError(err)
		}
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	// Log which settings are being updated (not the values)
	if we != nil {
		if req.DefaultWPM != nil {
			we.AddBool("settings.update.defaultWpm", true)
		}
		if req.DefaultChunkSize != nil {
			we.AddBool("settings.update.defaultChunkSize", true)
		}
		if req.AutoPlayOnOpen != nil {
			we.AddBool("settings.update.autoPlayOnOpen", true)
		}
		if req.PauseMultipliers != nil {
			we.AddBool("settings.update.pauseMultipliers", true)
		}
		if req.FontSize != nil {
			we.AddBool("settings.update.fontSize", true)
		}
	}

	settings, err := h.service.UpdateSettings(r.Context(), userID, &req)
	if err != nil {
		if we != nil {
			we.AddError(err)
		}
		if isValidationError(err) {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		if errors.Is(err, ErrUserNotFound) {
			writeError(w, http.StatusNotFound, "user not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to update settings")
		return
	}

	writeJSON(w, http.StatusOK, settings)
}
