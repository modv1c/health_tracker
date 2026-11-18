import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, ApiError, setUnauthorizedHandler, tokenStore } from "../api/client";
import type { User } from "../api/types";

interface AuthState {
  user: User | null;
  loading: boolean;
  sessionExpired: boolean;
  startupError: string | null;
  retry: () => void;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  const [startupError, setStartupError] = useState<string | null>(null);

  // При старте: если в браузере лежит токен — проверяем его через /auth/me.
  // Токен стираем только при 401 (он реально невалиден). Если сервер просто
  // не отвечает — оставляем токен и показываем экран с кнопкой "Повторить".
  const checkSession = useCallback(async () => {
    if (!tokenStore.get()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setStartupError(null);
    try {
      setUser(await api.me());
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) tokenStore.clear();
      else setStartupError(err instanceof Error ? err.message : "Сервер недоступен");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void checkSession(); }, [checkSession]);

  // Любой 401 (токен истёк или пользователь удалён) — выходим из аккаунта
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      setSessionExpired(true);
    });
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const { access_token } = await api.login(username, password);
    tokenStore.set(access_token);
    setUser(await api.me());
    setSessionExpired(false);
  }, []);

  const register = useCallback(async (username: string, email: string, password: string) => {
    await api.register({ username, email, password });
    await login(username, password);
  }, [login]);

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, sessionExpired, startupError, retry: () => void checkSession(), login, register, logout, setUser }),
    [user, loading, sessionExpired, startupError, checkSession, login, register, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth должен использоваться внутри AuthProvider");
  return ctx;
}
