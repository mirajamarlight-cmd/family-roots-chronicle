import { createMiddleware } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

export const requireAdmin = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const { supabase, userId } = context as {
      supabase: SupabaseClient<Database>;
      userId: string;
    };
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (error || !data) throw new Error("Forbidden: admin access required");
    return next({ context: { ...context, isAdmin: true as const } });
  });
