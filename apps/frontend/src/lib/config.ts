export const BACKEND_URL = process.env.BUN_PUBLIC_BACKEND_URL ?? "http://localhost:3001";
export const BACKEND_WS_URL = BACKEND_URL.replace(/^http/, "ws");