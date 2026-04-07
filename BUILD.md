# Alpha Court — Phased Build Plan

Each phase is a self-contained session with a copy-paste prompt for a fresh Claude Code conversation. Phases are designed for 2-4 hour sessions.

**Testing:** Vitest (matching nansen-ai2 patterns). Every phase includes tests.
**Re-evaluation:** Each phase ends with a checkpoint — review what worked, what didn't, and tweak the spec/approach before starting the next phase.

---

## Phase 1: Project Scaffolding & Foundation

### Goals
- Bootable Next.js 15 app with custom dark courtroom theme
- SQLite database with full schema (WAL mode)
- Vitest test setup
- Fonts, globals, root layout

### Tasks
1. Init Next.js 15 + TypeScript + Tailwind v4 + shadcn/ui (use pnpm)
2. Install core deps: `better-sqlite3`, `nanoid`, `clsx`, `tailwind-merge`, `lucide-react`
3. Install dev deps: `vitest`, `@types/better-sqlite3`
4. Create `vitest.config.ts` (globals: true, environment: node, @ alias)
5. Create `app/globals.css` with custom `@theme` block:
   - Background: #0a0e1a → #141824
   - Bull green: #22c55e, Bear red: #ef4444, Judge gold: #f59e0b
   - Text: primary #F0F0F5, secondary #8888A0, muted #555570
   - Border: #1E1E2E, #2A2A3A
   - Fonts: Inter (sans), JetBrains Mono (mono)
6. Create `app/layout.tsx` — root layout with Inter + JetBrains Mono (next/font/google), metadata
7. Create `next.config.ts` — standalone output, serverExternalPackages: ["better-sqlite3"]
8. Create `lib/db.ts`:
   - SQLite setup with WAL mode, busy_timeout 5000, synchronous NORMAL, foreign_keys ON
   - Full schema: `nansen_cache`, `trials`, `debate_messages` tables + indexes
   - `getDb()` function, auto-creates tables on first call
   - Uses `DATABASE_PATH` env var (default `./data/court.db`)
9. Create `lib/utils.ts` — port formatting helpers from nansen-ai3 (`formatUsd`, `formatPnl`, `formatPct`, `formatNumber`, `truncateAddress`, `timeAgo`) + shadcn `cn()` helper
10. Create `.env.example` with all env vars
11. Create `app/page.tsx` — placeholder landing page (just logo + "Alpha Court" title to verify theme)
12. Add pnpm scripts: `dev`, `build`, `start`, `typecheck`, `lint`, `test`, `test:watch`

### UX Considerations
- Theme must feel dark and authoritative, not just "dark mode". Deep navy/charcoal backgrounds, not gray.
- JetBrains Mono for all data/numbers, Inter for prose. Set up CSS utility classes for this.
- Ensure sufficient contrast ratios (WCAG AA minimum) between text colors and backgrounds.

### Edge Cases
- `DATABASE_PATH` directory doesn't exist → create it automatically
- SQLite WAL mode requires the `-wal` and `-shm` files to be writable alongside the DB
- `better-sqlite3` needs to be in `serverExternalPackages` or Next.js will try to bundle the native module

### Tests (`test/db.test.ts`, `test/utils.test.ts`)
- DB: schema creates all 3 tables successfully
- DB: WAL mode is enabled (PRAGMA check)
- DB: inserting and querying a trial works
- DB: inserting and querying debate_messages works
- DB: cache table insert/query with TTL expiry logic
- DB: indexes exist on expected columns
- Utils: `formatUsd` handles positive, negative, zero, compact mode
- Utils: `formatPnl` adds + prefix for positive
- Utils: `formatPct` handles positive/negative
- Utils: `truncateAddress` with short and long addresses
- Utils: `timeAgo` with various time differences

### Re-evaluation Checkpoint
- Does the theme feel "courtroom" enough? May need to adjust colors.
- Is Tailwind v4 `@theme` approach working well, or do we need a `tailwind.config.ts`?
- Are there any issues with better-sqlite3 in the Next.js dev server?

### Session Prompt

```
Read @SPEC.md for full project context. This is Phase 1 of the build — Project Scaffolding & Foundation.

You are building "Alpha Court" — a web app where 3 AI agents (Bull, Bear, Judge) debate whether to buy a crypto token using Nansen on-chain data.

PHASE 1 GOALS:
- Bootable Next.js 15 app with custom dark courtroom theme
- SQLite database with full schema (WAL mode)
- Vitest test setup
- Core utilities

SPECIFIC TASKS:
1. Init Next.js 15 + TypeScript + Tailwind v4 + shadcn/ui (use pnpm)
2. Install deps: better-sqlite3, nanoid, clsx, tailwind-merge, lucide-react, vitest, @types/better-sqlite3
3. Create vitest.config.ts (globals: true, environment: node, @ path alias)
4. Create app/globals.css with custom @theme: deep navy backgrounds (#0a0e1a/#141824), bull green (#22c55e), bear red (#ef4444), judge gold (#f59e0b), text colors (#F0F0F5/#8888A0/#555570), borders (#1E1E2E/#2A2A3A)
5. Create app/layout.tsx with Inter + JetBrains Mono fonts (next/font/google)
6. Create next.config.ts — standalone output, serverExternalPackages: ["better-sqlite3"]
7. Create lib/db.ts — SQLite with WAL mode, busy_timeout 5000, synchronous NORMAL, foreign_keys ON. Full schema with tables: nansen_cache, trials (nanoid 12-char IDs), debate_messages + indexes. Auto-create data dir and tables on first call. Use DATABASE_PATH env var (default ./data/court.db).
8. Create lib/utils.ts — port formatting from nansen-ai3 (see /Users/mrv/Documents/GitHub/nansen-ai3/lib/utils/format.ts for reference): formatUsd (with compact mode), formatPnl, formatPct, formatNumber, truncateAddress, timeAgo. Plus shadcn cn() helper.
9. Create .env.example
10. Create placeholder app/page.tsx to verify theme renders
11. Add scripts to package.json: dev, build, start, typecheck, lint, test, test:watch

SCHEMA (from SPEC.md):
- nansen_cache: id, cache_key (unique), command, params_json, response_json, chain, token_address, created_at, ttl_seconds
- trials: id (text PK, nanoid 12), token_address, chain, token_name, token_symbol, status (pending|gathering|debating|verdict|completed|error), verdict_score, verdict_label, verdict_summary, bull_conviction, bear_conviction, safety_score, safety_details_json, created_at, completed_at, error_message
- debate_messages: id, trial_id (FK), agent, phase, content, evidence_json, sequence, created_at
- Indexes: idx_trials_token_chain, idx_trials_created, idx_debate_messages_trial, idx_nansen_cache_key

TESTS TO WRITE (test/db.test.ts, test/utils.test.ts):
- DB schema creates all tables, WAL mode enabled, CRUD operations work, cache TTL logic, indexes exist
- Utils formatting functions with edge cases (zero, negative, compact, short addresses)

UX: Theme should feel dark and authoritative — deep navy, not gray. JetBrains Mono for data, Inter for prose.

EDGE CASES:
- Auto-create DATABASE_PATH directory if missing
- better-sqlite3 must be in serverExternalPackages
- WAL mode requires -wal/-shm files writable

After completing, run: pnpm typecheck && pnpm test && pnpm dev (verify it boots)
```

---

## Phase 2: Data Layer — Nansen CLI + External APIs

### Goals
- Async Nansen CLI wrapper with SQLite-backed caching
- All 13 Nansen endpoint builders for Alpha Court
- DexScreener, Jupiter, GoPlus clients
- Full test coverage for data layer

### Tasks
1. Create `lib/nansen/client.ts` — port from nansen-ai3, adapt:
   - Change `execSync` → `promisify(child_process.exec)` for async
   - Change timeout from 30s → 45s uniform
   - Change in-memory cache → SQLite-backed cache (use `lib/cache.ts`)
   - Keep retry logic (1 retry, skip for trade commands)
   - Keep JSON parsing with `{ success, data }` unwrapping
   - Remove trade-related parsing (no trading in MVP)
2. Create `lib/cache.ts` — SQLite cache operations:
   - `getCached(cacheKey)` → check nansen_cache table, return if not expired
   - `setCache(cacheKey, command, params, response, chain, token, ttl)` → upsert into cache
   - `invalidateCacheForToken(tokenAddress)` → delete matching entries
   - `getCacheStats()` → hit/miss counts, total entries, oldest entry
   - Cache key generation: `sha256(command + JSON.stringify(sortedParams))`
3. Create `lib/nansen/endpoints.ts` — command builders for all 13 endpoints:
   - `getSmNetflow(chain, token)` — `research smart-money netflow`
   - `getWhoBoughtSold(chain, token, side)` — `research token who-bought-sold`
   - `getTokenFlowIntelligence(chain, token)` — `research token flow-intelligence`
   - `getProfilerPnlSummary(wallet, chain)` — `research profiler pnl-summary`
   - `getTokenDexTrades(chain, token)` — `research token dex-trades`
   - `getTokenHolders(chain, token)` — `research token holders`
   - `getSmDexTrades(chain, token)` — `research smart-money dex-trades`
   - `getTokenFlows(chain, token, label)` — `research token flows`
   - `getTokenInfo(token, chain)` — `research token info`
   - `getTokenOhlcv(token, chain)` — `research token ohlcv`
   - `nansenSearch(query, chain)` — `research search`
   - Each function returns `Promise<NansenCliResult<T>>`
   - Each has appropriate TTL (see spec Cache TTLs section)
