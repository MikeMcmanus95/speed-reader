package http

import (
	"net/http"
	"strings"

	"github.com/mikepersonal/speed-reader/backend/internal/auth"
	"github.com/mikepersonal/speed-reader/backend/internal/config"
)

// MaxBodySize limits the request body size (uses guest limit)
// Deprecated: Use ContextAwareMaxBodySize for user-specific limits
func MaxBodySize(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		r.Body = http.MaxBytesReader(w, r.Body, config.MaxPasteSize)
		next.ServeHTTP(w, r)
	})
}

// ContextAwareMaxBodySize limits the request body size based on user type
// Guest users get 1MB limit, authenticated users get 10MB limit
func ContextAwareMaxBodySize(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		limit := int64(config.MaxGuestPasteSize)
		if user, ok := auth.UserFromContext(r.Context()); ok && !user.IsGuest {
			limit = config.MaxAuthPasteSize
		}
		r.Body = http.MaxBytesReader(w, r.Body, limit)
		next.ServeHTTP(w, r)
	})
}

// SecurityHeaders adds security-related HTTP headers
func SecurityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Prevent MIME type sniffing
		w.Header().Set("X-Content-Type-Options", "nosniff")

		// Prevent clickjacking
		w.Header().Set("X-Frame-Options", "DENY")

		// Enable XSS filter in browsers
		w.Header().Set("X-XSS-Protection", "1; mode=block")

		// Control referrer information
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")

		// Permissions policy (disable unnecessary browser features)
		w.Header().Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")

		next.ServeHTTP(w, r)
	})
}

// RequireJSONContentType validates that requests with bodies have JSON content type
func RequireJSONContentType(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Skip for methods that don't have bodies
		if r.Method == http.MethodGet || r.Method == http.MethodHead ||
			r.Method == http.MethodOptions || r.Method == http.MethodDelete {
			next.ServeHTTP(w, r)
			return
		}

		contentType := r.Header.Get("Content-Type")
		if !strings.HasPrefix(contentType, "application/json") {
			writeJSON(w, http.StatusUnsupportedMediaType,
				ErrorResponse{Error: "Content-Type must be application/json"})
			return
		}
		next.ServeHTTP(w, r)
	})
}
