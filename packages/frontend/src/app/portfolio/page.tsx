'use client'

import { useAccount } from 'wagmi'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import Header from '@/components/Header'
import PnLChart from '@/components/PnLChart'
import PortfolioOverview from '@/components/PortfolioOverview'
import { useSessionAccount } from '@/providers/SessionAccountProvider'

export default function PortfolioPage() {
  const { isConnected } = useAccount()
  const router = useRouter()
  const { sessionAccountAddress } = useSessionAccount()

  useEffect(() => {
    if (!isConnected) {
      router.push('/')
    }
  }, [isConnected, router])

  if (!isConnected) {
    return null
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <Header />
      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="space-y-8">
          {/* Page Header */}
          <div>
            <h1 className="text-3xl font-bold text-white">Portfolio</h1>
            <p className="mt-2 text-sm text-gray-400">
              Track your holdings and performance
            </p>
          </div>

          {/* Portfolio Content */}
          {sessionAccountAddress ? (
            <div className="space-y-8">
              <PortfolioOverview
                sessionAccountAddress={sessionAccountAddress}
              />

              {/* PnL Chart */}
              <PnLChart sessionAccountAddress={sessionAccountAddress} />
            </div>
          ) : (
            <div className="rounded-xl border border-slate-700/50 bg-slate-900/30 p-12 text-center">
              <p className="text-gray-400">
                Create a session account to view your portfolio
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
