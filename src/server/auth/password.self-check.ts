import { hashPassword, verifyPassword } from "./password.ts";

async function main() {
  const password = "test-password-not-production";
  const hashed = await hashPassword(password);
  if (!(await verifyPassword(password, hashed))) {
    throw new Error("bcrypt round-trip failed");
  }
  if (await verifyPassword("wrong", hashed)) {
    throw new Error("bcrypt accepted wrong password");
  }
  // Supabase-style $2a$ sample shape (not a real user hash)
  if (!hashed.startsWith("$2")) {
    throw new Error("unexpected hash prefix");
  }
  console.log("password.self-check: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
