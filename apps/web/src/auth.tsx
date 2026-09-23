import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AuthUser, ModulePermissions } from "@sharnam/shared";
import { api } from "./api";

type AuthState = {
  token: string | null;
  user: AuthUser | null;
  permissions: ModulePermissions | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithToken: (token: string, user: AuthUser) => void;
  logout: () => void;
  refresh: () => Promise<void>;
  /** Admin test mode — open another user's desk, then hand the session back. */
  impersonate: (userId: string) => Promise<{ user: AuthUser; landingPath: string }>;
  stopImpersonation: () => Promise<AuthUser>;
};

const AuthCtx = createContext<AuthState | null>(null);

const TOKEN_KEY = "sharnam_token";

function readStoredToken(): string | null {
  try {
    const session = sessionStorage.getItem(TOKEN_KEY);
    if (session) return session;
    const legacy = localStorage.getItem(TOKEN_KEY);
    if (legacy) {
      sessionStorage.setItem(TOKEN_KEY, legacy);
      localStorage.removeItem(TOKEN_KEY);
    }
    return legacy;
  } catch {
    return localStorage.getItem(TOKEN_KEY);
  }
}

function persistToken(next: string | null) {
  try {
    if (next) sessionStorage.setItem(TOKEN_KEY, next);
    else sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    if (next) localStorage.setItem(TOKEN_KEY, next);
    else localStorage.removeItem(TOKEN_KEY);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => readStoredToken());
  const setToken = (next: string | null) => {
    persistToken(next);
    setTokenState(next);
  };
  const [user, setUser] = useState<AuthUser | null>(null);
  const [permissions, setPermissions] = useState<ModulePermissions | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    if (!token) {
      setUser(null);
      setPermissions(null);
      setLoading(false);
      return;
    }
    try {
      const data = await api<{ user: AuthUser; permissions: ModulePermissions }>("/api/auth/me", { token });
      setUser(data.user);
      setPermissions(data.permissions);
    } catch {
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, [token]);

  const value = useMemo<AuthState>(
    () => ({
      token,
      user,
      permissions,
      loading,
      login: async (email, password) => {
        const data = await api<{ token: string; user: AuthUser }>("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
        setToken(data.token);
        setUser(data.user);
      },
      loginWithToken: (nextToken, nextUser) => {
        setToken(nextToken);
        setUser(nextUser);
      },
      logout: () => {
        setToken(null);
        setUser(null);
        setPermissions(null);
      },
      impersonate: async (userId) => {
        const data = await api<{ token: string; user: AuthUser; landingPath: string }>("/api/auth/impersonate", {
          method: "POST",
          token,
          body: JSON.stringify({ userId }),
        });
        setToken(data.token);
        setUser(data.user);
        return { user: data.user, landingPath: data.landingPath || "/dashboard" };
      },
      stopImpersonation: async () => {
        const data = await api<{ token: string; user: AuthUser }>("/api/auth/impersonate/stop", {
          method: "POST",
          token,
        });
        setToken(data.token);
        setUser(data.user);
        return data.user;
      },
      refresh,
    }),
    [token, user, permissions, loading],
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth outside provider");
  return ctx;
}
