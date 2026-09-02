export type AssistantConfirmKind =
  | "approve_submission"
  | "reject_submission"
  | "add_child"
  | "update_person";

export type AssistantJsonValue =
  | string
  | number
  | boolean
  | null
  | AssistantJsonValue[]
  | { [key: string]: AssistantJsonValue };

export type AssistantAction =
  | { type: "open_person"; personId: string; label: string }
  | {
      type: "confirm";
      id: string;
      kind: AssistantConfirmKind;
      label: string;
      payload: Record<string, AssistantJsonValue>;
    };
