import { Slot, Redirect } from "expo-router";
import { useAuth } from "../../context/AuthContext";

export default function StudentLayout() {
  const { user } = useAuth();

  if (!user) {
    return <Redirect href="/login" />;
  }

  if (user.role !== "student") {
    return <Redirect href="/coach/dashboard" />;
  }

  return <Slot />;
}

