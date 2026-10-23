import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { setOnUnauthorized, setToken } from "./api";

const KEY = "miniledger_token";

interface AuthState {
  token: string | null;
  loading: boolean;
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>(null as unknown as AuthState);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const signOut = useCallback(async () => {
    setToken(null);
    setTokenState(null);
    await AsyncStorage.removeItem(KEY);
  }, []);

  const signIn = useCallback(async (t: string) => {
    setToken(t);
    setTokenState(t);
    await AsyncStorage.setItem(KEY, t);
  }, []);

  useEffect(() => {
    setOnUnauthorized(() => { signOut(); }); // expired JWT -> back to login
    AsyncStorage.getItem(KEY).then((t) => {
      if (t) { setToken(t); setTokenState(t); }
      setLoading(false);
    });
  }, [signOut]);

  return <AuthContext.Provider value={{ token, loading, signIn, signOut }}>{children}</AuthContext.Provider>;
}
