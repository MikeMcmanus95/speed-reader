package auth

import (
	"encoding/json"
	"net/http"
	"time"
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
	// Use SameSite=None for cross-origin requests (frontend and API on different subdomains)
	// This requires Secure=true, which is set in production
	sameSite := http.SameSiteLaxMode
	if h.secureCookie {
		sameSite = http.SameSiteNoneMode
	}
	http.SetCookie(w, &http.Cookie{
		Name:     RefreshTokenCookieName,
		Value:    token,
		Path:     "/api/auth",
		Expires:  expiresAt,
		HttpOnly: true,
		Secure:   h.secureCookie,
		SameSite: sameSite,
	})
}

// clearRefreshTokenCookie clears the refresh token cookie
func (h *Handlers) clearRefreshTokenCookie(w http.ResponseWriter) {
	sameSite := http.SameSiteLaxMode
	if h.secureCookie {
		sameSite = http.SameSiteNoneMode
	}
	http.SetCookie(w, &http.Cookie{
		Name:     RefreshTokenCookieName,
		Value:    "",
		Path:     "/api/auth",
		Expires:  time.Unix(0, 0),
		HttpOnly: true,
		Secure:   h.secureCookie,
		SameSite: sameSite,
	})
}

// setCSRFTokenCookie sets the CSRF token cookie (readable by JavaScript)
func (h *Handlers) setCSRFTokenCookie(w http.ResponseWriter, token string) {
	sameSite := http.SameSiteLaxMode
	if h.secureCookie {
		sameSite = http.SameSiteNoneMode
	}
	http.SetCookie(w, &http.Cookie{
		Name:     CSRFTokenCookieName,
		Value:    token,
		Path:     "/",
		Expires:  time.Now().Add(CSRFTokenDuration),
		HttpOnly: false, // Must be readable by JavaScript
		Secure:   h.secureCookie,
		SameSite: sameSite,
	})
}

// GoogleLogin handles GET /api/auth/google
func (h *Handlers) GoogleLogin(w http.ResponseWriter, r *http.Request) {
	url := h.service.GetGoogleAuthURL()
	http.Redirect(w, r, url, http.StatusTemporaryRedirect)
}

// GoogleCallback handles GET /api/auth/google/callback
func (h *Handlers) GoogleCallback(w http.ResponseWriter, r *http.Request) {
	code := r.URL.Query().Get("code")
	if code == "" {
		http.Redirect(w, r, h.frontendURL+"?error=missing_code", http.StatusTemporaryRedirect)
		return
	}

	authResponse, refreshToken, err := h.service.HandleGoogleCallback(r.Context(), code)
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

// ExtensionGoogleLogin handles GET /api/auth/extension/google
// This initiates Google OAuth for Chrome extensions, redirecting back to an extension URL
func (h *Handlers) ExtensionGoogleLogin(w http.ResponseWriter, r *http.Request) {
	extensionID := r.URL.Query().Get("extension_id")
	if extensionID == "" {
		writeError(w, http.StatusBadRequest, "missing extension_id")
		return
	}

	url := h.service.GetExtensionGoogleAuthURL(extensionID)
	http.Redirect(w, r, url, http.StatusTemporaryRedirect)
}

// ExtensionGoogleCallback handles GET /api/auth/extension/google/callback
// This handles the Google OAuth callback for Chrome extensions
func (h *Handlers) ExtensionGoogleCallback(w http.ResponseWriter, r *http.Request) {
	code := r.URL.Query().Get("code")
	if code == "" {
		writeError(w, http.StatusBadRequest, "missing code")
		return
	}

	state := r.URL.Query().Get("state")

	// Handle callback and extract extension ID from state
	authResponse, refreshToken, extensionID, err := h.service.HandleExtensionGoogleCallback(r.Context(), code, state)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "auth failed: "+err.Error())
		return
	}

	// Redirect to extension's auth callback page with tokens in URL fragment
	// Format: chrome-extension://<extension_id>/auth-callback.html#access_token=xxx&refresh_token=yyy&expires_at=zzz
	redirectURL := "https://" + extensionID + ".chromiumapp.org/oauth2callback" +
		"#access_token=" + authResponse.Token +
		"&refresh_token=" + refreshToken +
		"&expires_at=" + authResponse.ExpiresAt.Format("2006-01-02T15:04:05Z07:00") +
		"&user_id=" + authResponse.User.ID.String()

	http.Redirect(w, r, redirectURL, http.StatusTemporaryRedirect)
}

// ExtensionRefresh handles POST /api/auth/extension/refresh
// This handles token refresh for Chrome extensions using Authorization header instead of cookie
func (h *Handlers) ExtensionRefresh(w http.ResponseWriter, r *http.Request) {
	// Get refresh token from request body
	var req struct {
		RefreshToken string `json:"refreshToken"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.RefreshToken == "" {
		writeError(w, http.StatusBadRequest, "missing refresh token in request body")
		return
	}

	authResponse, newRefreshToken, err := h.service.RefreshAccessToken(r.Context(), req.RefreshToken)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "invalid or expired refresh token")
		return
	}

	// Return tokens in response body (no cookies for extensions)
	type ExtensionAuthResponse struct {
		AccessToken  string `json:"accessToken"`
		RefreshToken string `json:"refreshToken"`
		ExpiresAt    string `json:"expiresAt"`
		User         *User  `json:"user"`
	}

	writeJSON(w, http.StatusOK, ExtensionAuthResponse{
		AccessToken:  authResponse.Token,
		RefreshToken: newRefreshToken,
		ExpiresAt:    authResponse.ExpiresAt.Format("2006-01-02T15:04:05Z07:00"),
		User:         authResponse.User,
	})
}
