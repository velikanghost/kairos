'use client'

import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { formatErrorMessage } from '@/utils/errorFormatter'
import {
  TrendingUp,
  Clock,
  DollarSign,
  MoreVertical,
  ExternalLink,
} from 'lucide-react'

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'

interface Strategy {
  id: string
  pairId: string
  frequency: string
  baseAmount: string
  slippage: number
  isActive: boolean
  nextCheckTime: string
  createdAt: string
  router: string
}

interface Execution {
  id: string
  status: string
  recommendedAmount: string
  price: number
  volatility: number
  liquidityScore: number
  trend: string
  txHash?: string
  errorMessage?: string
  createdAt: string
  executedAt?: string
}

export default function StrategyList() {
  const { address } = useAccount()
  const [strategies, setStrategies] = useState<Strategy[]>([])
  const [selectedStrategy, setSelectedStrategy] = useState<string | null>(null)
  const [executions, setExecutions] = useState<Execution[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch user's strategies
  useEffect(() => {
    if (!address) return

    const fetchStrategies = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch(
          `${BACKEND_URL}/strategies/user/${address.toLowerCase()}`,
        )

        if (!response.ok) {
          throw new Error('Failed to fetch strategies')
        }

        const data = await response.json()
        setStrategies(data)

        // Auto-expand if there's only one strategy
        if (data.length === 1) {
          setSelectedStrategy(data[0].id)
        }
      } catch (err) {
        console.error('Error fetching strategies:', err)
        const errorMsg =
          err instanceof Error ? err.message : 'Failed to fetch strategies'
        setError(formatErrorMessage(errorMsg))
      } finally {
        setIsLoading(false)
      }
    }

    fetchStrategies()

    // Refresh every 30 seconds
    const interval = setInterval(fetchStrategies, 30000)
    return () => clearInterval(interval)
  }, [address])

  // Fetch executions for selected strategy
  useEffect(() => {
    if (!selectedStrategy) return

    const fetchExecutions = async () => {
      try {
        const response = await fetch(
          `${BACKEND_URL}/strategies/${selectedStrategy}/executions`,
        )

        if (!response.ok) {
          throw new Error('Failed to fetch executions')
        }

        const data = await response.json()
        setExecutions(data)
      } catch (err) {
        console.error('Error fetching executions:', err)
      }
    }

    fetchExecutions()

    // Refresh every 10 seconds
    const interval = setInterval(fetchExecutions, 10000)
    return () => clearInterval(interval)
  }, [selectedStrategy])

  const toggleStrategy = async (strategyId: string, currentStatus: boolean) => {
    try {
      const endpoint = currentStatus ? 'deactivate' : 'activate'
      const response = await fetch(
        `${BACKEND_URL}/strategies/${strategyId}/${endpoint}`,
        {
          method: 'POST',
        },
      )

      if (!response.ok) {
        throw new Error(`Failed to ${endpoint} strategy`)
      }

      // Refresh strategies
      const updatedStrategies = strategies.map((s) =>
        s.id === strategyId ? { ...s, isActive: !currentStatus } : s,
      )
      setStrategies(updatedStrategies)
    } catch (err) {
      console.error('Error toggling strategy:', err)
      const errorMsg =
        err instanceof Error ? err.message : 'Failed to toggle strategy'
      alert(formatErrorMessage(errorMsg))
    }
  }

  const formatAmount = (weiAmount: string, pairId: string) => {
    const isUsdcBased = pairId.startsWith('USDC/')
    const decimals = isUsdcBased ? 1e6 : 1e18
    const amount = Number(weiAmount) / decimals
    return amount.toFixed(isUsdcBased ? 2 : 6)
  }

  const getAmountLabel = (pairId: string) => {
    return pairId.startsWith('USDC/') ? 'USDC' : 'ETH'
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`
    return date.toLocaleDateString()
  }

  const formatNextCheck = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = date.getTime() - now.getTime()

    if (diffMs < 0) return 'Any moment'

    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 60) return `${diffMins}m`
    if (diffMins < 1440)
      return `${Math.floor(diffMins / 60)}h ${diffMins % 60}m`
    return date.toLocaleDateString()
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
        <p className="text-red-400">{error}</p>
      </div>
    )
  }

  if (strategies.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
        <div className="h-16 w-16 mx-auto mb-4 bg-slate-800 rounded-full flex items-center justify-center">
          <TrendingUp className="h-8 w-8 text-gray-600" />
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">
          No Strategies Yet
        </h3>
        <p className="text-gray-400 text-sm">
          Create your first DCA strategy to get started!
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-bold text-white">Your Strategies</h2>
        <span className="text-sm text-gray-400">{strategies.length} total</span>
      </div>

      <div className="space-y-4">
        {strategies.map((strategy) => (
          <div
            key={strategy.id}
            className={`bg-slate-900 border rounded-xl overflow-hidden transition-all ${
              selectedStrategy === strategy.id
                ? 'border-indigo-500/50 shadow-lg shadow-indigo-500/10'
                : 'border-slate-800 hover:border-slate-700'
            }`}
          >
            {/* Strategy Header */}
            <div
              className="p-5 cursor-pointer"
              onClick={() =>
                setSelectedStrategy(
                  selectedStrategy === strategy.id ? null : strategy.id,
                )
              }
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  {/* Pair Title */}
                  <div className="flex items-center space-x-3 mb-3">
                    <h3 className="text-xl font-bold text-white">
                      {strategy.pairId}
                    </h3>
                    {strategy.isActive ? (
                      <span className="flex items-center space-x-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                        <div className="h-1.5 w-1.5 bg-emerald-400 rounded-full animate-pulse"></div>
                        <span className="text-xs font-medium text-emerald-400">
                          Active
                        </span>
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 bg-gray-500/10 border border-gray-500/20 rounded-full text-xs font-medium text-gray-400">
                        Paused
                      </span>
                    )}
                  </div>

                  {/* Strategy Details */}
                  <div className="flex items-center space-x-4 text-sm">
                    <div className="flex items-center space-x-2">
                      <DollarSign className="h-4 w-4 text-gray-500" />
                      <span className="text-gray-300 font-mono">
                        {formatAmount(strategy.baseAmount, strategy.pairId)}{' '}
                        {getAmountLabel(strategy.pairId)}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Clock className="h-4 w-4 text-gray-500" />
                      <span className="text-gray-400">
                        {strategy.frequency}
                      </span>
                    </div>
                  </div>

                  {/* Next Check */}
                  <div className="mt-3 flex items-center space-x-2 text-xs">
                    <span className="text-gray-500">Next check in:</span>
                    <span className="font-mono text-indigo-400">
                      {formatNextCheck(strategy.nextCheckTime)}
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center space-x-2 ml-4">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleStrategy(strategy.id, strategy.isActive)
                    }}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      strategy.isActive
                        ? 'bg-slate-800 text-gray-300 hover:bg-slate-700'
                        : 'bg-emerald-600 text-white hover:bg-emerald-500'
                    }`}
                  >
                    {strategy.isActive ? 'Pause' : 'Resume'}
                  </button>

                  <button
                    onClick={(e) => e.stopPropagation()}
                    className="p-2 text-gray-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    <MoreVertical className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Execution History - Expandable */}
            {selectedStrategy === strategy.id && (
              <div className="border-t border-slate-800 bg-slate-950/50 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold text-white">
                    Execution History
                  </h4>
                  <span className="text-xs text-gray-500">
                    {executions.length} total
                  </span>
                </div>

                {executions.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-8">
                    No executions yet
                  </p>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {executions.map((exec) => (
                      <div
                        key={exec.id}
                        className="bg-slate-900 border border-slate-800 rounded-lg p-4 hover:border-slate-700 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            {/* Status Badge */}
                            <div className="flex items-center space-x-2 mb-2">
                              {exec.status === 'executed' ? (
                                <>
                                  <div className="h-2 w-2 bg-emerald-400 rounded-full"></div>
                                  <span className="text-sm font-medium text-emerald-400">
                                    Success
                                  </span>
                                </>
                              ) : exec.status === 'failed' ? (
                                <>
                                  <div className="h-2 w-2 bg-red-400 rounded-full"></div>
                                  <span className="text-sm font-medium text-red-400">
                                    Failed
                                  </span>
                                </>
                              ) : exec.status === 'skipped' ? (
                                <>
                                  <div className="h-2 w-2 bg-amber-400 rounded-full"></div>
                                  <span className="text-sm font-medium text-amber-400">
                                    Skipped
                                  </span>
                                </>
                              ) : (
                                <>
                                  <div className="h-2 w-2 bg-blue-400 rounded-full"></div>
                                  <span className="text-sm font-medium text-blue-400">
                                    {exec.status}
                                  </span>
                                </>
                              )}
                            </div>

                            {/* Amount */}
                            <p className="text-white font-mono mb-2">
                              {formatAmount(
                                exec.recommendedAmount,
                                strategy.pairId,
                              )}{' '}
                              {getAmountLabel(strategy.pairId)}
                            </p>

                            {/* Market Metrics */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                              <div>
                                <span className="text-gray-500">Price</span>
                                <p className="text-gray-300 font-mono">
                                  ${exec.price.toFixed(2)}
                                </p>
                              </div>
                              <div>
                                <span className="text-gray-500">
                                  Volatility
                                </span>
                                <p className="text-gray-300 font-mono">
                                  {exec.volatility.toFixed(2)}%
                                </p>
                              </div>
                              <div>
                                <span className="text-gray-500">Liquidity</span>
                                <p className="text-gray-300 font-mono">
                                  {exec.liquidityScore.toFixed(2)}
                                </p>
                              </div>
                              <div>
                                <span className="text-gray-500">Trend</span>
                                <p
                                  className={`font-mono capitalize ${
                                    exec.trend === 'bullish'
                                      ? 'text-emerald-400'
                                      : exec.trend === 'bearish'
                                      ? 'text-red-400'
                                      : 'text-gray-400'
                                  }`}
                                >
                                  {exec.trend}
                                </p>
                              </div>
                            </div>

                            {/* Transaction Link */}
                            {exec.txHash && (
                              <a
                                href={`https://sepolia.etherscan.io/tx/${exec.txHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center space-x-1 mt-3 text-xs text-indigo-400 hover:text-indigo-300"
                              >
                                <span>View Transaction</span>
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}

                            {/* Error Message */}
                            {exec.errorMessage && (
                              <div className="mt-3 p-2 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-400">
                                {formatErrorMessage(exec.errorMessage)}
                              </div>
                            )}
                          </div>

                          {/* Timestamp */}
                          <span className="text-xs text-gray-500 ml-4">
                            {formatDate(exec.createdAt)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
