import React from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PrimaryButton } from "../../PrimaryButton";
import { useI18n } from "../../../context/I18nContext";

interface CoachActionsFooterProps {
  lastLogId: string | null;
  onLeaveFeedback: (logId: string) => void;
}

function CoachActionsFooterInner({ lastLogId, onLeaveFeedback }: CoachActionsFooterProps) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();

  if (!lastLogId) return null;

  return (
    <View
      style={{
        position: "absolute",
        bottom: insets.bottom + 16,
        left: 16,
        right: 16,
      }}
    >
      <PrimaryButton
        title={t("leave_feedback_on_last_workout")}
        onPress={() => onLeaveFeedback(lastLogId)}
      />
    </View>
  );
}

export const CoachActionsFooter = React.memo(CoachActionsFooterInner);
