'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import {
  TrendingUp, LayoutDashboard, Brain, Shuffle, BookOpen,
  PlusCircle, LogOut, User
} from 'lucide-react'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/analysis', label: 'AI Analysis', icon: Brain },
  { href: '/rebalance', label: 'Rebalance', icon: Shuffle },
  { href: '/learn', label: 'Learn', icon: BookOpen },
]

export function Sidebar({ userName }: { userName?: string | null }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <div className="w-60 flex-shrink-0 h-screen sticky top-0 flex flex-col glass border-r border-white/[0.06]">
      {/* Logo */}
      <div className="p-5 border-b border-white/[0.06]">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#4F8EF7] flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-white text-lg">NestEgg</span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link key={href} href={href}>
              <div className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                active
                  ? 'text-white'
                  : 'text-white/40 hover:text-white/70 hover:bg-white/5'
              }`}>
                {active && (
                  <motion.div
                    layoutId="activeNav"
                    className="absolute inset-0 rounded-xl bg-[#4F8EF7]/15 border border-[#4F8EF7]/20"
                    transition={{ type: 'spring', duration: 0.4 }}
                  />
                )}
                <Icon className={`w-4 h-4 relative z-10 ${active ? 'text-[#4F8EF7]' : ''}`} />
                <span className="relative z-10">{label}</span>
              </div>
            </Link>
          )
        })}

        <div className="pt-3 border-t border-white/[0.06] mt-3">
          <Link href="/portfolio/add">
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[#4F8EF7] hover:bg-[#4F8EF7]/10 transition-all">
              <PlusCircle className="w-4 h-4" />
              Add Investment
            </div>
          </Link>
        </div>
      </nav>

      {/* User */}
      <div className="p-3 border-t border-white/[0.06]">
        <div className="flex items-center gap-3 px-3 py-2 rounded-xl mb-0.5">
          <div className="w-7 h-7 rounded-full bg-[#4F8EF7]/20 flex items-center justify-center">
            <User className="w-3.5 h-3.5 text-[#4F8EF7]" />
          </div>
          <span className="text-white/60 text-sm truncate">{userName || 'Investor'}</span>
        </div>
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-white/30 hover:text-white/60 hover:bg-white/5 transition-all"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </div>
  )
}
