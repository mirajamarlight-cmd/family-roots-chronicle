import { useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { personPortraitUrl } from "@/lib/brand";
import type { FamilyGraph } from "@/lib/family";
import { removePersonPhoto, uploadPersonPhoto } from "@/lib/person-photo";
import { cn } from "@/lib/utils";

export function PersonPhotoField({
  graph,
  personId,
  className,
}: {
  graph: FamilyGraph;
  personId: string;
  className?: string;
}) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const person = graph.byId.get(personId);
  const preview = personPortraitUrl(graph, personId);
  const storedPath = person?.photo_path ?? null;
  const hasOwnPhoto = !!person?.photo_url;

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["family-graph"] });

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    const result = await uploadPersonPhoto(personId, file);
    setBusy(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success("Photo updated");
    void refresh();
  };

  const handleRemove = async () => {
    setBusy(true);
    const result = await removePersonPhoto(personId, storedPath);
    setBusy(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success("Photo removed");
    void refresh();
  };

  return (
    <div className={cn("flex items-center gap-4", className)}>
      {preview ? (
        <img
          src={preview}
          alt={person ? `Photo of ${person.display_name}` : "Photo"}
          className="size-20 shrink-0 rounded-xl border border-border object-cover"
        />
      ) : (
        <span className="flex size-20 shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/40 text-muted-foreground">
          <ImagePlus className="size-6" aria-hidden />
        </span>
      )}
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="rounded-full"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ImagePlus className="size-4" aria-hidden />}
            {hasOwnPhoto ? "Replace photo" : "Upload photo"}
          </Button>
          {hasOwnPhoto && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="rounded-full text-muted-foreground"
              disabled={busy}
              onClick={() => void handleRemove()}
            >
              <Trash2 className="size-4" aria-hidden />
              Remove
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">JPG, PNG or WebP, up to 5 MB.</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          void handleFile(file);
        }}
      />
    </div>
  );
}
