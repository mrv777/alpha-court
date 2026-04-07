# Alpha Court — AI Agents Debate Your Trades

> *"I don't trust one AI. I don't trust one signal. So I built a courtroom where 3 AI analysts argue about every trade — and I watch the trial."*

## Overview

Alpha Court is a web app where three AI agents — The Bull, The Bear, and The Judge — debate whether to buy a crypto token in real-time, each powered by different on-chain and market data. Users paste a token address, watch the debate unfold with real data citations, receive a verdict, and can share the result.

**Hackathon:** #NansenCLI Mac Mini Challenge — Week 4 (Final Round)
**Deadline:** April 12, 2026, 11:59 PM SGT

## Why This Wins

- **Genuinely novel** — multi-agent debate exists in research (TradingAgents, AI-Trader) but nobody ships it as a consumer-facing product
- **Entertaining to watch** — great for video demo (judges see agents arguing live with real data)
- **Deep Nansen integration** — 14+ CLI endpoints across 3 agents, each querying different data, with Nansen search for token autocomplete
- **Viral** — shareable verdict cards for Twitter, people will want to "put their token on trial"
- **Rides the dominant trend** — 97% of recent ETH hackathon winners involve AI agents

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router), TypeScript, React 19 |
| Styling | Tailwind CSS v4, shadcn/ui, custom dark courtroom theme |
| AI | Gemini 3.1 Flash Lite (`gemini-3.1-flash-lite-preview`) for Bull/Bear, Gemini 3.1 Pro (`gemini-3.1-pro-preview`) for Judge |
| AI SDK | `@google/genai` (Google GenAI SDK) |
| AI Features | Judge uses Google Search grounding for cross-referencing claims against public news/sentiment |
| Primary Data | Nansen CLI (shell exec with caching + retry logic, ported from nansen-ai3) |
| Supplementary Data | DexScreener (DEX price/volume/liquidity, free, no auth), Jupiter Price API (real-time prices), GoPlus Security API (token safety checks) |
| Database | SQLite via better-sqlite3 (WAL mode, caching + trial persistence) |
| Streaming | Server-Sent Events (SSE) via ReadableStream |
| OG Images | Puppeteer server-side screenshot of rendered HTML verdict card |
| Deployment | Docker + nginx on VPS |
| Demo Video | Remotion (separate repo) |

## The Three Agents

### The Bull 🟢

**Role:** Argues FOR buying the token. Finds bullish signals.
**Personality:** Confident, data-driven, urgent. Cites specific numbers. Acknowledges risks only to dismiss them.
**Model:** Gemini 3.1 Flash Lite (`gemini-3.1-flash-lite-preview`) — 1/8 the price of Flash, sufficient for argument generation.

**Nansen data sources:**
1. `smart-money netflow` — SM net capital flow direction
2. `token who-bought-sold` (buy side) — recent SM buyers
3. `token flow-intelligence` — detailed flow by entity label
4. `profiler pnl-summary` — win rate/PnL of top buying wallets

**Supplementary data sources:**
- DexScreener — real-time price, volume, liquidity, FDV, pair age
- Jupiter — real-time USD price

### The Bear 🔴

**Role:** Argues AGAINST buying. Hunts for risks and red flags.
**Personality:** Skeptical, forensic, protective. Highlights concentration risk, exits, declining metrics.
**Model:** Gemini 3.1 Flash Lite (`gemini-3.1-flash-lite-preview`)

**Nansen data sources:**
5. `token dex-trades` — DEX sell pressure and volume
6. `token holders` — holder concentration analysis
7. `smart-money dex-trades` — SM selling activity
8. `token flows --label whale` — whale exit patterns

**Supplementary data sources:**
- DexScreener — sell volume, liquidity depth, pair age (for age-based risk)
- GoPlus — token safety flags (freeze authority, hidden fees, balance-mutable, closable accounts)

### The Judge ⚖️

**Role:** Impartial arbiter. Cross-examines both sides with independent data. Renders verdict.
**Personality:** Measured, authoritative, fair. Evaluates evidence quality, not just quantity.
**Model:** Gemini 3.1 Pro (`gemini-3.1-pro-preview`) — higher reasoning capability for cross-examination and verdict.
**Google Search Grounding:** Enabled. Cross-references claims against public news, sentiment, and recent events.

