import { supabase } from "@/integrations/supabase/client";
import { dataBackend } from "@/lib/data-backend";

/** Dual-run sign-out: cookie session (postgres) or Supabase Auth. */
export async function signOutEverywhere(): Promise<void> {
  if (dataBackend() === "postgres") {
    const { authLogoutFn } = await import("@/lib/auth.functions");
    await authLogoutFn();
    return;
  }
  await supabase.auth.signOut();
}
