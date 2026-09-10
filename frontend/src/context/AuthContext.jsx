import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  getStoredToken,
  setStoredToken,
  login as apiLogin,
  signup as apiSignup,
  loginWithGoogle as apiLoginWithGoogle,
} from '../lib/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => getStoredToken());
  const [user, setUser] = useState(null);

  useEffect(() => {
    setStoredToken(token);
  }, [token]);

  const login = useCallback(async (email, password) => {
    const data = await apiLogin({ email, password });
    setToken(data.token);
    setUser(data.user);
    return data;
  }, []);

  const loginWithGoogle = useCallback(async (idToken) => {
    const data = await apiLoginWithGoogle(idToken);
    setToken(data.token);
    setUser(data.user);
    return data;
  }, []);

  const signup = useCallback(
    async (email, password, tenantName) => {
      await apiSignup({ email, password, tenantName });
      return login(email, password);
    },
    [login]
  );

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ token, user, login, loginWithGoogle, signup, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