**Nansen data sources:**
9. `token info` — token metadata (market cap, supply, age)
10. `token ohlcv` — price history and trends
11. `token who-bought-sold` (sell side) — balancing perspective
12. `profiler pnl-summary` — verify wallet quality claims from both sides

**Additional endpoints used:**
13. `search` — token lookup / autocomplete

**Total: 13 Nansen CLI endpoint calls per trial + 3 supplementary API calls**

## Data Sources Architecture

### Nansen CLI (Primary)

All Nansen data is fetched via shell exec of the Nansen CLI (not REST API). This matches the hackathon's focus on the CLI tool and guarantees API compatibility.

- **Wrapper:** Ported from nansen-ai3 (`lib/nansen/client.ts`), adapted for async execution
- **Execution:** `child_process.exec` with promisify (async, non-blocking). Buffers output in memory — fine for JSON responses which are typically small.
- **Timeout:** 45 seconds per command (uniform)
- **Output parsing:** JSON with automatic unwrapping of `{ success, data }` wrapper
- **Auth:** Nansen CLI reads from `~/.nansen/config.json` (volume-mounted in Docker)
- **Cache:** SQLite-backed cache layer (see Cache section)

### DexScreener (Supplementary)

- Free API, no auth, no rate limit key
- Base URL: `https://api.dexscreener.com/tokens/v1/{chain}`
- Provides: real-time prices, liquidity, 24h volume, FDV, market cap, pair creation dates
- Used by Bull (market strength data) and Bear (risk data like low liquidity, young pairs)

### Jupiter Price API (Supplementary)

- Free tier: `lite-api.jup.ag` (no auth)
- Provides: real-time USD prices, decimals, 24h price change
- Used for: real-time price display on trial page

### GoPlus Security API (Supplementary)

- Free, no auth, 30 calls/min limit
- Base URL: `https://api.gopluslabs.io/api/v1/solana/token_security`
- Detects: balance-mutable authority, non-transferable tokens, closable accounts, malicious mint/freeze authority, hidden transfer fees
- Fail-open design: API downtime never blocks the debate
- Used by Bear for security-based arguments and displayed as a safety badge on the verdict

### Data Failure Handling

- **Individual endpoint failure:** Agent proceeds with available data. AI prompt includes: "If data is missing or unavailable, acknowledge it and work with what you have."
- **All data fails for an agent:** Agent argues with reduced conviction using general market context and supplementary data sources. Flagged as "limited data" in the UI.
- **Supplementary API failure:** Silently ignored. These are enrichment, not core data.

## Debate Flow

The debate has 5 phases, executed sequentially. Total runtime: ~60-80 seconds per trial.

### Phase 1: Data Gathering (~10-20s)

All three agents fetch their data **grouped by agent** — each agent's 4 Nansen CLI calls run in parallel (3 groups of 4 concurrent CLI processes). Supplementary API calls (DexScreener, Jupiter, GoPlus) run concurrently with the first agent group. The UI shows a progress grid — each data point lights up as it completes, grouped by agent. All responses flow through a SQLite cache layer (skip CLI call if cached and fresh).

### Phase 2: Opening Statements (~15-20s)

Bull and Bear present their cases **simultaneously** via two parallel Gemini streams. The UI renders both panels streaming at once in the center courtroom panel. Each targets ~200-300 words, citing specific data points using inline citation syntax.

### Phase 3: Rebuttals (~15-20s)

Sequential: Bear rebuts Bull's opening, then Bull rebuts Bear's opening. Each reads the other's statement and responds with a focused ~150-200 word rebuttal, challenging weak points.

### Phase 4: Cross-Examination (~10-15s)

The Judge reads the full transcript plus its own independent data. Uses Google Search grounding to cross-reference claims against public news and sentiment. Asks pointed questions, calls out cherry-picking, evaluates evidence quality.

### Phase 5: Verdict (~10-15s)

The Judge delivers the verdict. This phase uses a **hybrid approach**: the verdict text streams naturally for dramatic effect, followed by a separate non-streaming structured output call to extract the formal scores. This guarantees valid JSON for the scores while keeping the streaming text natural.

**Verdict structure:**
- **Score:** -100 (strong sell) to +100 (strong buy)
- **Label:** STRONG BUY / BUY / HOLD / SELL / STRONG SELL
- **Summary:** 2-3 sentence reasoning
- **Conviction levels:** How convincing each agent was (0-100)
- **Safety badge:** GoPlus security assessment (clean / warnings / dangerous)

