import { Slot, Redirect } from "expo-router";
import { useAuth } from "../../context/AuthContext";

export default function AuthLayout() {
  const { user } = useAuth();

  if (user) {
    const href =
      user.role === "coach"
        ? "/coach/dashboard"
        : user.role === "athlete"
        ? "/athlete/workouts"
        : "/student/workouts";
    return <Redirect href={href as any} />;
  }

  return <Slot />;
}

