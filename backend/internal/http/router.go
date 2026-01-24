package http

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/mikepersonal/speed-reader/backend/internal/auth"
	"github.com/mikepersonal/speed-reader/backend/internal/documents"
	"github.com/mikepersonal/speed-reader/backend/internal/logging"
	"github.com/mikepersonal/speed-reader/backend/internal/sharing"
	"golang.org/x/exp/slog"
)

// RouterDeps contains dependencies for the router
type RouterDeps struct {
	DocService     *documents.Service
	AuthService    *auth.Service
	SharingService *sharing.Service
	FrontendURL    string
	SecureCookie   bool
	Logger         *slog.Logger
	Sanitizer      *logging.Sanitizer
}

// NewRouter creates a new HTTP router with all routes configured
func NewRouter(deps *RouterDeps) *chi.Mux {
	r := chi.NewRouter()

	// Global middleware
	r.Use(logging.RequestLoggingMiddleware(deps.Logger, deps.Sanitizer))
	r.Use(middleware.Recoverer)
	r.Use(middleware.RealIP)
	r.Use(SecurityHeaders)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:5173", "http://localhost:3000", deps.FrontendURL},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// Handlers
	docHandlers := NewHandlers(deps.DocService, deps.SharingService, deps.Logger, deps.Sanitizer)
	authHandlers := auth.NewHandlers(deps.AuthService, deps.FrontendURL, deps.SecureCookie)

	// Health check endpoint (outside /api for simplicity)
	r.Get("/api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"ok"}`))
	})

	// API routes
	r.Route("/api", func(r chi.Router) {
		// Auth routes (no auth required for most)
		r.Route("/auth", func(r chi.Router) {
			// Guest endpoint removed - unauthenticated users use local storage
			r.Get("/google", authHandlers.GoogleLogin)
			r.Get("/google/callback", authHandlers.GoogleCallback)
			r.Post("/refresh", authHandlers.Refresh)

			// Extension-specific auth routes
			r.Get("/extension/google", authHandlers.ExtensionGoogleLogin)
			r.Get("/extension/google/callback", authHandlers.ExtensionGoogleCallback)
			r.Post("/extension/refresh", authHandlers.ExtensionRefresh)

			// These need optional auth to identify user
			r.Group(func(r chi.Router) {
				r.Use(auth.OptionalAuth(deps.AuthService))
				r.Post("/logout", authHandlers.Logout)
				r.Get("/me", authHandlers.Me)
			})
		})

		// Document routes (require auth)
		r.Route("/documents", func(r chi.Router) {
			r.Use(auth.RequireAuth(deps.AuthService))
			r.Use(auth.ValidateCSRF(deps.AuthService))
			r.Use(RequireJSONContentType)
			r.Use(ContextAwareMaxBodySize) // Apply body size limit after auth so we know user type

			r.Get("/", docHandlers.ListDocuments)
			r.Post("/", docHandlers.CreateDocument)
			r.Get("/{id}", docHandlers.GetDocument)
			r.Put("/{id}", docHandlers.UpdateDocument)
			r.Delete("/{id}", docHandlers.DeleteDocument)
			r.Get("/{id}/tokens", docHandlers.GetTokens)
			r.Get("/{id}/content", docHandlers.GetDocumentContent)
			r.Get("/{id}/reading-state", docHandlers.GetReadingState)
			r.Put("/{id}/reading-state", docHandlers.UpdateReadingState)

			// Sharing routes
			r.Get("/{id}/share", docHandlers.GetShareInfo)
			r.Post("/{id}/share", docHandlers.GenerateShareToken)
			r.Delete("/{id}/share", docHandlers.RevokeShareToken)
			r.Put("/{id}/visibility", docHandlers.SetVisibility)
		})

		// Shared document route (no auth required)
		r.Route("/shared", func(r chi.Router) {
			r.Get("/{token}", docHandlers.GetSharedDocument)
			r.Get("/{token}/tokens", docHandlers.GetSharedDocumentTokens)
		})
	})

	return r
}
