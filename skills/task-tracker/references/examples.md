# Example Populated JSONs

## tasks.json (abbreviated)

```json
{
  "meta": { "version": "1.0", "last_updated": "2025-07-20T08:00:00Z" },
  "projects": {
    "enactus_econow": {
      "name": "Enactus EcoNow",
      "description": "Candle-making social enterprise under Enactus UNM 25/26 term",
      "tasks": {
        "enactus_candle_cost_model_20250720": {
          "title": "Build candle cost model spreadsheet",
          "description": "Create a full COGS breakdown for EcoNow candles including wax, wick, fragrance, jar, labour",
          "plan": "Gather supplier quotes first, then build the Excel model with per-unit and batch cost views",
          "priority": "high",
          "status": "active",
          "deadline": "2025-08-01",
          "duration_estimate": "4 days",
          "created_at": "2025-07-20T06:00:00Z",
          "updated_at": "2025-07-20T06:00:00Z",
          "done_at": null,
          "tags": ["finance", "operations"],
          "atoms": [
            {
              "id": "atom_3c8f12",
              "title": "COGS modelling for physical goods",
              "description": "How to structure a cost of goods sold model for a manufacturing micro-enterprise",
              "transferred": false
            },
            {
              "id": "atom_7a1d90",
              "title": "Supplier quote negotiation",
              "description": "Process of sourcing and comparing supplier quotes for raw materials",
              "transferred": false
            }
          ],
          "subtasks": {},
          "notes": ""
        }
      }
    },
    "hermes": {
      "name": "Hermes Financial Intelligence Pipeline",
      "description": "Automated investment research pipeline with multi-agent architecture",
      "tasks": {
        "hermes_sec_agent_20250718": {
          "title": "Build SEC filing scraper agent",
          "description": "Agent that fetches 10-K/10-Q from EDGAR and extracts key financial ratios",
          "plan": "Use EDGAR full-text search API, parse XBRL where available, fallback to HTML scraping",
          "priority": "critical",
          "status": "active",
          "deadline": "2025-07-28",
          "duration_estimate": "1 week",
          "created_at": "2025-07-18T09:00:00Z",
          "updated_at": "2025-07-18T09:00:00Z",
          "done_at": null,
          "tags": ["python", "agents", "finance", "scraping"],
          "atoms": [
            {
              "id": "atom_bb2211",
              "title": "EDGAR XBRL data extraction",
              "description": "Parsing XBRL structured financial data from SEC EDGAR full-text search API",
              "transferred": false
            },
            {
              "id": "atom_cc3322",
              "title": "Financial ratio extraction from 10-K",
              "description": "Which fields to pull from annual filings to compute standard valuation ratios",
              "transferred": false
            }
          ],
          "subtasks": {},
          "notes": ""
        }
      }
    }
  }
}
```

---

## knowledge.json (abbreviated)

```json
{
  "meta": { "last_updated": "2025-07-20T10:00:00Z", "total_atoms": 3 },
  "atoms": [
    {
      "id": "atom_a3f9c1",
      "title": "LoRa packet framing for telemetry",
      "description": "How to structure variable-length LoRa packets with a CRC tail for reliable 915 MHz telemetry links.",
      "source_task": "rocket_lora_integration_20250710",
      "source_project": "rocket_telemetry",
      "learned_at": "2025-07-10T14:22:00Z",
      "tags": ["embedded", "LoRa", "radio", "telemetry"],
      "notes": "Also useful for MeshSOS RF layer"
    }
  ]
}
```

---

## daily-brief.log (example output line)

```
========== 2025-07-21 08:00 ==========
📅 DAILY BRIEF — Monday, 21 July 2025

🔥 OVERDUE
  (none)

⚠️  DUE THIS WEEK
  • Build SEC filing scraper agent — Hermes — due 2025-07-28 (7 days)
  • Build candle cost model spreadsheet — EcoNow — due 2025-08-01 (11 days)

🎯 TOP PRIORITIES (active/pending, by urgency)
  1. Build SEC filing scraper agent — Hermes — CRITICAL — due 2025-07-28
  2. Build candle cost model spreadsheet — EcoNow — HIGH — due 2025-08-01

💡 SUGGESTED FOCUS TODAY
  Start with the SEC filing scraper — it's critical priority with a 7-day deadline.
  Aim to finish the EDGAR API integration today so you can test XBRL parsing tomorrow.

📚 RECENT ATOMS (last 7 days)
  • LoRa packet framing for telemetry — learned from rocket_lora_integration_20250710
```