4. Create `lib/nansen/types.ts` — response types for each endpoint (can be loose initially, tighten after seeing real CLI output)
5. Create `lib/data/dexscreener.ts` — port from nansen-ai3, add caching (2 min TTL)
6. Create `lib/data/jupiter.ts` — port from nansen-ai3, add caching (1 min TTL)
7. Create `lib/data/goplus.ts` — port from nansen-ai3, keep fail-open design, add caching (60 min TTL)
8. Create `lib/data/types.ts` — supplementary data types

### UX Considerations
- Cache should be transparent to callers — same API whether cached or fresh
- All data functions should return consistent result types (success/error pattern)
- GoPlus must be fail-open — never block the debate if security check fails

### Edge Cases
- Nansen CLI not installed / not in PATH → clear error message
- CLI returns non-JSON output (progress bars, warnings before JSON) → strip non-JSON prefix
- CLI hangs beyond 45s timeout → clean kill of child process
- Empty CLI output → treat as error, not empty success
- DexScreener returns no pairs → return error, don't crash
- Jupiter API changes response format (data wrapper vs flat) → handle both
- GoPlus returns unknown token → fail-open (safe: true)
- Cache key collision (different commands, same hash) → extremely unlikely with sha256 but worth noting
- Concurrent cache writes for the same key → SQLite handles this with WAL mode

