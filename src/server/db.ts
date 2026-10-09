import postgres, { type Sql, type TransactionSql } from "postgres";

/**
 * Server-only Postgres client. Never import from client components.
 * When DATABASE_URL is unset, callers should keep using the Supabase path.
 */
let _sql: Sql | undefined;

export function hasDatabaseUrl(): boolean {
  return Boolean(process.env["DATABASE_URL"]);
}

export function sql(): Sql {
  const url = process.env["DATABASE_URL"];
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  if (!_sql) {
    _sql = postgres(url, {
      max: 10,
      // ponytail: idle timeout fine for Coolify single instance; pooler later if needed.
      idle_timeout: 20,
      prepare: false,
    });
  }
  return _sql;
}

/** Set transaction-local actor for portable SQL triggers/functions. */
export async function withAppUser<T>(
  userId: string | null,
  fn: (tx: TransactionSql) => Promise<T>,
): Promise<T> {
  return sql().begin(async (tx) => {
    if (userId) {
      await tx`SELECT set_config('app.user_id', ${userId}, true)`;
    }
    return fn(tx);
  }) as Promise<T>;
}
