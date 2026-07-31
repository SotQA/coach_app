import { createContext, useContext, useState, type ReactNode } from "react";

type CoachFabVisibilityValue = {
  visible: boolean;
  setVisible: (visible: boolean) => void;
};

const CoachFabVisibilityContext = createContext<CoachFabVisibilityValue | undefined>(undefined);

export function CoachFabVisibilityProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  return (
    <CoachFabVisibilityContext.Provider value={{ visible, setVisible }}>
      {children}
    </CoachFabVisibilityContext.Provider>
  );
}

export function useCoachFabVisibility() {
  const ctx = useContext(CoachFabVisibilityContext);
  if (!ctx) {
    throw new Error("useCoachFabVisibility must be used within a CoachFabVisibilityProvider");
  }
  return ctx;
}
