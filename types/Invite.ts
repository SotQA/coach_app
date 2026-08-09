export type InviteStatus = "pending" | "accepted" | "declined";

/** A coach → student roster invite. Student is only linked to the coach's roster once accepted. */
export interface Invite {
  id: string;
  coachId: string;
  studentId: string;
  studentEmail: string;
  status: InviteStatus;
  createdAt: any;
  respondedAt?: any;
  /** Only set when declined — coach cannot re-invite this student until this passes (7-day cooldown). */
  expiresAt?: any;
  /** Whether the coach has seen the latest invite-related update (response) for this invite. */
  coachNotificationRead: boolean;
  /** Whether the student has seen/actioned the invite notification. */
  studentNotificationRead: boolean;
}
