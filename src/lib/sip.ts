import { randomBytes } from "crypto";

/**
 * Generate a globally unique SIP username.
 * Format: t_{short-tenant-id}_{extension}
 * Example: t_a1b2c3_101
 */
export function generateSipUsername(tenantId: string, extension: string): string {
  const short = tenantId.replace(/-/g, "").slice(0, 8);
  return `t_${short}_${extension}`;
}

/**
 * Generate a secure random SIP password (16 chars, alphanumeric).
 */
export function generateSipPassword(): string {
  return randomBytes(12).toString("base64url").slice(0, 16);
}
