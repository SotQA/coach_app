# Mentorix — UI/UX premium redesign plan

This document captures the visual + UX direction for Mentorix and provides paste-ready prompts for executing it in Cursor (Composer 2 or any other agent).

Brand references: Whoop, Strava, Peloton, Apple Fitness. Direction: **premium fitness, dark + lime, confident typography, real motion**.

---

## Chosen logo (locked)

**Direction E3 — heavy-M medallion.** A bold lime M inscribed inside a thin lime ring on a near-black field. Files in repo:

- `assets/logo/mentorix-icon.svg` — SVG source (1024×1024 viewBox).
- `assets/logo/mentorix-icon-final.png` — rendered 1024×1024 PNG, ready to use as the iOS App Store icon.
- `assets/logo/mentorix-wordmark.svg` — small medallion + "Mentorix" wordmark for in-app headers and the splash screen.

**To swap the App Store icon:**

1. Back up the current `assets/images/icon.png` (388 KB legacy template icon).
2. Replace it with `assets/logo/mentorix-icon-final.png` (rename to `icon.png` if you keep the `assets/images/` location). The path in `app.json` (`expo.icon`) does not need to change.
3. Re-export and submit a new TestFlight build to see it in the App Store listing.

**Old broken file in repo:** `assets/logo/mentorix-icon-1024.png` (3.5 KB grayscale, ImageMagick rendering glitch). Delete it manually — you can't see it from any UI, but `git status` will flag it.

---

## Part 1 — Audit of current onboarding flow

Screenshots reviewed: login, signup step 1 (Account), step 2 (About you), step 2 with date picker open, step 3 (Your role).

**What's working**
- Lime on near-black is a strong, distinctive base. Most premium fitness brands have a "their" colour — this lime is yours.
- Form fields are clean and readable.
- The 3-step progress bar communicates pacing.

**What's holding it back from "premium fitness"**
1. **No brand presence on the login screen.** "Welcome back" is a system-default greeting. The hero spot above the form is empty space — that's where the Mentorix wordmark or logo belongs.
2. **Card-on-near-black is muddy.** The card (`Colors.card #1C1C1E`) sits on `Colors.bg #080808` with low luminance contrast. Premium dark-mode design typically chooses one: full-bleed (no card, just form on bg) OR clearly elevated card (lighter surface + subtle 1px hairline border). Right now we have a card that doesn't quite read.
3. **Form is transactional, not emotional.** Three steps, six fields, four taps. Best-in-class onboarding (Whoop, Headspace, Cal AI, Duolingo) uses *one decision per screen* with confident type and tactile transitions. The user feels momentum, not friction.
4. **Date picker overflows the card** and uses the iOS spinner style — doesn't match the rest of the visual system.
5. **No motion.** Step transitions are instant. Screen-to-screen slide+fade adds 2× perceived polish for ~10 lines of Reanimated code.
6. **Type hierarchy is conservative.** Premium fitness apps push much harder — display sizes 36-44pt for hero text, ultra-tight letter spacing, deliberate weight contrast.
7. **"Already have an account? Log in" footer appears on every step** including step 3 where you've already started filling fields. Hide it after step 1.
8. **Selected role-card uses border-only emphasis.** Easily missed. Should also tint the background and possibly slightly scale up.

---

## Part 2 — New onboarding flow

Replace the current 3-step block with a conversational 8-screen flow. One decision per screen, big typography, slide+fade transitions between.

```
1. Splash + brand          Mentorix logo, tagline, "Get started" CTA
2. Coach or student?       Frame the rest of onboarding by role (now FIRST)
3. Your name               Just first name, huge input
4. Your birthday           Custom date picker (NOT the iOS spinner)
5a. (Student) Your goals   Multi-select chips: build muscle, get stronger, lose fat,
                           improve performance, recover from injury, general fitness
5b. (Coach) Your specialty Single select: strength, hypertrophy, endurance, mobility, general
6a. (Student) Frequency    1-2x / 3-4x / 5-6x / daily
6b. (Coach) Student count  None yet / 1-5 / 6-15 / 16+
7. Email + password        Last — by now they're invested
8. "You're in" reveal      Personalised hero: "Welcome, {firstName}. Let's build your first
                           plan." (or for coaches, "Let's set up your first student.")
```

