# gym-coach-app — Remaining Refactor Prompts

This file holds the two remaining refactor prompts from the App Store-readiness plan. Paste either block into Cursor's agent (or any other capable AI coding agent) when you're ready to execute it. Each prompt is self-contained — the agent does not need access to this surrounding text or any prior conversation.

---

## Status snapshot (as of merging the workoutHistory refactor)

**Done:**
- **Phase 0 — submission blockers:** debug screen removed, 5 TS errors fixed, `utils/logger.ts` added, root `ErrorBoundary`, App Check scaffold.
- **Phase 1 — stability:** ActiveWorkoutContext storage versioning, async-load unmount guards, notification permission gating, rest-timer race fix, bounds checks, divide-by-zero guards, streak off-by-one, timestamp try/catch, `Promise.allSettled` for student details, role enum validation, debounced AsyncStorage persistence.
- **Phase 2 — utils + theme:** `utils/dateConvert.ts`, `utils/dateRanges.ts`, `utils/inputParsing.ts`, `utils/userDisplay.ts`, `utils/studentMetrics.ts`, `utils/workoutLogStats.ts`, `utils/workoutCategorize.ts`, `constants/workoutCategories.ts`, theme tokens (Colors/Spacing/FontSizes), `types/firestore.ts` boundary types.
- **Phase 2 — context split + hook:** `ActiveWorkoutSessionContext` + `ElapsedTimeContext`, `useAsyncData` hook.
- **Phase 2 — screen refactors (3 of 4 done):** `workoutExecution.tsx` (→ hook + components), `studentDetails.tsx` (→ utils + components), `workoutHistory.tsx` (→ hook + components).

