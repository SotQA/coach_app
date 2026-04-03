import { View } from "react-native";
import { Colors } from "../../../theme/colors";

/** Middle tab target; navigation is intercepted in `_layout` to open create student. */
export default function CoachFabTab() {
  return <View style={{ flex: 1, backgroundColor: Colors.bg }} />;
}
