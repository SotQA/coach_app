---
name: session-updater
description: Log your development session — accomplishments, blockers, and exact stopping point. Use this at the end of each coding session (VS Code Claude or Cowork) to document what you built, what stopped you, and where to resume next time. This skill asks you 6 questions, formats the answers into a structured entry, and appends it to `.claude-dev/session-log.md`. Invoke with `/session-update` or say things like "log my session", "end-of-session update", "document what I did today", "record progress", "session summary".
compatibility: Requires file access to .claude-dev directory in your project
---

# Session Updater

## Overview

This skill helps you close out a development session by capturing what you accomplished, what stopped you, and exactly where to resume next time. It prevents context loss across sessions by creating a structured record that both Claude instances (VS Code and Cowork) can read.

At the end of your coding session, invoke this skill and answer 6 quick questions. The skill formats your answers into a session log entry and appends it to `.claude-dev/session-log.md`.

## How to Use

### Step 1: Invoke the Skill

When you're done working and ready to end the session, trigger the skill by:
- Typing `/session-update` 
- Saying "log my session" or "end-of-session update"
- Asking to "document what I did today"

### Step 2: Answer the Questions

The skill will ask you these 6 questions in order. Answer each one directly and concisely:

1. **What did you accomplish today?** — List features built, bugs fixed, refactors done. Focus on completed work.
2. **Where did you stop exactly?** — File path and line number (e.g., `src/components/Button.tsx:47`). This is the exact spot to resume from.
3. **What blockers/issues did you hit?** — What stopped progress? What didn't work as expected?
4. **Any new bugs discovered or existing issues found?** — Issues you uncovered but didn't fix.
5. **What should the next session focus on?** — Priority for next time. Should this be task X, or is there a dependency we need to unblock first?
6. **Anything else the next Claude should know?** — Environment setup needed? Critical context? Dependencies on external systems?

### Step 3: The Skill Formats and Appends

After you answer all 6 questions, the skill will:
- Capture the current date and time
- Determine which interface you're using (VS Code Claude or Cowork)
- Format your answers into a structured markdown entry
- Append the entry to `.claude-dev/session-log.md`
- Confirm the update was successful

## Expected Output Format

The skill produces a session log entry that looks like this:

```markdown
## Session: 2026-07-21, 3:45 PM - Cowork
**Duration:** [Estimated based on context, or you specify]
**Goal:** [First question — what you set out to do]

### Completed
- ✅ Built authentication modal
- ✅ Fixed login button styling
- ✅ Refactored auth service

### Attempted but Incomplete
- 🔶 Database migration (blocked by missing schema)
  - Blocker: Need to coordinate with backend
  - Next step: Wait for schema confirmation

### Challenges/Insights
- Login modal was more complex than expected due to form validation
- Discovered bug in error message display

### Stopping Point
**File:** `src/auth/AuthModal.tsx:142`
**Duration estimate:** 2 hours
**Context needed next:** Database schema should be confirmed by then
**Recommendation:** Start with the database migration next session since login modal is complete
```

## Key Things to Remember

**Be specific about the stopping point.** Include the exact file path and line number. This saves 10+ minutes of context rebuilding in your next session.

**Distinguish completed from incomplete.** If you partially completed something, note the exact stopping point within that task so the next session knows how far you got.

**Document blockers clearly.** If something stopped you, explain what needs to happen to unblock it. This helps the next session plan better.

**Think about the next session.** Your recommendation section should make it obvious what the next priorities are — no deliberation needed when you resume.

## Workflow Tips

**Use this at the END of every session** — make it a habit. Set a reminder if you need to. 5 minutes to document saves 20+ minutes of context-rebuilding next time.

**If you're mid-task:** Still log it. Note that feature X is 60% complete, here's the exact line you stopped at, here's why you stopped, here's what's left.

**If multiple things happened:** List them all in Completed. If you hit multiple blockers, list them all in Challenges.

**The next Claude will read this first.** Write for a blank slate. Assume the next session has no memory of what you were doing.

## File Location

The skill writes to:
```
.claude-dev/session-log.md
```

This file lives in your project root, co-located with your code. Both VS Code Claude and Cowork Claude can read it.

If `.claude-dev/session-log.md` doesn't exist yet, the skill will create it with a header.

## Archiving Old Sessions

As session-log.md grows, you can periodically archive old entries:
1. When the file has 50+ sessions
2. Move sessions older than 3 months to `.claude-dev/archive/session-log-2026-Q2.md` (or the relevant quarter)
3. Start fresh with a new session-log.md

Both files remain searchable if you need to find something from an old session.

## Integration with Your Workflow

This skill works best when combined with:
- **state.md** — Update this with new features/bugs found (the skill helps identify what to add)
- **roadmap.md** — Check off completed tasks here; the skill tells you what to check
- **architecture.md** — If you discovered design decisions, note them here

---

## Example Session

**Scenario:** You spent a 2-hour session building a user profile page, hit a styling issue, and need to connect it to the database tomorrow.

**Your answers:**
1. Accomplishment: "Built user profile page component with avatar, bio, and edit mode"
2. Stopping point: "src/pages/Profile.tsx:89 — the save button handler"
3. Blockers: "Profile photo upload styling doesn't work on mobile; need to debug CSS"
4. Bugs found: "Avatar doesn't update immediately after upload; seems to be cache issue"
5. Next focus: "Fix the avatar upload cache issue, then connect profile updates to database"
6. Other context: "Avatar component is in src/components/Avatar.tsx; database schema for user_profiles is ready"

**Result in session-log.md:**
```markdown
## Session: 2026-07-21, 6:30 PM - VS Code
**Duration:** ~2 hours
**Goal:** Build user profile page component

### Completed
- ✅ Created Profile page component with avatar, bio, edit mode
- ✅ Implemented edit form with validation

### Attempted but Incomplete
- 🔶 Mobile styling for photo upload (CSS not rendering correctly)
  - Blocker: CSS media query issue with upload input
  - Next step: Debug with DevTools, check Tailwind config

### Challenges/Insights
- Avatar doesn't refresh immediately after upload — appears to be browser cache
- Edit mode validation works but error messages could be clearer
- Component is more complex than expected due to file upload handling

### Stopping Point
**File:** `src/pages/Profile.tsx:89`
**Duration estimate:** 2 hours
**Context needed next:** Avatar component location: `src/components/Avatar.tsx`. Database schema for user_profiles is ready.
**Recommendation:** First, fix avatar cache issue (clear browser cache on upload). Then connect profile form to API. Mobile styling can be a follow-up if it's not critical.
```

When you start the next session, you'll read this entry and immediately know: where to start (line 89 of Profile.tsx), what's done, what needs work, and exactly what to do next.
