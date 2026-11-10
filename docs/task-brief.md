# Candidate brief snapshot

Source: https://app.notion.com/p/Dwello-task-4121b4ca63c980d482cde22eedfff233

The source export used placeholder links for repository filenames. For working project links, use [AGENTS.md](../AGENTS.md), [PLAN.md](../PLAN.md), [DECISIONS.md](DECISIONS.md), [AI_LOG.md](AI_LOG.md), and [README.md](../README.md). `CLAUDE.md` was named as an example in the brief and is not present in this repository.

Snapshot retrieved: 2026-11-08. The content below preserves the fetched candidate brief, including its source formatting. This is requirements evidence, distinct from the supplied GPT architecture handoff.

# Part A: Candidate brief

## Listing Inbox Normalizer

### Context

Brokers send us property listings in WhatsApp groups. The messages are messy: English, Arabic or both, Arabic-Indic digits, several listings in one message, reposts, buyer requests mixed in with listings, and plenty of noise. Before a listing reaches our marketplace, someone has to turn it into structured data and decide whether it can be trusted.

Build a small service that does this.

### How we want you to work

<i>Build this with AI coding agents</i> (Claude Code, Cursor, Codex, Copilot agent mode, or any other). We're assessing how you build software with agents, not whether you can avoid them. Don't hide your AI use, because that's the thing we're grading. Think of yourself as the engineer who owns the result: the agent writes much of the code, and you're accountable for every line.

### Functional requirements

1. <i>CLI:</i> process \<input.jsonl> reads raw messages and writes one JSON result per message to stdout, following the contract below.
2. <i>HTTP API:</i>
   - POST /messages ingests one raw message and returns its result.
   - GET /listings?needs\_review=true\|false lists the stored listings.
   - POST /listings/\{id\}/approve marks a reviewed listing as approved.
3. <i>Persistence:</i> SQLite or any embedded store. No external infrastructure should be needed to run it.
4. <i>Classification:</i> each message is a listing, project (off-plan development), buyer\_request or irrelevant.
5. <i>Extraction:</i> pull out the structured fields. One message can contain several listings.
6. <i>Normalization:</i> convert Arabic-Indic digits, normalize prices (3.2M, 950 ألف, 3,200,000) to numbers, and normalize Saudi phone numbers to E.164 (+9665XXXXXXXX).
7. <i>Deduplication:</i> detect when an incoming listing is the same property as one already stored, even if a different broker reposted it with different wording.
8. <i>Review flagging:</i> a listing goes to human review when data is missing, contradictory or uncertain, and each flag gives a reason a human can read.

### The one hard rule

<i>Never invent data.</i> A wrong price is worse than a missing one. If a value isn't in the message, it's null and the listing gets a review reason. If you infer anything (for example, a city from a district name), that's a decision you have to document and justify.

### Output contract (minimum; you may add fields)

```json
json
{
"message_id": "m-001",
"classification": "listing | project | buyer_request | irrelevant",
"listings": [
{
"id": "string",
"purpose": "sale | rent | null",
"property_type": "villa | apartment | studio | land | townhouse | other | null",
"city": "string | null",
"district": "string | null",
"bedrooms": "int | null",
"bathrooms": "int | null",
"area_sqm": "number | null",
"price": { "amount": "number | null", "currency": "SAR", "period": "total | yearly | monthly | null" },
"contact_phone": "+9665XXXXXXXX | null",
"needs_review": true,
"review_reasons": ["price_missing", "..."],
"duplicate_of": "listing id | null"
}
]
}
```

A buyer\_request or irrelevant message returns "listings": \[\].

### Sample input (messages.jsonl)

jsonl

