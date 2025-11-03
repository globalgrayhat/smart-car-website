// src/auth/roles.ts

export type AppRole = "ADMIN" | "BROADCAST_MANAGER" | "VIEWER";

// admin كامل
export const isAdmin = (role?: string | null) => role === "ADMIN";

// مدير بث
export const isManager = (role?: string | null) =>
  role === "ADMIN" || role === "BROADCAST_MANAGER";

// مشاهد
export const isViewer = (role?: string | null) =>
  !role || role === "VIEWER";

// مين يقدر ينشر/يبث
export const canPublish = (role?: string | null) =>
  role === "ADMIN" || role === "BROADCAST_MANAGER";

// مين يشوف صفحات الأدمن
export const canSeeAdminPages = (role?: string | null) =>
  role === "ADMIN" || role === "BROADCAST_MANAGER";

// مين يتحكّم بالمركبة/الجهاز
export const canControlVehicle = (role?: string | null) =>
  role === "ADMIN" || role === "BROADCAST_MANAGER";
