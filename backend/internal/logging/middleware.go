package logging

import (
	"net/http"
	"strings"
	"time"

	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
	"golang.org/x/exp/slog"
)

// responseWriter wraps http.ResponseWriter to capture status code and size
type responseWriter struct {
	http.ResponseWriter
	status      int
	wroteHeader bool
	size        int
}

func newResponseWriter(w http.ResponseWriter) *responseWriter {
	return &responseWriter{ResponseWriter: w, status: http.StatusOK}
}

func (rw *responseWriter) WriteHeader(code int) {
	if !rw.wroteHeader {
		rw.status = code
		rw.wroteHeader = true
	}
	rw.ResponseWriter.WriteHeader(code)
}

func (rw *responseWriter) Write(b []byte) (int, error) {
	if !rw.wroteHeader {
		rw.WriteHeader(http.StatusOK)
	}
	n, err := rw.ResponseWriter.Write(b)
	rw.size += n
	return n, err
}

// RequestLoggingMiddleware returns HTTP middleware that logs requests using wide events.
// It also integrates with OpenTelemetry for distributed tracing.
func RequestLoggingMiddleware(logger *slog.Logger, sanitizer *Sanitizer) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		// Wrap with OTel HTTP middleware for tracing
		otelHandler := otelhttp.NewHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()

			// Create wide event for this request
			we := NewWideEvent(logger)
			ctx := ContextWithWideEvent(r.Context(), we)
			r = r.WithContext(ctx)

			// Capture request info
			we.AddString("method", r.Method)
			we.AddString("path", r.URL.Path)
			if r.URL.RawQuery != "" {
				we.AddString("query", sanitizeQuery(r.URL.RawQuery))
			}
			we.AddString("user_agent", truncateUserAgent(r.UserAgent()))
			we.AddString("remote_addr", sanitizer.IPAddress(getClientIP(r)))

			// Wrap response writer to capture status and size
			wrapped := newResponseWriter(w)

			// Call the next handler
			next.ServeHTTP(wrapped, r)

			// Capture response info
			we.AddInt("status", wrapped.status)
			we.AddInt("response_size", wrapped.size)
			we.AddDuration("duration", time.Since(start))

			// Determine log level based on status code
			level := slog.LevelInfo
			if wrapped.status >= 500 {
				level = slog.LevelError
			} else if wrapped.status >= 400 {
				level = slog.LevelWarn
			}

			// Emit the wide event
			we.Emit(ctx, level, "http_request")
		}), "http_request")

		return otelHandler
	}
}

// getClientIP extracts the client IP from the request, considering proxies
func getClientIP(r *http.Request) string {
	// Check X-Forwarded-For header (may contain multiple IPs)
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		ips := strings.Split(xff, ",")
		if len(ips) > 0 {
			return strings.TrimSpace(ips[0])
		}
	}

	// Check X-Real-IP header
	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return xri
	}

	// Fall back to RemoteAddr
	ip := r.RemoteAddr
	// Remove port if present
	if colonIdx := strings.LastIndex(ip, ":"); colonIdx != -1 {
		ip = ip[:colonIdx]
	}
	return ip
}

// truncateUserAgent truncates long user agent strings
func truncateUserAgent(ua string) string {
	if len(ua) > 200 {
		return ua[:197] + "..."
	}
	return ua
}

// sanitizeQuery removes potentially sensitive query parameters
func sanitizeQuery(query string) string {
	sensitiveParams := []string{"token", "key", "secret", "password", "auth", "api_key", "apikey"}
	parts := strings.Split(query, "&")
	sanitized := make([]string, 0, len(parts))

	for _, part := range parts {
		kv := strings.SplitN(part, "=", 2)
		if len(kv) != 2 {
			sanitized = append(sanitized, part)
			continue
		}

		lower := strings.ToLower(kv[0])
		isSensitive := false
		for _, sensitive := range sensitiveParams {
			if strings.Contains(lower, sensitive) {
				isSensitive = true
				break
			}
		}

		if isSensitive {
			sanitized = append(sanitized, kv[0]+"=[REDACTED]")
		} else {
			sanitized = append(sanitized, part)
		}
	}

	return strings.Join(sanitized, "&")
}
