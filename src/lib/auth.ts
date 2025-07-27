import { getCloudflareContext } from "@opennextjs/cloudflare";

interface CachedPasswordCheck {
  hash: string;
  timestamp: number;
  isValid: boolean;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const passwordCache = new Map<string, CachedPasswordCheck>();

/**
 * Optimized password verification with caching
 * Reduces bcrypt CPU usage by caching recent password checks
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const cacheKey = `${password}:${hash}`;
  const cached = passwordCache.get(cacheKey);
  
  // Check cache first
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    return cached.isValid;
  }
  
  // Use lighter hash comparison for frequently accessed passwords
  const bcrypt = await import("bcryptjs");
  const isValid = await bcrypt.compare(password, hash);
  
  // Cache the result
  passwordCache.set(cacheKey, {
    hash,
    timestamp: Date.now(),
    isValid
  });
  
  // Clean old cache entries periodically
  if (passwordCache.size > 100) {
    const now = Date.now();
    for (const [key, value] of passwordCache.entries()) {
      if (now - value.timestamp > CACHE_TTL) {
        passwordCache.delete(key);
      }
    }
  }
  
  return isValid;
}

/**
 * Lightweight password hashing for new passwords
 * Uses lower salt rounds to reduce CPU usage
 */
export async function hashPassword(password: string): Promise<string> {
  const bcrypt = await import("bcryptjs");
  // Reduced from default 10 to 8 rounds to save CPU time
  return bcrypt.hash(password, 8);
}

/**
 * Simple password validation
 */
export function validatePassword(password: string): boolean {
  return Boolean(password && password.length >= 4);
}

/**
 * Extract password from Authorization header
 */
export function getPasswordFromAuth(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.substring(7);
}