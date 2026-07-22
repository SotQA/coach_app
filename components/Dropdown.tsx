import { useState } from "react";
import { FlatList, Modal, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../theme/colors";
import { Radius, Spacing } from "../theme/spacing";
import { FontSizes, Typography } from "../theme/typography";

export type DropdownOption = { value: string; label: string };

export interface DropdownProps {
  label: string;
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  testID?: string;
}

export function Dropdown({ label, value, options, onChange, placeholder = "Select…", testID }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value) ?? null;

  return (
    <View style={{ marginBottom: Spacing.md }}>
      <Text style={{ ...Typography.micro, marginBottom: 8 }}>{label}</Text>
      <Pressable
        testID={testID}
        onPress={() => setOpen(true)}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: Colors.inputBg,
          borderWidth: 1,
          borderColor: Colors.hairlineStrong,
          borderRadius: Radius.sm,
          paddingVertical: 10,
          paddingHorizontal: 12,
        }}
      >
        <Text
          numberOfLines={1}
          style={{ ...Typography.body, fontSize: FontSizes.note, color: selected ? Colors.text : Colors.textMuted, flex: 1 }}
        >
          {selected ? selected.label : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={16} color={Colors.textMuted} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" }}
          onPress={() => setOpen(false)}
        >
          <Pressable
            onPress={() => {}}
            style={{
              backgroundColor: Colors.card,
              borderTopLeftRadius: Radius.lg,
              borderTopRightRadius: Radius.lg,
              borderWidth: 1,
              borderColor: Colors.border,
              maxHeight: "70%",
              paddingBottom: Spacing.lg,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: Spacing.md,
                paddingVertical: Spacing.sm,
                borderBottomWidth: 1,
                borderBottomColor: Colors.border,
              }}
            >
              <Text style={{ ...Typography.section }}>{label}</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={22} color={Colors.textMuted} />
              </Pressable>
            </View>
            <FlatList
              data={options}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => {
                const sel = item.value === value;
                return (
                  <Pressable
                    onPress={() => {
                      onChange(item.value);
                      setOpen(false);
                    }}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingHorizontal: Spacing.md,
                      paddingVertical: 14,
                      backgroundColor: sel ? Colors.primaryGlow : "transparent",
                    }}
                  >
                    <Text
                      numberOfLines={1}
                      style={{ ...Typography.body, color: sel ? Colors.primary : Colors.text, fontWeight: sel ? "700" : "400", flex: 1 }}
                    >
                      {item.label}
                    </Text>
                    {sel ? <Ionicons name="checkmark" size={18} color={Colors.primary} /> : null}
                  </Pressable>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
