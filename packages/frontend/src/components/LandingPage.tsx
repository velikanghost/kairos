'use client'

import { metaMask } from 'wagmi/connectors'
import { useConnect } from 'wagmi'
import { Clock } from 'lucide-react'
import Header from './Header'

export default function LandingPage() {
  const { connect } = useConnect()

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <Header variant="landing" />

      <main className="relative px-6 pt-10 pb-20 mx-auto max-w-7xl">
        <div className="text-center">
          <p className="text-sm text-gray-500 mb-6 tracking-wide">
            INTRODUCING
          </p>

          <h1 className="text-[120px] md:text-[180px] font-bold leading-none mb-8 bg-linear-to-b from-white to-gray-600 bg-clip-text text-transparent">
            Kairos
          </h1>

          <p className="text-2xl text-gray-400 mb-16 max-w-2xl mx-auto leading-relaxed">
            Automated DCA with time-limited permissions and spending caps,
            powered by Envio and MetaMask Advanced Permissions (ERC-7710/7715).
          </p>

          {/* Demo Card - Clean and Centered */}
          <div className="max-w-md mx-auto">
            <div className="border border-slate-800/50 rounded-2xl p-8 bg-slate-900/30 backdrop-blur-sm">
              <div className="text-center mb-6">
                <h3 className="text-lg font-semibold text-white mb-2">
                  Connect to get started
                </h3>
                <p className="text-sm text-gray-500">
                  Start your automated DCA strategy
                </p>
              </div>

              <button
                onClick={() => connect({ connector: metaMask() })}
                className="w-full px-6 py-3.5 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-xl transition-colors"
              >
                Connect Wallet
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Minimal Footer */}
      <footer className="relative px-6 py-8 border-t border-slate-800/50">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              © 2025 Kairos. Built on Ethereum.
            </p>
            <div className="flex items-center space-x-6 text-sm text-gray-500">
              <a href="#" className="hover:text-white transition-colors">
                Docs
              </a>
              <a href="#" className="hover:text-white transition-colors">
                GitHub
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
