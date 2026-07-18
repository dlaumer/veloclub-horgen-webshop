import React, { createContext, useContext, useState, ReactNode, useCallback } from "react";
import { AdminAuth, adminLogin, loadStoredAdminAuth, storeAdminAuth } from "@/lib/adminApi";

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
