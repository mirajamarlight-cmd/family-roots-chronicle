import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { fetchFamilyGraph, type FamilyGraph } from "@/lib/family";
import { fetchJoinState } from "@/lib/submissions";

// ponytail: one shared channel — Supabase rejects .on() after subscribe() on the same name
let familyGraphChannel: RealtimeChannel | null = null;
let familyGraphChannelRefs = 0;
let joinStateChannel: RealtimeChannel | null = null;
let joinStateChannelRefs = 0;

export function useFamilyGraph() {
  const queryClient = useQueryClient();

  useEffect(() => {
    familyGraphChannelRefs++;
    if (!familyGraphChannel) {
      const invalidate = () => {
        void queryClient.invalidateQueries({ queryKey: ["family-graph"] });
      };
      familyGraphChannel = supabase
        .channel("family-graph-changes")
        .on("postgres_changes", { event: "*", schema: "public", table: "people" }, invalidate)
        .on("postgres_changes", { event: "*", schema: "public", table: "parent_child" }, invalidate)
        .subscribe();
    }

    return () => {
      familyGraphChannelRefs--;
      if (familyGraphChannelRefs === 0 && familyGraphChannel) {
        void supabase.removeChannel(familyGraphChannel);
        familyGraphChannel = null;
      }
    };
  }, [queryClient]);

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

export function useJoinState(userId: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;
    joinStateChannelRefs++;
    if (!joinStateChannel) {
      const invalidate = () => {
        void queryClient.invalidateQueries({ queryKey: ["join-state"] });
        void queryClient.invalidateQueries({ queryKey: ["person-claim-index"] });
      };
      joinStateChannel = supabase
        .channel("join-state-changes")
        .on("postgres_changes", { event: "*", schema: "public", table: "person_submissions" }, invalidate)
        .on("postgres_changes", { event: "*", schema: "public", table: "person_claims" }, invalidate)
        .subscribe();
    }

    return () => {
      joinStateChannelRefs--;
      if (joinStateChannelRefs === 0 && joinStateChannel) {
        void supabase.removeChannel(joinStateChannel);
        joinStateChannel = null;
      }
    };
  }, [queryClient, userId]);

  return useQuery({
    queryKey: ["join-state", userId],
    enabled: !!userId,
    queryFn: () => fetchJoinState(userId!),
    refetchOnMount: "always",
  });
}

/** Join nav becomes Profile once the user is linked to a tree person (and has no pending submission). */
export function useJoinNav() {
  const { userId, loading: authLoading } = useAuthSession();
  const joinState = useJoinState(userId);
  const isProfile = !!userId && !!joinState.data?.claim;
  return {
    label: isProfile ? "Profile" : "Join",
    isProfile,
    loading: authLoading || (!!userId && joinState.isLoading),
  };
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
