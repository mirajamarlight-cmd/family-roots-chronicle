import { compare, hash } from "bcryptjs";

/** Supabase GoTrue stores bcrypt hashes; verify with the same algorithm. */
export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return compare(password, passwordHash);
}

export async function hashPassword(password: string): Promise<string> {
  // Cost 10 matches common GoTrue defaults; raise later if needed.
  return hash(password, 10);
}