### Tests (`test/cache.test.ts`, `test/nansen/client.test.ts`, `test/data/*.test.ts`)
- Cache: set and get within TTL returns data
- Cache: get after TTL expiry returns null
- Cache: invalidateForToken removes matching entries only
- Cache: getCacheStats returns correct counts
- Cache: sha256 key generation is deterministic
- Nansen client: parses JSON output correctly
- Nansen client: unwraps `{ success, data }` wrapper
- Nansen client: handles non-JSON prefix in output
- Nansen client: returns error result on CLI failure (don't throw)
- Nansen client: respects timeout
- Nansen client: retry logic works (mock exec)
- Endpoints: each builder constructs correct CLI command string
- Endpoints: TTL values match spec
- DexScreener: parses multi-pair response, picks highest liquidity
- DexScreener: aggregates volume/liquidity across pairs
- DexScreener: handles empty pairs array
- Jupiter: parses price response (both wrapped and flat)
- Jupiter: returns null for unknown token
- GoPlus: detects dangerous token properties
- GoPlus: returns safe=true on API error (fail-open)
- GoPlus: returns safe=true for trusted tokens
- GoPlus: detects all 6 risk types (balance_mutable, non_transferable, closable, malicious_mint, malicious_freeze, transfer_fee)

### Re-evaluation Checkpoint
- Test the actual Nansen CLI with a real token — does the output match our expected types?
- Are there any Nansen endpoints that don't exist or have different names than expected?
- How fast is the CLI? If it's consistently under 5s, maybe we can run more concurrently.
- Does DexScreener work well for all three chains, or should we adjust?

### Session Prompt

```
Read @SPEC.md for full project context. Read @BUILD.md for the phased plan. This is Phase 2 — Data Layer.

Phase 1 is complete: we have a Next.js 15 app with Tailwind v4 custom dark theme, SQLite (WAL mode) with full schema, Vitest setup, and formatting utils.

PHASE 2 GOALS:
- Async Nansen CLI wrapper with SQLite-backed caching
- All 13 Nansen endpoint builders
- DexScreener, Jupiter, GoPlus clients (ported from nansen-ai3)
- Full test coverage

REFERENCE CODE — port these from nansen-ai3, adapting as described:
- /Users/mrv/Documents/GitHub/nansen-ai3/lib/nansen/client.ts → lib/nansen/client.ts
- /Users/mrv/Documents/GitHub/nansen-ai3/lib/nansen/endpoints.ts → lib/nansen/endpoints.ts
- /Users/mrv/Documents/GitHub/nansen-ai3/lib/prices/dexscreener.ts → lib/data/dexscreener.ts
- /Users/mrv/Documents/GitHub/nansen-ai3/lib/prices/jupiter.ts → lib/data/jupiter.ts
- /Users/mrv/Documents/GitHub/nansen-ai3/lib/security/goplus.ts → lib/data/goplus.ts

KEY ADAPTATIONS from nansen-ai3:
1. Nansen client: execSync → promisify(child_process.exec) for async non-blocking exec
2. Nansen client: 30s timeout → 45s uniform timeout
3. Nansen client: in-memory cache → SQLite-backed cache via lib/cache.ts
4. Remove all trade-related code (parseTradeQuoteOutput, parseTradeExecuteOutput, nansenCliCallRaw, getTradeQuote, executeTradeCmd) — trading is not in MVP
5. DexScreener/Jupiter/GoPlus: add SQLite caching with TTLs (DexScreener 2min, Jupiter 1min, GoPlus 60min)

CREATE lib/cache.ts — SQLite cache operations:
- getCached(cacheKey): check nansen_cache table, return if within TTL
- setCache(cacheKey, command, params, response, chain, token, ttl): upsert
- invalidateCacheForToken(tokenAddress): delete matching entries
- getCacheStats(): hit/miss counts, total entries
- Key generation: sha256(command + JSON.stringify(sortedParams))

CREATE lib/nansen/endpoints.ts — 13 endpoints for Alpha Court:
- Bull: getSmNetflow, getWhoBoughtSold(buy side), getTokenFlowIntelligence, getProfilerPnlSummary
- Bear: getTokenDexTrades, getTokenHolders, getSmDexTrades, getTokenFlows(whale label)
- Judge: getTokenInfo, getTokenOhlcv, getWhoBoughtSold(sell side), getProfilerPnlSummary
- Shared: nansenSearch
- Each with appropriate TTL (token-info 5min, ohlcv 5min, who-bought-sold/dex-trades 10min, sm-netflow 10min, holders/flows 15min, profiler 30min)

CREATE lib/nansen/types.ts — response types (can be loose Record<string, unknown> initially)

EDGE CASES:
- CLI not in PATH → clear error message
- Non-JSON prefix in CLI output → strip before parsing
- CLI hangs → 45s timeout kills child process
- GoPlus fail-open → API errors return safe:true
- DexScreener no pairs → error result, don't crash

TESTS — write comprehensive tests with mocked exec/fetch:
- Cache: TTL expiry, invalidation, stats, key determinism
- Nansen client: JSON parsing, wrapper unwrapping, non-JSON prefix handling, error results, timeout, retry
- Endpoints: correct CLI command construction, TTL values
- DexScreener: multi-pair aggregation, highest-liquidity selection, empty pairs
- Jupiter: both response formats, unknown token
- GoPlus: all 6 risk types, fail-open, trusted tokens

After completing, run: pnpm typecheck && pnpm test
```

---

## Phase 3: Landing Page & Token Search

### Goals
- Functional landing page with token input, autocomplete, chain selector
- POST /api/trial endpoint (create trial with cooldown check)
- GET /api/token/search endpoint (Nansen primary, DexScreener fallback)
- Recent trials grid
- Full test coverage for API routes

### Tasks
1. Create `components/chain-selector.tsx` — Solana/Base/Ethereum dropdown, Solana pre-selected
2. Create `components/token-input.tsx`:
   - Text input with debounced autocomplete (500ms)
   - Dropdown showing search results (token name, symbol, chain, address)
   - Accepts both name/symbol search and direct address paste
   - Shows "Limited Nansen data" warning for DexScreener-only results
   - Loading spinner during search
   - Keyboard navigation (up/down/enter)
3. Create `components/trial-card.tsx` — card for recent trials grid (token name, symbol, verdict label, score, colored by verdict)
4. Build `app/page.tsx` — full landing page:
   - "ALPHA COURT" header with tagline
   - Token input + chain selector
   - "BEGIN TRIAL" button (disabled until valid token selected)
   - Recent trials grid (last 10, static load)
   - Empty state: "No trials yet — put a token on trial!"
5. Create `app/api/token/search/route.ts`:
   - GET with `?q=query&chain=solana` params
   - Call Nansen CLI `research search` (debounced server-side via cache)
   - If Nansen is slow (>2s) or empty, fall back to DexScreener search
   - Return unified response: `{ results: [{ name, symbol, address, chain, source: 'nansen'|'dexscreener' }] }`
6. Create `app/api/trial/route.ts`:
   - POST with `{ tokenAddress, chain }` body
   - Validate token exists (call `nansen token info` or DexScreener)
   - Check 30-minute global cooldown (query trials table for same token+chain)
   - If cooldown active: return `{ cooldown: true, existingTrialId, cooldownEndsAt }`
   - If ok: create trial in DB with nanoid(12), status=pending, return `{ trialId }`
   - Redirect client to `/trial/[id]`
7. Create `app/trial/[id]/page.tsx` — placeholder trial page (just shows trial ID, will be built in Phase 6)

### UX Considerations
- Token input should feel instant — debounce 500ms, show loading state, cache results
- Autocomplete dropdown should clearly distinguish Nansen results (checkmark/verified badge) vs DexScreener fallback results ("may have limited data")
- BEGIN TRIAL button should have visual weight — it's the primary CTA
- Recent trials grid should be visually scannable — color-code by verdict (green for buy, red for sell, gray for hold)
- Cooldown should show a countdown timer, not just a message
- Chain selector should be subtle — most users will use Solana

### Edge Cases
- User pastes a full URL instead of address (e.g., solscan URL) → extract address
- User types a symbol that matches many tokens → show top 5, sorted by relevance
- Nansen search returns 0 results but DexScreener does → show DexScreener results with warning
- Both Nansen and DexScreener return 0 results → "Token not found" message
- User submits while autocomplete is still loading → use the raw input as address
- Cooldown: token trialed 29 minutes ago → show countdown (1 min remaining)
- Cooldown: same token, different chain → allow (cooldown is per token+chain)
- Trial creation race condition → use unique constraint on trials table, handle conflict
- Invalid token address format → client-side validation before API call

### Tests (`test/api/trial.test.ts`, `test/api/search.test.ts`, `test/components/token-input.test.ts`)
- Search: returns Nansen results when available
- Search: falls back to DexScreener when Nansen is empty
- Search: falls back to DexScreener when Nansen times out (>2s)
- Search: returns unified format from both sources
- Search: handles both sources returning empty
- Trial: creates trial with valid token, returns trialId
- Trial: rejects when cooldown is active (within 30 min)
- Trial: allows trial for same token on different chain
- Trial: allows trial after cooldown expires
- Trial: returns existing trial ID when cooldown active
- Trial: validates token address format
- Trial: generates 12-char nanoid
- TokenInput: debounces search calls (mock timer)
- TokenInput: shows loading state during search
- TokenInput: handles keyboard navigation
- ChainSelector: defaults to Solana
- TrialCard: renders correct colors for each verdict type

### Re-evaluation Checkpoint
- Does the Nansen search CLI command actually work? What's the response format?
- Is 500ms debounce the right feel? Too slow? Too fast?
- Does the landing page feel compelling enough for a hackathon demo?
- Is 30 minutes the right cooldown, or should it be shorter for demo purposes?

### Session Prompt

```
Read @SPEC.md for full project context. Read @BUILD.md for the phased plan. This is Phase 3 — Landing Page & Token Search.

Phases 1-2 are complete: we have a Next.js 15 app with custom dark courtroom theme, SQLite DB (WAL mode, full schema), Vitest, Nansen CLI async wrapper with SQLite caching, DexScreener/Jupiter/GoPlus clients, formatting utils. All with tests.

PHASE 3 GOALS:
- Functional landing page with token input, autocomplete, chain selector
- POST /api/trial (create trial, validate token, 30-min cooldown check)
- GET /api/token/search (Nansen CLI primary, DexScreener fallback)
- Recent trials grid (last 10)

TASKS:
1. components/chain-selector.tsx — Solana/Base/Ethereum dropdown, Solana default
2. components/token-input.tsx — debounced autocomplete (500ms), dropdown with search results, accepts name/symbol/address, keyboard nav, loading spinner, "Limited Nansen data" warning for DexScreener-only results
3. components/trial-card.tsx — recent trial card (token, verdict label, score, color-coded by verdict)
4. app/page.tsx — full landing page: header + tagline, token input + chain selector, BEGIN TRIAL button, recent trials grid (last 10), empty state
5. app/api/token/search/route.ts — GET ?q=query&chain=solana. Nansen CLI search primary, DexScreener fallback if Nansen slow (>2s) or empty. Unified response format.
6. app/api/trial/route.ts — POST { tokenAddress, chain }. Validate token, check 30-min global per-token+chain cooldown (query trials table), create trial with nanoid(12), return trialId. If cooldown: return existingTrialId + cooldownEndsAt.
7. app/trial/[id]/page.tsx — placeholder page (shows trial ID, built properly in Phase 6)

UX REQUIREMENTS:
- Token input should feel instant with good loading/empty states
- Distinguish Nansen results (verified badge) vs DexScreener fallback ("limited data" warning)
- BEGIN TRIAL button = primary visual CTA
- Recent trials color-coded: green (buy), red (sell), gray (hold)
- Cooldown shows countdown timer, not just a message
- Chain selector is subtle — most users use Solana

EDGE CASES:
- User pastes Solscan URL → extract address
- Both search sources return empty → "Token not found"
- User submits during loading → use raw input as address
- Cooldown: same token different chain → allow
- Trial creation race condition → handle unique constraint conflict
- Invalid address format → client-side validation

TESTS:
- Search: Nansen results, DexScreener fallback, timeout fallback, both empty
- Trial: creation, cooldown enforcement, cooldown expiry, different chain allowed, nanoid length, token validation
- Components: debounce behavior, keyboard nav, chain selector default, trial card colors

After completing, run: pnpm typecheck && pnpm test && pnpm dev (visually verify landing page)
```

---

## Phase 4: Gemini Integration & Agent System

### Goals
- @google/genai SDK wrapper with streaming, structured output, Google Search grounding
- Bull/Bear/Judge agent modules with prompts and data fetching
- Citation syntax parser
- Full test coverage

### Tasks
1. Install `@google/genai` package
2. Create `lib/gemini.ts` — SDK wrapper:
   - Initialize client with `GEMINI_API_KEY`
   - `streamChat(model, systemPrompt, userPrompt, options)` — returns async iterable of text chunks
   - `structuredOutput(model, systemPrompt, userPrompt, schema)` — returns parsed JSON
   - Model constants: `FLASH_LITE = 'gemini-3.1-flash-lite-preview'`, `PRO = 'gemini-3.1-pro-preview'`
   - Grounding config for Judge (Google Search)
   - Soft timeout: monitor streamed word count, stop if >2x target
   - Error handling: wrap API errors in consistent format
3. Create `lib/citations.ts` — citation parser:
   - Parse `[[cite:endpoint-name|display value]]` from streaming text
   - Handle partial citations during streaming (buffer until complete)
   - Handle malformed citations (fall back to rendering as bold text)
   - `parseCitations(text)` → `{ cleanText, citations: [{ endpoint, displayValue, startIndex, endIndex }] }`
   - `parseCitationStream(chunk, buffer)` → `{ segments: (TextSegment | CitationSegment)[], remainingBuffer }`
4. Create `lib/agents/types.ts`:
   - `AgentRole = 'bull' | 'bear' | 'judge'`
   - `AgentData` — the fetched data bundle for an agent
   - `AgentMessage` — content + evidence + metadata
   - `DebatePhase = 'gathering' | 'opening' | 'rebuttal' | 'cross_exam' | 'verdict'`
5. Create `lib/agents/bull.ts`:
   - `fetchBullData(tokenAddress, chain)` — calls 4 Nansen endpoints + DexScreener + Jupiter concurrently
   - `buildBullOpeningPrompt(data, tokenName)` — system prompt + user prompt with data injection + citation instructions
   - `buildBullRebuttalPrompt(data, bearOpening)` — rebuttal prompt referencing Bear's argument
   - Model: Flash Lite, word targets: opening 200-300, rebuttal 150-200
6. Create `lib/agents/bear.ts`:
   - `fetchBearData(tokenAddress, chain)` — calls 4 Nansen endpoints + DexScreener + GoPlus concurrently
   - `buildBearOpeningPrompt(data, tokenName)` — with risk-focused analytical framework
   - `buildBearRebuttalPrompt(data, bullOpening)` — rebuttal prompt
   - Model: Flash Lite
7. Create `lib/agents/judge.ts`:
   - `fetchJudgeData(tokenAddress, chain)` — calls 4 Nansen endpoints concurrently
   - `buildJudgeCrossExamPrompt(data, bullOpening, bearOpening, bullRebuttal, bearRebuttal)` — cross-examination prompt
   - `buildJudgeVerdictPrompt(data, fullTranscript)` — verdict prompt (streamed text)
   - `buildJudgeVerdictStructuredPrompt(verdictText)` — extract structured scores from verdict text
   - Model: Pro with Google Search grounding
   - Verdict schema: `{ score: number, label: string, summary: string, bull_conviction: number, bear_conviction: number }`

### UX Considerations
- Streaming should feel natural — text appears word-by-word, not in large chunks
- Citation chips should appear inline as soon as the closing `]]` is detected in the stream
- Agent personalities should be distinct but not caricatured — read the prompts aloud to check
- Soft timeout should cut gracefully (let the current sentence finish if possible)

### Edge Cases
- Gemini API returns 429 (rate limited) → retry once after 2s delay
- Gemini API returns 500 → retry once, then return error
- Gemini stream stalls (no chunks for >15s) → timeout and close
- Citation syntax appears in middle of a word → still parse correctly
- Nested brackets in citation value (e.g., `[[cite:x|value (with parens)]]`) → handle
- Agent receives empty data bundle → prompt includes "No data available for X" context
- Structured output returns invalid JSON → retry once, then use fallback parsing
- Grounding search returns no results → Judge proceeds without web context

### Tests (`test/citations.test.ts`, `test/agents/*.test.ts`, `test/gemini.test.ts`)
- Citations: parse single citation from text
- Citations: parse multiple citations from text
- Citations: handle malformed citation (missing closing brackets) → render as text
- Citations: handle citation with special characters in value
- Citations: streaming parser buffers partial citations correctly
- Citations: streaming parser emits text segments and citation segments in order
- Citations: empty input returns empty result
- Bull: `fetchBullData` calls correct 6 data sources
- Bull: `buildBullOpeningPrompt` includes all data sections and citation instructions
- Bull: `buildBullRebuttalPrompt` includes Bear's opening text
- Bear: `fetchBearData` calls correct 6 data sources (including GoPlus)
- Bear: prompt includes risk-focused analytical framework
- Judge: `fetchJudgeData` calls correct 4 data sources
- Judge: cross-exam prompt includes full transcript from all phases
- Judge: verdict structured schema matches expected format
- Gemini: soft timeout triggers at 2x word target
- Gemini: error wrapping produces consistent error format
- Agent prompts: include citation syntax instructions
- Agent prompts: include word count targets
- Agent prompts: handle missing data gracefully in prompt text

### Re-evaluation Checkpoint
- Do the Gemini 3.1 models actually exist and work? Test with a real API call.
- Is Google Search grounding available for gemini-3.1-pro-preview? Check SDK docs.
- Are the prompts producing good-quality arguments? May need iteration.
- Is the citation syntax reliable with Flash Lite, or does it need more prompt engineering?
- Is the soft timeout working well, or does it cut too abruptly?

### Session Prompt

```
Read @SPEC.md for full project context. Read @BUILD.md for the phased plan. This is Phase 4 — Gemini Integration & Agent System.

Phases 1-3 are complete: we have a Next.js 15 app with custom dark theme, SQLite DB, Nansen CLI wrapper + DexScreener/Jupiter/GoPlus clients (all with SQLite caching), landing page with token search autocomplete, trial creation API with cooldown, recent trials grid. All with tests.

PHASE 4 GOALS:
- @google/genai SDK wrapper (streaming, structured output, Google Search grounding)
- Bull/Bear/Judge agent modules with data fetching + prompt construction
- Citation syntax parser for [[cite:endpoint|value]] format
- Full test coverage

INSTALL: @google/genai

CREATE lib/gemini.ts:
- Init client with GEMINI_API_KEY env var
- streamChat(model, systemPrompt, userPrompt, options) → async iterable of text chunks
- structuredOutput(model, systemPrompt, userPrompt, schema) → parsed JSON
- Model constants: FLASH_LITE = 'gemini-3.1-flash-lite-preview', PRO = 'gemini-3.1-pro-preview'
- Google Search grounding config for Judge
- Soft timeout: track streamed word count, stop stream if >2x target words
- Consistent error wrapping

CHECK: Before implementing, verify the exact @google/genai SDK API for streaming, structured output, and grounding. Use context7 MCP to fetch current docs if needed. The SDK API may differ from what we expect.

CREATE lib/citations.ts:
- parseCitations(text) → { cleanText, citations: [{ endpoint, displayValue, startIndex, endIndex }] }
- parseCitationStream(chunk, buffer) → { segments: (TextSegment | CitationSegment)[], remainingBuffer }
- Handle: malformed citations (render as bold text), partial citations during streaming (buffer), nested parens in values, empty input

CREATE lib/agents/types.ts — AgentRole, AgentData, AgentMessage, DebatePhase types

CREATE lib/agents/bull.ts:
- fetchBullData(tokenAddress, chain) — calls concurrently: getSmNetflow, getWhoBoughtSold(buy), getTokenFlowIntelligence, getProfilerPnlSummary + getDexScreenerToken + getJupiterPrice
- buildBullOpeningPrompt(data, tokenName) — confident/data-driven persona, cite with [[cite:x|y]], target 200-300 words
- buildBullRebuttalPrompt(data, bearOpening) — focused counter-argument, target 150-200 words
- Model: FLASH_LITE

CREATE lib/agents/bear.ts:
- fetchBearData(tokenAddress, chain) — calls concurrently: getTokenDexTrades, getTokenHolders, getSmDexTrades, getTokenFlows(whale) + getDexScreenerToken + checkTokenSecurity
- buildBearOpeningPrompt(data, tokenName) — skeptical/forensic persona, risk-focused framework
- buildBearRebuttalPrompt(data, bullOpening) — counter Bull's points
- Model: FLASH_LITE

CREATE lib/agents/judge.ts:
- fetchJudgeData(tokenAddress, chain) — calls concurrently: getTokenInfo, getTokenOhlcv, getWhoBoughtSold(sell), getProfilerPnlSummary
- buildJudgeCrossExamPrompt(data, bullOpening, bearOpening, bullRebuttal, bearRebuttal)
- buildJudgeVerdictPrompt(data, fullTranscript) — streams verdict text
- Structured output call after streaming to extract: { score: -100..100, label, summary, bull_conviction: 0-100, bear_conviction: 0-100 }
- Model: PRO with Google Search grounding

PROMPT DESIGN (middle ground — clear persona + analytical framework, no forced catchphrases):
- Each prompt includes: role definition, analytical framework, citation instructions ([[cite:endpoint|value]]), word target, actual data, missing data handling
- Citation instruction: "Only cite data you have been provided. Never fabricate citations."

EDGE CASES:
- Gemini 429/500 → retry once after 2s
- Stream stalls (no chunks >15s) → timeout
- Nested brackets in citation values → handle
- Empty data bundle → prompt says "No data available for X"
- Structured output invalid JSON → retry once, fallback parsing

TESTS (mock Gemini API, don't make real calls):
- Citations: single/multiple/malformed/partial streaming/special chars/empty
- Each agent: data fetching calls correct sources, prompts include all required sections
- Gemini wrapper: soft timeout, error wrapping, consistent format
- All prompts include citation instructions and word targets

After completing, run: pnpm typecheck && pnpm test
```

---

## Phase 5: Debate Engine & SSE Streaming

### Goals
- Debate engine orchestrator (5-phase sequential logic)
- SSE streaming API route
- Server-side completion with per-phase DB persistence
- useDebateStream React hook
- Full test coverage

### Tasks
1. Create `lib/debate-engine.ts` — the core orchestrator:
   - `runDebate(trialId, tokenAddress, chain, tokenName)` — main entry point
   - Accepts an `EventEmitter` or callback for SSE events
   - Phase 1 (gathering): fetch data grouped by agent (Bull, then Bear, then Judge — each group's calls run concurrently). Emit `data_progress` events as each completes. Update trial status to `gathering`.
   - Phase 2 (opening): stream Bull and Bear openings simultaneously. Emit `chunk` events. On complete, emit `message_complete`. Persist to debate_messages. Update trial status to `debating`.
   - Phase 3 (rebuttal): sequential — Bear rebuts Bull, then Bull rebuts Bear. Stream each, persist.
   - Phase 4 (cross_exam): Judge reads full transcript + own data. Stream cross-examination.
   - Phase 5 (verdict): Judge streams verdict text, then structured output call for scores. Emit `verdict` event. Update trial with scores.
   - Retry logic: on Gemini failure, retry once, then skip that agent's message
   - Server-side completion: runs to completion regardless of client disconnection
   - Persist each message to debate_messages as it completes (not batch at end)
   - Update trial status at each phase transition
   - On any unrecoverable error: set trial status=error, error_message
2. Create `app/api/debate/[id]/route.ts` — SSE endpoint:
   - GET request, returns ReadableStream with SSE headers
   - Check trial exists and is in valid state
   - If trial is `completed` → emit all stored messages from DB, then `done`
   - If trial is `pending` → start debate engine, stream events
   - If trial is in-progress (`gathering`/`debating`/`verdict`) → emit completed messages from DB, then join live stream
   - Handle client disconnect (abort signal) — debate continues server-side
   - Event format: `event: <type>\ndata: <json>\n\n`
3. Create `hooks/use-debate-stream.ts` — React hook:
   - `useDebateStream(trialId)` → `{ messages, phase, verdict, isStreaming, error }`
   - Connects to SSE endpoint
   - Parses events: `phase`, `data_progress`, `chunk`, `message_complete`, `verdict`, `error`, `done`
   - Handles reconnection on disconnect (with backoff)
   - For completed trials: receives all messages instantly
   - Manages streaming text state (accumulates chunks per agent/phase)
4. Create a simple global map or module-level state to track in-progress debates (so multiple SSE connections to the same trial share the same debate engine instance)

### UX Considerations
- SSE events should be granular enough for smooth UI updates but not so frequent they cause rendering jank
- `data_progress` events should include agent name + endpoint name + status for the progress grid
- `chunk` events should be ~5-20 tokens each for smooth typing effect
- Phase transitions should emit a clear `phase` event so the UI can update the phase indicator
- Reconnection should be seamless — user shouldn't see a loading state if they refresh mid-debate

### Edge Cases
- Two clients connect to the same trial simultaneously → share the same debate engine instance
- Client connects after trial errored → return stored messages + error event
- Client connects mid-Phase 3 → get Phase 1-2 from DB, join Phase 3 live stream
- Debate engine throws unhandled exception → catch at top level, set trial error status
- Gemini streams partial message then errors → store what we have, mark as incomplete
- SSE connection drops during verdict structured output call → verdict still persists to DB
- Trial ID doesn't exist → return 404
- Trial is already pending (another client started it) → join the existing debate stream

### Tests (`test/debate-engine.test.ts`, `test/api/debate.test.ts`, `test/hooks/use-debate-stream.test.ts`)
- Engine: executes all 5 phases in correct order
- Engine: Phase 1 fetches data grouped by agent (Bull, Bear, Judge groups)
- Engine: Phase 2 runs Bull and Bear openings concurrently
- Engine: Phase 3 runs rebuttals sequentially (Bear first, then Bull)
- Engine: Phase 4 passes full transcript to Judge
- Engine: Phase 5 streams verdict + extracts structured scores
- Engine: persists each message to debate_messages table
- Engine: updates trial status at each phase transition
- Engine: retry on Gemini failure, then skip
- Engine: sets trial error status on unrecoverable failure
- Engine: continues after client disconnect
- SSE route: returns 404 for non-existent trial
- SSE route: streams all stored messages for completed trial
- SSE route: emits correct SSE format (event + data)
- SSE route: handles concurrent connections to same trial
- Hook: parses chunk events and accumulates text
- Hook: parses message_complete events
- Hook: parses verdict events with all fields
- Hook: reconnects on disconnect
- Hook: handles completed trial (instant load)

### Re-evaluation Checkpoint
- Is the debate pacing right? May need to adjust Gemini parameters (temperature, max tokens).
- Does simultaneous streaming (Phase 2) look good, or is interleaved text confusing?
- Is the SSE reconnection working smoothly? Test by killing/restarting the dev server mid-debate.
- Are the debate messages being persisted correctly? Check DB after a full trial run.
- How long does a full debate actually take? If >80s, consider reducing word targets.

### Session Prompt

```
Read @SPEC.md for full project context. Read @BUILD.md for the phased plan. This is Phase 5 — Debate Engine & SSE Streaming.

Phases 1-4 are complete: we have the full data layer (Nansen CLI + DexScreener/Jupiter/GoPlus with caching), Gemini SDK wrapper (streaming + structured output + grounding), citation parser, and all three agent modules (Bull/Bear/Judge with data fetching + prompt construction). Landing page with token search and trial creation works. All with tests.

PHASE 5 GOALS:
- Debate engine orchestrator (5-phase sequential logic, runs server-side to completion)
- SSE streaming API route with reconnection support
- useDebateStream React hook
- Full test coverage

CREATE lib/debate-engine.ts — the core orchestrator:
- runDebate(trialId, tokenAddress, chain, tokenName, emitEvent: (event) => void)
- Phase 1 (gathering): fetch data grouped by agent (Bull group concurrent, then Bear group, then Judge group). Emit data_progress events per endpoint. Set trial status=gathering.
- Phase 2 (opening): stream Bull + Bear openings SIMULTANEOUSLY (two parallel Gemini streams). Emit chunk events interleaved. On complete, emit message_complete per agent. Persist each to debate_messages table. Set trial status=debating.
- Phase 3 (rebuttal): SEQUENTIAL — Bear rebuts Bull's opening, then Bull rebuts Bear's opening. Stream + persist each.
- Phase 4 (cross_exam): Judge reads full transcript + own data + Google Search grounding. Stream.
- Phase 5 (verdict): Judge streams verdict text, then SEPARATE structured output call for scores { score, label, summary, bull_conviction, bear_conviction }. Emit verdict event. Update trial row with all verdict fields. Set status=completed.
- On Gemini failure: retry once, then skip that message and continue debate
- On unrecoverable error: set trial status=error, error_message
- Persist EACH message to debate_messages as it completes (not batch)
- Runs to completion regardless of client disconnection

CREATE app/api/debate/[id]/route.ts — SSE endpoint:
- GET, returns ReadableStream with Content-Type: text/event-stream
- If trial completed → replay all messages from debate_messages, emit done
- If trial pending → start debate engine, stream events live
- If trial in-progress → emit completed phases from DB, join live stream
- Track active debates in module-level Map so concurrent connections share same engine
- Format: event: <type>\ndata: <json>\n\n
- Handle abort signal (debate still continues server-side)

CREATE hooks/use-debate-stream.ts:
- useDebateStream(trialId) → { messages, phase, verdict, isStreaming, error, dataProgress }
- EventSource to /api/debate/[id]
- Parse all event types: phase, data_progress, chunk, message_complete, verdict, error, done
- Accumulate streaming chunks per agent/phase
- Handle reconnection with backoff
- For completed trials: receive all messages at once

EDGE CASES:
- Two clients same trial → shared engine instance
- Client connects after error → return stored messages + error
- Mid-trial join → DB replay + live join
- Unhandled engine exception → catch, set error status
- Partial Gemini stream + error → store partial, mark incomplete
- Trial doesn't exist → 404
- Trial already started by another client → join existing

SSE EVENT TYPES (from SPEC.md):
- phase: { phase, status: "start"|"complete" }
- data_progress: { endpoint, agent, status: "pending"|"complete"|"error" }
- chunk: { agent, phase, text }
- message_complete: { agent, phase, content, evidence }
- verdict: { score, label, summary, bull_conviction, bear_conviction, safety }
- error: { message, recoverable }
- done: {}

TESTS (mock Gemini calls, use real DB):
- Engine: 5 phases execute in order
- Engine: Phase 1 groups by agent, Phase 2 parallel, Phase 3 sequential
- Engine: persists messages per phase, updates trial status
- Engine: retry + skip on failure, error status on unrecoverable
- SSE: 404 for missing trial, correct format, completed trial replay, concurrent connections
- Hook: chunk accumulation, event parsing, reconnection, completed trial instant load

After completing, run: pnpm typecheck && pnpm test
Then manually test: create a trial via the landing page and watch the SSE stream in browser dev tools. Verify debate runs to completion and all phases appear.
```

---

## Phase 6: Trial Page UI

### Goals
- Three-column courtroom layout (desktop)
- Center streaming panel with live debate
- Agent side panels with evidence cards
- Inline citation chips (parse during stream, expand on click)
- Data gathering progress grid
- Mobile interleaved layout
- Full test coverage

### Tasks
1. Create `components/data-progress.tsx` — Phase 1 progress grid:
   - 3 groups (Bull/Bear/Judge), 4+ items each
   - Each item shows endpoint name + status (pending/loading/complete/error)
   - Animated: items pulse while loading, check mark on complete, X on error
   - Grouped by agent with agent color accent
2. Create `components/citation-chip.tsx`:
   - Inline chip component: colored pill with endpoint name + value
   - Click/hover expands to show raw Nansen data snippet
   - Color-coded by source type (Nansen green, DexScreener blue, GoPlus orange)
   - Collapsed state: just the display value as a chip
   - Expanded state: popup/tooltip with full data
3. Create `components/debate-message.tsx`:
   - Message bubble with colored left border (green/red/gold by agent)
   - Agent avatar + name label
   - Content with inline citation chips (parsed from text)
   - Streaming state: text appears progressively, citation chips pop in when detected
   - Completed state: full text with all citations interactive
4. Create `components/agent-panel.tsx` — side panel:
   - Agent identity (avatar, name, role description)
   - Key evidence highlights (populated after each phase from evidence_json)
   - Conviction meter (hidden until verdict, then animates)
   - Agent color theme (green/red/gold border + subtle glow)
5. Create `components/debate-stream.tsx` — center panel:
   - Scrolling container for debate messages
   - Auto-scrolls to latest message during streaming
   - Phase dividers between debate sections
   - "Streaming..." indicator when active
6. Create `components/courtroom.tsx` — main layout:
   - Desktop: three-column grid (Bull panel | Debate stream | Bear panel)
   - Judge bar below the grid
   - Phase indicator at top (showing current phase)
   - Token info header (name, symbol, chain)
7. Build `app/trial/[id]/page.tsx` — full trial page:
   - Fetch trial data from DB (server component wrapper)
   - Client component with `useDebateStream` hook
   - Render courtroom layout
   - Handle all trial states: pending (loading), gathering (progress grid), debating (streaming), completed (replay), error
8. Mobile responsive layout:
   - Single column, interleaved stream
   - Agent panels collapse into compact cards above the stream
   - Citation chips still work (expand on tap)
   - Phase indicator stays visible (sticky header)

### UX Considerations
- Auto-scroll should be smart: scroll to bottom if user is near bottom, don't scroll if user scrolled up to read
- Citation chips should have subtle entrance animation (scale from 0 to 1)
- Phase transitions should have a brief visual separator (line + phase name)
- During Phase 2 (simultaneous streaming), interleave Bull/Bear messages clearly — don't let one dominate
- Side panels should update their evidence highlights smoothly, not jump/flash
- The Judge bar should have visual distinction (gold accent, slightly different background)
- Loading states should feel intentional, not broken — use skeleton UI or pulse animations
- For completed trials: instant render + auto-scroll to verdict (from SPEC.md)

### Edge Cases
- Trial page loaded but debate hasn't started yet → show "Preparing trial..." with token info
- Debate errors mid-stream → show error message in the stream with "The debate encountered an issue"
- Very long agent message (soft timeout failed) → text container scrolls, doesn't break layout
- No evidence data for an agent → side panel shows "No evidence available" state
- Citation references data that failed to load → chip shows "data unavailable" state
- Mobile: very rapid interleaved chunks → throttle rendering to prevent jank (requestAnimationFrame)
- User navigates away and back → trial page reloads from DB state + rejoins stream if active
- Completed trial with missing messages (skipped phases) → handle gaps in sequence numbers
- Accessibility: citation chips should be keyboard-accessible (tab + enter to expand)

### Tests (`test/components/*.test.ts`)
- DataProgress: renders correct number of items per agent group
- DataProgress: updates item status correctly
- CitationChip: renders chip with display value
- CitationChip: expands on click to show raw data
- CitationChip: handles missing data gracefully
- DebateMessage: renders with correct agent color
- DebateMessage: parses and renders inline citations
- DebateMessage: handles text-only messages (no citations)
- AgentPanel: shows evidence highlights
- AgentPanel: conviction meter hidden initially, visible after verdict
- Courtroom: renders three-column layout on desktop
- Courtroom: renders single-column on mobile (test with viewport mock)
- TrialPage: shows loading state for pending trial
- TrialPage: renders completed trial with all messages
- TrialPage: auto-scrolls to verdict for completed trials

### Re-evaluation Checkpoint
- Does the three-column layout look good with real streaming content?
- Is the mobile interleaved view readable, or too chaotic during simultaneous streaming?
- Are citation chips too noisy? Too subtle? Adjust sizing/colors.
- Does the auto-scroll behavior feel right?
- Is the phase progression visually clear to a first-time viewer?

### Session Prompt

```
Read @SPEC.md for full project context. Read @BUILD.md for the phased plan. This is Phase 6 — Trial Page UI.

Phases 1-5 are complete: full data layer, Gemini integration with all 3 agents, debate engine (5-phase orchestrator with server-side completion), SSE streaming API, useDebateStream hook. Landing page and trial creation work. All with tests.

PHASE 6 GOALS:
- Three-column courtroom layout (desktop)
- Center streaming panel with live debate messages
- Agent side panels with evidence cards + conviction meters
- Inline citation chips (parse during stream, expand on click)
- Data gathering progress grid (Phase 1 UI)
- Mobile interleaved layout
- Full trial page handling all states

COMPONENTS TO CREATE:
1. components/data-progress.tsx — Phase 1 progress grid: 3 agent groups, items pulse while loading, check/X on complete/error
2. components/citation-chip.tsx — inline colored pill, click to expand raw data popup, color by source type
3. components/debate-message.tsx — message bubble with colored left border (green/red/gold), agent label, inline citations, streaming + completed states
4. components/agent-panel.tsx — side panel: agent identity, evidence highlights (update per phase), conviction meter (hidden→animate at verdict), agent color glow
5. components/debate-stream.tsx — center scrolling panel: messages + phase dividers, auto-scroll (smart: only if near bottom), "Streaming..." indicator
6. components/courtroom.tsx — three-column desktop grid (Bull | Stream | Bear) + Judge bar, phase indicator, token info header
7. app/trial/[id]/page.tsx — full page: server component fetches trial, client component uses useDebateStream, renders courtroom, handles states: pending/gathering/debating/completed/error

MOBILE RESPONSIVE:
- Single column interleaved stream with colored left borders
- Agent panels → compact cards above stream
- Sticky phase indicator header
- Citation chips expand on tap

UX REQUIREMENTS:
- Smart auto-scroll (don't scroll if user scrolled up to read)
- Citation chips: subtle scale-in animation on appear
- Phase transitions: visual separator (line + phase name)
- Phase 2: clear interleaving of Bull/Bear (don't let one dominate)
- Completed trial: instant render + auto-scroll to verdict
- Loading state: skeleton UI or pulse, not spinner
- Strategic drama: MINIMAL animation during debate, save drama for verdict (Phase 7)

EDGE CASES:
- Trial hasn't started → "Preparing trial..." with token info
- Mid-stream error → error message in stream flow
- Very long message → container scrolls, layout doesn't break
- No evidence for agent → "No evidence available" in side panel
- Citation references failed data → "data unavailable" chip state
- Mobile rapid chunks → throttle rendering (requestAnimationFrame)
- Skipped phases (agent failed) → handle gaps in sequence
- Keyboard-accessible citation chips

TESTS:
- DataProgress: renders items per group, status updates
- CitationChip: render, expand, missing data
- DebateMessage: agent colors, inline citations, text-only
- AgentPanel: evidence, conviction meter hidden→visible
- Courtroom: desktop 3-column, mobile single-column
- TrialPage: loading state, completed with messages, auto-scroll to verdict

THEME REFERENCE (from globals.css):
- Bull: #22c55e green, Bear: #ef4444 red, Judge: #f59e0b gold
- Background: #0a0e1a → #141824
- Font: Inter for text, JetBrains Mono for data

After completing, run: pnpm typecheck && pnpm test && pnpm dev
Then: create a trial and watch the full debate render in the courtroom UI. Test on desktop and mobile viewport.
```

---

## Phase 7: Verdict, Sharing & OG Images

### Goals
- Animated verdict display (gauge, conviction meters, safety badge)
- Strategic drama animations for verdict reveal
- Shareable verdict page with OG meta tags
- Puppeteer-based OG image generation
- Share/download functionality

### Tasks
1. Create `components/verdict-display.tsx`:
   - Score gauge: horizontal bar from -100 to +100 with animated marker
   - Verdict label: large text, color-coded (green=buy, red=sell, gray=hold)
   - Summary: 2-3 sentence Judge reasoning
   - Conviction meters: Bull and Bear bars that animate from 0 to final score
   - All animations trigger on mount (when verdict event received) — not before
   - Animation timing: gauge sweeps over 1.5s, label fades in at 1s, meters fill over 2s
2. Create `components/safety-badge.tsx`:
   - Three states: clean (green shield), warnings (yellow shield with count), dangerous (red skull)
   - Tooltip on hover showing specific GoPlus findings
   - Appears below conviction meters in verdict
3. Update `components/agent-panel.tsx` — conviction meters:
   - Hidden/empty during debate phases
   - At verdict: animate from 0 to score with smooth fill animation
   - Color intensity based on score (low = muted, high = vivid)
4. Create `components/share-button.tsx`:
   - "Share Verdict" button → copies `/verdict/[trialId]` URL to clipboard with toast notification
   - "Download Card" button → triggers download of OG image from `/api/verdict/[id]/image`
5. Create `components/verdict-card.tsx` — the HTML template rendered by Puppeteer for OG images:
   - 1200x630px fixed dimensions
   - Dark background matching courtroom theme
   - Token name + symbol, verdict label (color-coded), score gauge, summary
   - Bull/Bear conviction bars, safety badge
   - "Alpha Court" branding in corner
   - Must look good as a Twitter card (clear at small preview sizes)
6. Create `app/verdict/[id]/page.tsx` — shareable verdict page:
   - Separate layout (no courtroom chrome, minimal JS)
   - Large verdict display (score, label, summary, convictions, safety)
   - "View Full Trial →" link to `/trial/[id]`
   - OG meta tags: `og:title`, `og:description`, `og:image`, `twitter:card=summary_large_image`, `twitter:image`
   - OG image URL: `{APP_URL}/api/verdict/[id]/image`
7. Create `app/api/verdict/[id]/route.ts` — GET verdict data:
   - Return trial verdict fields as JSON
   - 404 if trial doesn't exist or not completed
8. Install `puppeteer` and create `app/api/verdict/[id]/image/route.ts`:
   - GET returns PNG image
   - Launch Puppeteer (headless), navigate to an internal HTML page rendering `verdict-card.tsx`
   - Screenshot at 1200x630
   - Cache the resulting PNG (store in filesystem or DB) so repeated requests don't re-render
   - Set Cache-Control headers for CDN caching
9. Update verdict integration in trial page:
   - When verdict event received, trigger dramatic reveal animation
   - After animation completes, show share buttons
   - Smooth transition from "debating" phase to verdict

### UX Considerations
- Verdict reveal is THE moment — build anticipation with a brief pause before showing
- Animations should feel smooth and polished, not janky — use CSS transitions over JS where possible
- Score gauge should have visual weight — thicker bar, clear position marker
- Color coding should be immediately obvious: green = good, red = bad, gray = neutral
- Safety badge should be informative but not alarming — "Clean" is the happy path
- OG image must be readable at Twitter's small preview size (~500px wide render)
- Share button should give clear feedback (toast: "Link copied!")
- Verdict page should load fast (SSR, minimal JS) since it's the viral sharing entry point

### Edge Cases
- Verdict score exactly 0 → label "HOLD", gray color, gauge centered
- Verdict score at extremes (-100 or +100) → gauge at edge, strong color
- Missing safety data (GoPlus failed) → hide safety badge entirely
- OG image generation takes >5s → serve stale cache, regenerate in background
- Very long verdict summary → truncate in OG image (max 3 lines), full text on page
- Verdict page visited before trial completes → show "Trial in progress..." with live link
- Puppeteer crashes → return fallback static image
- Multiple concurrent OG image requests for same trial → only generate once (mutex/lock)
- Twitter crawler visits OG image URL → must return within 5s or Twitter shows no card

### Tests (`test/components/verdict.test.ts`, `test/api/verdict.test.ts`)
- VerdictDisplay: renders all score ranges correctly (-100, -50, 0, 50, 100)
- VerdictDisplay: shows correct label and color for each verdict type
- VerdictDisplay: conviction meters render with correct widths
- SafetyBadge: renders clean/warnings/dangerous states
- SafetyBadge: shows tooltip with findings on hover
- SafetyBadge: hidden when no safety data
- VerdictCard: renders at 1200x630 dimensions
- VerdictCard: all text is visible and not clipped
- ShareButton: copies correct URL to clipboard
- VerdictPage: renders all verdict fields
- VerdictPage: includes correct OG meta tags
- VerdictPage: shows "in progress" for incomplete trial
- Verdict API: returns 404 for missing trial
- Verdict API: returns correct JSON structure
- OG Image API: returns PNG content type
- OG Image API: handles concurrent requests (no double-render)

### Re-evaluation Checkpoint
- Does the verdict animation feel impactful? Too slow? Too fast?
- Does the OG image look good when shared on Twitter? Test with Twitter Card Validator.
- Is the Puppeteer setup stable? Any memory leaks on repeated renders?
- Is the verdict page compelling enough to make someone click "View Full Trial"?
- Should the score gauge be more visually elaborate (e.g., semicircular)?

### Session Prompt

```
Read @SPEC.md for full project context. Read @BUILD.md for the phased plan. This is Phase 7 — Verdict, Sharing & OG Images.

Phases 1-6 are complete: full courtroom UI with three-column layout, streaming debate, citation chips, data progress grid, mobile responsive. Debate engine runs all 5 phases. Landing page, token search, trial creation all work. All with tests.

PHASE 7 GOALS:
- Animated verdict display (gauge, conviction meters, safety badge) with strategic drama
- Shareable verdict page (/verdict/[id]) with OG meta tags
- Puppeteer OG image generation (1200x630 PNG)
- Share/download buttons

COMPONENTS:
1. components/verdict-display.tsx — score gauge (-100→+100, animated sweep 1.5s), verdict label (color-coded, fade in at 1s), summary text, conviction meters (animate fill 0→score over 2s). All triggered on mount when verdict received.
2. components/safety-badge.tsx — clean (green shield) / warnings (yellow + count) / dangerous (red skull). Tooltip with GoPlus findings. Hidden if no safety data.
3. Update components/agent-panel.tsx — conviction meters hidden during debate, animate at verdict
4. components/share-button.tsx — "Share Verdict" (copy URL + toast) + "Download Card" (fetch OG image)
5. components/verdict-card.tsx — HTML template for OG image: 1200x630, dark theme, token name, verdict label, gauge, summary, convictions, safety, branding. Must be readable at small Twitter preview size.
6. app/verdict/[id]/page.tsx — separate minimal layout, large verdict display, "View Full Trial →" link, OG meta tags (og:title, og:description, og:image, twitter:card=summary_large_image)
7. app/api/verdict/[id]/route.ts — GET verdict data JSON, 404 if missing/incomplete
8. Install puppeteer. app/api/verdict/[id]/image/route.ts — launch Puppeteer, render verdict-card HTML, screenshot at 1200x630, cache resulting PNG, Cache-Control headers. Handle concurrent requests (no double-render).

ANIMATION PHILOSOPHY (strategic drama):
- Debate phases: minimal animation
- Verdict reveal: THE moment. Brief pause before showing, then: gauge sweeps, label fades, meters fill
- Use CSS transitions over JS where possible for smoothness

EDGE CASES:
- Score 0 → HOLD/gray/centered gauge
- Score ±100 → gauge at edge, strong color
- No safety data → hide badge
- OG image >5s → serve stale cache
- Long summary → truncate in OG (3 lines max), full on page
- Verdict page before trial completes → "Trial in progress..."
- Puppeteer crash → fallback static image
- Concurrent OG requests → generate once
- Twitter crawler timeout → must respond <5s

TESTS:
- VerdictDisplay: all score ranges, labels, colors, conviction widths
- SafetyBadge: all three states, tooltip, hidden when no data
- VerdictCard: correct dimensions, text visible
- ShareButton: clipboard copy
- VerdictPage: all fields, OG meta tags, in-progress state
- API: 404 for missing, correct JSON, PNG content type, concurrent handling

After completing, run: pnpm typecheck && pnpm test && pnpm dev
Then: run a full trial, verify verdict animation, test the share button, check /verdict/[id] page renders correctly, verify OG image at /api/verdict/[id]/image.
```

---

## Phase 8: Hardening & Polish

### Goals
- Comprehensive error states throughout
- Word length soft timeout working correctly
- Mid-trial join (replay + catch up)
- Debug page
- Final responsive polish
- Pre-cache demo tokens
- End-to-end testing

### Tasks
1. Audit all pages/components for error states:
   - Landing page: search error, trial creation error, cooldown display
   - Trial page: trial not found (404 page), trial errored, debate engine failure mid-stream
   - Verdict page: trial not found, trial in progress
   - Global: network errors, API timeouts
2. Create loading skeletons:
   - Trial page skeleton (three columns with pulsing placeholder blocks)
   - Verdict page skeleton
   - Landing page skeleton (for recent trials loading)
3. Verify and fix word length soft timeout:
   - Test with verbose Gemini responses
   - Ensure the stream stops cleanly without mid-word/mid-sentence cuts
   - Verify the timeout respects the 2x target limit
4. Verify and fix mid-trial join:
   - Test: start a trial, navigate away, come back — should see completed phases + live stream
   - Test: share trial URL during debate — new visitor should see replay + live
   - Test: refresh page during verdict phase — should see full debate + verdict
5. Create `app/debug/page.tsx` — debug dashboard:
   - Protected by `DEBUG_ENABLED=true` env var
   - Cache stats: total entries, hit/miss ratio, oldest entry, cache size by endpoint
   - API timings: average Nansen CLI call duration per endpoint, Gemini call durations
   - Trial stats: total, completed, errored, average duration
   - Recent errors: last 10 error messages from trials
   - Active debates: currently running trials
6. Create `app/api/debug/route.ts` — debug data API
7. Mobile responsive polish:
   - Test every page at 375px and 768px viewports
   - Fix any overflow, text truncation, or layout issues
   - Verify citation chips work on touch (tap to expand)
   - Verify verdict animations work on mobile
   - Test the interleaved debate stream on mobile — is it readable?
8. Pre-cache demo tokens — create a script `scripts/precache.ts`:
   - List of 3-5 well-known tokens with good Nansen coverage (e.g., popular Solana memes)
   - Runs all Nansen CLI calls + supplementary APIs for each token
   - Stores results in cache with long TTL (24h)
   - Optionally runs a full trial for each to pre-populate the recent trials grid
9. Performance audit:
   - Check for unnecessary re-renders during streaming (React profiler)
   - Verify SSE connection doesn't leak on page navigation
   - Check memory usage during long debates
   - Verify SQLite connections are properly closed

### UX Considerations
- Error messages should be human-readable, not technical stack traces
- Loading skeletons should match the actual layout to minimize layout shift
- The 404 page should suggest going back to the landing page
- Debug page should be clean and scannable — not just a wall of numbers
- Mobile: every touch target should be at least 44x44px
- Pre-cached demo should feel indistinguishable from a live trial

### Edge Cases
- User rapidly creates multiple trials → rate limiting? Or just let cooldown handle it
- Browser back/forward during debate → page state should be correct
- Very slow network → SSE reconnection with exponential backoff
- SQLite database file grows large → no action needed for hackathon scale
- Puppeteer browser instance leaks → ensure proper cleanup after each OG image render
- User disables JavaScript → verdict page should still show content (SSR)
- Debug page accessed without DEBUG_ENABLED → 404, don't reveal its existence

### Tests (`test/e2e/*.test.ts`, `test/debug.test.ts`)
- Error states: trial not found, trial errored, network error display
- Skeletons: loading states render without data
- Soft timeout: stops at 2x word target, doesn't cut mid-word
- Mid-trial join: completed phases appear, live stream resumes
- Debug: shows correct cache stats, trial counts
- Debug: returns 404 when DEBUG_ENABLED is not set
- Mobile: layout doesn't break at 375px viewport
- Pre-cache script: populates cache table with correct TTLs
- SSE: connection closes cleanly on page navigation (no leak)

### Re-evaluation Checkpoint
- Is the app stable enough for a demo? Run 5 trials back-to-back.
- Any memory leaks or performance issues after multiple trials?
- Is the error handling comprehensive enough?
- Does the mobile experience need more work?
- Is the debug page useful for demo preparation?

### Session Prompt

```
Read @SPEC.md for full project context. Read @BUILD.md for the phased plan. This is Phase 8 — Hardening & Polish.

Phases 1-7 are complete: full working app with landing page, token search, trial creation, 5-phase debate engine, courtroom UI with streaming, citation chips, animated verdict, safety badge, shareable verdict page with OG images. All with tests.

PHASE 8 GOALS:
- Comprehensive error states and loading skeletons throughout
- Verify soft timeout, mid-trial join, reconnection
- Debug page (/debug, behind env flag)
- Mobile responsive polish
- Pre-cache script for demo tokens
- Performance audit

TASKS:
1. Audit all pages for error/loading/empty states: landing (search error, creation error, cooldown), trial (404, error, mid-stream failure), verdict (not found, in progress)
2. Loading skeletons matching actual layouts for trial page, verdict page, recent trials
3. Verify soft timeout: test with verbose responses, check 2x limit, clean stop without mid-word cut
4. Verify mid-trial join: navigate away + back, share URL during debate, refresh during verdict
5. Create app/debug/page.tsx (DEBUG_ENABLED=true): cache stats (entries, hit/miss, by endpoint), API timings (Nansen + Gemini averages), trial stats (total, completed, errored, avg duration), recent errors, active debates
6. Create app/api/debug/route.ts
7. Mobile polish: test 375px + 768px, fix overflow/truncation, touch targets ≥44px, citation tap-to-expand, verdict animations on mobile
8. Create scripts/precache.ts: list 3-5 popular Solana tokens, run all data fetches, cache with 24h TTL, optionally run full trials to populate recent grid
9. Performance: check re-renders during streaming (React profiler), SSE connection cleanup on navigation, memory during long debates, SQLite connection cleanup

EDGE CASES:
- Rapid trial creation → cooldown handles it
- Browser back/forward during debate → correct state
- Slow network → SSE reconnection with backoff
- Puppeteer browser leak → proper cleanup
- Debug page without env flag → 404, don't reveal existence
- Verdict page JS disabled → SSR still shows content

TESTS:
- Error states render correctly for all scenarios
- Skeletons render without data
- Soft timeout stops at 2x target
- Mid-trial join replays + resumes
- Debug shows correct stats, 404 without flag
- Mobile layout at 375px
- Pre-cache populates correctly
- SSE cleanup on navigation

After completing, run: pnpm typecheck && pnpm test && pnpm dev
Then: run 5 trials back-to-back to verify stability. Test on mobile. Run precache script. Check debug page.
```

---

## Phase 9: Docker & Deployment

### Goals
- Production Dockerfile (Next.js + Puppeteer + Nansen CLI)
- docker-compose.yml with proper volume mounts
- Production testing on VPS
- Final verification

### Tasks
1. Create `Dockerfile`:
   - Multi-stage build (builder + runtime)
   - Stage 1: pnpm install + next build (standalone output)
   - Stage 2: Node.js 22 slim + install Nansen CLI globally + install Puppeteer system dependencies (Chromium)
   - Copy standalone build + static + public
   - Create data directory
   - Set env defaults
   - Expose port 3000
2. Create `docker-compose.yml`:
   - Single service (alpha-court)
   - env_file: .env
   - Ports: 3013:3000 (or configurable)
   - Volumes:
     - `court-data:/app/data` (SQLite persistence)
     - `~/.nansen:/root/.nansen:ro` (Nansen CLI auth, read-only)
   - Health check: curl http://localhost:3000/api/debug (or simple health endpoint)
3. Create `nginx.conf` (if deploying behind nginx):
   - Proxy pass to Next.js
   - SSE support (disable buffering for `/api/debate/*`)
   - Static file caching
   - Gzip compression
   - SSL termination (if needed)
4. Create `/api/health` endpoint — simple health check returning 200
5. Test Docker build locally:
   - Build image
   - Run container
   - Verify all features work (search, trial creation, debate, verdict, OG images)
   - Verify Nansen CLI works inside container
   - Verify Puppeteer works inside container
   - Check data persistence across container restart
6. Production deployment:
   - Push to VPS
   - Run docker-compose up -d
   - Verify with real domain
   - Run precache script on VPS
   - Smoke test all features

### UX Considerations
- Docker image should build in <5 minutes (CI/CD friendly)
- Container should start in <10 seconds
- OG images should generate within 5s even in container (Puppeteer cold start)
- SSE connections must work through nginx (disable proxy_buffering)

### Edge Cases
- Nansen CLI auth file missing in container → clear error on startup
- SQLite database doesn't exist → auto-created on first access
- Puppeteer can't find Chromium → install chromium-sandbox deps in Dockerfile
- Container runs out of disk space (SQLite grows) → monitor, not critical at hackathon scale
- Port conflicts → configurable via docker-compose
- SSL certificate issues → ensure OG image URLs use correct protocol
- Docker build fails on M1 Mac → ensure platform compatibility (linux/amd64 for VPS)

### Tests (manual verification checklist)
- [ ] Docker image builds successfully
- [ ] Container starts and serves the landing page
- [ ] Token search works (Nansen CLI executes inside container)
- [ ] Trial creation works
- [ ] Full debate runs to completion
- [ ] Verdict displays correctly
- [ ] OG image generates (Puppeteer works in container)
- [ ] Verdict page has correct OG meta tags
- [ ] Data persists across container restart
- [ ] SSE works through nginx (no buffering issues)
- [ ] Pre-cache script runs in container
- [ ] Debug page accessible with DEBUG_ENABLED=true
- [ ] Container logs are clean (no error spam)

### Re-evaluation Checkpoint
- Is the Docker image size acceptable? (Will be large due to Puppeteer/Chromium)
- Any issues with Nansen CLI inside Docker?
- Is the deployment stable enough for a demo?
- Final chance to fix any issues before submission.

### Session Prompt

```
Read @SPEC.md for full project context. Read @BUILD.md for the phased plan. This is Phase 9 — Docker & Deployment.

Phases 1-8 are complete: fully working Alpha Court app with landing page, token search, trial creation, 5-phase debate engine, courtroom UI, animated verdict, safety badge, shareable verdict with OG images, debug page, error handling, mobile responsive. All with tests, pre-cache script ready.

PHASE 9 GOALS:
- Production Dockerfile (Next.js standalone + Puppeteer/Chromium + Nansen CLI)
- docker-compose.yml with volume mounts
- nginx config for SSE support
- Production deployment verification

REFERENCE: See nansen-ai3's Docker setup at:
- /Users/mrv/Documents/GitHub/nansen-ai3/Dockerfile.web (multi-stage Next.js build pattern)
- /Users/mrv/Documents/GitHub/nansen-ai3/docker-compose.yml (volume mounts pattern)

CREATE Dockerfile (multi-stage):
- Stage 1 (builder): Node 22 slim, pnpm install --frozen-lockfile, next build
- Stage 2 (runtime): Node 22 slim + install nansen-cli globally (npm i -g nansen-cli) + install Puppeteer deps (chromium, fonts)
- Copy .next/standalone, .next/static, public
- Create /app/data directory
- ENV: NODE_ENV=production, DATABASE_PATH=/app/data/court.db, PORT=3000
- EXPOSE 3000
- CMD: node server.js

CREATE docker-compose.yml:
- Service: alpha-court
- env_file: .env
- ports: "3013:3000"
- volumes:
  - court-data:/app/data (SQLite persistence)
  - ~/.nansen:/root/.nansen:ro (Nansen CLI auth)
- restart: unless-stopped

CREATE nginx.conf (optional, for production):
- proxy_pass to localhost:3000
- SSE: proxy_buffering off for /api/debate/*
- Gzip, static caching, SSL termination placeholder

CREATE app/api/health/route.ts — returns 200 with { status: "ok", timestamp }

EDGE CASES:
- Nansen CLI auth missing → clear error on startup (check in entrypoint)
- Puppeteer chromium deps → install in Dockerfile (fonts, libx11, etc.)
- M1 Mac builds → ensure --platform linux/amd64 for VPS deployment
- SSE through nginx → proxy_buffering off, proxy_http_version 1.1
- SQLite auto-creates on first access

VERIFICATION CHECKLIST (manual testing after deploy):
- Docker builds, container starts, landing page loads
- Token search executes Nansen CLI in container
- Full debate runs to completion
- OG image generates (Puppeteer works)
- Data persists across restart
- SSE works through nginx
- Debug page works
- Pre-cache script runs

After completing: docker build, docker-compose up, verify all features, run precache inside container.
```

---

## Phase Summary

| Phase | Focus | Key Deliverables | Est. Hours |
|-------|-------|------------------|------------|
| 1 | Foundation | Next.js + theme + SQLite + Vitest | 2-3h |
| 2 | Data Layer | Nansen CLI + DexScreener/Jupiter/GoPlus + caching | 3-4h |
| 3 | Landing Page | Token search + trial creation + cooldown | 3-4h |
| 4 | AI System | Gemini SDK + agents + citations | 3-4h |
| 5 | Debate Engine | 5-phase orchestrator + SSE + hook | 3-4h |
| 6 | Trial Page UI | Courtroom layout + streaming + mobile | 4-5h |
| 7 | Verdict & Sharing | Animations + OG images + verdict page | 3-4h |
| 8 | Hardening | Error states + debug + polish + precache | 3-4h |
| 9 | Deployment | Docker + nginx + production | 2-3h |
| **Total** | | | **~26-35h** |

## Re-evaluation Protocol

After each phase:
1. **What worked?** — Keep doing this in the next phase
2. **What didn't work?** — Change approach or update spec
3. **What surprised us?** — API behavior, model quality, performance, etc.
4. **Spec changes needed?** — Update SPEC.md before starting next phase
5. **Priority shift?** — Anything we should move earlier/later?

Things that commonly need adjustment:
- Gemini model names (may change or not be available)
- Nansen CLI command syntax (may differ from expected)
- Agent prompt quality (usually needs 2-3 iterations)
- Animation timing (feels different in practice vs spec)
- Mobile layout (always needs more work than expected)
- API rate limits (may be more restrictive than assumed)
