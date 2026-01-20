package auth

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

// GoogleUserInfo represents the user info returned by Google
type GoogleUserInfo struct {
	ID            string `json:"id"`
	Email         string `json:"email"`
	VerifiedEmail bool   `json:"verified_email"`
	Name          string `json:"name"`
	GivenName     string `json:"given_name"`
	FamilyName    string `json:"family_name"`
	Picture       string `json:"picture"`
}

// GoogleOAuth handles Google OAuth2 operations
type GoogleOAuth struct {
	config *oauth2.Config
}

// NewGoogleOAuth creates a new Google OAuth client
func NewGoogleOAuth(clientID, clientSecret, redirectURL string) *GoogleOAuth {
	return &GoogleOAuth{
		config: &oauth2.Config{
			ClientID:     clientID,
			ClientSecret: clientSecret,
			RedirectURL:  redirectURL,
			Scopes: []string{
				"https://www.googleapis.com/auth/userinfo.email",
				"https://www.googleapis.com/auth/userinfo.profile",
			},
			Endpoint: google.Endpoint,
		},
	}
}

// GetAuthURL returns the URL for the OAuth consent screen
func (g *GoogleOAuth) GetAuthURL(state string) string {
	return g.config.AuthCodeURL(state, oauth2.AccessTypeOffline)
}

// GetExtensionAuthURL returns the URL for the OAuth consent screen for Chrome extensions
// This uses a different redirect URL that points to the extension callback endpoint
func (g *GoogleOAuth) GetExtensionAuthURL(state string) string {
	// Create a copy of config with extension-specific redirect URL
	extConfig := &oauth2.Config{
		ClientID:     g.config.ClientID,
		ClientSecret: g.config.ClientSecret,
		RedirectURL:  g.getExtensionRedirectURL(),
		Scopes:       g.config.Scopes,
		Endpoint:     g.config.Endpoint,
	}
	return extConfig.AuthCodeURL(state, oauth2.AccessTypeOffline)
}

// getExtensionRedirectURL extracts the base URL and creates the extension callback URL
func (g *GoogleOAuth) getExtensionRedirectURL() string {
	// The original redirect URL is like: http://localhost:8080/api/auth/google/callback
	// We need: http://localhost:8080/api/auth/extension/google/callback
	// Simple string replacement
	return g.config.RedirectURL[:len(g.config.RedirectURL)-len("/google/callback")] + "/extension/google/callback"
}

// ExchangeCode exchanges an authorization code for tokens
func (g *GoogleOAuth) ExchangeCode(ctx context.Context, code string) (*oauth2.Token, error) {
	token, err := g.config.Exchange(ctx, code)
	if err != nil {
		return nil, fmt.Errorf("failed to exchange code: %w", err)
	}
	return token, nil
}

// ExchangeCodeForExtension exchanges an authorization code for tokens using the extension redirect URL
func (g *GoogleOAuth) ExchangeCodeForExtension(ctx context.Context, code string) (*oauth2.Token, error) {
	// Create a copy of config with extension-specific redirect URL
	extConfig := &oauth2.Config{
		ClientID:     g.config.ClientID,
		ClientSecret: g.config.ClientSecret,
		RedirectURL:  g.getExtensionRedirectURL(),
		Scopes:       g.config.Scopes,
		Endpoint:     g.config.Endpoint,
	}
	token, err := extConfig.Exchange(ctx, code)
	if err != nil {
		return nil, fmt.Errorf("failed to exchange code: %w", err)
	}
	return token, nil
}

// GetUserInfo fetches the user's profile information from Google
func (g *GoogleOAuth) GetUserInfo(ctx context.Context, token *oauth2.Token) (*GoogleUserInfo, error) {
	client := g.config.Client(ctx, token)

	resp, err := client.Get("https://www.googleapis.com/oauth2/v2/userinfo")
	if err != nil {
		return nil, fmt.Errorf("failed to fetch user info: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to fetch user info: status %d", resp.StatusCode)
	}

	var userInfo GoogleUserInfo
	if err := json.NewDecoder(resp.Body).Decode(&userInfo); err != nil {
		return nil, fmt.Errorf("failed to decode user info: %w", err)
	}

	return &userInfo, nil
}

// ToCreateOAuthUserParams converts Google user info to OAuth params
func (g *GoogleUserInfo) ToCreateOAuthUserParams() *CreateOAuthUserParams {
	return &CreateOAuthUserParams{
		Email:     g.Email,
		GoogleID:  g.ID,
		Name:      g.Name,
		AvatarURL: g.Picture,
	}
}