### Word Length Control

Each Gemini call includes target word counts in the prompt. A **soft timeout** monitors the streaming output — if a response exceeds 2x the target word count, the stream is stopped. This prevents runaway responses without mid-sentence cuts from hard token limits.

### Phase Failure Handling

If a Gemini call fails during any phase:
1. **Retry once** with the same prompt
2. If still fails, **skip that agent's message** and continue the debate
3. Subsequent phases adapt to missing context (prompts include: "If a previous argument is missing, proceed with available information")

## Token Search & Input

### Search Strategy

**Primary:** Nansen CLI `search` command, debounced at 500ms. Returns tokens that Nansen has data for — validates coverage before starting a trial.

**Fallback:** DexScreener search API for faster results and broader token coverage. If Nansen search is slow (>2s) or returns empty, DexScreener results appear as secondary suggestions with a "Limited Nansen data" warning.

**Input modes:**
- Autocomplete search by name/symbol
- Direct address paste (validated with `nansen token info`)

### Chain Selection

Solana is pre-selected as the default (best Nansen SM coverage). Base and Ethereum available via dropdown. Chain is auto-suggested when possible based on address format.

## Trial Cooldown

**Global per-token cooldown: 30 minutes.** If a trial for the same token address was completed within the last 30 minutes, the user sees the existing trial result with a countdown timer showing when a new trial can be started. This prevents redundant API usage and Gemini costs.

The Nansen data cache (separate from trial cooldown) has its own TTLs per endpoint type, meaning a new trial after the cooldown still benefits from cached data if it's fresh.

## Pages & Routes

### Pages

| Route | Description |
|-------|-------------|
| `/` | Landing page — token input, chain selector, recent trials grid (last 10) |
| `/trial/[id]` | Main debate page — courtroom with live streaming or completed replay |
| `/verdict/[id]` | Shareable verdict page — separate layout optimized for social sharing, minimal JS, OG meta tags |
| `/debug` | Debug page (behind env flag) — cache stats, API timings, Gemini token usage, error rates |

### API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/trial` | POST | Create a new trial (validate token, check cooldown, return trialId) |
| `/api/debate/[id]` | GET | SSE stream for the full debate |
| `/api/verdict/[id]` | GET | Fetch verdict data |
| `/api/verdict/[id]/image` | GET | Render verdict as PNG via Puppeteer screenshot |
| `/api/token/search` | GET | Token search — Nansen CLI primary, DexScreener fallback |
| `/api/debug` | GET | Debug stats (cache, API timings, errors) |

## Database Schema (SQLite, WAL mode)

```sql
-- Cache Nansen CLI responses
CREATE TABLE nansen_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cache_key TEXT UNIQUE NOT NULL,        -- sha256(command + sorted params)
  command TEXT NOT NULL,                  -- full CLI command string
  params_json TEXT NOT NULL,
  response_json TEXT NOT NULL,
  chain TEXT NOT NULL,
  token_address TEXT,
  created_at INTEGER NOT NULL,
  ttl_seconds INTEGER NOT NULL DEFAULT 300
);

-- Track trials
CREATE TABLE trials (
  id TEXT PRIMARY KEY,                   -- nanoid (12 chars)
  token_address TEXT NOT NULL,
  chain TEXT NOT NULL,                   -- 'solana' | 'base' | 'ethereum'
  token_name TEXT,
  token_symbol TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending|gathering|debating|verdict|completed|error
  verdict_score INTEGER,                 -- -100 to +100
  verdict_label TEXT,                    -- 'STRONG BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG SELL'
  verdict_summary TEXT,
  bull_conviction INTEGER,               -- 0-100
  bear_conviction INTEGER,               -- 0-100
  safety_score TEXT,                     -- 'clean' | 'warnings' | 'dangerous'
  safety_details_json TEXT,              -- GoPlus safety check results
  created_at INTEGER NOT NULL,
  completed_at INTEGER,
  error_message TEXT
);

-- Store each debate message for replay (persisted per-phase as each completes)
CREATE TABLE debate_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trial_id TEXT NOT NULL REFERENCES trials(id),
  agent TEXT NOT NULL,                   -- 'bull' | 'bear' | 'judge' | 'system'
  phase TEXT NOT NULL,                   -- 'gathering' | 'opening' | 'rebuttal' | 'cross_exam' | 'verdict'
  content TEXT NOT NULL,
  evidence_json TEXT,                    -- cited Nansen/supplementary data snippets
  sequence INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_trials_token_chain ON trials(token_address, chain);
CREATE INDEX idx_trials_created ON trials(created_at DESC);
CREATE INDEX idx_debate_messages_trial ON debate_messages(trial_id, sequence);
CREATE INDEX idx_nansen_cache_key ON nansen_cache(cache_key);
```

