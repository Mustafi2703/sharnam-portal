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
};

const AuthCtx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("sharnam_token"));
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
      localStorage.removeItem("sharnam_token");
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
        localStorage.setItem("sharnam_token", data.token);
        setToken(data.token);
        setUser(data.user);
      },
      loginWithToken: (nextToken, nextUser) => {
        localStorage.setItem("sharnam_token", nextToken);
        setToken(nextToken);
        setUser(nextUser);
      },
      logout: () => {
        localStorage.removeItem("sharnam_token");
        setToken(null);
        setUser(null);
      },
      refresh,
    }),
    [token, user, permissions, loading]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth outside provider");
  return ctx;
}