**Note on the goal/specialty/frequency questions:** these are *new fields* that would live on the user document. Light feature-level work. They unlock real personalisation later (homepage greetings, suggested workout templates, coach-student matching). If you'd rather stay refactor-only, drop screens 5 and 6 and keep the rest of the choreography — that alone is a big lift.

---

## Part 3 — Visual system upgrades

These are foundational changes that lift every screen. Do these BEFORE redesigning individual screens, otherwise you'll redo work.

### 3.1 Typography scale (extend `theme/typography.ts`)

Add a confident display tier. Current `FontSizes` tops out at h2:26. Premium fitness needs hero numbers and hero headers.

```ts
export const FontSizes = {
  ...existing,
  display: 44,    // splash hero, big-decision screens (e.g. "Coach or student?")
  h1: 32,         // screen primary heading where current h2:26 lives today
  // h2:26 stays as section header
  // h3:22 stays as card title
  micro: 11,      // ALL CAPS labels, badges
};

export const Typography = {
  ...existing,
  display: { fontSize: FontSizes.display, fontWeight: "800" as const, letterSpacing: -1.0, color: Colors.text },
  hero:    { fontSize: FontSizes.h1,      fontWeight: "800" as const, letterSpacing: -0.5, color: Colors.text },
  micro:   { fontSize: FontSizes.micro,   fontWeight: "700" as const, letterSpacing: 1.4,  color: Colors.textMuted, textTransform: "uppercase" as const },
};
```

### 3.2 Surface tokens (extend `theme/colors.ts`)

Add an elevated-surface tier so form fields and cards stand off the bg without going muddy.

```ts
export const Colors = {
  ...existing,
  // Add:
  surfaceElevated: "#15151A",   // form-card surface; +luminance vs bg
  inputBg:         "#1F1F23",   // input field background
  hairline:        "rgba(255,255,255,0.06)",  // 1px borders on cards
  hairlineStrong:  "rgba(255,255,255,0.12)",  // 1px borders on inputs (not focused)
  primaryGlow:     "rgba(212,255,68,0.35)",   // input focus halo
};
```

### 3.3 New `InputField` component

A premium input with a focus state. Replace every raw `<TextInput>` in the auth flow.

- Default: dark bg (`Colors.inputBg`), 1px hairline border, 14px label above, 16pt input text.
- Focused: lime border (1.5px), subtle glow shadow with `primaryGlow`, label colour shifts to lime.
- Error: red border, helper text below.
- Animates the border colour with Reanimated 200ms ease-out.

### 3.4 New `PrimaryButton` (or upgrade existing)

- 56pt height, 16pt radius, lime fill, dark text, weight 700.
- Pressed: scale 0.97, opacity 0.92, with Reanimated `withSpring`.
- Loading: lime fill stays, replaces text with a small spinner of a darker lime.
- Add a `secondary` variant: transparent bg, 1.5px lime border, lime text. For the "Continue with Google" / "Create account" buttons on the login screen.

### 3.5 New `ChoiceCard` component

For role selection, goal selection, frequency selection.

- 64-80pt tall row.
- Default: dark surface bg, hairline border, optional left icon.
- Selected: lime tint background (rgba(212,255,68,0.10)), lime border (1.5px), lime checkmark right-aligned, slight scale-up (1.02) via Reanimated.
- Press: scale 0.98 with spring.

### 3.6 New `SegmentedProgress` component

Replace the current thin progress bar with a stepped indicator.

