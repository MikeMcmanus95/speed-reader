package auth

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/google/uuid"
)

const (
	// RefreshTokenCookieName is the name of the refresh token cookie
	RefreshTokenCookieName = "refresh_token"

	// CSRFTokenCookieName is the name of the CSRF token cookie
	CSRFTokenCookieName = "csrf_token"
)

// Handlers contains HTTP handlers for auth
type Handlers struct {
	service     *Service
	frontendURL string
	secureCookie bool
}

// NewHandlers creates a new auth Handlers instance
func NewHandlers(service *Service, frontendURL string, secureCookie bool) *Handlers {
	return &Handlers{
		service:     service,
		frontendURL: frontendURL,
		secureCookie: secureCookie,
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

// setRefreshTokenCookie sets the refresh token cookie
func (h *Handlers) setRefreshTokenCookie(w http.ResponseWriter, token string, expiresAt time.Time) {
	http.SetCookie(w, &http.Cookie{
		Name:     RefreshTokenCookieName,
		Value:    token,
		Path:     "/api/auth",
		Expires:  expiresAt,
		HttpOnly: true,
		Secure:   h.secureCookie,
		SameSite: http.SameSiteLaxMode,
	})
}

// clearRefreshTokenCookie clears the refresh token cookie
func (h *Handlers) clearRefreshTokenCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     RefreshTokenCookieName,
		Value:    "",
		Path:     "/api/auth",
		Expires:  time.Unix(0, 0),
		HttpOnly: true,
		Secure:   h.secureCookie,
		SameSite: http.SameSiteLaxMode,
	})
}

// setCSRFTokenCookie sets the CSRF token cookie (readable by JavaScript)
func (h *Handlers) setCSRFTokenCookie(w http.ResponseWriter, token string) {
	http.SetCookie(w, &http.Cookie{
		Name:     CSRFTokenCookieName,
		Value:    token,
		Path:     "/",
		Expires:  time.Now().Add(CSRFTokenDuration),
		HttpOnly: false, // Must be readable by JavaScript
		Secure:   h.secureCookie,
		SameSite: http.SameSiteLaxMode,
	})
}

// CreateGuest handles POST /api/auth/guest
func (h *Handlers) CreateGuest(w http.ResponseWriter, r *http.Request) {
	authResponse, refreshToken, err := h.service.CreateGuestUser(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create guest user")
		return
	}

	// Set refresh token cookie
	h.setRefreshTokenCookie(w, refreshToken, time.Now().Add(RefreshTokenDuration))

	// Generate and set CSRF token
	csrfToken, err := h.service.GenerateCSRFToken()
	if err == nil {
		h.setCSRFTokenCookie(w, csrfToken)
	}

	writeJSON(w, http.StatusCreated, authResponse)
}

// GoogleLogin handles GET /api/auth/google
func (h *Handlers) GoogleLogin(w http.ResponseWriter, r *http.Request) {
	// Read guest ID from query parameter (passed by frontend when user is a guest)
	// This enables document migration when a guest user signs up
	var url string
	if guestIDStr := r.URL.Query().Get("guest_id"); guestIDStr != "" {
		if guestID, err := uuid.Parse(guestIDStr); err == nil {
			url = h.service.GetGoogleAuthURL(&guestID)
		} else {
			url = h.service.GetGoogleAuthURL(nil)
		}
	} else {
		url = h.service.GetGoogleAuthURL(nil)
	}

	http.Redirect(w, r, url, http.StatusTemporaryRedirect)
}

// GoogleCallback handles GET /api/auth/google/callback
func (h *Handlers) GoogleCallback(w http.ResponseWriter, r *http.Request) {
	code := r.URL.Query().Get("code")
	if code == "" {
		http.Redirect(w, r, h.frontendURL+"?error=missing_code", http.StatusTemporaryRedirect)
		return
	}

	state := r.URL.Query().Get("state")

	authResponse, refreshToken, err := h.service.HandleGoogleCallback(r.Context(), code, state)
	if err != nil {
		http.Redirect(w, r, h.frontendURL+"?error=auth_failed", http.StatusTemporaryRedirect)
		return
	}

	// Set refresh token cookie
	h.setRefreshTokenCookie(w, refreshToken, time.Now().Add(RefreshTokenDuration))

	// Generate and set CSRF token
	csrfToken, err := h.service.GenerateCSRFToken()
	if err == nil {
		h.setCSRFTokenCookie(w, csrfToken)
	}

	// Redirect to frontend with access token in URL fragment (more secure than query params)
	redirectURL := h.frontendURL + "/auth/callback#token=" + authResponse.Token
	http.Redirect(w, r, redirectURL, http.StatusTemporaryRedirect)
}

// Refresh handles POST /api/auth/refresh
func (h *Handlers) Refresh(w http.ResponseWriter, r *http.Request) {
	// Get refresh token from cookie
	cookie, err := r.Cookie(RefreshTokenCookieName)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "missing refresh token")
		return
	}

	authResponse, newRefreshToken, err := h.service.RefreshAccessToken(r.Context(), cookie.Value)
	if err != nil {
		h.clearRefreshTokenCookie(w)
		writeError(w, http.StatusUnauthorized, "invalid or expired refresh token")
		return
	}

	// Set new refresh token cookie
	h.setRefreshTokenCookie(w, newRefreshToken, time.Now().Add(RefreshTokenDuration))

	// Generate and set new CSRF token
	csrfToken, err := h.service.GenerateCSRFToken()
	if err == nil {
		h.setCSRFTokenCookie(w, csrfToken)
	}

	writeJSON(w, http.StatusOK, authResponse)
}

// Logout handles POST /api/auth/logout
func (h *Handlers) Logout(w http.ResponseWriter, r *http.Request) {
	// Get user from context
	user, ok := UserFromContext(r.Context())
	if ok {
		// Delete all refresh tokens for user
		_ = h.service.Logout(r.Context(), user.ID)
	}

	// Clear cookies
	h.clearRefreshTokenCookie(w)

	w.WriteHeader(http.StatusNoContent)
}

// Me handles GET /api/auth/me
func (h *Handlers) Me(w http.ResponseWriter, r *http.Request) {
	user, ok := UserFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "not authenticated")
		return
	}

	writeJSON(w, http.StatusOK, user)
}
