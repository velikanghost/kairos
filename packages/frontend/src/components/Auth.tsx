'use client'

import { useAccount, useChainId, useSwitchChain } from 'wagmi'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useSessionAccount } from '@/providers/SessionAccountProvider'
import { usePermissions } from '@/providers/PermissionProvider'
import LandingPage from './LandingPage'
import GrantPermissionsButton from './GrantPermissionsButton'
import Header from './Header'
import { AlertTriangle } from 'lucide-react'

export function Auth() {
  const { address, chainId: connectedChainId, isConnected } = useAccount()
  const { switchChain } = useSwitchChain()
  const currentChainId = useChainId()
  const router = useRouter()
  const {
    sessionAccountAddress,
    createSessionAccount,
    isLoading: sessionLoading,
    error: sessionError,
  } = useSessionAccount()
  const { permission } = usePermissions()

  // Redirect to overview if user has granted permissions (session account will be created automatically)
  useEffect(() => {
    if (isConnected && connectedChainId === currentChainId && permission) {
      router.push('/overview')
    }
  }, [isConnected, connectedChainId, currentChainId, permission, router])

  // Not connected - Show landing page
  if (!isConnected) {
    return <LandingPage />
  }

  // Wrong chain
  if (connectedChainId !== currentChainId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[#0a0a0f]">
        <div className="max-w-md w-full space-y-6 text-center">
          <div className="h-16 w-16 mx-auto bg-amber-500/10 border border-amber-500/20 rounded-full flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-amber-400" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-white">Wrong Network</h2>
            <p className="text-gray-400">
              Please switch to Sepolia Testnet to continue
            </p>
          </div>

          <button
            onClick={() => switchChain({ chainId: currentChainId })}
            className="w-full px-6 py-3 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-lg transition-colors"
          >
            Switch to Sepolia Testnet
          </button>
        </div>
      </div>
    )
  }

  // Setup Flow - Only show if not fully configured
  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Minimal Header */}
      <Header variant="minimal" />

      <main className="max-w-2xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-white mb-3">
            Get Started with Kairos
          </h2>
          <p className="text-gray-400">
            Complete the steps below to start automated trading
          </p>
        </div>

        <div className="space-y-6">
          {/* Step 1: Create Session Account */}
          <div
            className={`border rounded-xl p-8 bg-slate-900/30 ${
              sessionAccountAddress
                ? 'border-emerald-500/20 bg-emerald-500/5'
                : 'border-slate-800/50'
            }`}
          >
            <div className="flex items-start space-x-6">
              <div
                className={`shrink-0 flex h-10 w-10 items-center justify-center rounded-full border text-sm font-semibold ${
                  sessionAccountAddress
                    ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
                    : 'border-slate-700 bg-slate-900 text-gray-400'
                }`}
              >
                {sessionAccountAddress ? '✓' : '1'}
              </div>
              <div className="flex-1 space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">
                    Create Session Account
                  </h3>
                  <p className="text-sm text-gray-400 leading-relaxed">
                    This creates a smart account that will execute trades on
                    your behalf
                  </p>
                </div>
                {!sessionAccountAddress && (
                  <>
                    <button
                      onClick={createSessionAccount}
                      disabled={sessionLoading}
                      className="px-6 py-2.5 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
                    >
                      {sessionLoading
                        ? 'Creating...'
                        : 'Create Session Account'}
                    </button>
                    {sessionError && (
                      <p className="text-sm text-red-400">{sessionError}</p>
                    )}
                  </>
                )}
                {sessionAccountAddress && (
                  <p className="text-sm text-emerald-400">
                    Session account created successfully!
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Step 2: Grant Permissions */}
          <div
            className={`border rounded-xl p-8 bg-slate-900/30 ${
              permission
                ? 'border-emerald-500/20 bg-emerald-500/5'
                : sessionAccountAddress
                ? 'border-slate-800/50'
                : 'border-slate-800/30 opacity-50'
            }`}
          >
            <div className="flex items-start space-x-6">
              <div
                className={`shrink-0 flex h-10 w-10 items-center justify-center rounded-full border text-sm font-semibold ${
                  permission
                    ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
                    : sessionAccountAddress
                    ? 'border-slate-700 bg-slate-900 text-gray-400'
                    : 'border-slate-800 bg-slate-950 text-gray-600'
                }`}
              >
                {permission ? '✓' : '2'}
              </div>
              <div className="flex-1 space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">
                    Grant Permissions
                  </h3>
                  <p className="text-sm text-gray-400 leading-relaxed mb-4">
                    Allow the session account to execute periodic trades
                  </p>
                </div>
                {sessionAccountAddress && !permission && (
                  <GrantPermissionsButton />
                )}
                {permission && (
                  <p className="text-sm text-emerald-400">
                    Permissions granted! Redirecting to dashboard...
                  </p>
                )}
                {!sessionAccountAddress && (
                  <p className="text-sm text-gray-500">Complete step 1 first</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
