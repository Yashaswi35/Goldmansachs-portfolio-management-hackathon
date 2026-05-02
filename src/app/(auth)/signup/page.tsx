'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TrendingUp, Eye, EyeOff } from 'lucide-react'

export default function SignUpPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [emailSent, setEmailSent] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    if (data.session) {
      // Email confirmation disabled — user is immediately logged in
      router.push('/onboarding')
    } else {
      // Email confirmation required — show instructions
      setEmailSent(true)
      setLoading(false)
    }
  }

  if (emailSent) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
        <div className="w-16 h-16 rounded-full bg-[#10B981]/15 flex items-center justify-center mx-auto mb-4">
          <TrendingUp className="w-7 h-7 text-[#10B981]" />
        </div>
        <h2 className="text-white font-bold text-xl mb-2">Check your email</h2>
        <p className="text-white/50 text-sm max-w-xs mx-auto mb-4">
          We sent a confirmation link to <strong className="text-white/70">{email}</strong>.
          Click it to activate your account, then sign in.
        </p>
        <Link href="/signin" className="text-[#4F8EF7] text-sm hover:underline">Go to sign in →</Link>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="text-center mb-8">
        <Link href="/" className="inline-flex items-center gap-2 mb-6">
          <div className="w-9 h-9 rounded-xl bg-[#4F8EF7] flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-white">NestEgg</span>
        </Link>
        <h1 className="text-2xl font-bold text-white">Start investing smarter</h1>
        <p className="text-white/50 mt-1 text-sm">Your AI-powered financial guide</p>
      </div>

      <div className="glass rounded-2xl p-6">
        <form onSubmit={handleSignUp} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-white/70 text-sm">Email address</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-[#4F8EF7] focus:ring-[#4F8EF7]/20"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-white/70 text-sm">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                minLength={8}
                required
                className="bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-[#4F8EF7] pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="text-[#F43F5E] text-sm bg-[#F43F5E]/10 border border-[#F43F5E]/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-[#4F8EF7] hover:bg-[#4F8EF7]/90 text-white font-medium h-11 rounded-xl transition-all"
          >
            {loading ? 'Creating account...' : 'Create free account'}
          </Button>
        </form>

        <div className="mt-4 text-center text-sm text-white/40">
          Already have an account?{' '}
          <Link href="/signin" className="text-[#4F8EF7] hover:underline">
            Sign in
          </Link>
        </div>
      </div>

      <p className="text-center text-xs text-white/25 mt-4">
        By signing up you agree to our Terms of Service and Privacy Policy.
        NestEgg is for educational purposes only, not financial advice.
      </p>
    </motion.div>
  )
}
