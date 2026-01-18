import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, LogIn, LogOut, ChevronDown } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function UserMenu() {
  const { user, isLoading, login, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside - uses document listener to work across stacking contexts
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  if (isLoading) {
    return (
      <div className="w-8 h-8 rounded-full bg-bg-surface animate-pulse" />
    );
  }

  if (!user) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={login}
        className="gap-2"
      >
        <LogIn className="w-4 h-4" />
        Sign In
      </Button>
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg transition-colors",
          "hover:bg-bg-elevated focus:outline-none focus:ring-2 focus:ring-amber-400/30",
          isOpen && "bg-bg-elevated"
        )}
      >
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={user.name}
            className="w-8 h-8 rounded-full ring-2 ring-amber-400/30"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-amber-400/20 flex items-center justify-center">
            <User className="w-4 h-4 text-amber-400" />
          </div>
        )}
        <div className="hidden sm:block text-left">
          <div className="text-sm font-medium text-text-primary truncate max-w-[120px]">
            {user.name}
          </div>
          {user.isGuest && (
            <div className="text-xs text-amber-400/80">Guest</div>
          )}
        </div>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-text-tertiary transition-transform",
            isOpen && "rotate-180"
          )}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full mt-2 w-64 z-50 bg-bg-elevated border border-border rounded-lg shadow-xl shadow-black/30 overflow-hidden"
            >
              <div className="p-4 border-b border-border">
                <div className="flex items-center gap-3">
                  {user.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.name}
                      className="w-12 h-12 rounded-full ring-2 ring-amber-400/30"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-amber-400/20 flex items-center justify-center">
                      <User className="w-6 h-6 text-amber-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-text-primary truncate">
                      {user.name}
                    </div>
                    {user.email && (
                      <div className="text-sm text-text-secondary truncate">
                        {user.email}
                      </div>
                    )}
                    {user.isGuest && (
                      <div className="text-xs text-amber-400 mt-0.5">
                        Guest Account
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-2">
                {user.isGuest ? (
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      login();
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-bg-surface transition-colors group cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-full bg-amber-400/10 flex items-center justify-center group-hover:bg-amber-400/20 transition-colors">
                      <LogIn className="w-4 h-4 text-amber-400" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-text-primary">
                        Sign in with Google
                      </div>
                      <div className="text-xs text-text-secondary">
                        Keep your documents forever
                      </div>
                    </div>
                  </button>
                ) : (
                  <button
                    onClick={async () => {
                      setIsOpen(false);
                      await logout();
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-bg-surface transition-colors group cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-full bg-bg-surface flex items-center justify-center group-hover:bg-destructive/10 transition-colors">
                      <LogOut className="w-4 h-4 text-text-tertiary group-hover:text-destructive transition-colors" />
                    </div>
                    <div className="text-sm text-text-primary group-hover:text-destructive transition-colors">
                      Sign out
                    </div>
                  </button>
                )}
              </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