**Pending (what's in this file):**
- **Branch 8 — refactor `ExerciseLibraryModal` + `createWorkoutPlan`.** The last screen-pair refactor.
- **Branch 9 — Phase 3 performance pass.** Pagination, throttling, asset cleanup, lazy-loaded i18n, platform-split firebase config, Firestore indexes.

---

## How to use these prompts

1. Open Cursor (or your preferred agent) on the `gym-coach-app` repo.
2. Make sure your local `main` is up to date with the merged work above.
3. Copy ONE prompt block (the entire fenced block under a `## Prompt N` heading).
4. Paste into the agent and let it execute.
5. Review the resulting commits, run the verification commands listed inside the prompt, smoke-test on iOS sim.
6. Open a PR, merge, move to the next.

The prompts are written for Sonnet 4.6 / Opus tier models. Composer 2 (Cursor's free model) may struggle with these — they're not impossible there, but watch for hallucinated APIs or dropped commits.

---

## Prompt 1 — `ExerciseLibraryModal` + `createWorkoutPlan` refactor

````
# Branch: phase-2-refactor-exercise-library-and-create-plan

You're working on `gym-coach-app`, an Expo + React Native + TypeScript + Firebase app preparing for iOS App Store submission. The earlier refactor phases have all been merged. Your job is to refactor TWO tightly-coupled files in one branch:

- `components/ExerciseLibraryModal.tsx` (~465 lines)
- `app/coach/createWorkoutPlan.tsx` (~500 lines)

The modal is invoked from inside `createWorkoutPlan`. They share enough state shape that refactoring them separately would invent two versions of the same abstractions.

**Behavior must be identical.** No new features, no UX changes. Same drag-reorder behavior, same validation, same submit payload.

Existing utilities you must use (do NOT reimplement):
- `utils/dateConvert.ts` — `toMs`, `toDate`.
- `utils/inputParsing.ts` — `parseKgInput`, `normalizeDecimalInput`.
- `utils/logger.ts` — `logger.log/warn/error`. NEVER call `console.log` directly.
- `hooks/useAsyncData.ts` — for any async load.
- `theme/colors.ts`, `theme/spacing.ts`, `theme/typography.ts` — use `Colors.*`, `Spacing.*`, `FontSizes.*` instead of inline literals.
- `types/firestore.ts` — `*FirestoreDoc` types at Firestore boundaries.

Create branch `phase-2-refactor-exercise-library-and-create-plan`. ONE commit per task.

---

## Task A — Map the current responsibilities

Read both files end-to-end. In your PR description draft, list:
- Every `useState` / `useRef` in each file and what it tracks.
- Every `useEffect` and its trigger.
- Every async function and its side effects.
- Every JSX section and rough line range.

For ExerciseLibraryModal specifically: identify the search/filter state, category tabs, list rendering, and the "create new exercise" form path.

For createWorkoutPlan specifically: identify the plan-form state (name, notes, exercises[]), drag-reorder behavior, modal trigger, and submit logic.

Don't write code yet. Paste this into the PR description at the end.

---

## Task B — Extract `hooks/useExerciseLibrary.ts`

Move the modal's search + filter + template-load state into a hook.

```ts
export interface UseExerciseLibraryResult {
  loading: boolean;
  templates: ExerciseTemplate[];                // all loaded templates
  filteredTemplates: ExerciseTemplate[];        // search + category filter applied
  search: string;
  setSearch: (s: string) => void;
  category: ExerciseCategory | "all";
  setCategory: (c: ExerciseCategory | "all") => void;
  reload: () => void;
}

export function useExerciseLibrary(coachId: string | undefined): UseExerciseLibraryResult;
```

- Internally use `useAsyncData<ExerciseTemplate[]>(...)` to load templates via `services/exerciseTemplateService` (whatever method already exists — match the call site in the current modal, do NOT change service signatures).
- Apply existing search debounce (~150ms) inside the hook. Match what the screen does today.
- Apply category filter the same way the screen does.
- The `ExerciseCategory` type comes from existing types; if not exported, export it from `types/Exercise.ts` (or wherever the current category enum lives) — do NOT define a new one.

Commit: `B: extract useExerciseLibrary hook`

---

## Task C — Extract `components/exercise-library/ExerciseTemplateList.tsx`

The list-rendering portion of the modal becomes its own component.

```ts
interface ExerciseTemplateListProps {
  templates: ExerciseTemplate[];
  onSelect: (t: ExerciseTemplate) => void;
  onCreateNew?: () => void;        // opens the creation form inside the modal
  loading?: boolean;
}
```

- Use `FlatList` with `keyExtractor`. ALSO add `getItemLayout` (fixed item height — measure from the current implementation; it's typically ~60-80px) and `removeClippedSubviews={true}`. These satisfy Phase 3 audit item P1 #14 (no separate Phase 3 work needed for this finding).
- Empty state: match what the modal currently shows.
- Loading state: match what the modal currently shows.
- `React.memo` the export.

Commit: `C: extract ExerciseTemplateList component`

---

## Task D — Extract `components/exercise-library/ExerciseCreationForm.tsx`

The "create new exercise" form inside the modal becomes its own component.

```ts
interface ExerciseCreationFormProps {
  onCreate: (template: ExerciseTemplateInput) => Promise<void>;
  onCancel: () => void;
  submitting?: boolean;
}
```

- Same input fields as today (name, category, default sets/reps, notes — match exactly).
- Validate: name non-empty; trim before submit; `maxLength` on every TextInput (100 for name, 500 for notes — adjust to taste, but DO add maxLength on every input).
- Use `parseKgInput`/`normalizeDecimalInput` if numeric fields exist.
- `React.memo` the export.

Commit: `D: extract ExerciseCreationForm component`

---

## Task E — Slim `components/ExerciseLibraryModal.tsx`

The modal becomes a thin shell that switches between two views: the template list and the creation form.

```ts
interface ExerciseLibraryModalProps {
  visible: boolean;
  coachId: string;
  onClose: () => void;
  onSelect: (t: ExerciseTemplate) => void;     // user picked an existing template
  onCreate?: (t: ExerciseTemplateInput) => Promise<void>; // optional: user created new
}
```

- Internal state: just `mode: "list" | "create"`. Default to `"list"`.
- Renders `<ExerciseTemplateList>` in list mode (passing data from `useExerciseLibrary`) and `<ExerciseCreationForm>` in create mode.
- Header row with close button and (in list mode) a "Create new" button that switches to create mode.
- **Target: ≤ 180 lines.**

Commit: `E: slim ExerciseLibraryModal to shell`

---

## Task F — Extract `hooks/useWorkoutPlanForm.ts`

Move createWorkoutPlan's plan-form state and mutators into a hook.

```ts
export interface UseWorkoutPlanFormResult {
  planName: string;
  setPlanName: (s: string) => void;
  notes: string;
  setNotes: (s: string) => void;
  exercises: ExerciseDraft[];                    // ordered list

  // Mutators
  addExercise: (e: ExerciseDraft) => void;
  removeExercise: (key: string) => void;
  updateExercise: (key: string, patch: Partial<ExerciseDraft>) => void;
  reorderExercises: (newOrder: ExerciseDraft[]) => void; // for draggable-flatlist

  // Validation
  isValid: boolean;
  validationErrors: string[];                    // human-readable; empty when valid
}

export function useWorkoutPlanForm(initial?: {
  planName?: string;
  notes?: string;
  exercises?: ExerciseDraft[];
}): UseWorkoutPlanFormResult;
```

- Match current behavior: drag reorder uses `react-native-draggable-flatlist`'s data callback; mutators preserve referential stability where possible.
- Validation rules: planName non-empty after trim; ≥ 1 exercise; reject duplicate exercise names within the plan (audit item P2 #31). On duplicate, push a clear message into `validationErrors`.
- All state lives in this hook; the screen calls mutators only.

Commit: `F: extract useWorkoutPlanForm hook`

---

## Task G — Extract `hooks/useCreateWorkoutPlan.ts`

The submit flow (validation + service call + navigation) becomes its own hook.

```ts
export function useCreateWorkoutPlan(): {
  submit: (input: { studentId: string; groupId?: string | null; planName: string; notes: string; exercises: ExerciseDraft[] }) => Promise<void>;
  submitting: boolean;
  submitError: Error | null;
};
```

- Calls existing `workoutService.createWorkoutPlan` (or whatever the existing method is named — match it exactly, do NOT change the service signature or payload shape).
- Navigates with `router.replace` (or `.push`, match current behavior).
- On error: sets `submitError`, leaves the form intact for retry.
- Match the existing analytics/logging the screen does today.

Commit: `G: extract useCreateWorkoutPlan hook`

---

## Task H — Slim `app/coach/createWorkoutPlan.tsx`

After F and G, the screen contains:
- `useLocalSearchParams` for studentId / groupId.
- `const form = useWorkoutPlanForm();`
- `const { submit, submitting } = useCreateWorkoutPlan();`
- Modal visibility state (single boolean).
- Handlers that wire `<ExerciseLibraryModal>` selection to `form.addExercise`.
- Render: form fields, draggable exercise list, "Add exercise" button, Submit button, modal.

**Target: ≤ 280 lines.** Move residual styles into a colocated stylesheet at the bottom.

Add `maxLength` on the planName and notes TextInputs (covers audit item P2 #37).

Commit: `H: slim createWorkoutPlan screen`

---

## Task I — Verification

Run all of these and paste results into the PR description:

1. `npx tsc --noEmit` — must be empty (skip pre-existing `.expo/types` errors if your environment has them).
2. `npx expo lint` — no NEW errors.
3. `wc -l app/coach/createWorkoutPlan.tsx components/ExerciseLibraryModal.tsx components/exercise-library/*.tsx hooks/useExerciseLibrary.ts hooks/useWorkoutPlanForm.ts hooks/useCreateWorkoutPlan.ts` — paste counts. Modal ≤ 180, screen ≤ 280.
4. `grep -n "console\.log" app/coach/createWorkoutPlan.tsx components/ExerciseLibraryModal.tsx components/exercise-library/` — must be empty.
5. `grep -n "let cancelled\|let active = true" app/coach/createWorkoutPlan.tsx components/ExerciseLibraryModal.tsx hooks/useExerciseLibrary.ts hooks/useWorkoutPlanForm.ts` — must be empty.
6. `grep -n "function parseKgInput\|function normalizeDecimalInput" app/coach/ components/exercise-library/` — must be empty (helpers come from `utils/inputParsing.ts`).

Manual smoke on iOS simulator (be thorough):
- Coach signs in → opens dashboard → opens a student → "Create workout plan".
- Form blank → submit → blocked, error message shown.
- Add exercise → modal opens → search filters templates → category tabs filter templates → tap an exercise → it appears in the form.
- Tap "Create new" inside the modal → creation form appears → cancel returns to list.
- Add multiple exercises → drag-reorder works → reorder persists when modal opens/closes.
- Try to add a duplicate exercise name → form shows error, blocks submit.
- Fill name + add ≥ 1 exercise → submit → loader appears → navigates back to student → new plan visible.

Open a PR titled `phase-2: refactor ExerciseLibraryModal + createWorkoutPlan` with the responsibilities map from Task A, before/after line counts, the verification output, and smoke-test notes.

---

## DO NOT in this branch

- Do not change Firestore queries or service signatures.
- Do not paginate template loads here — that's not in the audit and the modal handles current scale fine.
- Do not introduce a state library or new dependency. React state + hooks are sufficient.
- Do not change drag-reorder library or behavior. Same `react-native-draggable-flatlist` patterns.
- Do not rename `ExerciseDraft`, `ExerciseTemplate`, `WorkoutPlan`, or any existing domain type.
- Do not "improve" validation rules beyond what's specified (planName non-empty, ≥1 exercise, duplicate name check, maxLength).
- Do not add unit tests in this branch.

If you find any other obvious bug while extracting, **note it in the PR description** but do not fix it here.
````

---

## Prompt 2 — Phase 3 performance pass

````
# Branch: phase-3-perf

You're working on `gym-coach-app`, an Expo + React Native + TypeScript + Firebase app preparing for iOS App Store submission. All Phase 0/1/2 work has been merged. This branch is the performance pass — small, targeted fixes with high user impact.

**Behavior preserved everywhere except where explicitly noted (the i18n locale-load change is the only user-facing behavior delta, and only on first locale switch).**

Do these in order. ONE commit per task. Some tasks are tiny (delete files, declarative config) — that's fine, ship them anyway.

---

## Task 1 — Paginate `getWorkoutHistory()` in `services/workoutService.ts`

**Problem:** Currently fetches every log a student has ever made in one Firestore query. For long-tenured users this is hundreds to thousands of docs per cold load.

**Fix:**
1. Add an optional `limit` parameter (default 200) and an optional `startAfter` cursor (a Firestore `DocumentSnapshot` from a previous page, or null).
2. Build the query with `query(collection, where("studentId", "==", id), orderBy("completedAt", "desc"), firestoreLimit(limit), ...maybeStartAfter)`.
3. Return both the logs and the last-doc cursor for the next page:
   ```ts
   { logs: WorkoutLog[]; nextCursor: DocumentSnapshot | null }
   ```
   (Or extend the existing return type — adapt to your actual signature.)
4. Update call sites:
   - `hooks/useWorkoutHistory.ts` — pass `limit: 200`. Add a `loadMore()` function returned by the hook that fetches the next page using the cursor and appends. The screen does not need to expose loadMore in this branch — wire it up in the hook only; UI integration in a follow-up.
   - `app/coach/studentDetails.tsx` — pass `limit: 200` when loading recent history.
   - Anywhere else that calls `getWorkoutHistory` — same default.
5. Add a `firestore.indexes.json` declaration if not already present for the `(studentId asc, completedAt desc)` composite index.

Commit: `1: paginate getWorkoutHistory with cursor + limit`

---

## Task 2 — Throttle re-fetch on tab focus in `app/student/(tabs)/workouts.tsx`

**Problem:** `useFocusEffect` re-runs the parallel load on every tab return, even after a 3-second detour.

**Fix:**
1. Add a module-level (or `useRef`-based) `lastFetchAtRef`.
2. On focus, if `Date.now() - lastFetchAtRef.current < 60_000` (60s), skip the fetch entirely.
3. Otherwise, fetch as before and update `lastFetchAtRef`.
4. Always allow pull-to-refresh to bypass the throttle.

Apply the same pattern to any other tab screen that does the load-on-focus dance (`app/coach/(tabs)/dashboard.tsx`, `app/coach/(tabs)/progress.tsx` — verify with grep).

Commit: `2: throttle tab-focus refetch to once per 60s`

---

## Task 3 — Lazy-load i18n locales in `i18n/index.ts`

**Problem:** All three locales (en, pl, ru) are eagerly imported at boot. Two of them are dead weight for any given user.

**Fix:**
1. Bundle only `en.json` synchronously at boot (so the app has a fallback before locale init completes).
2. Move `pl.json` and `ru.json` to dynamic imports (`await import("./pl.json")`).
3. In `context/I18nContext.tsx`'s `setLocale` (and during initial hydrate), if the requested locale is not yet loaded, dynamically import its JSON and merge into i18n-js before applying.
4. Cache loaded locales so subsequent switches are instant.
5. While a locale is loading, the UI keeps showing whatever locale was previously active. Do NOT show a loading screen.

Verify: cold-launch with locale = en → only en.json bundled. Switch to ru → ru.json fetched. Switch back to en → no fetch.

Commit: `3: lazy-load i18n locales beyond fallback`

---

## Task 4 — Platform-split `firebase/firebaseConfig.js`

**Problem:** The current file uses dynamic `require()` inside a function to choose between web and native auth persistence. This defeats Metro tree-shaking and the React Compiler.

**Fix:**
1. Convert `firebase/firebaseConfig.js` → `firebase/firebaseConfig.ts` (typed).
2. Create `firebase/firebaseConfig.web.ts` with the web-only `getAuth(app)` path and the App Check init.
3. Create `firebase/firebaseConfig.native.ts` with the native AsyncStorage-persisted auth path.
4. The platform-extension resolver in Metro picks the right file automatically (`.web.ts` for web, `.native.ts` for iOS/Android, `.ts` as the universal fallback if both exist — but in this case the bare `.ts` should re-export the universal pieces only).
5. Both platform files use top-level `import` (no `require`). Both export `app`, `auth`, `db`. Both call `App Check` init in the way appropriate to the platform — for native, leave the call as a TODO comment if the project doesn't yet have native App Check wiring (don't add a new dependency in this branch).

Verify: `npx tsc --noEmit` clean. `npx expo start --web` boots. `npx expo run:ios` boots.

Commit: `4: split firebaseConfig per platform`

---

## Task 5 — Memoize `AuthContext` value

**Problem:** `AuthProvider` returns a fresh object every render, so every consumer re-renders whenever auth state changes for any reason.

**Fix:**
1. Wrap the provider value in `useMemo`:
   ```ts
   const value = useMemo(
     () => ({ user, loading, signIn, signOut, /* …whatever the existing surface is */ }),
     [user?.id, loading, signIn, signOut]
   );
   ```
2. Stabilize callback identities with `useCallback` for `signIn`, `signOut`, and any other function exposed via context.
3. Do not add new APIs to the context. Same surface, just stable references.

Commit: `5: memoize AuthContext value to prevent consumer re-renders`

---

## Task 6 — Pre-format elapsed-time string in `context/ElapsedTimeContext.tsx`

**Problem:** The interval ticks `elapsedSeconds: number` every second. Consumers call `formatElapsedForTimer(elapsed)` inside their render, so every consumer re-renders every second AND recomputes the string.

**Fix:**
1. Inside the provider, derive both the integer seconds and a pre-formatted `elapsedFormatted: string`.
2. Expose two hooks:
   - `useElapsedSeconds(): number` — same as today.
   - `useElapsedFormatted(): string` — new; ticks every second with the formatted value.
3. Migrate every consumer that only displays the formatted string (e.g. `FloatingWorkoutBar`, the workout-execution header) to `useElapsedFormatted()`. Leave consumers that need the raw number on `useElapsedSeconds()`.

Commit: `6: expose useElapsedFormatted to avoid per-render formatting`

---

## Task 7 — Delete unused legacy template assets

**Problem:** Expo template leftover assets ship in the bundle even though nothing references them.

**Fix:**
1. Confirm with grep that NOTHING references these files:
   - `assets/images/react-logo.png`
   - `assets/images/react-logo@2x.png`
   - `assets/images/react-logo@3x.png`
   - `assets/images/partial-react-logo.png`
   - `components/hello-wave.tsx`
   - `components/parallax-scroll-view.tsx`
   - `components/external-link.tsx`
2. For any file that has zero references in `app/`, `components/`, or anywhere outside `node_modules`, delete it.
3. Run `npx expo lint` after — confirm no broken imports.

Commit: `7: remove legacy Expo template assets`

---

## Task 8 — Compress oversized assets

**Problem:** `assets/images/icon.png` is ~388 KB; iOS App Store accepts up to 1 MB but smaller ships faster and a 1024×1024 PNG should be ~150-200 KB after optimization. Same for `assets/images/android-icon-foreground.png` (~80 KB).

**Fix:** Run both through TinyPNG or ImageOptim. Replace the originals. Verify visual quality at 1× / 2× / 3× density. Commit the new files.

(This step is manual — no code change. If you don't have an optimizer available right now, skip and note in the PR. It's a small win, not a blocker.)

Commit: `8: compress app icons`

---

## Task 9 — Declare Firestore composite indexes

**Problem:** `services/workoutService.ts` has a fallback path for the active-plans query because the composite index isn't declared.

**Fix:**
1. Create or update `firestore.indexes.json` at the repo root.
2. Add the composite indexes for every multi-field `where`+`orderBy` combination the services use. At minimum:
   - `workoutPlans` collection: `(studentId asc, isActive asc, order asc)`.
   - `workoutLogs` collection: `(studentId asc, completedAt desc)`.
   - `workoutLogs` collection: `(coachId asc, completedAt desc)` if used anywhere.
3. Deploy with: `firebase deploy --only firestore:indexes` (separate from app deploys).
4. Once indexes are live for ≥ 1 release, remove the fallback path in `services/workoutService.ts` (P2.12 → P3 cleanup). Don't remove it in this branch — index propagation is async and you don't know whose project has it deployed yet.

Commit: `9: declare Firestore composite indexes`

---

## Task 10 — Verification

Run all of these and paste results into the PR description:

1. `npx tsc --noEmit` — must be empty.
2. `npx expo lint` — no NEW errors.
3. Bundle-size check before vs after: `npx expo export --platform ios` then compare `dist/_expo/static/js/ios/index.hash.js` byte size between `main` and this branch. Note the delta.
4. `grep -rn "react-logo\|hello-wave\|parallax-scroll-view\|external-link" --include="*.ts" --include="*.tsx" app components hooks utils services` — empty (nothing references the deleted files).
5. `ls assets/images/icon.png` — note new size.

Manual smoke on iOS simulator:
- Cold-launch time feels comparable or faster.
- History tab loads quickly even for a student with 500+ logs (test the pagination by checking the visible list ends with "(more available)" pattern or similar — depending on how you wired loadMore).
- Tab switching to Workouts and back does NOT trigger a network call within 60s of the previous one (confirm via Firestore console or React Native debugger).
- Locale switch en → pl → ru → en works without crashes; ru takes a moment first time (lazy load), instant after.
- Active workout: timer ticks every second; consumers that don't need the timer text don't re-render every second (verify via React DevTools profiler).

Open a PR titled `phase-3: performance pass`.

---

## DO NOT in this branch

- Do not refactor any screen further. The screen-level refactors are done.
- Do not change Firestore document shapes or migrate data.
- Do not paginate `ProgressAnalyticsView` — its computation chunking is a separate decision.
- Do not introduce Sentry, Crashlytics, or any analytics in this branch.
- Do not add new connectors, dependencies, or config plugins.
- Do not change Firebase API keys, project IDs, or App Check site keys (the App Check site key in `.env.example` is the only env var touched here).
- Do not memoize component bodies that the React Compiler already handles. Focus on context values, list `getItemLayout`, formatter pre-computation — places the compiler can't reach.

If you find any other obvious bug while doing the above, **note it in the PR description** but do not fix it here.
````

---

## After both branches merge

The plan is complete. The codebase is in App Store-ready shape from a code-quality standpoint. Remaining items deferred to v1.0.1:

- **Sentry / Crashlytics integration** for post-launch crash diagnostics.
- **Accessibility pass** (`accessibilityLabel` audit on every interactive element).
- **Request timeout wrapper** around Firestore calls.
- **Optimistic UI on workout submit.**
- **Lint + tsc as CI gates** (currently they only run locally).

These don't need a refactor branch — each is a small focused change you can make once you're ramping toward a real submission.

Good luck with the submission.
