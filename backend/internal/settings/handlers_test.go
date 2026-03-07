package settings

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/mikepersonal/speed-reader/backend/internal/auth"
)

type fakeSettingsService struct {
	getSettingsFn    func(ctx context.Context, userID uuid.UUID) (*Settings, error)
	updateSettingsFn func(ctx context.Context, userID uuid.UUID, update *UpdateSettingsRequest) (*Settings, error)
}

func (f *fakeSettingsService) GetSettings(ctx context.Context, userID uuid.UUID) (*Settings, error) {
	if f.getSettingsFn == nil {
		return nil, nil
	}
	return f.getSettingsFn(ctx, userID)
}

func (f *fakeSettingsService) UpdateSettings(ctx context.Context, userID uuid.UUID, update *UpdateSettingsRequest) (*Settings, error) {
	if f.updateSettingsFn == nil {
		return nil, nil
	}
	return f.updateSettingsFn(ctx, userID, update)
}

func authenticatedRequest(req *http.Request) *http.Request {
	user := &auth.User{
		ID:        uuid.New(),
		Name:      "Test User",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	return req.WithContext(auth.ContextWithUser(req.Context(), user))
}

func decodeErrorResponse(t *testing.T, rr *httptest.ResponseRecorder) ErrorResponse {
	t.Helper()
	var response ErrorResponse
	if err := json.Unmarshal(rr.Body.Bytes(), &response); err != nil {
		t.Fatalf("failed to decode error response: %v", err)
	}
	return response
}

func TestGetSettings_ErrorStatusMapping(t *testing.T) {
	tests := []struct {
		name       string
		serviceErr error
		wantStatus int
		wantError  string
	}{
		{
			name:       "returns 404 for user not found",
			serviceErr: ErrUserNotFound,
			wantStatus: http.StatusNotFound,
			wantError:  "user not found",
		},
		{
			name:       "returns 500 for unexpected error",
			serviceErr: errors.New("db unavailable"),
			wantStatus: http.StatusInternalServerError,
			wantError:  "failed to get settings",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			handlers := NewHandlers(&fakeSettingsService{
				getSettingsFn: func(_ context.Context, _ uuid.UUID) (*Settings, error) {
					return nil, tt.serviceErr
				},
			}, nil, nil)

			req := authenticatedRequest(httptest.NewRequest(http.MethodGet, "/api/settings", nil))
			rr := httptest.NewRecorder()

			handlers.GetSettings(rr, req)

			if rr.Code != tt.wantStatus {
				t.Fatalf("expected status %d, got %d", tt.wantStatus, rr.Code)
			}

			response := decodeErrorResponse(t, rr)
			if response.Error != tt.wantError {
				t.Fatalf("expected error %q, got %q", tt.wantError, response.Error)
			}
		})
	}
}

func TestUpdateSettings_ErrorStatusMapping(t *testing.T) {
	tests := []struct {
		name       string
		serviceErr error
		wantStatus int
		wantError  string
	}{
		{
			name:       "returns 400 for typed validation errors",
			serviceErr: newValidationError("pauseMultipliers.comma must be between 1.0 and 5.0"),
			wantStatus: http.StatusBadRequest,
			wantError:  "pauseMultipliers.comma must be between 1.0 and 5.0",
		},
		{
			name:       "returns 404 for user not found",
			serviceErr: ErrUserNotFound,
			wantStatus: http.StatusNotFound,
			wantError:  "user not found",
		},
		{
			name:       "returns 500 for unexpected errors",
			serviceErr: errors.New("write failed"),
			wantStatus: http.StatusInternalServerError,
			wantError:  "failed to update settings",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			handlers := NewHandlers(&fakeSettingsService{
				updateSettingsFn: func(_ context.Context, _ uuid.UUID, _ *UpdateSettingsRequest) (*Settings, error) {
					return nil, tt.serviceErr
				},
			}, nil, nil)

			req := authenticatedRequest(httptest.NewRequest(http.MethodPut, "/api/settings", bytes.NewBufferString(`{"defaultWpm":300}`)))
			rr := httptest.NewRecorder()

			handlers.UpdateSettings(rr, req)

			if rr.Code != tt.wantStatus {
				t.Fatalf("expected status %d, got %d", tt.wantStatus, rr.Code)
			}

			response := decodeErrorResponse(t, rr)
			if response.Error != tt.wantError {
				t.Fatalf("expected error %q, got %q", tt.wantError, response.Error)
			}
		})
	}
}
