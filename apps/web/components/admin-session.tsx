"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { AuthSession } from "../lib/auth";

const AdminSessionContext = createContext<AuthSession | null>(null);

export function AdminSessionProvider({
  session,
  children,
}: {
  session: AuthSession;
  children: ReactNode;
}) {
  return <AdminSessionContext.Provider value={session}>{children}</AdminSessionContext.Provider>;
}

export function useAdminSession(): AuthSession {
  const session = useContext(AdminSessionContext);
  if (!session) throw new Error("Admin session is unavailable.");
  return session;
}
