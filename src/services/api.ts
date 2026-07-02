const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_PORTAL_API_URL ||
  "https://binaryguard-api-44d2u.ondigitalocean.app";

type ApiResult = {
  ok: boolean;
  success?: boolean;
  message?: string;
  expires_in_minutes?: number;
  tenant_id?: string;
  attempts_remaining?: number;
};

async function postJson(path: string, body: unknown): Promise<ApiResult> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const result = (await response.json()) as ApiResult;

  if (!response.ok || !result.ok) {
    throw new Error(result.message || "API request failed.");
  }

  return result;
}

export function requestOtp(email: string, purpose: "registration" | "login" = "registration") {
  return postJson("/api/otp/request", {
    email,
    purpose,
  });
}

export function verifyOtp(
  email: string,
  code: string,
  purpose: "registration" | "login" = "registration",
) {
  return postJson("/api/otp/verify", {
    email,
    code,
    purpose,
  });
}
