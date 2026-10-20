# Project rules
- Keep the startup fallback outside the React root until the first committed render so module or mount failures cannot erase recovery controls.
- Restore auth sessions during initialization and sign out only on explicit user action so reload-based recovery preserves access.
- Lazy-load pages so map and analytics dependencies are not part of the initial reload download.
- Report creation notifies supervisors through a database trigger in the same transaction; clients must not broadcast duplicate new-report notifications.
- Share compressed photo verification and versioned cooldown handling across citizen report forms to keep AI fallback consistent.
