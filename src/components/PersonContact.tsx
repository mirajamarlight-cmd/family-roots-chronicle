import { useQuery } from "@tanstack/react-query";
import { Mail, MapPin, Phone } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

export function PersonContact({ personId, className }: { personId: string; className?: string }) {
  const { data } = useQuery({
    queryKey: ["person-claim", personId],
    queryFn: async () => {
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
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contact</h3>
      {data.address && (
        <p className="flex items-start gap-2 text-sm">
          <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <span>{data.address}</span>
        </p>
      )}
      {data.phone && (
        <p className="flex items-center gap-2 text-sm">
          <Phone className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <a href={`tel:${data.phone}`} className="underline-offset-2 hover:underline">
            {data.phone}
          </a>
        </p>
      )}
      {data.email && (
        <p className="flex items-center gap-2 text-sm">
          <Mail className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <a href={`mailto:${data.email}`} className="break-all underline-offset-2 hover:underline">
            {data.email}
          </a>
        </p>
      )}
    </section>
  );
}
