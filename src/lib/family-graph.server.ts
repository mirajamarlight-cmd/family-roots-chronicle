import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildGraph, personIsDeceased, type Link, type Person } from "@/lib/family";

const PERSON_BASE_COLUMNS =
  "id, first_name, middle_name, last_name, display_name, gender, birth_date, death_date, photo_url, notes";

async function fetchPeopleServer(): Promise<Person[]> {
  const withFlag = await supabaseAdmin
    .from("people")
    .select(`${PERSON_BASE_COLUMNS}, is_deceased`)
    .order("display_name");
  if (!withFlag.error) return (withFlag.data ?? []) as Person[];

  const msg = withFlag.error.message ?? "";
  if (!msg.includes("is_deceased")) throw withFlag.error;

  const base = await supabaseAdmin.from("people").select(PERSON_BASE_COLUMNS).order("display_name");
  if (base.error) throw base.error;
  return ((base.data ?? []) as Omit<Person, "is_deceased">[]).map((p) => ({
    ...p,
    is_deceased: personIsDeceased(p),
  }));
}

export async function fetchFamilyGraphServer() {
  const [people, linkRes] = await Promise.all([
    fetchPeopleServer(),
    supabaseAdmin
      .from("parent_child")
      .select("id, parent_id, child_id, relationship_type, child_order"),
  ]);
  if (linkRes.error) throw linkRes.error;
  return buildGraph(people, (linkRes.data ?? []) as Link[], []);
}
