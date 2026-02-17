// src/utils/auth.js
export function saveToken(token) {
  localStorage.setItem("access_token", token);
}

export function loadToken() {
  return localStorage.getItem("access_token") || "";
}

export function clearToken() {
  localStorage.removeItem("access_token");
}

export function getPayload(token) {
  try {
    const [, payloadB64] = token.split(".");
    return JSON.parse(atob(payloadB64));
  } catch {
    return {};
  }
}

export function routeAfterLogin(token) {
  const p = getPayload(token);
  // backend puts role as either string or enum.value
  const role = (p.role || "").toString().toUpperCase();

  switch (role) {
    case "ADMIN":
      return "/admin";
    case "ANALYST":
    case "OFFICER":
      return "/analyst";
    case "CUSTOMER":
    default:
      return "/customer";
  }
}
