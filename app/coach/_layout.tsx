import { Slot, Redirect } from "expo-router";
import { useAuth } from "../../context/AuthContext";

export default function CoachLayout() {
  const { user } = useAuth();

  if (!user) {
    return <Redirect href="/login" />;
  }

  if (user.role !== "coach") {
    return <Redirect href="/student/workouts" />;
  }

  return <Slot />;
}

