package http

import (
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/mikepersonal/speed-reader/backend/internal/documents"
)

// NewRouter creates a new HTTP router with all routes configured
func NewRouter(docService *documents.Service) *chi.Mux {
	r := chi.NewRouter()

	// Middleware
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.RealIP)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:5173", "http://localhost:3000"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// Handlers
	handlers := NewHandlers(docService)

	// API routes
	r.Route("/api", func(r chi.Router) {
		r.Use(MaxBodySize)

		r.Route("/documents", func(r chi.Router) {
			r.Post("/", handlers.CreateDocument)
			r.Get("/{id}", handlers.GetDocument)
			r.Get("/{id}/tokens", handlers.GetTokens)
			r.Get("/{id}/reading-state", handlers.GetReadingState)
			r.Put("/{id}/reading-state", handlers.UpdateReadingState)
		})
	})

	return r
}
