// API client configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export class APIError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: any
  ) {
    super(message);
    this.name = "APIError";
  }
}

/**
 * Get Firebase ID token
 * This will be called by the app to set the token getter function
 */
let getIdTokenFn: (() => Promise<string | null>) | null = null;

export function setAuthTokenGetter(fn: () => Promise<string | null>) {
  getIdTokenFn = fn;
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  // Get Firebase ID token if available
  let idToken: string | null = null;
  if (getIdTokenFn) {
    try {
      idToken = await getIdTokenFn();
    } catch (error) {
      console.error("Failed to get auth token:", error);
    }
  }

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  // Add authentication header if token is available
  if (idToken) {
    headers["Authorization"] = `Bearer ${idToken}`;
  }
  
  const config: RequestInit = {
    ...options,
    headers,
  };

  try {
    const response = await fetch(url, config);

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { error: response.statusText };
      }

      throw new APIError(
        errorData.error || errorData.message || "Request failed",
        response.status,
        errorData.details
      );
    }

    // Handle empty responses (e.g., 204 No Content)
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      return await response.json();
    }

    return {} as T;
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }
    // Network or other errors
    throw new APIError(
      error instanceof Error ? error.message : "Network error",
      0
    );
  }
}
