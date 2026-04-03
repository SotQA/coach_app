import { addDoc, collection } from "firebase/firestore";
import { Button, View } from "react-native";
import { db } from "../firebase/firebaseConfig";
import { useAuth } from "../context/AuthContext";

export default function TestScreen() {
  const { user } = useAuth();

  const addWorkout = async () => {
    try {
      if (!user) {
        alert("Please login first.");
        return;
      }
      await addDoc(collection(db, "workoutLogs"), {
        studentId: user.id,
        exercise: "Bench Press",
        sets: 4,
        reps: "10",
        weight: 80,
        date: new Date()
      });

      alert("Workout saved!");
    } catch (error) {
      console.log(error);
      alert("Error saving workout");
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Button title="Add Test Workout" onPress={addWorkout} />
    </View>
  );
}