import type { EquipmentFlagReason } from "../types/Workout";

/** Full reason text, e.g. for the flag-reason picker and the in-card pill. */
export const EQUIPMENT_FLAG_REASON_LABEL_KEY: Record<EquipmentFlagReason, string> = {
  different_gym: "flagReasonDifferentGym",
  different_machine: "flagReasonDifferentMachine",
  miscalibrated: "flagReasonMiscalibrated",
  other: "flagReasonOther",
};

/** Short badge text for the coach's session-detail exercise rows, e.g. "Diff. gym". */
export const EQUIPMENT_FLAG_REASON_BADGE_KEY: Record<EquipmentFlagReason, string> = {
  different_gym: "coachBadgeDiffGym",
  different_machine: "coachBadgeDiffMachine",
  miscalibrated: "coachBadgeMiscalibrated",
  other: "coachBadgeOtherReason",
};
