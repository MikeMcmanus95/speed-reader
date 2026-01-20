# Build stage
FROM golang:1.20-alpine AS builder
WORKDIR /build
RUN apk add --no-cache git ca-certificates
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o api ./cmd/api
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o cleanup ./cmd/cleanup

# Runtime stage
FROM alpine:3.19
WORKDIR /app
RUN apk add --no-cache ca-certificates tzdata
COPY --from=builder /build/api /app/api
COPY --from=builder /build/cleanup /app/cleanup
COPY --from=builder /build/migrations /app/migrations
RUN mkdir -p /app/data
RUN adduser -D -u 1000 appuser && chown -R appuser:appuser /app
USER appuser
EXPOSE 8080
CMD ["/app/api"]
