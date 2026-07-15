# Web Interface Guidelines notes — 2026-07-16

Source: https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md

Relevant requirements for the static mobile navigation:

- Navigation uses anchors; menu button retains aria-label and aria-expanded.
- Mobile CTA targets are at least 44px and have visible focus-visible styles.
- Do not disable browser zoom or rely on hover.
- Avoid transition: all; animate only explicit properties and honor prefers-reduced-motion.
- Prevent horizontal overflow and account for mobile safe areas when positioning fixed actions.
