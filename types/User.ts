export type UserRole = "coach" | "student";

export interface AppUser {
  id: string;
  email: string;
  role: UserRole;
}

// Shape used when signing up a new user
export interface SignupPayload {
  email: string;
  password: string;
  role: UserRole;
}
