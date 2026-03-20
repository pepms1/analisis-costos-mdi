import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { apiRequest } from "../api/client";
import { getRolePermissions, hasAllPermissions, hasAnyPermission, hasPermission } from "../utils/permissions";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("auth_token");

    if (!token) {
      setIsLoading(false);
      return;
    }

    apiRequest("/auth/me")
      .then((data) => {
        const nextUser = data.user;
        setUser({
          ...nextUser,
          permissions: nextUser.permissions || getRolePermissions(nextUser.role),
        });
      })
      .catch(() => {
        localStorage.removeItem("auth_token");
        setUser(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated: Boolean(user),
      hasPermission: (permission) => hasPermission(user, permission),
      hasAnyPermission: (permissions) => hasAnyPermission(user, permissions),
      hasAllPermissions: (permissions) => hasAllPermissions(user, permissions),
      async login(credentials) {
        const data = await apiRequest("/auth/login", {
          method: "POST",
          body: JSON.stringify(credentials),
        });

        localStorage.setItem("auth_token", data.token);
        setUser({
          ...data.user,
          permissions: data.user.permissions || getRolePermissions(data.user.role),
        });
        return data.user;
      },
      logout() {
        localStorage.removeItem("auth_token");
        setUser(null);
      },
    }),
    [isLoading, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
