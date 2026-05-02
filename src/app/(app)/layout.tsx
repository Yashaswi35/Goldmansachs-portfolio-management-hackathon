import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/shared/sidebar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/signin')

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('full_name, onboarding_completed')
    .eq('id', user.id)
    .single()

  // If table doesn't exist, show setup instructions rather than looping
  if (profileError && profileError.message.includes('relation')) {
    redirect('/setup')
  }

  if (!profile?.onboarding_completed) redirect('/onboarding')

  return (
    <div className="flex min-h-screen bg-mesh">
      <Sidebar userName={profile?.full_name} />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
