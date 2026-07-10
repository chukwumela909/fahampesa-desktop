import { auth } from "@/lib/firebase";

// API base. Configurable at build time via VITE_API_BASE_URL (e.g. the deployed
// backend for distributable builds); falls back to the local backend for dev.
// The backend enables permissive CORS (app.use(cors())), so plain fetch works from
// both the Vite dev server and the Tauri webview — no Tauri HTTP plugin required.
const ENV_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
export const BACKEND_API_BASE_URL = ENV_BASE && ENV_BASE.length > 0 ? ENV_BASE : "http://localhost:4000/api/v1";

export class BackendApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "BackendApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function isBackendApiError(error: unknown): error is BackendApiError {
  return error instanceof BackendApiError;
}

interface ApiEnvelope<T> {
  data: T;
}

interface ApiErrorEnvelope {
  error?: { code?: string; message?: string; details?: unknown };
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  /** Set false for public endpoints (no Authorization header). Defaults to true. */
  auth?: boolean;
  signal?: AbortSignal;
  /** Sets the `Idempotency-Key` header so safe retries of queued writes don't duplicate. */
  idempotencyKey?: string;
}

async function currentToken(): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken();
}

/** Call the backend, attaching the Firebase ID token and unwrapping the `{ data }` envelope. */
export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, auth: useAuth = true, signal, idempotencyKey } = options;
  const token = useAuth ? await currentToken() : null;

  const response = await fetch(`${BACKEND_API_BASE_URL}${path}`, {
    method,
    signal,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const parsed = (await response.json().catch(() => null)) as ApiEnvelope<T> | ApiErrorEnvelope | null;

  if (!response.ok) {
    const error = (parsed as ApiErrorEnvelope | null)?.error;
    throw new BackendApiError(response.status, error?.code || `http_${response.status}`, error?.message || "Request failed", error?.details);
  }

  if (parsed && typeof parsed === "object" && "data" in parsed) {
    return (parsed as ApiEnvelope<T>).data;
  }
  return parsed as T;
}

// ---- Session / auth ----

export interface BackendOnboardingStatus {
  completed: boolean;
  skipped: boolean;
  hasBusiness: boolean;
  businessAccountId: string | null;
  status: string;
}

export interface BackendSession {
  auth: { firebaseUid: string; email?: string; phone?: string; name?: string; platformRole?: string };
  userId: string;
  businessAccountId?: string | null;
  role?: "owner" | "admin" | "manager" | "cashier" | string;
  assignedBranchIds: string[];
  accountStatus?: string;
  planTier?: string;
  subscriptionStatus?: string;
  subscriptionEndsAt?: string | null;
  onboardingStatus: BackendOnboardingStatus;
}

export function getMe() {
  return api<BackendSession>("/me");
}

export interface UploadedAsset {
  url: string;
  storagePath?: string;
  contentType?: string;
  size?: number;
}

/** Upload a product image (multipart) and return its hosted URL. Requires auth + connectivity. */
export async function uploadProductImage(file: File, signal?: AbortSignal): Promise<UploadedAsset> {
  const token = await currentToken();
  const form = new FormData();
  form.append("image", file); // backend field name is `image`
  const response = await fetch(`${BACKEND_API_BASE_URL}/assets/product-images`, {
    method: "POST",
    signal,
    // No Content-Type — the browser sets the multipart boundary.
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
  });
  const parsed = (await response.json().catch(() => null)) as ApiEnvelope<UploadedAsset> | ApiErrorEnvelope | null;
  if (!response.ok) {
    const error = (parsed as ApiErrorEnvelope | null)?.error;
    throw new BackendApiError(response.status, error?.code || `http_${response.status}`, error?.message || "Image upload failed", error?.details);
  }
  return (parsed as ApiEnvelope<UploadedAsset>).data;
}

/** Lightweight reachability check against the public health endpoint. */
export async function checkHealth(signal?: AbortSignal): Promise<boolean> {
  try {
    const response = await fetch(`${BACKEND_API_BASE_URL}/health`, { signal });
    return response.ok;
  } catch {
    return false;
  }
}
