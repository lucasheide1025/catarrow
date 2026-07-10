# Frontend Development Guidelines

> Best practices for frontend development in this project.

---

## Overview

This directory contains guidelines for frontend development. Fill in each file with your project's specific conventions.

---

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Directory Structure](./directory-structure.md) | Module organization and file layout | To fill |
| [Component Guidelines](./component-guidelines.md) | Component patterns, props, composition | To fill |
| [Hook Guidelines](./hook-guidelines.md) | Custom hooks, data fetching patterns | To fill |
| [State Management](./state-management.md) | Local state, global state, server state | To fill |
| [Quality Guidelines](./quality-guidelines.md) | Code standards, forbidden patterns | To fill |
| [Type Safety](./type-safety.md) | Type patterns, validation | To fill |
| [Dungeon System](./dungeon-system.md) | Dungeon contracts, role model, contract types, dark-mode admin | ✅ Active |
| [Cat Companion](./cat-companion.md) | Cat roles, individual stat allocation, skill traits, shared combat calculation | ✅ Active |
| [RPG Equipment](./equipment-system.md) | Equipment bonus formula, upgrade display, and equipment-page contracts | ✅ Active |
| [Inventory and Coin Shop](./inventory-shop-system.md) | Backpack boundaries, shop rotation, catalog safety, and atomic purchases | ✅ Active |
| [Practice Simulator](./practice-simulator.md) | Real target formats, qualification timing signals, timeout behavior, and detailed records | ✅ Active |
| [Shared Target Face](./target-face.md) | Canonical target geometry, scoring, landing coordinates, and battle integration | ✅ Active |
| [Battle Practice Analysis](./battle-practice-analysis.md) | Personal shooting context, raw battle-arrow analysis, history sources, and true averages | ✅ Active |
| [Cat Village and Gathering](./cat-village-gathering.md) | Mobile village information architecture, gathering contracts, attempts, rewards, and future co-op boundary | ✅ Active |
| [Access Control Tiers](./access-control-tiers.md) | Student tier gating, adjustable permission matrix, frozen/maintenance locks, and the Firestore security boundary | ✅ Active |
| [Guild Quest System](./guild-quest-system.md) | Three quest generators sharing `guildQuests`, the `questSubtype` validation gotcha, and the client-triggered daily-refresh pattern | ✅ Active |
| [Guest / Kid Mode](./guest-kid-mode.md) | `accountType` account model, doc-ID-agnostic login lookup, in-place official conversion, official-only query filtering, `deleteField()` sentinel gotcha, anonymous-auth-reuse production incident | ✅ Active |
| [Firestore Cost Optimization](./firestore-cost-optimization.md) | Session-cache pattern for the hottest write path (`computeExcavationPatch`), one-off-fetch vs live-listener convention, `limit()` over new-index tradeoffs | ✅ Active |
| [Booking System](./booking-system.md) | Atomic slot-capacity transaction contract, three shared entry points, `bookingBetaAccess`/`accessControl.js` dual-gating, hidden-URL tradeoff, uniform-1hr known limitation | ✅ Active |

---

## How to Fill These Guidelines

For each guideline file:

1. Document your project's **actual conventions** (not ideals)
2. Include **code examples** from your codebase
3. List **forbidden patterns** and why
4. Add **common mistakes** your team has made

The goal is to help AI assistants and new team members understand how YOUR project works.

---

**Language**: All documentation should be written in **English**.
