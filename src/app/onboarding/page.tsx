'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import {
  TrendingUp, ArrowRight, ArrowLeft, User, DollarSign,
  Heart, Shield, Target, Briefcase, CheckCircle2, Sparkles,
  PiggyBank, Loader2, FileText
} from 'lucide-react'
import type {
  EmploymentType, MaritalStatus, RiskTolerance, InvestmentGoal, InvestmentHorizon,
  RiskArchetype, EmergencyFund, DebtType, ExperienceLevel, TaxBracket
} from '@/types'

const RISK_QUESTIONS = [
  {
    question: 'You invest $1,000 and it drops to $800 in one month. What do you do?',
    answers: [
      { text: "Sell everything — I can't handle losing money", score: 1 },
      { text: 'Sell some, move to safer options', score: 2 },
      { text: 'Hold on, markets recover', score: 3 },
      { text: 'Buy more — prices are lower now!', score: 4 },
    ],
  },
  {
    question: 'How long can you leave your money invested without needing it?',
    answers: [
      { text: 'Less than 1 year', score: 1 },
      { text: '1 to 3 years', score: 2 },
      { text: '3 to 7 years', score: 3 },
      { text: "7+ years — I'm in it for the long haul", score: 4 },
    ],
  },
  {
    question: 'Which option sounds most like you?',
    answers: [
      { text: 'I want to keep my money safe above all else', score: 1 },
      { text: 'I prefer slow, steady growth with little risk', score: 2 },
      { text: "I'm okay with some bumps for better returns", score: 3 },
      { text: 'High risk, high reward — let\'s go!', score: 4 },
    ],
  },
  {
    question: 'You hear a stock might double in value but could also go to zero. Do you invest?',
    answers: [
      { text: 'Absolutely not', score: 1 },
      { text: 'Maybe a tiny amount', score: 2 },
      { text: 'Yes, a moderate amount', score: 3 },
      { text: "I'd put in a significant amount", score: 4 },
    ],
  },
  {
    question: 'How would you describe your current financial situation?',
    answers: [
      { text: 'Tight — I need this money available soon', score: 1 },
      { text: 'Stable — I have some emergency savings', score: 2 },
      { text: "Comfortable — I invest what I don't need", score: 3 },
      { text: 'Strong — I actively look for investment opportunities', score: 4 },
    ],
  },
]

function scoreToRiskTolerance(score: number): RiskTolerance {
  if (score <= 8) return 'conservative'
  if (score <= 14) return 'moderate'
  return 'aggressive'
}

function scoreToArchetype(score: number): RiskArchetype {
  if (score <= 7) return 'conservative'
  if (score <= 10) return 'moderately_conservative'
  if (score <= 14) return 'moderate'
  if (score <= 17) return 'moderately_aggressive'
  return 'aggressive'
}

const archetypeDisplay: Record<RiskArchetype, { label: string; color: string; description: string; emoji: string }> = {
  conservative: {
    label: 'Conservative Investor',
    color: '#10B981',
    emoji: '🛡️',
    description: "You prioritize protecting your wealth over chasing gains. We'll build you a stable, low-volatility portfolio.",
  },
  moderately_conservative: {
    label: 'Cautiously Optimistic',
    color: '#06b6d4',
    emoji: '⚓',
    description: 'You want some growth but safety comes first. A mostly stable portfolio with room for modest gains.',
  },
  moderate: {
    label: 'Balanced Investor',
    color: '#4F8EF7',
    emoji: '⚖️',
    description: "You want growth with guardrails. We'll balance risk and reward to grow your wealth steadily.",
  },
  moderately_aggressive: {
    label: 'Growth-Oriented',
    color: '#a78bfa',
    emoji: '🚀',
    description: "You're comfortable with some volatility in exchange for higher growth. Long-term focused.",
  },
  aggressive: {
    label: 'Aggressive Investor',
    color: '#f59e0b',
    emoji: '⚡',
    description: "You're comfortable with market swings for maximum long-term returns. High risk, high reward.",
  },
}