### Cache TTLs

| Data Type | TTL | Reason |
|-----------|-----|--------|
| Token info | 5 min | Price-sensitive metadata |
| OHLCV | 5 min | Price candles change frequently |
| Who-bought-sold, dex-trades | 10 min | Moderately dynamic |
| Smart-money netflow | 10 min | Moderately dynamic |
| Holders, flows | 15 min | Slower-changing structural data |
| Profiler PnL summary | 30 min | Rarely changes |
| DexScreener responses | 2 min | Real-time price data |
| Jupiter prices | 1 min | Real-time prices |
| GoPlus security | 60 min | Token security properties rarely change |

## SSE Event Protocol

The `/api/debate/[id]` endpoint streams the following event types:

```
event: phase
data: { "phase": "data_gathering", "status": "start" }

event: data_progress
data: { "endpoint": "smart-money netflow", "agent": "bull", "status": "complete" }

event: chunk
data: { "agent": "bull", "phase": "opening", "text": "Smart money has been..." }

event: message_complete
data: { "agent": "bull", "phase": "opening", "content": "...", "evidence": [...] }

event: verdict
data: { "score": 47, "label": "BUY", "summary": "...", "bull_conviction": 73, "bear_conviction": 58, "safety": "clean" }

event: error
data: { "message": "Failed to fetch token data", "recoverable": true }

event: done
data: {}
```

### Server-Side Completion

The debate runs **server-side to completion** regardless of client connection state. All messages are persisted to the `debate_messages` table as each phase completes. If the user disconnects and reconnects (or refreshes), they see completed phases instantly from DB and can rejoin the live stream at the current phase.

### Mid-Trial Join (Late Visitors)

When a user navigates to `/trial/[id]` while a trial is in progress:
1. Completed phases are loaded instantly from the `debate_messages` table
2. The client joins the SSE stream at the current live phase
3. This gives late joiners full context without missing anything

### Completed Trial Replay

When navigating to a completed trial: render all messages instantly and auto-scroll to the verdict section. The full transcript is above for those who want to read it.

## UI Design

### Theme

