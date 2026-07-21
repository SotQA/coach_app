# Claude Development Notes

📍 **You are here:** This is the Claude-specific documentation for this project.

## Quick Links
- 🎯 **Where are we?** → [state.md](./state.md)
- 📋 **What's next?** → [roadmap.md](./roadmap.md)
- 📖 **What happened last session?** → [session-log.md](./session-log.md)
- 🏗️ **How is this built?** → [architecture.md](./architecture.md)

## 30-Second Orientation
1. Read the **last entry in [session-log.md](./session-log.md)** - tells you what you were doing
2. Check **[state.md](./state.md)** - current app state and architecture
3. Look at **[roadmap.md](./roadmap.md)** - what's prioritized to work on
4. Reference **[architecture.md](./architecture.md)** if you need design context

## On Starting a New Session
1. Open `.claude-dev/session-log.md` and read the most recent "Stopping Point" section
2. Verify the recommended file/line from last session
3. Check [roadmap.md](./roadmap.md) to see what's prioritized
4. If running locally: follow setup steps noted in [state.md](./state.md)

## On Ending a Session
1. Use the `/session-update` skill to log your session
2. Update the highest-priority items in [roadmap.md](./roadmap.md) checkbox statuses
3. Update [state.md](./state.md) with any new features or discovered issues
4. The skill automatically handles session-log.md

## Maintenance
- **state.md** - Update every session (what got built, what's working)
- **roadmap.md** - Update when priorities change or tasks complete
- **session-log.md** - Updated automatically by `/session-update` skill (required every session)
- **architecture.md** - Update when major decisions change (less frequent)

## Using the Session Updater Skill
At the end of each session, trigger: `/session-update` or say "log my session"

The skill will ask 6 questions, then automatically format and append your session to session-log.md. No manual editing needed.
