---
name: jane-desk-router
description: Compatibility router for Life-at-a-Glance requests. Delegate to jane-desk-main, the primary cross-agent entry skill; do not use for general dashboard development.
---

# Jane-Desk router (compatibility entry)

Load `jane-desk-main/SKILL.md` from the same installed Jane-Desk bundle, then follow its routing decision. New integrations should select `jane-desk-main` directly.

Never edit `data/life.db`, even if the API is unavailable.
