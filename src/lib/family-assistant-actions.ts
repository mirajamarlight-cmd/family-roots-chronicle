export type AssistantConfirmKind =
  | "approve_submission"
  | "reject_submission"
  | "add_child"
  | "update_person";

export type AssistantAction =
  | { type: "open_person"; personId: string; label: string }
  | {
      type: "confirm";
      id: string;
      kind: AssistantConfirmKind;
      label: string;
      payload: Record<string, unknown>;
    };
