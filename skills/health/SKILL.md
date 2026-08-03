---
name: health
description: Placeholder skill for future nutrition / health tracking and integration with external health APIs. Not implemented yet — read QUESTION.md before building anything here.
---

# Health (future work)

## Status: NOT IMPLEMENTED — placeholder

This skill reserves the design intent for health tracking: documenting nutrition, intake,
and wellbeing, and (in the future) connecting to external health APIs.

The current dashboard intentionally does **one thing at a time**. Task planning is in
motion; health comes after. Nothing in the core depends on health data.

## Intended shape (provisional)

- A new entity for health/nutrition records (date, type, amount/values, notes).
- The status layer (`skills/status/SKILL.md`) would aggregate health records into the
  per-area health signal for the `health` area.
- External health APIs plug in behind the same status layer — the dashboard consumes their
  output, it does not couple to any vendor.

## Before building

Read `QUESTION.md` (section "Health / future") for the open questions and answer them first.
Do not scaffold a health feature until the user has specified the scope.
