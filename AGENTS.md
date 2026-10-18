# Project rules
- Keep the startup fallback outside the React root until the first committed render so module or mount failures cannot erase recovery controls.
- Restore auth sessions during initialization and sign out only on explicit user action so reload-based recovery preserves access.