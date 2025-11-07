// client/src/auth/roles.ts
// Simple role helpers.

export type AppRole = "ADMIN" | "BROADCAST_MANAGER" | "VIEWER";

export const isAdmin = (role?: string | null) => role === "ADMIN";

export const isManager = (role?: string | null) =>
  role === "ADMIN" || role === "BROADCAST_MANAGER";

export const isViewer = (role?: string | null) =>
  !role || role === "VIEWER";

export const canPublish = (role?: string | null) =>
  role === "ADMIN" || role === "BROADCAST_MANAGER";

export const canSeeAdminPages = (role?: string | null) =>
  role === "ADMIN" || role === "BROADCAST_MANAGER";

export const canControlVehicle = (role?: string | null) =>
  role === "ADMIN" || role === "BROADCAST_MANAGER";
