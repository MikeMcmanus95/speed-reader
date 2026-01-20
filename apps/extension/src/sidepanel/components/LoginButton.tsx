import { useState } from 'react';
import { LogIn, LogOut, User, Loader2 } from 'lucide-react';
import { Button } from '@speed-reader/ui';
import { useAuth } from '../../auth/AuthContext';

export function LoginButton() {
  const { isAuthenticated, isLoading, user, login, logout } = useAuth();
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      await login();
    } catch (error) {
      console.error('Login failed:', error);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  if (isLoading) {
    return (
      <Button variant="ghost" size="sm" disabled>
        <Loader2 className="w-4 h-4 animate-spin" />
      </Button>
    );
  }

  if (isAuthenticated && user) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 text-xs text-text-secondary">
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.name}
              className="w-5 h-5 rounded-full"
            />
          ) : (
            <User className="w-4 h-4" />
          )}
          <span className="max-w-20 truncate">{user.name}</span>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleLogout}
          title="Sign out"
        >
          <LogOut className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleLogin}
      disabled={isLoggingIn}
      className="gap-1.5"
    >
      {isLoggingIn ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <LogIn className="w-3.5 h-3.5" />
      )}
      Sign in
    </Button>
  );
}
