# Video script (target 2:50, hard limit under 3:00)

Rules from the hackathon: under 3 minutes, public on YouTube, footage of the project working, no third-party trademarks
or copyrighted music without permission. Use fictional names only. Add captions (YouTube auto-captions, then correct them).

**Recording setup:** 1920×1080, browser zoom 110–125%, one browser window, bookmarks bar hidden, dev tools closed.
Record each shot separately and cut them together. Don't linger on PayPal's own pages or logos; Turnwise's screens are
enough to show PayPal is doing the work (the ledger shows real PayPal IDs).

**Before recording:**
1. On the hosted site run `pnpm circles:tidy` (see JUDGES.md / deploy notes) so the Circles list is clean.
2. Judge mode → **Load the demo circle** (fresh copy).
3. Judge mode → **Start a live circle** about 1 minute before you film shots 4–6, so it is mid-run when you arrive.
4. Practise the ledger question twice so the take is clean.

| Time | On screen | Voiceover (plain, unhurried) |
| --- | --- | --- |
| 0:00–0:15 | Black title card: "₦10 million in ajo savings, gone." Then: "Source: Legit.ng, Aug 2026" in small text. Fade to the Turnwise home page. | "In August, a Lagos businesswoman lost ten million naira in ajo savings. Savings circles fail in two ways: the collector keeps the pot, or someone who collects early stops paying." |
| 0:15–0:30 | Home page headline, then Judge mode. | "Turnwise is a savings circle without the collector. PayPal moves the money. Three AI agents run the circle. And a policy gate written in code decides every money move." |
| 0:30–0:50 | Simulated circle: **Home** with the turn ring. Hover over a filled member, then a gold one. | "This circle has eight members in Lagos, London and Houston, saving a hundred dollars a month. Filled members have collected. Gold members are still waiting. This history is simulated, and it's labelled that way." |
| 0:50–1:05 | **Charter** tab: the rules in plain words. Type "Can we add my cousin mid-cycle?" → Ask the Treasurer → the draft "needs every member". | "The Treasurer agent drafted these rules from plain words, and every member approved them. Ask it to change one, and it explains what would change and drafts it for everyone to approve. Nothing changes until they all do." |
| 1:05–1:20 | **My mandate** as Efe: type "I'll pay when I can" → the question comes back. | "Each member tells their Turn Agent what they need. 'When I can' isn't something code can enforce, so the agent asks for an amount." |
| 1:20–1:40 | Switch to the **live circle**. Show the "Live in the PayPal sandbox" and "Demo time, accelerated" flags. **Ledger**: real PayPal IDs on contributions. | "This one is live in the PayPal sandbox, on accelerated demo time. Each payment is authorized from the member's saved PayPal wallet five days before it's due, and captured on the due date. These are real PayPal IDs." |
| 1:40–1:55 | **Auction** while open: click **Send an over-cap outside bid** → Rejected: over mandate cap. | "When the pot is complete, the agents place sealed bids. An outside assistant can bid too, over MCP. This one bid nine dollars for a member whose mandate allows two. The gate rejected it." |
| 1:55–2:10 | **Home** Latest notices: Ada's reminder, the window to pay, her deposit used. | "In cycle two, Ada misses a payment. The agreed steps run: a reminder, grace days, a window to pay, and then her deposit keeps the pot whole. The Guardian explains each step to her. Code decides them." |
| 2:10–2:30 | Back to the **simulated circle → Ledger**. Type "Who has paid late twice?" → Ask → Chidi (2). Click a row → the audit drawer. | "The ledger is AG Grid. Ask it a question in plain words. The answer is a grid view, checked against AG Grid's own schema before it's applied. Every row shows the agent, the rule the gate applied, and the PayPal ID." |
| 2:30–2:42 | Live circle **Passport** → **Check against PayPal now** → $0.00. | "When the circle finishes, every payout is confirmed with PayPal, and the ledger is reconciled against PayPal's records. The difference: zero." |
| 2:42–2:52 | **Trust** console: the meters, then a slow pan of the action log. End card: "Turnwise. Your savings circle, without the collector." and the repo URL. | "Agents propose. The gate decides. Turnwise." |

**Check before uploading:** length under 3:00; captions corrected; no music unless royalty-free and credited; no
real names or faces without consent; the "demo time, accelerated" flag is visible whenever time is sped up.