// Steps 0-6 are user-facing; step 7 is the generated IPS confirmation screen
const PROGRESS_STEPS = 7

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [generatingIPS, setGeneratingIPS] = useState(false)
  const [generatedIPS, setGeneratedIPS] = useState<string | null>(null)

  // Step 0
  const [fullName, setFullName] = useState('')
  const [age, setAge] = useState('')
  // Step 1
  const [annualIncome, setAnnualIncome] = useState('')
  const [employmentType, setEmploymentType] = useState<EmploymentType | ''>('')
  // Step 2
  const [maritalStatus, setMaritalStatus] = useState<MaritalStatus | ''>('')
  const [numDependents, setNumDependents] = useState('0')
  // Step 3 — risk quiz
  const [riskAnswers, setRiskAnswers] = useState<number[]>([])
  const [computedRisk, setComputedRisk] = useState<RiskTolerance | null>(null)
  const [computedArchetype, setComputedArchetype] = useState<RiskArchetype | null>(null)
  // Step 4 — financial context
  const [emergencyFund, setEmergencyFund] = useState<EmergencyFund | ''>('')
  const [debtType, setDebtType] = useState<DebtType | ''>('')
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel | ''>('')
  const [taxBracket, setTaxBracket] = useState<TaxBracket | ''>('')
  const [hasNearTermExpenses, setHasNearTermExpenses] = useState<boolean | null>(null)
  // Step 5 — goals
  const [investmentGoal, setInvestmentGoal] = useState<InvestmentGoal | ''>('')
  const [investmentHorizon, setInvestmentHorizon] = useState<InvestmentHorizon | ''>('')

  const progress = Math.min(((step + 1) / PROGRESS_STEPS) * 100, 100)

  function nextStep() { setStep((s) => s + 1) }
  function prevStep() { setStep((s) => Math.max(s - 1, 0)) }

  function handleRiskAnswer(questionIdx: number, score: number) {
    const updated = [...riskAnswers]
    updated[questionIdx] = score
    setRiskAnswers(updated)
    if (questionIdx === RISK_QUESTIONS.length - 1) {
      const total = updated.reduce((a, b) => a + (b || 0), 0)
      setComputedRisk(scoreToRiskTolerance(total))
      setComputedArchetype(scoreToArchetype(total))
    }
  }

  async function handleFinish(withBroker = false, brokerName?: string) {
    setSaving(true)
    setSaveError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/signin'); return }

    const riskScore = riskAnswers.reduce((a, b) => a + (b || 0), 0)
    const risk = computedRisk || scoreToRiskTolerance(riskScore)
    const archetype = computedArchetype || scoreToArchetype(riskScore)

    // Try saving full profile (requires v2 migrations)
    const fullProfile = {
      id: user.id,
      full_name: fullName,
      age: parseInt(age),
      annual_income: parseFloat(annualIncome.replace(/,/g, '')),
      employment_type: employmentType,
      marital_status: maritalStatus,
      num_dependents: parseInt(numDependents),
      risk_tolerance: risk,
      risk_archetype: archetype,
      investment_goal: investmentGoal,
      investment_horizon: investmentHorizon,
      emergency_fund: emergencyFund || 'none',
      debt_type: debtType || 'none',
      experience_level: experienceLevel || 'total_beginner',
      tax_bracket: taxBracket || 'under_44k',
      has_near_term_expenses: hasNearTermExpenses ?? false,
      onboarding_completed: true,
    }

    let { error: upsertError } = await supabase.from('profiles').upsert(fullProfile)

    // If column not found (v2 migrations not run), fall back to v1 fields only
    if (upsertError && upsertError.message.includes('column')) {
      const { error: fallbackError } = await supabase.from('profiles').upsert({
        id: user.id,
        full_name: fullName,
        age: parseInt(age),
        annual_income: parseFloat(annualIncome.replace(/,/g, '')),
        employment_type: employmentType,
        marital_status: maritalStatus,
        num_dependents: parseInt(numDependents),
        risk_tolerance: risk,
        investment_goal: investmentGoal,
        investment_horizon: investmentHorizon,
        onboarding_completed: true,
      })
      upsertError = fallbackError
    }

    if (upsertError) {
      setSaving(false)
      setSaveError(`Database error: ${upsertError.message}. Please run the SQL migrations in your Supabase dashboard first.`)
      return
    }

    // Create portfolio if none exists
    const { data: existing } = await supabase
      .from('portfolios')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!existing) {
      await supabase
        .from('portfolios')
        .insert({ user_id: user.id, name: 'My Portfolio', source: 'manual' })
    }

    if (withBroker && brokerName) {
      await fetch('/api/portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'seed_demo', brokerage: brokerName }),
      })
    }

    setSaving(false)

    // Move to IPS generation step (skip straight to done if IPS fails)
    setStep(7)
    setGeneratingIPS(true)
    try {
      const res = await fetch('/api/ai/ips', { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        setGeneratedIPS(data.investment_policy_statement || null)
      }
    } catch {
      // IPS is best-effort; show confirmation without it
    }
    setGeneratingIPS(false)
  }

  const variants = {
    enter: { opacity: 0, x: 30 },
    center: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -30 },
  }

  return (
    <div className="min-h-screen bg-mesh flex flex-col">
      <div className="flex items-center justify-between p-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#4F8EF7] flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-white">NestEgg</span>
        </div>
        {step < 7 && (
          <div className="text-white/40 text-sm">Step {Math.min(step + 1, 7)} of 7</div>
        )}
      </div>

      {step < 7 && (
        <div className="px-6">
          <Progress value={progress} className="h-1 bg-white/10" />
        </div>
      )}

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-lg">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25 }}
            >

              {/* ── Step 0: Welcome ── */}
              {step === 0 && (
                <StepCard icon={<User className="w-6 h-6" />} title="Let's get to know you" subtitle="This helps us personalize your experience">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-white/60 mb-1.5">Your name</label>
                      <Input
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g. Alex Johnson"
                        className="input-dark"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-white/60 mb-1.5">Your age</label>
                      <Input
                        type="number"
                        min="18"
                        max="100"
                        value={age}
                        onChange={(e) => setAge(e.target.value)}
                        placeholder="e.g. 28"
                        className="input-dark"
                      />
                      <p className="text-white/30 text-xs mt-1">Age shapes the right balance of risk vs. safety for you</p>
                    </div>
                  </div>
                  <StepNav onNext={nextStep} canNext={!!fullName && !!age} />
                </StepCard>
              )}

              {/* ── Step 1: Financial Snapshot ── */}
              {step === 1 && (
                <StepCard icon={<DollarSign className="w-6 h-6" />} title="Your financial snapshot" subtitle="Private — only used to personalize your plan">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-white/60 mb-1.5">Annual income (approximate)</label>
                      <Input
                        type="number"
                        value={annualIncome}
                        onChange={(e) => setAnnualIncome(e.target.value)}
                        placeholder="e.g. 65000"
                        className="input-dark"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-white/60 mb-2">Employment type</label>
                      <div className="grid grid-cols-2 gap-2">
                        {(['employed', 'self-employed', 'student', 'retired', 'unemployed'] as EmploymentType[]).map((type) => (
                          <button
                            key={type}
                            onClick={() => setEmploymentType(type)}
                            className={`p-3 rounded-xl text-sm font-medium border transition-all capitalize ${
                              employmentType === type
                                ? 'bg-[#4F8EF7]/20 border-[#4F8EF7] text-[#4F8EF7]'
                                : 'bg-white/5 border-white/10 text-white/60 hover:border-white/20'
                            }`}
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <StepNav onNext={nextStep} onBack={prevStep} canNext={!!annualIncome && !!employmentType} />
                </StepCard>
              )}

              {/* ── Step 2: Life Stage ── */}
              {step === 2 && (
                <StepCard icon={<Heart className="w-6 h-6" />} title="Your life situation" subtitle="Life stage affects the right investment strategy">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-white/60 mb-2">Relationship status</label>
                      <div className="grid grid-cols-2 gap-2">
                        {(['single', 'married', 'divorced', 'widowed'] as MaritalStatus[]).map((s) => (
                          <button
                            key={s}
                            onClick={() => setMaritalStatus(s)}
                            className={`p-3 rounded-xl text-sm font-medium border transition-all capitalize ${
                              maritalStatus === s
                                ? 'bg-[#4F8EF7]/20 border-[#4F8EF7] text-[#4F8EF7]'
                                : 'bg-white/5 border-white/10 text-white/60 hover:border-white/20'
                            }`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm text-white/60 mb-1.5">Number of dependents</label>
                      <div className="flex gap-2">
                        {['0', '1', '2', '3', '4+'].map((n) => (
                          <button
                            key={n}
                            onClick={() => setNumDependents(n === '4+' ? '4' : n)}
                            className={`flex-1 py-3 rounded-xl text-sm font-semibold border transition-all ${
                              numDependents === (n === '4+' ? '4' : n)
                                ? 'bg-[#4F8EF7]/20 border-[#4F8EF7] text-[#4F8EF7]'
                                : 'bg-white/5 border-white/10 text-white/60 hover:border-white/20'
                            }`}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <StepNav onNext={nextStep} onBack={prevStep} canNext={!!maritalStatus} />
                </StepCard>
              )}

              {/* ── Step 3: Risk Quiz ── */}
              {step === 3 && (
                <StepCard icon={<Shield className="w-6 h-6" />} title="Find your risk style" subtitle="Answer 5 quick questions — no wrong answers!">
                  <div className="space-y-5">
                    {RISK_QUESTIONS.map((q, qi) => (
                      <div key={qi}>
                        <p className="text-white/80 text-sm font-medium mb-2">
                          {qi + 1}. {q.question}
                        </p>
                        <div className="space-y-1.5">
                          {q.answers.map((a, ai) => (
                            <button
                              key={ai}
                              onClick={() => handleRiskAnswer(qi, a.score)}
                              className={`w-full text-left p-2.5 rounded-lg text-sm border transition-all ${
                                riskAnswers[qi] === a.score
                                  ? 'bg-[#4F8EF7]/20 border-[#4F8EF7] text-white'
                                  : 'bg-white/[0.03] border-white/[0.08] text-white/60 hover:border-white/20'
                              }`}
                            >
                              {riskAnswers[qi] === a.score && (
                                <CheckCircle2 className="inline w-3.5 h-3.5 mr-1.5 text-[#4F8EF7]" />
                              )}
                              {a.text}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}

                    {computedArchetype && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-4 rounded-xl border"
                        style={{
                          borderColor: `${archetypeDisplay[computedArchetype].color}40`,
                          background: `${archetypeDisplay[computedArchetype].color}10`,
                        }}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span>{archetypeDisplay[computedArchetype].emoji}</span>
                          <span className="font-semibold text-sm" style={{ color: archetypeDisplay[computedArchetype].color }}>
                            {archetypeDisplay[computedArchetype].label}
                          </span>
                        </div>
                        <p className="text-white/60 text-xs">{archetypeDisplay[computedArchetype].description}</p>
                      </motion.div>
                    )}
                  </div>
                  <StepNav
                    onNext={nextStep}
                    onBack={prevStep}
                    canNext={
                      riskAnswers.length === RISK_QUESTIONS.length &&
                      !riskAnswers.includes(undefined as unknown as number)
                    }
                  />
                </StepCard>
              )}

              {/* ── Step 4: Financial Context ── */}
              {step === 4 && (
                <StepCard icon={<PiggyBank className="w-6 h-6" />} title="Your financial foundation" subtitle="These details help us build a safer, smarter plan for you">
                  <div className="space-y-5">

                    <div>
                      <label className="block text-sm text-white/60 mb-1">Emergency fund</label>
                      <p className="text-white/30 text-xs mb-2">How many months of living expenses do you have saved?</p>
                      <div className="grid grid-cols-2 gap-2">
                        {([
                          { value: 'none', label: 'None yet', emoji: '😬' },
                          { value: 'less_3mo', label: 'Less than 3 months', emoji: '🌱' },
                          { value: '3_6mo', label: '3–6 months', emoji: '✅' },
                          { value: '6mo_plus', label: '6+ months', emoji: '🏆' },
                        ] as { value: EmergencyFund; label: string; emoji: string }[]).map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => setEmergencyFund(opt.value)}
                            className={`p-3 rounded-xl text-left border transition-all ${
                              emergencyFund === opt.value
                                ? 'bg-[#4F8EF7]/20 border-[#4F8EF7]'
                                : 'bg-white/5 border-white/10 hover:border-white/20'
                            }`}
                          >
                            <div className="text-lg mb-0.5">{opt.emoji}</div>
                            <div className="text-xs font-medium text-white/70">{opt.label}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm text-white/60 mb-1.5">Current debt situation</label>
                      <div className="grid grid-cols-2 gap-2">
                        {([
                          { value: 'none', label: 'No significant debt' },
                          { value: 'student_loans', label: 'Student loans' },
                          { value: 'credit_cards', label: 'Credit card debt' },
                          { value: 'mortgage', label: 'Mortgage only' },
                          { value: 'multiple', label: 'Multiple types' },
                        ] as { value: DebtType; label: string }[]).map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => setDebtType(opt.value)}
                            className={`p-3 rounded-xl text-sm font-medium border transition-all ${
                              debtType === opt.value
                                ? 'bg-[#4F8EF7]/20 border-[#4F8EF7] text-[#4F8EF7]'
                                : 'bg-white/5 border-white/10 text-white/60 hover:border-white/20'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm text-white/60 mb-1.5">Investing experience</label>
                      <div className="space-y-1.5">
                        {([
                          { value: 'total_beginner', label: "Brand new — I'm just starting", emoji: '👶' },
                          { value: 'read_about_it', label: "I've read about it but haven't invested", emoji: '📚' },
                          { value: 'traded_before', label: "I've bought stocks before", emoji: '📈' },
                          { value: 'experienced', label: 'I actively manage investments', emoji: '💼' },
                        ] as { value: ExperienceLevel; label: string; emoji: string }[]).map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => setExperienceLevel(opt.value)}
                            className={`w-full text-left p-2.5 rounded-lg text-sm border transition-all ${
                              experienceLevel === opt.value
                                ? 'bg-[#4F8EF7]/20 border-[#4F8EF7] text-white'
                                : 'bg-white/[0.03] border-white/[0.08] text-white/60 hover:border-white/20'
                            }`}
                          >
                            <span className="mr-2">{opt.emoji}</span>{opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-white/60 mb-1.5">Tax bracket</label>
                        <div className="space-y-1.5">
                          {([
                            { value: 'under_44k', label: 'Under $44k' },
                            { value: '44_89k', label: '$44k–$89k' },
                            { value: '89_190k', label: '$89k–$190k' },
                            { value: '190k_plus', label: '$190k+' },
                          ] as { value: TaxBracket; label: string }[]).map((opt) => (
                            <button
                              key={opt.value}
                              onClick={() => setTaxBracket(opt.value)}
                              className={`w-full p-2 rounded-lg text-xs font-medium border transition-all ${
                                taxBracket === opt.value
                                  ? 'bg-[#4F8EF7]/20 border-[#4F8EF7] text-[#4F8EF7]'
                                  : 'bg-white/5 border-white/10 text-white/50 hover:border-white/20'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm text-white/60 mb-1">Big expenses soon?</label>
                        <p className="text-white/25 text-xs mb-2">Car, wedding, home in the next 12 months?</p>
                        <div className="space-y-1.5">
                          <button
                            onClick={() => setHasNearTermExpenses(true)}
                            className={`w-full p-3 rounded-lg text-sm font-medium border transition-all ${
                              hasNearTermExpenses === true
                                ? 'bg-[#f59e0b]/20 border-[#f59e0b] text-[#f59e0b]'
                                : 'bg-white/5 border-white/10 text-white/60 hover:border-white/20'
                            }`}
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => setHasNearTermExpenses(false)}
                            className={`w-full p-3 rounded-lg text-sm font-medium border transition-all ${
                              hasNearTermExpenses === false
                                ? 'bg-[#10B981]/20 border-[#10B981] text-[#10B981]'
                                : 'bg-white/5 border-white/10 text-white/60 hover:border-white/20'
                            }`}
                          >
                            No
                          </button>
                        </div>
                      </div>
                    </div>

                  </div>
                  <StepNav
                    onNext={nextStep}
                    onBack={prevStep}
                    canNext={
                      !!emergencyFund && !!debtType && !!experienceLevel &&
                      !!taxBracket && hasNearTermExpenses !== null
                    }
                  />
                </StepCard>
              )}

              {/* ── Step 5: Investment Goals ── */}
              {step === 5 && (
                <StepCard icon={<Target className="w-6 h-6" />} title="What are you investing for?" subtitle="Your goal shapes your entire strategy">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-white/60 mb-2">Primary investment goal</label>
                      <div className="grid grid-cols-1 gap-2">
                        {[
                          { value: 'retirement', label: '🏖️ Retirement', desc: 'Building wealth for when I stop working' },
                          { value: 'house', label: '🏠 Buy a home', desc: 'Saving for a down payment' },
                          { value: 'wealth', label: '📈 Grow wealth', desc: 'General long-term wealth building' },
                          { value: 'emergency', label: '🛡️ Emergency fund', desc: 'Building a financial safety net' },
                          { value: 'education', label: '🎓 Education', desc: 'For my kids or my own education' },
                        ].map((g) => (
                          <button
                            key={g.value}
                            onClick={() => setInvestmentGoal(g.value as InvestmentGoal)}
                            className={`p-3 rounded-xl text-left border transition-all ${
                              investmentGoal === g.value
                                ? 'bg-[#4F8EF7]/20 border-[#4F8EF7]'
                                : 'bg-white/5 border-white/10 hover:border-white/20'
                            }`}
                          >
                            <div className="font-medium text-sm text-white">{g.label}</div>
                            <div className="text-white/40 text-xs mt-0.5">{g.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm text-white/60 mb-2">How long until you need this money?</label>
                      <div className="grid grid-cols-2 gap-2">
                        {([
                          { value: '<1yr', label: 'Less than 1 year' },
                          { value: '1-5yrs', label: '1 – 5 years' },
                          { value: '5-10yrs', label: '5 – 10 years' },
                          { value: '10+yrs', label: '10+ years' },
                        ] as { value: InvestmentHorizon; label: string }[]).map((h) => (
                          <button
                            key={h.value}
                            onClick={() => setInvestmentHorizon(h.value)}
                            className={`p-3 rounded-xl text-sm font-medium border transition-all ${
                              investmentHorizon === h.value
                                ? 'bg-[#4F8EF7]/20 border-[#4F8EF7] text-[#4F8EF7]'
                                : 'bg-white/5 border-white/10 text-white/60 hover:border-white/20'
                            }`}
                          >
                            {h.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <StepNav onNext={nextStep} onBack={prevStep} canNext={!!investmentGoal && !!investmentHorizon} />
                </StepCard>
              )}

              {/* ── Step 6: Portfolio Setup ── */}
              {step === 6 && (
                <StepCard icon={<Briefcase className="w-6 h-6" />} title="Set up your portfolio" subtitle="You can always add more investments later">
                  <div className="space-y-3">
                    <p className="text-white/50 text-sm">Connect a simulated brokerage to load demo data, or start fresh and add manually.</p>

                    {saveError && (
                      <div className="p-3 rounded-xl bg-[#F43F5E]/10 border border-[#F43F5E]/20 text-[#F43F5E] text-xs leading-relaxed">
                        {saveError}
                      </div>
                    )}

                    {['Robinhood', 'Fidelity', 'Schwab', 'E*TRADE'].map((broker) => (
                      <BrokerButton
                        key={broker}
                        name={broker}
                        disabled={saving}
                        onConnect={async () => {
                          await handleFinish(true, broker)
                        }}
                      />
                    ))}

                    <div className="flex items-center gap-3 my-2">
                      <div className="flex-1 h-px bg-white/10" />
                      <span className="text-white/30 text-xs">or</span>
                      <div className="flex-1 h-px bg-white/10" />
                    </div>

                    <Button
                      onClick={() => handleFinish(false)}
                      disabled={saving}
                      variant="outline"
                      className="w-full border-white/15 text-white/70 hover:bg-white/5 hover:text-white rounded-xl h-11"
                    >
                      {saving ? 'Setting up...' : "I'll add investments manually"}
                    </Button>
                  </div>
                  <div className="pt-2">
                    <Button
                      onClick={prevStep}
                      variant="ghost"
                      className="text-white/40 hover:text-white/70 gap-1 w-full"
                    >
                      <ArrowLeft className="w-4 h-4" /> Back
                    </Button>
                  </div>
                </StepCard>
              )}

              {/* ── Step 7: IPS Generation + Confirmation ── */}
              {step === 7 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4 }}
                >
                  {generatingIPS ? (
                    <div className="glass rounded-2xl p-10 space-y-6 text-center">
                      <div className="w-16 h-16 rounded-full bg-[#4F8EF7]/15 flex items-center justify-center mx-auto">
                        <Loader2 className="w-7 h-7 text-[#4F8EF7] animate-spin" />
                      </div>
                      <div>
                        <p className="text-white font-semibold text-lg">Building your investor profile...</p>
                        <p className="text-white/40 text-sm mt-1">Our AI is crafting a personalized investment strategy just for you</p>
                      </div>
                      <div className="space-y-2 text-left max-w-xs mx-auto">
                        {[
                          'Analyzing your risk tolerance',
                          'Reviewing your financial situation',
                          'Drafting your Investment Policy Statement',
                          'Setting target allocations',
                        ].map((item, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.6 }}
                            className="flex items-center gap-2 text-white/50 text-sm"
                          >
                            <div className="w-1.5 h-1.5 rounded-full bg-[#4F8EF7]/60" />
                            {item}
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="glass rounded-2xl p-8 space-y-6 text-center">
                      <div>
                        <div className="w-16 h-16 rounded-full bg-[#10B981]/15 flex items-center justify-center mx-auto mb-4">
                          <Sparkles className="w-7 h-7 text-[#10B981]" />
                        </div>
                        <h2 className="text-white font-bold text-2xl">Your profile is ready!</h2>
                        <p className="text-white/40 text-sm mt-1">
                          Welcome to NestEgg, {fullName.split(' ')[0]}. Here&apos;s your personalized investment compass.
                        </p>
                      </div>

                      {computedArchetype && (
                        <div
                          className="p-3 rounded-xl border text-left"
                          style={{
                            borderColor: `${archetypeDisplay[computedArchetype].color}30`,
                            background: `${archetypeDisplay[computedArchetype].color}08`,
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{archetypeDisplay[computedArchetype].emoji}</span>
                            <div>
                              <p className="font-semibold text-sm" style={{ color: archetypeDisplay[computedArchetype].color }}>
                                {archetypeDisplay[computedArchetype].label}
                              </p>
                              <p className="text-white/45 text-xs">{archetypeDisplay[computedArchetype].description}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {generatedIPS && (
                        <div className="p-4 rounded-xl border border-[#4F8EF7]/20 bg-[#4F8EF7]/[0.05] text-left">
                          <div className="flex items-center gap-2 mb-2">
                            <FileText className="w-3.5 h-3.5 text-[#4F8EF7]" />
                            <p className="text-[#4F8EF7] text-xs font-medium uppercase tracking-wider">
                              Your Investment Policy Statement
                            </p>
                          </div>
                          <p className="text-white/65 text-sm leading-relaxed">{generatedIPS}</p>
                        </div>
                      )}

                      <Button
                        onClick={() => router.push('/dashboard')}
                        className="w-full bg-[#4F8EF7] hover:bg-[#4F8EF7]/90 text-white font-semibold h-12 rounded-xl text-base gap-2"
                      >
                        Go to my Dashboard <ArrowRight className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </motion.div>
              )}

            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

function StepCard({ icon, title, subtitle, children }: {
  icon: React.ReactNode
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-2xl bg-[#4F8EF7]/15 flex items-center justify-center text-[#4F8EF7]">
          {icon}
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">{title}</h2>
          <p className="text-white/40 text-sm">{subtitle}</p>
        </div>
      </div>
      <div className="glass rounded-2xl p-6 space-y-5">{children}</div>
    </div>
  )
}

function StepNav({ onNext, onBack, canNext = true }: {
  onNext: () => void
  onBack?: () => void
  canNext?: boolean
}) {
  return (
    <div className="flex gap-3 pt-2">
      {onBack && (
        <Button onClick={onBack} variant="ghost" className="text-white/40 hover:text-white/70 gap-1">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
      )}
      <Button
        onClick={onNext}
        disabled={!canNext}
        className="flex-1 bg-[#4F8EF7] hover:bg-[#4F8EF7]/90 text-white font-medium h-11 rounded-xl gap-1 disabled:opacity-40"
      >
        Continue <ArrowRight className="w-4 h-4" />
      </Button>
    </div>
  )
}

function BrokerButton({ name, onConnect, disabled: parentDisabled }: {
  name: string
  onConnect: () => void
  disabled?: boolean
}) {
  const [loading, setLoading] = useState(false)
  const [connected, setConnected] = useState(false)

  const icons: Record<string, string> = {
    Robinhood: '🟢',
    Fidelity: '🔵',
    Schwab: '🟠',
    'E*TRADE': '⚫',
  }

  async function handleClick() {
    setLoading(true)
    await new Promise((r) => setTimeout(r, 1500))
    setConnected(true)
    await onConnect()
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading || connected || parentDisabled}
      className={`w-full flex items-center justify-between p-3.5 rounded-xl border transition-all ${
        connected
          ? 'bg-[#10B981]/10 border-[#10B981]/30 text-[#10B981]'
          : 'bg-white/5 border-white/10 text-white hover:border-white/25 disabled:opacity-60'
      }`}
    >
      <div className="flex items-center gap-3">
        <span className="text-lg">{icons[name]}</span>
        <span className="font-medium text-sm">{name}</span>
        <span className="text-xs text-white/30 bg-white/5 px-2 py-0.5 rounded-full">Demo</span>
      </div>
      {connected ? (
        <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
      ) : loading ? (
        <div className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
      ) : (
        <span className="text-xs text-[#4F8EF7]">Connect →</span>
      )}
    </button>
  )
}
