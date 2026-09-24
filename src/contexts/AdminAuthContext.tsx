import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect } from "react";
import { AdminAuth, adminLogin, loadStoredAdminAuth, storeAdminAuth, AUTH_EXPIRED_EVENT } from "@/lib/adminApi";

interface AdminAuthContextType {
  auth: AdminAuth | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export const AdminAuthProvider = ({ children }: { children: ReactNode }) => {
  const [auth, setAuth] = useState<AdminAuth | null>(() => loadStoredAdminAuth());

  const login = useCallback(async (email: string, password: string) => {
    const result = await adminLogin(email, password);
    storeAdminAuth(result);
    setAuth(result);
  }, []);

  const logout = useCallback(() => {
    storeAdminAuth(null);
    setAuth(null);
  }, []);

  // adminApi's pbFetch() dispatches this when a request comes back 401/403,
  // or when loadStoredAdminAuth() finds an already-expired token on load.
  // It already cleared localStorage - this just syncs the React state so
  // RequireAdminAuth immediately redirects to /admin/login instead of the
  // dashboard sitting there showing stale/empty data forever.
  useEffect(() => {
    const handleExpired = () => setAuth(null);
    window.addEventListener(AUTH_EXPIRED_EVENT, handleExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handleExpired);
  }, []);

  return (
    <AdminAuthContext.Provider value={{ auth, isAuthenticated: !!auth, login, logout }}>
      {children}
    </AdminAuthContext.Provider>
  );
};

export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);
  if (context === undefined) {
    throw new Error("useAdminAuth must be used within an AdminAuthProvider");
  }
  return context;
};
