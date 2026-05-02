# NestEgg Product and Technical Blueprint

## 1) Problem We Are Solving

Retail investors, especially beginners, face three recurring problems:

1. **Advice is generic, not personal**  
   Most tools provide one-size-fits-all guidance without grounding recommendations in the user's life context (income, goals, horizon, risk tolerance, dependents, debt load).

2. **Portfolio actionability is weak**  
   Users can see charts, but they do not get clear, prioritized, and explainable next actions tied to policy constraints.

3. **Decision confidence is low during uncertainty**  
   When markets move or social sentiment spikes, users need plain-English interpretation, not raw data overload.

NestEgg solves this by combining deterministic portfolio intelligence with AI-generated explanations and conversational support.

---

## 2) Vision

Build the most trusted **AI copilot for beginner investors**: a product that converts personal context + portfolio state + market signals into clear, safe, and explainable guidance.

The long-term vision is to make every user feel:

- "I know what my plan is."
- "I know why this recommendation exists."
- "I know what to do next."

---

## 3) Target User Persona

### Primary Persona: Guided Beginner

- Age: 22-40
- Early-to-mid career, regular income, first serious investing journey
- Comfortable using apps, not comfortable with finance jargon
- Wants growth but fears major losses
- Needs coaching-style explanations and specific next steps

### Secondary Persona: Busy Professional Investor

- Already owns multiple holdings, limited time for active management
- Wants fast diagnosis of drift, concentration, and risk-policy mismatches
- Values concise AI summaries and rebalance scenarios more than educational content

---

## 4) Proposed Solution

NestEgg provides an end-to-end operating system for personal portfolio decisions:

1. **Adaptive onboarding** to build a profile, risk archetype, and investment policy baseline.
2. **Personalized policy engine** that converts profile data into hard allocation and concentration constraints.
3. **Portfolio intelligence layer** that merges holdings, pricing, and fundamentals into a normalized snapshot.
4. **Deterministic rebalance engine** that produces scenario-based trade queues with explainability.
5. **AI analysis layer** that translates diagnostics into beginner-friendly, context-aware insights.
6. **AI chat copilot** that supports natural language Q&A using portfolio + market + optional social signals.
7. **Compliance and safety layer** to avoid guarantees and keep outputs educational.

---

## 5) Methodology

NestEgg uses a **hybrid intelligence methodology**:

### A. Deterministic First

- Portfolio diagnostics, drift detection, and trade queues are rule-driven and reproducible.
- Policy constraints are explicit and auditable.
- Trade prioritization uses impact-per-dollar and tax-aware logic.

### B. AI for Translation and Coaching

- LLMs are used to explain, summarize, and personalize communication.
- Structured outputs (JSON) are preferred where possible.
- Deterministic fallbacks are used when AI output is missing or malformed.

### C. Context Persistence

- A per-user AI context cache stores profile + holdings fingerprint and normalized context payload.
- Rebuild only on profile/portfolio change, reducing latency and ensuring consistency across AI features.

### D. Safety by Design

- Prompt-level and post-processing safeguards avoid guarantees and hard trading imperatives.
- Outputs are framed as educational guidance, not direct investment execution.

---

## 6) User Onboarding Strategy

Onboarding is a 7-step guided flow designed to maximize completion while collecting decision-critical data:

1. Identity and age
2. Income and employment
3. Life stage/dependents
4. Risk quiz (5 questions -> risk tolerance + risk archetype)
5. Financial context (emergency fund, debt, tax bracket, near-term expenses, experience)
6. Goal and horizon
7. Portfolio setup (manual start or demo brokerage seed)

After completion:

- Profile is persisted in Supabase.
- A default portfolio is provisioned if missing.
- `POST /api/ai/ips` generates a personalized Investment Policy Statement and target allocation.
- Context cache is refreshed to keep downstream AI routes synchronized.

This creates a strong "first value" moment: users immediately receive a tailored policy compass before deep portfolio actions.

---

## 7) Rebalance Strategies

NestEgg supports multiple rebalance triggers and scenario outcomes:

### Trigger Modes

- **Threshold**: rebalance when drift exceeds configured threshold.
- **Calendar**: rebalance on cadence.
- **Hybrid**: combines threshold and calendar logic.

### Strategy Pipeline

1. Build portfolio snapshot.
2. Build target allocations by scenario (`conservative`, `moderate`, `aggressive`).
3. Detect drift against moderate target.
4. Optimize scenario trades (tax-aware, contribution-aware).
5. Rank and queue actions by impact.

### Output Structure

- `trade_queue` with `buy/sell/hold`, dollars, shares estimate, impact score, and explanations.
- Three user-facing scenarios:
  - `Capital Shield` (conservative)
  - `Balanced Optimizer` (moderate)
  - `Growth Accelerator` (aggressive)

### Rollout and Reliability

- Engine V2 (deterministic) can be toggled by env flag.
- Legacy prompt-led scenario generation remains available for fallback/comparison.
- Optional legacy comparison summary helps validate parity during rollout.

---

## 8) AI Analysis Strategy

NestEgg AI analysis is designed around structured personalization and robust fallback:

### Portfolio Analysis (`POST /api/ai/analysis`)

- Inputs: user context, holdings snapshot, policy diagnostics.
- AI returns strict JSON (`health_score`, risk summary, insights, suggested additions).
- Deterministic fallback generates a complete analysis when model output fails.
- Risk ranking step enriches top risks with priority/severity/urgency semantics.
- Compliance layer post-processes final payload.

### Holding Insight (`POST /api/ai/holding-insight`)