Custom dark courtroom aesthetic (not shadcn default dark mode — fully custom CSS variables and component styles):
- **Background:** Deep navy/charcoal (#0a0e1a to #141824)
- **Bull:** Green family (#22c55e, dark green glow)
- **Bear:** Red family (#ef4444, dark red glow)
- **Judge:** Gold/amber (#f59e0b, gold glow)
- **Typography:** Inter for text (highly readable), JetBrains Mono for data/citations
- **Accessibility:** Minimal — basic semantic HTML, keyboard-navigable token input, sufficient color contrast

### Animation Philosophy: Strategic Drama

- **During debate phases:** Minimal animation. Don't distract from streaming content. Subtle pulse on the active phase indicator, smooth text appearance.
- **During verdict reveal:** Full dramatic treatment — conviction meters animate from 0 to final score, score gauge sweeps to position, verdict label fades in with glow effect, safety badge appears.
- **Phase transitions:** Clean fade/slide between phases. Brief pause for impact before each new phase starts.

### Landing Page (`/`)

```
+----------------------------------------------------------+
|  ALPHA COURT ⚖️                                          |
|  Where AI agents debate your next trade                   |
|                                                           |
|  +------------------------------------------------------+ |
|  | Enter token address or name...         [Solana ▼]    | |
|  +------------------------------------------------------+ |
|                 [ BEGIN TRIAL ]                            |
|                                                           |
|  Recent Trials (last 10):                                 |
|  +--------+  +--------+  +--------+  +--------+          |
|  | $WIF   |  | $BONK  |  | $AERO  |  | $DEGEN |         |
|  | BUY +72|  | HOLD +5|  |SELL -45|  | BUY +61|         |
|  +--------+  +--------+  +--------+  +--------+          |
+----------------------------------------------------------+
```

Recent trials grid shows the last 10 completed trials, loaded statically on page load. Empty state for first use: *"No trials yet — put a token on trial!"*

### Debate Page (`/trial/[id]`) — Desktop

Three-column layout: **Center = live streaming debate (the main show), Sides = static context cards.**

```
+----------------------------------------------------------+
|  ALPHA COURT  |  $TOKEN on Solana     |  Phase: Opening   |
+----------------------------------------------------------+
|                                                           |
| +--Bull Card----+ +---Courtroom---+ +--Bear Card----+    |
| | 🟢 The Bull   | |               | | 🔴 The Bear   |   |
| |               | | [LIVE DEBATE] | |               |    |
| | KEY EVIDENCE: | |               | | KEY EVIDENCE: |    |
| | • +$2.3M SM  | | Bull: "SM     | | • 73% top 10  |    |
| |   netflow    | | netflow shows  | |   holders     |    |
| | • 45 buyers  | | +$2.3M..."    | | • Sell vol 3x  |   |
| | • 78% win    | |               | |   buy vol      |   |
| |   rate       | | Bear: "But    | | • ⚠️ Freeze    |   |
| |               | | holders..."   | |   authority    |   |
| +---------------+ |               | +---------------+    |
|                    | Judge: "..."  |                      |
| +--Judge Bar------+---------------+--------------------+ |
| | ⚖️ The Judge: Cross-examining...              [live] | |
| +------------------------------------------------------+ |
+----------------------------------------------------------+
```

**Side panels:** Agent identity card, key evidence highlights (update after each phase completes), and — at verdict — conviction meters that animate from 0 to final score.

**Center panel:** The main streaming debate text. All agent messages flow here with colored left borders (green/red/gold) and agent labels. This is where the user's attention is focused.

### Debate Page — Mobile

Single-column interleaved stream with colored left borders per agent. During simultaneous streaming (Phase 2), both Bull and Bear chunks appear interleaved in one feed. This creates an exciting "crosstalk" feel that works better on mobile than tabs.

### Inline Citation Chips

Agents use explicit citation syntax in their output: `[[cite:endpoint-name|display value]]`

Examples in Gemini output:
```
Smart money has accumulated [[cite:sm-netflow|+$2.3M net inflow]] over the past 7 days,
with [[cite:who-bought-sold|45 unique SM buyers]] entering positions...
```

The UI parses these during streaming into colored chips:
- **During streaming:** Chip renders inline immediately as the syntax is detected in the stream
- **After click/hover:** Chip expands to show the raw Nansen data snippet (the actual CLI output for that data point)
- **Edge cases:**
  - If Gemini outputs malformed citation syntax, fall back to rendering it as bold text
  - If the cited endpoint data is unavailable (fetch failed), chip renders with a "data unavailable" state
  - Citation chips are stored in the `evidence_json` column for replay

The explicit syntax approach is more reliable than post-hoc matching because:
1. Stream parsing is deterministic (no fuzzy matching during real-time render)
2. Each citation links to a specific data source (no ambiguity about which endpoint sourced a number)
3. Gemini can be instructed to only cite data it actually received, preventing hallucinated citations

### Verdict Display

```
+------------------------------------------+
|            ⚖️  VERDICT                    |
|                                          |
|     [ ← -100 ====●========== +100 → ]   |
|              Score: +47                  |
|                                          |
|            ✅  BUY                        |
|                                          |
|  "Smart money accumulation is genuine,   |
|   but concentration risk limits the      |
|   upside potential..."                   |
|                                          |
|  Bull: ████████░░ 73    Bear: ██████░░░░ 58  |
|                                          |
|  🛡️ Safety: Clean                        |
|                                          |
|  [🔗 Share Verdict]  [📸 Download Card]  |
+------------------------------------------+
```

Conviction meters are hidden/empty until the verdict phase, then animate from 0 to their final scores for dramatic effect.

### Shareable Verdict Page (`/verdict/[id]`)

Separate, dedicated page with its own layout optimized for social sharing:
- Minimal JavaScript, fast server-rendered load
- Large verdict display (score, label, summary, conviction bars)
- Safety badge
- "View Full Trial →" CTA linking to `/trial/[id]`
- OG meta tags (`twitter:card`, `twitter:image`, `og:image`) pointing to `/api/verdict/[id]/image`

### OG Image Generation

Puppeteer server-side screenshot at `/api/verdict/[id]/image`:
- 1200x630px OG image dimensions
- Dark background with courtroom aesthetic (full CSS support via Puppeteer)
- Token name, verdict label (color-coded), score gauge, summary quote
- Bull/Bear conviction bars
- Safety badge
- "Alpha Court" branding

### Debug Page (`/debug`)

Available when `DEBUG_ENABLED=true` in env. Shows:
- Nansen cache hit/miss stats
- API call timings (per endpoint average)
- Gemini token usage (per trial)
- Recent trial error rates
- Active/completed trial counts

## Project Structure

```
alpha-court/
├── app/
│   ├── layout.tsx                     # Root layout, fonts (Inter + JetBrains Mono), metadata
│   ├── page.tsx                       # Landing page
│   ├── trial/[id]/
│   │   └── page.tsx                   # Debate page (SSE consumer)
│   ├── verdict/[id]/
│   │   └── page.tsx                   # Shareable verdict page (separate layout)
│   ├── debug/
│   │   └── page.tsx                   # Debug dashboard
│   └── api/
│       ├── trial/route.ts             # POST: create trial (validate, cooldown check)
│       ├── debate/[id]/route.ts       # GET: SSE debate stream
│       ├── verdict/[id]/
│       │   ├── route.ts               # GET: verdict data
│       │   └── image/route.ts         # GET: OG image PNG via Puppeteer
│       ├── token/search/route.ts      # GET: token autocomplete (Nansen + DexScreener)
│       └── debug/route.ts             # GET: debug stats
├── components/
│   ├── ui/                            # shadcn/ui primitives (custom dark theme overrides)
│   ├── token-input.tsx                # Token address input + autocomplete dropdown
│   ├── chain-selector.tsx             # Solana / Base / Ethereum picker (Solana default)
│   ├── courtroom.tsx                  # Main debate arena — three-column layout
│   ├── agent-panel.tsx                # Side panel agent card (evidence + conviction meter)
│   ├── debate-stream.tsx              # Center panel streaming debate messages
│   ├── debate-message.tsx             # Message bubble with colored border + citation chips
│   ├── citation-chip.tsx              # Inline citation chip (click to expand raw data)
│   ├── evidence-card.tsx              # Expanded Nansen data display
│   ├── data-progress.tsx              # Phase 1 data gathering progress grid (grouped by agent)
│   ├── verdict-display.tsx            # Animated verdict gauge + score + conviction meters
│   ├── verdict-card.tsx               # Verdict layout for OG image rendering
│   ├── safety-badge.tsx               # GoPlus safety assessment badge
│   ├── trial-card.tsx                 # Recent trial card for landing page grid
│   └── share-button.tsx               # Copy link + download image
├── lib/
│   ├── nansen/
│   │   ├── client.ts                  # CLI wrapper (ported from nansen-ai3) — async exec, caching, retry, JSON parsing
│   │   ├── endpoints.ts               # Command builders per endpoint (13 endpoints)
│   │   └── types.ts                   # Response types for each endpoint
│   ├── data/
│   │   ├── dexscreener.ts             # DexScreener API client (ported from nansen-ai3)
│   │   ├── jupiter.ts                 # Jupiter Price API client (ported from nansen-ai3)
│   │   ├── goplus.ts                  # GoPlus Security API client (ported from nansen-ai3)
│   │   └── types.ts                   # Supplementary data types
│   ├── agents/
│   │   ├── bull.ts                    # Bull data fetching + prompt construction
│   │   ├── bear.ts                    # Bear data fetching + prompt construction
│   │   ├── judge.ts                   # Judge cross-exam + verdict prompt (with grounding config)
│   │   └── types.ts                   # Agent interfaces
│   ├── gemini.ts                      # @google/genai SDK wrapper — streaming, structured output, grounding
│   ├── debate-engine.ts               # Orchestrates 5-phase debate (runs server-side to completion)
│   ├── citations.ts                   # Citation syntax parser ([[cite:x|y]] → structured data)
│   ├── db.ts                          # SQLite setup (WAL mode) + queries
│   ├── cache.ts                       # Nansen + supplementary API response cache operations
│   └── utils.ts                       # Formatting (USD, PnL, percentages, addresses)
├── hooks/
│   └── use-debate-stream.ts           # SSE consumer hook (handles reconnection + replay)
├── public/
│   └── agents/                        # Agent avatar images
├── data/                              # SQLite DB files (gitignored, Docker volume mount)
├── package.json
├── tailwind.config.ts
├── tsconfig.json
├── next.config.ts
├── Dockerfile
├── docker-compose.yml
├── .env.example
└── SPEC.md
```

## Agent Prompt Design

### Philosophy: Middle Ground

Clear persona identity + specific analytical framework, but no forced catchphrases or artificial speech patterns. The agents should feel like distinct analysts with different perspectives, not caricatures.

Each agent prompt includes:
1. **Role definition** — who they are and what they argue for
2. **Analytical framework** — what data to prioritize and how to interpret it
3. **Citation instructions** — use `[[cite:endpoint-name|value]]` syntax for all data references
4. **Word target** — specific word count for the phase (opening: 200-300, rebuttal: 150-200)
5. **Context injection** — the actual Nansen + supplementary data for the token
6. **Missing data handling** — "If data is missing or unavailable, acknowledge it and work with what you have. Reduce your conviction accordingly."

### Citation Syntax Prompt

```
When referencing specific data points, use this exact format: [[cite:endpoint-name|display value]]

Examples:
- [[cite:sm-netflow|+$2.3M 7d net inflow]]
- [[cite:who-bought-sold|45 unique SM buyers]]
- [[cite:dexscreener|$12.4M 24h volume]]
- [[cite:goplus|no security flags detected]]

Only cite data you have actually been provided. Never fabricate citations.
```

## Nansen CLI Integration

### Authentication

The Nansen CLI reads its API key from `~/.nansen/config.json`. In Docker, this directory is volume-mounted from the host: `-v ~/.nansen:/root/.nansen:ro`.

### CLI Wrapper (Ported from nansen-ai3)

```typescript
// Async execution via promisified child_process.exec
// 45-second uniform timeout per command
// JSON parsing with { success, data } unwrapping
// SQLite-backed cache layer (skip CLI call if cached and fresh)
// Single retry on failure, then graceful degradation
```

### Execution Flow

Data fetching is **grouped by agent** for controlled concurrency:
1. **Group 1:** Bull's 4 Nansen calls + DexScreener + Jupiter (concurrent)
2. **Group 2:** Bear's 4 Nansen calls + GoPlus (concurrent)
3. **Group 3:** Judge's 4 Nansen calls (concurrent)

Each group's calls run in parallel. Groups run sequentially. This prevents overwhelming the Nansen API while keeping total fetch time reasonable (~15-20s with cache misses).

### Graceful Degradation

If any single Nansen CLI call fails (timeout, error, empty data), the agent proceeds with available data. The AI prompt includes awareness of which data sources are available. If ALL of an agent's data fails, the agent still participates but with reduced conviction, using general market context and supplementary data (DexScreener, GoPlus).

## Response Caching

Every Nansen CLI call and supplementary API call goes through `lib/cache.ts`:
1. Generate cache key: `sha256(command + JSON.stringify(sortedParams))`
2. Check SQLite `nansen_cache` table
3. If hit and not expired → return cached response
4. If miss → execute CLI / fetch API, store in cache, return

## Supported Chains

- **Solana** (default — best SM coverage on Nansen)
- **Base** (secondary)
- **Ethereum** (tertiary)

All three are equivalent for MVP since trading is not included.

## Environment Variables

```
GEMINI_API_KEY=              # Google AI Studio key (billing enabled)
DATABASE_PATH=./data/court.db
NEXT_PUBLIC_APP_URL=         # For OG image URLs and share links
DEBUG_ENABLED=false          # Enable /debug page
JUPITER_API_KEY=             # Optional: Jupiter paid tier for higher rate limits
```

Nansen auth is handled via `~/.nansen/config.json` (volume mount), not env var.

## Build Order (5-Day Sprint)

### Day 1: Foundation
- Init Next.js 15 + TypeScript + Tailwind v4 + shadcn/ui
- Custom dark courtroom theme (CSS variables, Inter + JetBrains Mono)
- SQLite schema + db.ts (WAL mode)
- Port Nansen CLI wrapper from nansen-ai3 (adapt to async exec)
- Port DexScreener, Jupiter, GoPlus clients from nansen-ai3
- Cache layer (SQLite-backed)
- Landing page UI (token input with autocomplete, chain selector, recent trials grid)
- POST /api/trial (create trial, validate token, cooldown check)
- GET /api/token/search (Nansen CLI primary + DexScreener fallback)

### Day 2: Debate Engine
- Gemini wrapper with @google/genai SDK (streaming, structured output, grounding)
- Three agent modules (bull.ts, bear.ts, judge.ts) with prompts + data fetching
- Citation syntax parser
- Debate engine orchestrator (5-phase sequential logic, server-side completion)
- SSE streaming route with debate_messages persistence per phase
- useDebateStream hook (handles reconnection + completed replay)
- Trial page shell with three-column layout + streaming center panel

### Day 3: Polish + Verdict
- Side panel agent cards with evidence highlights
- Inline citation chips (parse during stream, expand on click)
- Data gathering progress grid (grouped by agent)
- Strategic drama animations (verdict reveal, conviction meter animations)
- Verdict display with animated gauge + safety badge
- Shareable verdict page with OG meta tags
- OG image generation via Puppeteer
- Debug page

### Day 4: Hardening + Edge Cases
- Phase failure handling (retry once, then skip)
- Soft timeout for word length control
- Mid-trial join (replay completed phases + join live)
- Empty/error states throughout
- Global per-token cooldown (30 min)
- Mobile responsive layout (interleaved stream)
- GoPlus safety badge integration

### Day 5: Deploy + Demo
- Dockerfile + docker-compose.yml (with ~/.nansen volume mount + data volume)
- Deploy to VPS, test production
- Pre-cache demo tokens for reliable presentation
- Final polish and bug fixes

## Key Dependencies

```json
{
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@google/genai": "^1.0.0",
    "better-sqlite3": "^11.0.0",
    "nanoid": "^5.0.0",
    "puppeteer": "^23.0.0",
    "clsx": "^2.0.0",
    "tailwind-merge": "^2.0.0",
    "lucide-react": "^0.400.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.0.0",
    "typescript": "^5.0.0",
    "@types/node": "^20.0.0",
    "@types/react": "^19.0.0"
  }
}
```

## Stretch Goal: Per-Token Flow Visualization

**Status:** Plan architecture but don't block MVP. Only attempt if MVP ships by Day 3.

If MVP is complete, add a simplified flow visualization to the debate page showing smart money capital flowing in and out of the token. Uses data already fetched in Phase 1 (no additional API calls).

### Simplified Version (Recommended over full animation)

Instead of animated particles, show a **static flow chart** (bar chart of inflows vs outflows by wallet category). Quick to build (1-2 hours), informative, and visually compelling:

```
+--------------------------------------------------+
|              TOKEN FLOW SUMMARY                    |
|                                                    |
|  Inflows                    Outflows               |
|  SM Wallets  ████████████   ███                    |
|  Whales      ██████         ████████               |
|  DEX Traders ████           ██████                 |
|                                                    |
|  Net: +$1.41M (bullish)                           |
+--------------------------------------------------+
```

### Full Version (If time permits)

Animated canvas with `requestAnimationFrame`:
- Nodes: token (center), SM wallets (orbiting), exchanges (edges)
- Edges: animated particles flowing in (green) or out (red)
- Particle speed/density proportional to USD volume
- Data source: `token flow-intelligence` + `token flows` (already fetched)

## Reusable Code from nansen-ai3

The following will be ported and adapted:

| Source File | Target | What |
|-------------|--------|------|
| `lib/nansen/client.ts` | `lib/nansen/client.ts` | CLI wrapper (adapt execSync → async exec) |
| `lib/nansen/endpoints.ts` | `lib/nansen/endpoints.ts` | Command builders (add Alpha Court endpoints) |
| `lib/prices/dexscreener.ts` | `lib/data/dexscreener.ts` | DexScreener API client |
| `lib/prices/jupiter.ts` | `lib/data/jupiter.ts` | Jupiter Price API client |
| `lib/security/goplus.ts` | `lib/data/goplus.ts` | GoPlus Security API client |
| `lib/db/schema.ts` | `lib/db.ts` | SQLite setup patterns (WAL mode) |
| `lib/utils/format.ts` | `lib/utils.ts` | USD, PnL, percentage, address formatting |

## Trial ID Format

nanoid with **12 characters** — URL-safe, ~3.6 quadrillion combinations. Short enough for sharing (`/trial/V1StGXR8_Z5j`), collision-safe at hackathon scale.
