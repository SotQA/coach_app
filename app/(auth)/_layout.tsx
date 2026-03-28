import { Slot, Redirect } from "expo-router";
import { useAuth } from "../../context/AuthContext";

export default function AuthLayout() {
  const { user } = useAuth();

  if (user) {
    return (
      <Redirect href={user.role === "coach" ? "/coach/dashboard" : "/student/workouts"} />
    );
  }

  return <Slot />;
}