- Inputs: holding details + quote + fundamentals + profile context.
- AI returns verdict (`Strong Fit`, `Fit`, `Watch`, `Misaligned`) plus key points and risk watchlist.
- Sanitization strips risky phrasing and enforces educational language.

### IPS Generation (`POST /api/ai/ips`)

- Uses profile and computed stock/bond/cash targets to create a personalized policy statement.
- Persists IPS and target allocations to profile.

---

## 9) AI Chat Feature with Multi-Agent Architecture

Current chat implementation uses a single orchestrated prompt.  
To scale quality, speed, and trust, NestEgg should evolve this into a **multi-agent architecture**.

### Proposed Multi-Agent Roles

1. **Conversation Agent (Orchestrator)**
   - Owns user interaction and final response synthesis.
   - Breaks user query into sub-tasks and merges outputs.

2. **Portfolio Agent**
   - Interprets holdings, drift, concentration, and policy fit.
   - Pulls normalized user context and rebalance diagnostics.

3. **Market Agent**
   - Curates relevant quote/news/fundamental context for discussed tickers.
   - Scores relevance and recency to prevent noise.

4. **Sentiment Agent**
   - Processes optional X.com/Reddit links/notes.
   - Emits confidence-weighted sentiment signals, clearly labeled as unverified.

5. **Policy & Risk Agent**
   - Validates recommendations against user policy constraints and risk bucket.
   - Flags unsafe or inconsistent guidance.

6. **Compliance Agent (Guardrail)**
   - Final-pass safety checks: no guarantees, no imperative trade instructions, no legal/tax overreach.

### Execution Pattern

- Orchestrator receives question and context metadata.
- Sub-agents run in parallel where possible.
- A structured intermediate schema captures:
  - `facts`
  - `inferences`
  - `confidence`
  - `policy_violations`
  - `recommended_next_steps`
- Orchestrator produces:
  - short direct answer
  - policy-aware rationale
  - 3 specific next steps

### Benefits

- Better reasoning separation (market facts vs user policy vs sentiment).
- Improved transparency and debuggability.
- Easier A/B testing and agent-level quality monitoring.
- Stronger safety guarantees before user-visible output.

---

## 10) How We Solve the Problem End-to-End

NestEgg links product value across the full decision loop:

1. **Profile users deeply but simply** via guided onboarding.
2. **Formalize intent into policy constraints** with IPS + target allocations.
3. **Continuously normalize portfolio context** into a reusable AI context layer.
4. **Diagnose and prioritize risk drift deterministically** for explainable action.
5. **Translate diagnostics into plain-English guidance** with structured AI outputs.
6. **Provide always-available conversational support** grounded in user-specific context.
7. **Persist recommendations and sessions** for continuity, review, and future learning loops.

---

## 11) Technical Architecture

### Frontend

- Next.js App Router (React 18, TypeScript, Tailwind)
- Dashboard UX with allocation visualization, holdings table, and AI chat modal
- Dynamic modal for holding-level insights

### Backend/API

- Next.js route handlers under `src/app/api`
- Core AI endpoints:
  - `/api/ai/ips`
  - `/api/ai/analysis`
  - `/api/ai/holding-insight`
  - `/api/ai/rebalance`
  - `/api/ai/dashboard-chat`
- Portfolio CRUD and market data endpoints:
  - `/api/portfolio`
  - `/api/market/quote`
  - `/api/market/search`

### Data and Persistence

- Supabase Postgres with RLS policies
- Core tables:
  - `profiles`
  - `portfolios`
  - `holdings`
  - `holding_lots`
  - `rebalancing_sessions`
  - `rebalancing_scenarios`
  - `rebalance_recommendations`
  - `rebalance_trades`
  - `user_ai_contexts`

### AI and Market Integrations

- OpenAI API for chat completions and structured JSON outputs
- Yahoo Finance data via `yahoo-finance2` wrappers for quote/news/fundamentals/history

### Core Internal Modules

- `lib/personalization/*`
  - policy generation
  - compliance filtering
  - risk ranking
  - user context cache and fingerprinting
- `lib/rebalance-engine/*`
  - snapshot builder
  - target builder
  - drift detector
  - tax optimizer
  - queue ranking
  - legacy compatibility path

### Security and Governance

- Supabase auth + row-level security to isolate user data
- API route auth checks before portfolio/AI access
- Prompt and output safety patterns to minimize harmful finance phrasing

### Reliability Principles

- Deterministic fallbacks for critical AI routes
- Cached user context for latency reduction and coherence
- Feature flags for controlled rollout (`REBALANCE_ENGINE_V2_ENABLED`)
- Legacy comparison path for regression detection

---

## 12) Success Metrics (Recommended)

To validate product-market fit and system quality, track:

- Onboarding completion rate
- Time-to-first-actionable-insight
- % users with IPS generated within first session
- Rebalance recommendation acceptance/view rate
- AI response helpfulness rating
- AI safety violation rate (should trend to near zero)
- Latency p95 for analysis, rebalance, and chat endpoints

---

## 13) Next Technical Milestones

1. Implement multi-agent chat orchestration and agent-level telemetry.
2. Add recommendation outcome tracking (which suggested actions users adopt).
3. Introduce scenario backtesting and what-if simulations.
4. Expand compliance policy engine with stricter financial safety taxonomies.
5. Add observability dashboards for drift triggers, queue quality, and AI fallback frequency.

---

## 14) One-Line Positioning

NestEgg is a personalized AI investing copilot that combines deterministic portfolio intelligence with safe, explainable guidance so beginners can invest with clarity and confidence.
