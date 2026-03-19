export type UserRole = "coach" | "student";

export type Sex = "male" | "female" | "other";

export interface AppUser {
  id: string;
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  sex: Sex;
}

// Shape used when signing up a new user
export interface SignupPayload {
  email: string;
  password: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  sex: Sex;
}
