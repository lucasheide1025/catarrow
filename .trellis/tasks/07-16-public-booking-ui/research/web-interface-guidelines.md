# Web Interface Guidelines notes — 2026-07-16

Source: https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md

Relevant requirements for this task:

- Use semantic buttons for actions and anchors for navigation; icon-only controls require aria-label.
- Inputs need associated labels, meaningful name/autocomplete, correct type/inputMode, inline actionable errors, and no blocked paste.
- Interactive elements require visible focus-visible states; do not remove outline without replacement.
- Touch targets must be comfortable on mobile; full-bleed/fixed layouts need safe-area handling and must avoid horizontal overflow.
- Async status and validation use aria-live; modals contain overscroll.
- Animations use transform/opacity and honor prefers-reduced-motion; avoid transition: all.
- Use Intl for date/time/currency formatting rather than hardcoded locale formatting.
- Preserve zoom, keyboard access, empty states, long text handling, and explicit image dimensions.
