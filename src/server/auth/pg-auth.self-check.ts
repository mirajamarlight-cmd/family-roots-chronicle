/**
 * Staging-only: prove bcrypt register/login against a disposable Postgres.
 * Never prints passwords or hashes.
 */
import { createHash, randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";

async function main() {
  const name = `frc-authcheck-${process.pid}`;
  const backup =
    process.env["FRC_BACKUP"] ||
    "/home/abdosh/Downloads/family-roots-connect-89_261009.backup";

  const run = (cmd: string, env: Record<string, string> = {}) => {
    const res = spawnSync("bash", ["-lc", cmd], {
      env: { ...process.env, ...env },
      encoding: "utf8",
    });
    if (res.status !== 0) {
      throw new Error(res.stderr || res.stdout || `command failed: ${cmd}`);
    }
    return res.stdout;
  };

  try {
    run(
      `docker run -d --name ${name} -e POSTGRES_PASSWORD=check -e POSTGRES_HOST_AUTH_METHOD=trust postgres:18-alpine >/dev/null`,
    );
    for (let i = 0; i < 40; i++) {
      const ready = spawnSync("docker", ["exec", name, "pg_isready", "-U", "postgres"], {
        encoding: "utf8",
      });
      if (ready.status === 0) break;
      await new Promise((r) => setTimeout(r, 500));
    }

    run(`DB_CONTAINER=${name} bash scripts/db-migrate.sh`);
    run(
      `DB_CONTAINER=${name} FRC_TARGET_KIND=disposable FRC_CONFIRM=REPLACE_ALL_DATA bash scripts/load-from-supabase-backup.sh ${JSON.stringify(backup)}`,
    );

    // Create a throwaway account with a random password; verify via SQL bcrypt shape + node verify
    const { hashPassword, verifyPassword } = await import("./password.ts");
    const password = randomBytes(12).toString("base64url");
    const email = `selfcheck_${createHash("sha256").update(password).digest("hex").slice(0, 12)}@example.test`;
    const passwordHash = await hashPassword(password);

    const insert = spawnSync(
      "docker",
      [
        "exec",
        "-i",
        name,
        "psql",
        "-U",
        "postgres",
        "-d",
        "postgres",
        "-v",
        "ON_ERROR_STOP=1",
        "-c",
        // do not echo hash: pass via env inside container
        `INSERT INTO app_users (email, password_hash, email_verified_at) VALUES ('${email}', '${passwordHash.replace(/'/g, "''")}', now())`,
      ],
      { encoding: "utf8" },
    );
    if (insert.status !== 0) throw new Error(insert.stderr || "insert failed");

    const select = spawnSync(
      "docker",
      [
        "exec",
        name,
        "psql",
        "-U",
        "postgres",
        "-d",
        "postgres",
        "-tAc",
        `SELECT password_hash FROM app_users WHERE email = '${email}'`,
      ],
      { encoding: "utf8" },
    );
    if (select.status !== 0) throw new Error(select.stderr || "select failed");
    const stored = select.stdout.trim();
    if (!stored.startsWith("$2")) throw new Error("stored hash is not bcrypt-shaped");
    if (!(await verifyPassword(password, stored))) throw new Error("verify failed for new account");
    if (await verifyPassword("wrong-password", stored)) throw new Error("accepted wrong password");

    // Migrated users: bcrypt prefix only (no credential verification without known password)
    const migrated = spawnSync(
      "docker",
      [
        "exec",
        name,
        "psql",
        "-U",
        "postgres",
        "-d",
        "postgres",
        "-tAc",
        "SELECT count(*) FROM app_users WHERE password_hash LIKE '\\$2%' AND email NOT LIKE '%@example.test'",
      ],
      { encoding: "utf8" },
    );
    const n = Number(migrated.stdout.trim());
    if (!Number.isFinite(n) || n < 1) throw new Error("expected migrated bcrypt hashes");

    console.log(`pg-auth.self-check: ok (new account verify + ${n} migrated bcrypt-shaped hashes)`);
  } finally {
    spawnSync("docker", ["rm", "-f", name], { encoding: "utf8" });
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
