import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { authService } from "../../services/authService";
import { studentService } from "../../services/studentService";
import { PrimaryButton } from "../../components/PrimaryButton";

// Screen used by the coach to create a new student record
// that will appear in their dashboard.
export default function CreateStudent() {
  const router = useRouter();
  const [studentUid, setStudentUid] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setError(null);
    setLoading(true);
    try {
      const user = await authService.getCurrentUserWithRole();
      if (!user || user.role !== "coach") {
        setError("You must be logged in as a coach.");
        return;
      }

      const uid = studentUid.trim();
      if (!uid) {
        setError("Student UID is required.");
        return;
      }

      await studentService.createStudent({
        id: uid,
        coachId: user.id,
        name: name.trim(),
        email: email.trim(),
      });

      router.replace("/coach/dashboard");
    } catch (e: any) {
      setError(e.message ?? "Failed to create student.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#0F172A" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, padding: 16 }}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={{
            backgroundColor: "#111827",
            borderRadius: 24,
            padding: 20,
            marginTop: 16,
          }}
        >
          <Text
            style={{
              fontSize: 20,
              fontWeight: "700",
              marginBottom: 8,
              color: "#F9FAFB",
            }}
          >
            Create Student
          </Text>
          <Text style={{ color: "#9CA3AF", marginBottom: 16 }}>
            Add a student to your roster using their Firebase Auth UID so you can assign workouts.
          </Text>
          <Text style={{ color: "#E5E7EB", marginBottom: 4 }}>Student UID</Text>
          <TextInput
            placeholder="Firebase Auth UID"
            placeholderTextColor="#6B7280"
            autoCapitalize="none"
            value={studentUid}
            onChangeText={setStudentUid}
            style={{
              borderWidth: 1,
              borderColor: "#1F2937",
              padding: 12,
              borderRadius: 12,
              marginBottom: 12,
              color: "white",
              backgroundColor: "#020617",
            }}
          />
          <Text style={{ color: "#E5E7EB", marginBottom: 4 }}>Student Name</Text>
          <TextInput
            placeholder="Jane Doe"
            placeholderTextColor="#6B7280"
            value={name}
            onChangeText={setName}
            style={{
              borderWidth: 1,
              borderColor: "#1F2937",
              padding: 12,
              borderRadius: 12,
              marginBottom: 12,
              color: "white",
              backgroundColor: "#020617",
            }}
          />
          <Text style={{ color: "#E5E7EB", marginBottom: 4 }}>Student Email</Text>
          <TextInput
            placeholder="student@example.com"
            placeholderTextColor="#6B7280"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            style={{
              borderWidth: 1,
              borderColor: "#1F2937",
              padding: 12,
              borderRadius: 12,
              marginBottom: 16,
              color: "white",
              backgroundColor: "#020617",
            }}
          />

          {loading ? (
            <ActivityIndicator style={{ marginVertical: 12 }} />
          ) : (
            <PrimaryButton title="Create Student" onPress={handleCreate} />
          )}
          {error ? (
            <Text style={{ color: "#FCA5A5", marginTop: 8 }}>{error}</Text>
          ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

