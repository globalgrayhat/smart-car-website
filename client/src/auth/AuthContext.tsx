// src/auth/AuthContext.tsx
import React, {
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

  // load from storage
  useEffect(() => {
    const token = localStorage.getItem("token");
    const userRaw = localStorage.getItem("user");
    if (token && userRaw) {
      setApiToken(token);
      try {
        setUser(JSON.parse(userRaw));
      } catch {
        setUser(null);
      }
    }
    setLoading(false);

    // لو أي ريكوست عطانا 401 من api.ts
    const handler = () => {
      setApiToken(null);
      setUser(null);
    };
    window.addEventListener("app:unauthorized", handler);
    return () => window.removeEventListener("app:unauthorized", handler);
  }, []);

  const login = async (email: string, password: string) => {
    // POST /api/auth/login
    const res = await api.post<{
      access_token: string;
      user: User;
    }>("/api/auth/login", { email, password });

    // نحفظ التوكن
    setApiToken(res.access_token);
    setUser(res.user);
    localStorage.setItem("user", JSON.stringify(res.user));
  };

  const logout = () => {
    setApiToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
