import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getGetHistoryQueryKey } from '@workspace/api-client-react';

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function readResponse(response: Response): Promise<{ user?: AuthUser; error?: string }> {
  return response.json().catch(() => ({}));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const userRef = useRef<AuthUser | null>(null);

  const updateUser = useCallback(
    (nextUser: AuthUser | null) => {
      if (userRef.current?.id !== nextUser?.id) {
        queryClient.removeQueries({ queryKey: getGetHistoryQueryKey() });
      }
      userRef.current = nextUser;
      setUser(nextUser);
    },
    [queryClient],
  );

  useEffect(() => {
    let active = true;

    void fetch('/api/auth/me', { credentials: 'include', cache: 'no-store' })
      .then(async (response) => {
        if (!active) return;
        if (!response.ok) {
          updateUser(null);
          return;
        }
        const data = await readResponse(response);
        updateUser(data.user ?? null);
      })
      .catch(() => {
        if (active) updateUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [updateUser]);

  const authenticate = useCallback(
    async (path: string, body: Record<string, string>) => {
      const response = await fetch(path, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await readResponse(response);
      if (!response.ok || !data.user) {
        throw new Error(data.error ?? 'Authentication failed. Please try again.');
      }
      updateUser(data.user);
    },
    [updateUser],
  );

  const signIn = useCallback(
    (email: string, password: string) =>
      authenticate('/api/auth/login', { email, password }),
    [authenticate],
  );
  const register = useCallback(
    (name: string, email: string, password: string) =>
      authenticate('/api/auth/register', { name, email, password }),
    [authenticate],
  );
  const logout = useCallback(async () => {
    const response = await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
    if (!response.ok) {
      throw new Error('Unable to sign out. Please try again.');
    }
    updateUser(null);
  }, [updateUser]);

  const value = useMemo(
    () => ({ user, loading, signIn, register, logout }),
    [user, loading, signIn, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider.');
  }
  return context;
}
