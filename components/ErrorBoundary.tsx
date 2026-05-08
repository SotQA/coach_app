import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Colors } from "../theme/colors";
import { Typography } from "../theme/typography";
import { Spacing, Radius } from "../theme/spacing";
import { logger } from "../utils/logger";

type State = { hasError: boolean; error: Error | null };

export default class ErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    logger.error("[ErrorBoundary]", error, info);
  }

  handleRestart = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <View style={styles.container}>
        <Text style={styles.title}>GymCoach</Text>
        <Text style={styles.subtitle}>Something went wrong</Text>
        {this.state.error ? (
          <Text style={styles.message}>{this.state.error.message}</Text>
        ) : null}
        <Pressable
          onPress={this.handleRestart}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        >
          <Text style={styles.buttonText}>Restart</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.lg,
  },
  title: {
    ...Typography.title,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    ...Typography.section,
    color: Colors.textMuted,
    marginBottom: Spacing.xs,
  },
  message: {
    ...Typography.secondary,
    color: Colors.textMuted,
    textAlign: "center",
    marginBottom: Spacing.lg,
  },
  button: {
    backgroundColor: Colors.primary,
    paddingVertical: 15,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.lg,
    marginTop: Spacing.md,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    ...Typography.section,
    color: Colors.onPrimary,
    textAlign: "center",
  },
});
