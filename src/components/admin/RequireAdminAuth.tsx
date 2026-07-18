import { Navigate } from "react-router-dom";
import { ReactNode } from "react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";

export const RequireAdminAuth = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated } = useAdminAuth();

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  return <>{children}</>;
};
