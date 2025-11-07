// client/src/auth/AuthContext.tsx
// Auth state provider: user + token + login/logout.

import React,
{
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api, setApiToken } from "../services/api";

type User = {
  id: number;
  username: string;
  email: string;
  role: string;
};

type AuthCtx = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthCtx>({} as AuthCtx);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const stored = localStorage.getItem("user");

    if (token && stored) {
      setApiToken(token);
      try {
        setUser(JSON.parse(stored));
      } catch {
        setUser(null);
      }
    }

    setLoading(false);

    const onUnauthorized = () => {
      setApiToken(null);
      setUser(null);
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    };

    window.addEventListener("app:unauthorized", onUnauthorized);
    return () =>
      window.removeEventListener("app:unauthorized", onUnauthorized);
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.post<{
      access_token: string;
      user: User;
    }>("/auth/login", { email, password });

    setApiToken(res.access_token);
    setUser(res.user);
    localStorage.setItem("token", res.access_token);
    localStorage.setItem("user", JSON.stringify(res.user));
  };

  const logout = () => {
    setApiToken(null);
    setUser(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
