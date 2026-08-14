import type { UserRole } from "../types/User";

export interface OnboardingStep {
  targetId: string;
  titleKey: string;
  bodyKey: string;
}

/**
 * Per-role onboarding spotlight sequences. Pure data — arrow direction and
 * above/below tooltip placement are derived at render time from the
 * measured target's position, not hardcoded here.
 *
 * Athlete ships 2 steps, not the 3 in the original design mockup — the
 * mockup's step 2 highlights a "+" FAB that doesn't exist for athletes yet
 * (only coaches have a speed-dial FAB). Decided with product to drop the
 * step rather than build a new persistent nav element for this feature.
 */
export const onboardingTours: Record<UserRole, OnboardingStep[]> = {
  coach: [
    { targetId: "coach-bell", titleKey: "onboardingCoachStep1Title", bodyKey: "onboardingCoachStep1Body" },
    { targetId: "coach-addStudent", titleKey: "onboardingCoachStep2Title", bodyKey: "onboardingCoachStep2Body" },
    { targetId: "coach-myTraining", titleKey: "onboardingCoachStep3Title", bodyKey: "onboardingCoachStep3Body" },
    { targetId: "coach-tab-students", titleKey: "onboardingCoachStep4Title", bodyKey: "onboardingCoachStep4Body" },
  ],
  student: [
    { targetId: "student-emptyState", titleKey: "onboardingStudentStep1Title", bodyKey: "onboardingStudentStep1Body" },
    { targetId: "student-bell", titleKey: "onboardingStudentStep2Title", bodyKey: "onboardingStudentStep2Body" },
    { targetId: "student-tab-profile", titleKey: "onboardingStudentStep3Title", bodyKey: "onboardingStudentStep3Body" },
  ],
  athlete: [
    { targetId: "athlete-emptyState", titleKey: "onboardingAthleteStep1Title", bodyKey: "onboardingAthleteStep1Body" },
    { targetId: "athlete-tab-progress", titleKey: "onboardingAthleteStep2Title", bodyKey: "onboardingAthleteStep2Body" },
  ],
};
