import { API_URL } from "./config";
import { Loan, Summary } from "./types";

let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export const setToken = (t: string | null) => { authToken = t; };
export const setOnUnauthorized = (fn: () => void) => { onUnauthorized = fn; };

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { ...(options.headers as Record<string, string>) };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  // For FormData the runtime sets the multipart boundary itself, so only set JSON type for string bodies
  if (typeof options.body === "string") headers["Content-Type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...options, headers });
  } catch {
    throw new Error(`Cannot reach server at ${API_URL}`);
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && authToken && !path.startsWith("/auth")) onUnauthorized?.();
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as T;
}

export const api = {
  requestOtp: (phone: string) =>
    request<{ message: string }>("/auth/request-otp", { method: "POST", body: JSON.stringify({ phone }) }),
  verifyOtp: (phone: string, otp: string) =>
    request<{ token: string }>("/auth/verify-otp", { method: "POST", body: JSON.stringify({ phone, otp }) }),
  getLoans: () => request<Loan[]>("/loans"),
  getSummary: () => request<Summary>("/summary"),
  repay: (id: number) => request<Loan>(`/loans/${id}/repay`, { method: "PATCH" }),
  addLoan: (form: FormData) => request<Loan>("/loans", { method: "POST", body: form }),
};
