import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { fetchFamilyGraph, type FamilyGraph } from "@/lib/family";

export function useFamilyGraph() {
  return useQuery<FamilyGraph>({
    queryKey: ["family-graph"],
    queryFn: fetchFamilyGraph,
    staleTime: 30_000,
  });
}

export function useAuthSession() {
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
      setEmail(session?.user?.email ?? null);
    });
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user?.id ?? null);
      setEmail(data.session?.user?.email ?? null);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { userId, email, loading };
}

export function useIsAdmin() {
  const { userId, email, loading } = useAuthSession();
  const query = useQuery({
    queryKey: ["is-admin", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId!)
        .eq("role", "admin")
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });
  return {
    userId,
    email,
    isAdmin: !!query.data,
    loading: loading || (!!userId && query.isLoading),
    refetch: query.refetch,
  };
}