- Row of N pills, gap 6pt.
- Filled pills = lime; current pill = lime with subtle pulse animation; remaining pills = `hairlineStrong`.
- Optional small "Step X of N" caption above.

### 3.7 Custom date picker

Replace `@react-native-community/datetimepicker` for DOB with a styled month/year inline picker that lives inside your card. Don't use a modal sheet — premium onboarding keeps everything on-screen.

Suggested: three columns of large numbers with snap-scroll, dark bg, lime selection bar across the middle row. Reanimated for snap haptics.

### 3.8 Motion principles

- **Screen transitions** (between onboarding steps): horizontal slide 24pt + opacity 0→1, 280ms `Easing.out(Easing.cubic)`. Use `react-native-screens` `slide_from_right`/`slide_from_left` or wire it manually with Reanimated layout animations on the route group.
- **Press feedback**: scale 0.97 on press-in, withSpring back on press-out. Apply to every Pressable in this flow.
- **Field focus**: 200ms border-colour interp; 200ms shadow opacity 0→0.6.
- **Number/progress changes**: 400ms `Easing.out(Easing.exp)` so the progress bar feels deliberate.

### 3.9 Brand presence

- Add the chosen logo (concept A, B, or C from the chat) as a wordmark + mark above the login form's "Welcome back".
- Splash should be bg #080808 with the logo centered + a one-line tagline like "Coaching that moves with you." (placeholder — workshop later).

---

## Part 4 — Composer 2 prompts (paste-ready)

Execute in order. Each prompt is sized for Composer 2.

### Prompt UI-1 — Foundation: typography, colours, InputField

````
# Branch: ui-1-foundation

Working on the Mentorix React Native app (Expo SDK 54, RN 0.81). The repo has an existing theme system. This branch adds tokens and one component — no screen redesigns yet. Behavior preserved everywhere; only adds new exports.

## Task 1 — Extend `theme/typography.ts`

Add to the existing `FontSizes` and `Typography` exports (do NOT remove anything; only ADD):

```ts
export const FontSizes = {
  ...existing values,
  display: 44,
  h1: 32,
  micro: 11,
};

// Add these to the Typography object:
display: {
  fontSize: 44, fontWeight: "800" as const, letterSpacing: -1.0, color: Colors.text,
},
hero: {
  fontSize: 32, fontWeight: "800" as const, letterSpacing: -0.5, color: Colors.text,
},
micro: {
  fontSize: 11, fontWeight: "700" as const, letterSpacing: 1.4,
  color: Colors.textMuted, textTransform: "uppercase" as const,
},
```

## Task 2 — Extend `theme/colors.ts`

Add (do NOT remove or rename existing tokens):

```ts
surfaceElevated: "#15151A",
inputBg:         "#1F1F23",
hairline:        "rgba(255,255,255,0.06)",
hairlineStrong:  "rgba(255,255,255,0.12)",
primaryGlow:     "rgba(212,255,68,0.35)",
```

## Task 3 — Create `components/InputField.tsx`

A single TextInput wrapper with label, focus animation, and optional error state. Props:

```ts
interface InputFieldProps {
  label: string;
  value: string;
  onChangeText: (s: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: TextInputProps["keyboardType"];
  autoCapitalize?: TextInputProps["autoCapitalize"];
  autoComplete?: TextInputProps["autoComplete"];
  error?: string | null;
  maxLength?: number;
  testID?: string;
}
```

Layout: column. Label (14pt, weight 600, color `Colors.text`, marginBottom 8). Input row (height 56, radius 14, bg `Colors.inputBg`, border 1px `Colors.hairlineStrong`, paddingHorizontal 16, fontSize 16, color `Colors.text`). Error text below (12pt, color `Colors.danger`).

Focus state: animate border from `hairlineStrong` to `Colors.primary` (1.5px) over 200ms, and animate shadow opacity 0 → 0.6 with shadowColor `Colors.primary` and shadowRadius 8. Use `react-native-reanimated`'s `withTiming` and `useAnimatedStyle` on a wrapping `Animated.View`.

