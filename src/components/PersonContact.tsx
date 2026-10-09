import { useQuery } from "@tanstack/react-query";
import { MapPin } from "lucide-react";

import { ContactLinks } from "@/components/ContactLinks";
import { supabase } from "@/integrations/supabase/client";
import { dataBackend } from "@/lib/data-backend";

export function PersonContact({ personId, className }: { personId: string; className?: string }) {
  const { data } = useQuery({
    queryKey: ["person-claim", personId],
    queryFn: async () => {
      if (dataBackend() === "postgres") {
        const { pgPersonClaimFn } = await import("@/lib/pg-data.functions");
        const claim = await pgPersonClaimFn({ data: { personId } });
        if (!claim) return null;
        return { address: claim.address, phone: claim.phone, email: claim.email };
      }
      const { data, error } = await supabase
        .from("person_claims")
        .select("address, phone, email")
        .eq("person_id", personId)
        .maybeSingle();
      if (error) return null;
      return data;
    },
  });
  if (!data?.address && !data?.phone && !data?.email) return null;

  return (
    <section className={className ?? "space-y-1.5"}>
      <h3 className="font-display text-sm font-semibold tracking-tight">Contact</h3>
      {data.address && (
        <p className="flex items-start gap-2 text-sm">
          <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <span>{data.address}</span>
        </p>
      )}
      <ContactLinks phone={data.phone} email={data.email} />
    </section>
  );
}
