import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { RebalancingScenario, RebalancingAction } from '@/types'
import { buildPersonalizedPolicy, buildPolicyDiagnostics } from '@/lib/personalization/policy'
import { applyRebalanceCompliance } from '@/lib/personalization/compliance'
import { runRebalanceEngine } from '@/lib/rebalance-engine'
import type { HoldingLot, RebalanceMode } from '@/lib/rebalance-engine/types'
import { runLegacyRebalanceScenarios, buildLegacyComparisonSummary } from '@/lib/rebalance-engine/legacy'
import { getOrBuildUserAiContext } from '@/lib/personalization/user-context'

function toScenarioTitle(type: 'conservative' | 'moderate' | 'aggressive'): string {
  if (type === 'conservative') return 'Capital Shield'
  if (type === 'aggressive') return 'Growth Accelerator'
  return 'Balanced Optimizer'
}

function toTagline(type: 'conservative' | 'moderate' | 'aggressive'): string {
  if (type === 'conservative') return 'Lower volatility with smaller, safer moves.'
  if (type === 'aggressive') return 'Higher growth tilt with wider tolerance for volatility.'
  return 'Balanced adjustments aligned to your target allocation.'
}

function toExpectedOutcome(type: 'conservative' | 'moderate' | 'aggressive', triggerReason: string): string {
  if (type === 'conservative') return `Reduces concentration and downside exposure while keeping diversification stable (${triggerReason}).`
  if (type === 'aggressive') return `Increases growth allocation while maintaining policy limits (${triggerReason}).`
  return `Brings weights closer to target and reduces allocation drift (${triggerReason}).`
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const v2Enabled = process.env.REBALANCE_ENGINE_V2_ENABLED !== 'false'
  const compareLegacy = body?.compare_legacy === true
  const portfolio_id = body?.portfolio_id as string | undefined
  const mode = (body?.mode as RebalanceMode) || 'hybrid'
  const threshold_pct = typeof body?.threshold_pct === 'number' ? body.threshold_pct : 5
  if (!portfolio_id) {
    return NextResponse.json({ error: 'portfolio_id is required' }, { status: 400 })
  }

  const userContext = await getOrBuildUserAiContext({
    supabase,
    userId: user.id,
    portfolioId: portfolio_id,
  })
  const [lotsRes, lastRecoRes] = await Promise.all([
    supabase.from('holding_lots').select('*').eq('portfolio_id', portfolio_id),
    supabase.from('rebalance_recommendations')
      .select('created_at')
      .eq('user_id', user.id)
      .eq('portfolio_id', portfolio_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const profile = userContext.profile
  const holdings = userContext.holdings
  const lots = (lotsRes.data || []) as HoldingLot[]
  const lastRebalanceAt = lastRecoRes.data?.created_at || null

  if (holdings.length === 0) {
    return NextResponse.json({ error: 'No holdings to rebalance' }, { status: 400 })
  }

  const totalValue = userContext.total_value
  const enrichedHoldings = holdings.map((h) => ({
    ...h,
    company_name: h.company_name || h.ticker,
    sector: h.sector || 'Other',
    current_pct: h.allocation_pct,
    lots: lots.filter((l) => l.holding_id === h.id),
  }))

  const policy = buildPersonalizedPolicy(profile)
  const policyDiagnostics = buildPolicyDiagnostics(
    enrichedHoldings.map((h) => ({
      ticker: h.ticker,
      current_value: h.current_value,
      asset_type: h.asset_type,
      sector: h.sector,
    })),
    totalValue,
    policy
  )
  const availableContribution = typeof body?.available_contribution_cash === 'number'
    ? Math.max(0, body.available_contribution_cash)
    : Math.max(0, Number(userContext.available_contribution_cash || 0))

  const engine = runRebalanceEngine({
    mode,
    profile,
    policy,
    holdings: enrichedHoldings,
    total_value: totalValue,
    available_contribution_cash: availableContribution,
    threshold_pct,
    last_rebalance_at: lastRebalanceAt,
  })

  const holdingsSummary = enrichedHoldings.map((h) => ({
    ticker: h.ticker,
    company: h.company_name,
    sector: h.sector,
    assetType: h.asset_type,
    allocationPct: totalValue > 0 ? ((h.current_value / totalValue) * 100).toFixed(1) : '0',
    gainLossPct: (((h.current_price - h.avg_cost_basis) / Math.max(0.01, h.avg_cost_basis)) * 100).toFixed(1),
  }))

  const scenarioTypes: Array<'conservative' | 'moderate' | 'aggressive'> = ['conservative', 'moderate', 'aggressive']
  const scenariosRaw: RebalancingScenario[] = scenarioTypes.map((scenarioType) => {
    const actions: RebalancingAction[] = engine.trade_queue
      .filter((t) => t.scenario_type === scenarioType)
      .slice(0, 6)
      .map((t) => ({
        ticker: t.ticker,
        company_name: t.company_name,
        action: t.action,
        current_pct: t.current_pct,
        target_pct: t.target_pct,
        estimated_amount: t.dollars,
        reason: t.reason,
        beginner_explanation: t.explanation,
      }))

    const riskLevel = scenarioType === 'conservative' ? 3 : scenarioType === 'moderate' ? 6 : 9
    return {
      scenario_type: scenarioType,
      title: toScenarioTitle(scenarioType),
      tagline: toTagline(scenarioType),
      rationale: `Deterministic ${mode} rebalance using policy constraints and tax-lot optimization. Trigger: ${engine.drift.trigger_reason}.`,
      expected_outcome: toExpectedOutcome(scenarioType, engine.drift.trigger_reason),
      risk_level: riskLevel,
      strategy_basis: `${mode} mode with threshold ${threshold_pct}% and impact-per-dollar queue ranking`,
      actions,
    }
  })

  let scenarios: RebalancingScenario[] = applyRebalanceCompliance(scenariosRaw, profile, policy)
  let legacyScenarios: RebalancingScenario[] = []
  const targetStockMid = Math.round((policy.target_stock_min_pct + policy.target_stock_max_pct) / 2)

  if (!v2Enabled || compareLegacy) {
    legacyScenarios = applyRebalanceCompliance(
      await runLegacyRebalanceScenarios({
        profile,
        holdingsSummary,
        totalValue,
        targetStockPct: targetStockMid,
      }),
      profile,
      policy
    )
  }

  if (!v2Enabled) {
    scenarios = legacyScenarios
  }

  const snapshotJson = {
    ...engine.snapshot,
    mode,
    threshold_pct,
    available_contribution_cash: availableContribution,
  }
  const diagnosticsJson = {
    ...engine.diagnostics,
    drift: engine.drift,
    policy: policyDiagnostics,
  }
  const queueJson = engine.trade_queue

  // Persist to DB
  const { data: session } = await supabase
    .from('rebalancing_sessions')
    .insert({ user_id: user.id, portfolio_id, market_context: `EngineV2 ${mode} ${new Date().toISOString()}` })
    .select()
    .single()

  if (session) {
    await supabase.from('rebalancing_scenarios').insert(
      scenarios.map((s) => ({ ...s, session_id: session.id }))
    )
  }

  const recommendation = v2Enabled
    ? await supabase
        .from('rebalance_recommendations')
        .insert({
          user_id: user.id,
          portfolio_id,
          mode,
          trigger_reason: engine.drift.trigger_reason,
          snapshot_json: snapshotJson,
          diagnostics_json: diagnosticsJson,
          queue_json: queueJson,
        })
        .select('id')
        .single()
    : { data: null as { id: string } | null }

  if (recommendation.data?.id && queueJson.length > 0 && v2Enabled) {
    await supabase.from('rebalance_trades').insert(
      queueJson.map((t, index) => ({
        recommendation_id: recommendation.data!.id,
        scenario_type: t.scenario_type,
        rank: index + 1,
        ticker: t.ticker,
        action: t.action,
        dollars: t.dollars,
        shares_estimate: t.shares_estimate,
        current_pct: t.current_pct,
        target_pct: t.target_pct,
        impact_score: t.impact_score,
        tax_note: t.tax_note,
        reason: t.reason,
        explanation: t.explanation,
        lot_ids: t.lot_ids || null,
      }))
    )
  }

  return NextResponse.json({
    engine_version: v2Enabled ? 'v2' : 'legacy',
    mode,
    threshold_pct,
    trigger: engine.drift.should_rebalance,
    trigger_reason: engine.drift.trigger_reason,
    snapshot: engine.snapshot,
    diagnostics: diagnosticsJson,
    trade_queue: queueJson,
    scenarios,
    recommendation_id: recommendation.data?.id || null,
    session_id: session?.id || null,
    legacy_comparison: compareLegacy
      ? buildLegacyComparisonSummary({
          deterministicScenarios: applyRebalanceCompliance(scenariosRaw, profile, policy),
          legacyScenarios,
        })
      : null,
  })
}
