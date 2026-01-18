package http

import (
	"net/http"

	"github.com/mikepersonal/speed-reader/backend/internal/config"
)

// MaxBodySize limits the request body size
func MaxBodySize(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		r.Body = http.MaxBytesReader(w, r.Body, config.MaxPasteSize)
		next.ServeHTTP(w, r)
	})
}
