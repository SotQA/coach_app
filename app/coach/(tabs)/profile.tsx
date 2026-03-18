import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { authService } from "../../../services/authService";
import type { AppUser } from "../../../types/User";
import { ScreenLayout } from "../../../components/ScreenLayout";
import { Colors } from "../../../theme/colors";
import { Radius, Spacing } from "../../../theme/spacing";
import { Typography } from "../../../theme/typography";

export default function CoachProfile() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        setError(null);
        const u = await authService.getCurrentUserWithRole();
        if (!u || u.role !== "coach") {
          setError("You must be logged in as a coach.");
          return;
        }
        setUser(u);
      } catch (e: any) {
        setError(e.message ?? "Failed to load profile.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <ScreenLayout>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Colors.bg }}>
          <ActivityIndicator />
        </View>
      </ScreenLayout>
    );
  }

  if (error) {
    return (
      <ScreenLayout>
        <View style={{ flex: 1, justifyContent: "center", padding: Spacing.md, backgroundColor: Colors.bg }}>
          <Text style={{ color: Colors.danger }}>{error}</Text>
        </View>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout>
      <View style={{ flex: 1, backgroundColor: Colors.bg, padding: Spacing.md }}>
        <Text style={{ ...Typography.title, fontSize: 22, marginBottom: Spacing.sm }}>Profile</Text>
        <View
          style={{
            backgroundColor: Colors.card,
            borderRadius: Radius.md,
            padding: Spacing.md,
            borderWidth: 1,
            borderColor: Colors.border,
          }}
        >
          <Text style={Typography.secondary}>Email</Text>
          <Text style={{ ...Typography.section, marginBottom: Spacing.sm }}>{user?.email ?? "—"}</Text>
          <Text style={Typography.secondary}>Role</Text>
          <Text style={Typography.section}>{user?.role ?? "—"}</Text>
        </View>
      </View>
    </ScreenLayout>
  );
}

