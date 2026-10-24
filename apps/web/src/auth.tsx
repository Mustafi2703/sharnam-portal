import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { AuthUser, ModulePermissions } from "@sharnam/shared";
import { api, ApiError, SESSION_REJECTED_EVENT } from "./api";

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

/** Tool windows hold their own copy of the token; logging out in one window ends that same session in all of them. */
const AUTH_CHANNEL = "sharnam-auth";

/** Identifies a session without sending the token itself: the tail of the JWT signature. */
function tokenFingerprint(token: string | null | undefined) {
  return token ? token.split(".").pop()?.slice(-24) || "" : "";
}

function openAuthChannel(): BroadcastChannel | null {
  try {
    return typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(AUTH_CHANNEL);
  } catch {
    return null;
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
  const tokenRef = useRef(token);
  tokenRef.current = token;

  const endSession = (broadcast: boolean) => {
    const ended = tokenRef.current;
    setToken(null);
    setUser(null);
    setPermissions(null);
    if (broadcast && ended) {
      const channel = openAuthChannel();
      channel?.postMessage({ type: "logout", session: tokenFingerprint(ended) });
      channel?.close();
    }
  };

  const refresh = async () => {
    const forToken = token;
    if (!forToken) {
      setUser(null);
      setPermissions(null);
      setLoading(false);
      return;
    }
    for (let attempt = 0; ; attempt++) {
      try {
        const data = await api<{ user: AuthUser; permissions: ModulePermissions }>("/api/auth/me", { token: forToken });
        if (tokenRef.current !== forToken) return;
        setUser(data.user);
        setPermissions(data.permissions);
        break;
      } catch (err) {
        if (tokenRef.current !== forToken) return;
        const status = err instanceof ApiError ? err.status : 0;
        // A rejected token or a removed account ends the session; a network or database blip does not.
        const rejected = status === 401 || status === 403 || status === 404;
        if (rejected || attempt >= 2) {
          if (rejected) setToken(null);
          setUser(null);
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    void refresh();
  }, [token]);

  useEffect(() => {
    // The API turned this session's token away (expired, deactivated, role changed): sign out here too.
    const onRejected = (event: Event) => {
      const rejectedToken = (event as CustomEvent<{ token?: string }>).detail?.token;
      if (rejectedToken && rejectedToken === tokenRef.current) endSession(true);
    };
    window.addEventListener(SESSION_REJECTED_EVENT, onRejected);
    const channel = openAuthChannel();
    if (channel) {
      channel.onmessage = (event: MessageEvent<{ type?: string; session?: string }>) => {
        const current = tokenFingerprint(tokenRef.current);
        if (event.data?.type === "logout" && current && event.data.session === current) endSession(false);
      };
    }
    return () => {
      window.removeEventListener(SESSION_REJECTED_EVENT, onRejected);
      channel?.close();
    };
  }, []);

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
        endSession(true);
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
