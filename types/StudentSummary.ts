export interface StudentSummary {
  id: string; // Firebase Auth UID (users/{uid})
  email: string;
  coachId?: string;
  firstName?: string;
  lastName?: string;
}

