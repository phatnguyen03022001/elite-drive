"use client";

import React, { createContext, useCallback, useContext, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authService } from "@/features/auth/auth.service";

interface AuthUser {
  id?: string;
  email?: string;
  role?: "ADMIN" | "OWNER" | "CUSTOMER";
  firstName?: string | null;
  lastName?: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["auth-profile"],
    queryFn: authService.getProfile,
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  const user = useMemo<AuthUser | null>(() => {
    if (!data || typeof data !== "object") return null;
    return data as AuthUser;
  }, [data]);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } finally {
      queryClient.clear();
      window.location.assign("/login");
    }
  }, [queryClient]);

  const contextValue = useMemo(
    () => ({
      user,
      isLoading: isLoading || isFetching,
      isAuthenticated: Boolean(user),
      logout,
    }),
    [user, isLoading, isFetching, logout],
  );

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuthContext must be used within AuthProvider");
  }
  return context;
};
