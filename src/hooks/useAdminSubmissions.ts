import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { approveSubmission, fetchPendingSubmissions, rejectSubmission } from "@/lib/submissions";

export function useAdminSubmissions(onApproved?: (personId: string) => void) {
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["pending-submissions"],
    queryFn: fetchPendingSubmissions,
  });

  useEffect(() => {
    const channel = supabase
      .channel("admin-submissions")
      .on("postgres_changes", { event: "*", schema: "public", table: "person_submissions" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["pending-submissions"] });
        void queryClient.invalidateQueries({ queryKey: ["family-graph"] });
        void queryClient.invalidateQueries({ queryKey: ["join-state"] });
        void queryClient.invalidateQueries({ queryKey: ["registered-members"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const run = async (id: string, kind: "approve" | "reject") => {
    setBusyId(id);
    try {
      if (kind === "approve") {
        const personId = await approveSubmission(id);
        toast.success("Approved — now on the tree");
        await queryClient.invalidateQueries({ queryKey: ["pending-submissions"] });
        await queryClient.invalidateQueries({ queryKey: ["family-graph"] });
        await queryClient.invalidateQueries({ queryKey: ["person-claim"] });
        await queryClient.invalidateQueries({ queryKey: ["registered-members"] });
        if (personId) onApproved?.(personId);
      } else {
        await rejectSubmission(id);
        toast.success("Rejected");
        await queryClient.invalidateQueries({ queryKey: ["pending-submissions"] });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update submission");
    } finally {
      setBusyId(null);
    }
  };

  return {
    items: query.data ?? [],
    isLoading: query.isLoading,
    busyId,
    approve: (id: string, prompt: string) => {
      if (!window.confirm(prompt)) return;
      void run(id, "approve");
    },
    reject: (id: string) => {
      if (!window.confirm("Reject this submission? They can send it again later.")) return;
      void run(id, "reject");
    },
  };
}