Use `forwardRef` so callers can `.focus()` it. Memoize the export with `React.memo`.

## Task 4 — Verification

1. `npx tsc --noEmit` — must be clean for the new component and the modified theme files.
2. Confirm the existing Typography/FontSizes/Colors usages across the codebase still work (no removed members).
3. No new dependencies. Reanimated is already installed.

## DO NOT in this branch

- Do not touch any screen file.
- Do not modify the existing PrimaryButton.
- Do not delete or rename existing theme tokens.
- Do not introduce a styled-components or theme-provider abstraction.

Commit message: `ui-1: add display/hero/micro typography, surface tokens, InputField component`
````

### Prompt UI-2 — Premium login screen

Run after UI-1 lands.

````
# Branch: ui-2-login-redesign

Redesign `app/(auth)/login.tsx` to feel premium-fitness (Whoop / Strava / Peloton vibe). Foundation already merged in UI-1: `Typography.display/hero/micro`, surface tokens (`surfaceElevated`, `inputBg`, `hairline`, `hairlineStrong`, `primaryGlow`), and the `InputField` component.

## Targets

1. **Brand presence**: above the form, render the Mentorix wordmark (just the text "Mentorix" in `Typography.display`, color `Colors.primary`, letterSpacing -1.5) with a one-line tagline below in `Typography.micro` color `Colors.textMuted`. Tagline: "Coach. Train. Progress." (placeholder, easy to swap.)

2. **Drop the card.** The current screen wraps the form in a dark card on near-black bg — that's the muddy look. Go full-bleed: form lives directly on `Colors.bg` with horizontal padding 24, no card surface.

3. **Input upgrade**: replace the raw TextInputs with `<InputField label="Email" ... />` and `<InputField label="Password" secureTextEntry ... />` from `components/InputField.tsx`.

4. **Hero greeting**: replace "Welcome back" with `Typography.display` "Welcome back" (32pt → 44pt). Subtitle below in `Typography.body` color `Colors.textMuted`.

5. **Button stack**: keep the three buttons (Login, Continue with Google, Create account) but space them with Spacing.md gap. Login = primary (lime). The other two = secondary variant: transparent bg, 1.5px `Colors.primary` border, `Colors.primary` text. If a `secondary` variant doesn't exist on `PrimaryButton`, add it as an opt-in prop (don't break existing usage).

6. **Press feedback**: every Pressable in this screen scales to 0.97 on press-in via `react-native-reanimated`'s `withSpring`. Wrap as a small inline helper or a `<TouchScale>` component if you prefer — keep it local, don't over-extract.

7. **Keyboard handling**: use `KeyboardAvoidingView` with `behavior="padding"` on iOS so the input doesn't get covered.

8. **Layout vertical centering**: the hero + form + buttons cluster lives in the middle of the screen. Above and below, `flex: 1` spacers.

## DO NOT

- Do not change the auth logic (`handleSignIn`, Google sign-in, navigation). Only the visual layer.
- Do not move the screen file.
- Do not add new dependencies.
- Do not redesign the signup flow in this branch — separate prompt.

## Verification

1. `npx tsc --noEmit` clean.
2. Sign in works (email + password and Google) exactly as before.
3. iOS sim screenshot looks substantially different from the current login screen — much more brand-forward.

Commit message: `ui-2: redesign login screen with brand hero + premium inputs`
````

### Prompt UI-3 — Role-first onboarding flip

Run after UI-2 lands. Restructures the signup flow so role is the first decision.

````
# Branch: ui-3-role-first-onboarding

Restructure `app/(auth)/signup.tsx` so role selection is the FIRST step instead of the last. New step order:
1. Role (was step 3) — coach or student
2. About you (was step 2) — name, dob, sex
3. Account (was step 1) — email, password

