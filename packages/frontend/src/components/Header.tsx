'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useAccount, useDisconnect, useConnect } from 'wagmi'
import { metaMask } from 'wagmi/connectors'
import Logo from './Logo'

type HeaderVariant = 'landing' | 'minimal' | 'dashboard'

interface HeaderProps {
  variant?: HeaderVariant
}

export default function Header({ variant = 'dashboard' }: HeaderProps) {
  const pathname = usePathname()
  const { address, chainId } = useAccount()
  const { disconnect } = useDisconnect()
  const { connect } = useConnect()

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  const getChainName = (id?: number) => {
    if (id === 11155111) return 'Sepolia'
    return 'Unknown'
  }

  const navigation = [
    { name: 'Overview', href: '/overview' },
    { name: 'Strategies', href: '/strategies' },
    { name: 'Portfolio', href: '/portfolio' },
    { name: 'Permissions', href: '/permissions' },
    { name: 'History', href: '/history' },
  ]

  // Landing page header - Logo + CTA button
  if (variant === 'landing') {
    return (
      <header className="relative z-10 flex items-center justify-between px-6 py-6 mx-auto max-w-7xl">
        <Logo href="/" />
        <button
          onClick={() => connect({ connector: metaMask() })}
          className="px-6 py-2.5 text-sm font-medium border border-slate-700/50 rounded-lg hover:bg-white/5 transition-colors"
        >
          Get started
        </button>
      </header>
    )
  }

  // Minimal header - Logo only (for setup/auth flow)
  if (variant === 'minimal') {
    return (
      <header className="relative z-10 flex items-center justify-between px-6 py-6 mx-auto max-w-7xl border-b border-slate-800/50">
        <Logo href={undefined} />
      </header>
    )
  }

  // Dashboard header - Full navigation
  return (
    <header className="sticky top-0 z-50 border-b border-slate-800/50 bg-[#0a0a0f]/95 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center space-x-8">
            <Logo href="/overview" size="sm" />

            {/* Navigation Links */}
            <nav className="hidden md:flex items-center space-x-1">
              {navigation.map((item) => {
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`px-3 py-2 text-sm font-medium transition-colors ${
                      isActive ? 'text-white' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {item.name}
                  </Link>
                )
              })}
            </nav>
          </div>

          {/* Right: Network + Wallet + Disconnect */}
          <div className="flex items-center space-x-3">
            {/* Network Badge */}
            <div className="flex items-center space-x-2 rounded-lg border border-slate-700/50 px-3 py-1.5">
              <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400"></div>
              <span className="text-xs font-medium text-gray-400">
                {getChainName(chainId)}
              </span>
            </div>

            {/* Wallet Address */}
            {address && (
              <div className="hidden items-center space-x-2 rounded-lg border border-slate-700/50 px-3 py-1.5 sm:flex">
                <code className="font-mono text-xs text-gray-400">
                  {formatAddress(address)}
                </code>
              </div>
            )}

            {/* Disconnect Button */}
            <button
              onClick={() => disconnect()}
              className="rounded-lg border border-slate-700/50 px-3 py-1.5 text-xs font-medium text-gray-400 transition-colors hover:bg-white/5 hover:text-white"
              aria-label="Disconnect wallet"
            >
              Disconnect
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
