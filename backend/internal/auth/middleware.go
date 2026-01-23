package auth

import (
	"net/http"
	"strings"
)

// RequireAuth middleware requires a valid access token
func RequireAuth(service *Service) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Extract token from Authorization header
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				http.Error(w, `{"error":"missing authorization header"}`, http.StatusUnauthorized)
				return
			}

			// Expect "Bearer <token>"
			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
				http.Error(w, `{"error":"invalid authorization header format"}`, http.StatusUnauthorized)
				return
			}

			tokenString := parts[1]

			// Validate token
			claims, err := service.ValidateAccessToken(tokenString)
			if err != nil {
				http.Error(w, `{"error":"invalid or expired token"}`, http.StatusUnauthorized)
				return
			}

			// Get user ID from claims
			userID, err := GetUserIDFromClaims(claims)
			if err != nil {
				http.Error(w, `{"error":"invalid token claims"}`, http.StatusUnauthorized)
				return
			}

			// Get user from database
			user, err := service.GetCurrentUser(r.Context(), userID)
			if err != nil {
				http.Error(w, `{"error":"user not found"}`, http.StatusUnauthorized)
				return
			}

			// Add user to context
			ctx := ContextWithUser(r.Context(), user)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// OptionalAuth middleware adds user to context if token is present, but doesn't require it
func OptionalAuth(service *Service) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Extract token from Authorization header
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				// No token, continue without user
				next.ServeHTTP(w, r)
				return
			}

			// Expect "Bearer <token>"
			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
				// Invalid format, continue without user
				next.ServeHTTP(w, r)
				return
			}

			tokenString := parts[1]

			// Validate token
			claims, err := service.ValidateAccessToken(tokenString)
			if err != nil {
				// Invalid token, continue without user
				next.ServeHTTP(w, r)
				return
			}

			// Get user ID from claims
			userID, err := GetUserIDFromClaims(claims)
			if err != nil {
				next.ServeHTTP(w, r)
				return
			}

			// Get user from database
			user, err := service.GetCurrentUser(r.Context(), userID)
			if err != nil {
				next.ServeHTTP(w, r)
				return
			}

			// Add user to context
			ctx := ContextWithUser(r.Context(), user)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// ValidateCSRF middleware validates the CSRF token for state-changing requests
// Note: Requests using Bearer token authentication are exempt from CSRF validation
// because CSRF attacks rely on cookies being automatically sent by browsers.
// Bearer tokens must be explicitly added by the application, so they're not
// vulnerable to CSRF attacks.
func ValidateCSRF(service *Service) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Only validate for state-changing methods
			if r.Method == http.MethodGet || r.Method == http.MethodHead || r.Method == http.MethodOptions {
				next.ServeHTTP(w, r)
				return
			}

			// Skip CSRF validation for Bearer token authentication (used by extensions)
			// Bearer tokens are not automatically sent by browsers, so they're inherently
			// protected from CSRF attacks
			authHeader := r.Header.Get("Authorization")
			if strings.HasPrefix(authHeader, "Bearer ") {
				next.ServeHTTP(w, r)
				return
			}

			// Get CSRF token from header
			csrfToken := r.Header.Get("X-CSRF-Token")
			if csrfToken == "" {
				http.Error(w, `{"error":"missing CSRF token"}`, http.StatusForbidden)
				return
			}

			// Validate token
			if !service.ValidateCSRFToken(csrfToken) {
				http.Error(w, `{"error":"invalid CSRF token"}`, http.StatusForbidden)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