```json

{"id":"m-001","sender":"+966551234567","received_at":"2026-11-01T09:12:00+03:00","text":"For Sale – Villa in Al Malqa, Riyadh. 5 BR, 6 baths, 450 sqm land / 380 sqm BUA. Price 3.2M SAR negotiable. Call Ahmed 0551234567"}
{"id":"m-002","sender":"+966509876543","received_at":"2026-11-01T09:40:00+03:00","text":"للبيع شقة في حي النرجس، الرياض. ٣ غرف نوم، ٢ دورة مياه، المساحة ١٦٥ م². السعر ٩٥٠ ألف ريال. للتواصل: ٠٥٠٩٨٧٦٥٤٣"}
{"id":"m-003","sender":"+966533334444","received_at":"2026-11-01T11:05:00+03:00","text":"Villa for sale Malqa district Riyadh 5 bedrooms 380m2 built-up, asking 3,200,000 SAR. WhatsApp +966 55 123 4567"}
{"id":"m-004","sender":"+966541112222","received_at":"2026-11-01T12:30:00+03:00","text":"Apartment for rent in Al Olaya, 2BR furnished, 85,000/yr, 2 payments"}
{"id":"m-005","sender":"+966567778888","received_at":"2026-11-01T13:00:00+03:00","text":"Looking for a 4BR villa in north Riyadh, budget up to 2.5M, cash buyer. Brokers welcome"}
{"id":"m-006","sender":"+966512223333","received_at":"2026-11-01T14:15:00+03:00","text":"New launch: Al Waha Residences, Jeddah. Off-plan, 1–4 BR units from SAR 780K. Handover Q4 2028, 10% down payment"}
{"id":"m-007","sender":"+966555556666","received_at":"2026-11-01T15:20:00+03:00","text":"Land for sale in Obhur, Jeddah, 900 sqm, SAR 2,500/sqm (total 2.1M)"}
{"id":"m-008","sender":"+966598887777","received_at":"2026-11-01T16:00:00+03:00","text":"شقة للإيجار – Al Rawdah, Jeddah – 3BR – السعر عند التواصل"}
{"id":"m-009","sender":"+966501010101","received_at":"2026-11-02T07:30:00+03:00","text":"صباح الخير جميعاً 🌹 جمعة مباركة"}
{"id":"m-010","sender":"+966520202020","received_at":"2026-11-02T10:10:00+03:00","text":"Available now: 1) Studio Al Yasmin 35K/yr 2) 2BR Al Yasmin 55K/yr 3) 3BR Hittin 80K/yr. Call 0520202020"}
```

We'll also run your CLI against a <i>hidden set</i> of messages like these, so build for the general problem rather than only these ten.

### Technical constraints

- Use any language or framework you like.
- You can use an LLM inside the product for extraction. If you do:
  - the test suite must run <i>offline with no API key</i>;
  - malformed or invented LLM output must be caught;
  - the README must explain cost and latency for each message.
- Include one command that runs the tests and one that starts the service.
- Commit no secrets. Provide a .env.example.

### Deliverables (a private Git repo shared with us)

1. <i>Working code with tests.</i> The tests must check behaviour, not just that a function runs.
2. <i>Git history in small, meaningful commits.</i> One giant commit hurts your score.
3. <i>Your agent setup:</i> the [CLAUDE.md](http://claude.md/), [AGENTS.md](http://agents.md/), rules files, custom commands or sub-agents you used.
4. [<i>PLAN.md</i>](http://plan.md/)<i>:</i> the spec or plan you, or you and the agent together, wrote <i>before</i> implementation. Keep it as it was and don't rewrite it afterwards.
5. [<i>DECISIONS.md</i>](http://decisions.md/)<i>:</i> at least five decisions you made and why. Include <i>at least three places where the agent got something wrong</i>, how you caught each one and what you changed.
6. <i>AI\_LOG.md or exported transcripts:</i> your key agent sessions. Summaries are fine, but show the prompts that mattered.
7. [<i>README.md</i>](http://readme.md/)<i>:</i> setup, how to run, known limitations, and what you'd do next with another day.

### Time

Aim for about \*5 focused hours. Please don't spend a weekend on it, because a polished but over-built result doesn't score higher. You have \*<i>3 days</i> to submit. If you run out of time, write down what's unfinished. Being honest about gaps scores better than pretending they don't exist.

### What happens next

After you submit, we'll have a <i>60-minute live session</i>. You'll share your screen and extend your solution with your agent setup while we watch. Have your environment ready.