Rationale: every "best in class" onboarding asks the most consequential question first, then frames the rest of the flow around it. Right now we collect personal info from the user before we even know who they are.

## Tasks

1. **Reorder the step state machine** in signup.tsx so the screens render in the new order.
2. **Re-label the progress bar**: step 1 of 3 is now "Your role", step 2 is "About you", step 3 is "Account".
3. **Hide the "Already have an account? Log in" footer on steps 2 and 3** — it makes sense only on step 1 (the role page). On other steps the user has clearly committed.
4. **Use the new `InputField` component** for all text inputs in step 3 (Account: email, password, confirm password).
5. Selected role card: in addition to the lime border, add a lime tint background `Colors.primaryGlow` (or similar low-alpha lime), and animate scale 1.0 → 1.02 with Reanimated when selected.
6. Press feedback: scale 0.97 on press-in for all Pressables in the flow.

## DO NOT

- Do not yet add new fields (goals, frequency, specialty). That's a separate feature branch.
- Do not redesign the date-of-birth picker yet. Separate branch.
- Do not change the underlying signup API call or its payload shape.
- Do not add screen-to-screen slide animations yet — separate motion branch.

## Verification

1. `npx tsc --noEmit` clean.
2. On iOS sim, signup completes successfully end-to-end. The order of questions is role → about-you → account.
3. The "Log in" footer is invisible on steps 2 and 3.

Commit message: `ui-3: flip signup so role selection is the first step`
````

### Subsequent prompts — outline (ask Claude to expand each when ready)

- **UI-4 — `ChoiceCard` component** (extract role-card pattern, reuse for goals / frequency / specialty).
- **UI-5 — `SegmentedProgress` component** (replace the thin bar; pulse on current step).
- **UI-6 — Custom DOB picker** (replace iOS spinner with snap-scroll lime-bar inline picker).
- **UI-7 — Screen-transition motion** (slide+fade between onboarding steps via Reanimated layout transitions or react-native-screens animation prop).
- **UI-8 — Splash + welcome reveal** (cold-launch splash with Mentorix wordmark; post-signup "You're in, {firstName}" hero).
- **UI-9 (optional, feature work) — Goals / frequency / specialty fields** (adds the questions and the user-doc fields they write to).
- **UI-10 — Daily-use polish** (the workouts tab, today screen, workout execution — pass tokens + motion onto already-refactored screens).

---

## Part 5 — Logo

Three concepts shown in chat:

- **A — Peak M.** Inverted M, centre points up like a mountain. Reads as "rise" / "summit". Best in dark themes; works as both icon and wordmark monogram.
- **B — Rise marks.** Two stacked chevrons. Abstract. Signals progression without committing to the M letterform.
- **C — Bold M reversed.** High-shoulder M reversed onto a lime tile. Most assertive, highest brand recognition at App Store thumbnail size.

For the icon at App Store scale (60×60 in search results), C reads loudest because the lime tile pops. For an in-app wordmark + dark-themed splash, A is more elegant. Many fitness brands use one mark in two arrangements: lime-on-dark for in-app, dark-on-lime for the App Store icon — A and C could be the same brand at different applications.

**Next step on logo:** vote on a direction (A / B / C / hybrid), then I can produce a refined SVG in vector form (Figma-importable) plus the App Store icon at 1024×1024 PNG.

---

## How to use this document

1. Pick a logo direction (or ask for refinements).
2. Apply Prompt UI-1 first — it's the foundation. Without those tokens and the InputField, the screen redesigns can't land.
3. Apply UI-2 (login).
4. Apply UI-3 (role-first signup).
5. Stop and look. Decide whether to keep going through UI-4 → UI-10 or take a break and ship a TestFlight build with just these wins.

The visual jump from "current state" to post-UI-3 is already substantial. Most of the "premium fitness" feel comes from UI-1's typography upgrade + UI-2's brand-forward login. Everything after is iteration.
