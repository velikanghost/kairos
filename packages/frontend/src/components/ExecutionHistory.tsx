'use client'

import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { Clock, ExternalLink, TrendingUp, Filter } from 'lucide-react'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'

interface Execution {
  id: string
  strategyId: string
  status: string
  recommendedAmount: string
  usdcAmountIn?: string
  wethAmountOut?: string
  executionPrice?: number
  txHash?: string
  executedAt?: string
  createdAt: string
}

interface Strategy {
  id: string
  pairId: string
  frequency: string
  baseAmount: string
}

export default function ExecutionHistory() {
  const { address } = useAccount()
  const [executions, setExecutions] = useState<(Execution & { strategy?: Strategy })[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<'all' | 'executed' | 'failed' | 'pending'>('all')

  useEffect(() => {
    if (address) {
      fetchExecutionHistory()
    }
  }, [address])

  const fetchExecutionHistory = async () => {
    try {
      setIsLoading(true)

      // Fetch all strategies
      const strategiesResponse = await fetch(
        `${BACKEND_URL}/strategies/user/${address?.toLowerCase()}`
      )

      if (!strategiesResponse.ok) {
        setIsLoading(false)
        return
      }

      const strategies = await strategiesResponse.json()

      // Fetch executions for each strategy
      const allExecutions: (Execution & { strategy?: Strategy })[] = []

      for (const strategy of strategies) {
        const execResponse = await fetch(
          `${BACKEND_URL}/strategies/${strategy.id}/executions`
        )

        if (execResponse.ok) {
          const executions = await execResponse.json()
          allExecutions.push(...executions.map((e: Execution) => ({
            ...e,
            strategy
          })))
        }
      }

      // Sort by date (most recent first)
      allExecutions.sort((a, b) => {
        const dateA = a.executedAt ? new Date(a.executedAt) : new Date(a.createdAt)
        const dateB = b.executedAt ? new Date(b.executedAt) : new Date(b.createdAt)
        return dateB.getTime() - dateA.getTime()
      })

      setExecutions(allExecutions)
    } catch (error) {
      console.error('Failed to fetch execution history:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
  }

  const formatAmount = (amount?: string, decimals: number = 6) => {
    if (!amount) return 'N/A'
    const value = Number(amount) / Math.pow(10, decimals)
    return value.toFixed(decimals === 6 ? 2 : 6)
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'executed':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
      case 'failed':
        return 'text-red-400 bg-red-500/10 border-red-500/20'
      case 'pending':
        return 'text-amber-400 bg-amber-500/10 border-amber-500/20'
      default:
        return 'text-gray-400 bg-gray-500/10 border-gray-500/20'
    }
  }

  const getStatusLabel = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1)
  }

  const filteredExecutions = statusFilter === 'all'
    ? executions
    : executions.filter(e => e.status === statusFilter)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center space-x-3 text-gray-400">
          <Clock className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading execution history...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-400">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All</option>
            <option value="executed">Executed</option>
            <option value="failed">Failed</option>
            <option value="pending">Pending</option>
          </select>
        </div>
        <div className="text-sm text-gray-400">
          {filteredExecutions.length} {filteredExecutions.length === 1 ? 'execution' : 'executions'}
        </div>
      </div>

      {/* Executions List */}
      {filteredExecutions.length === 0 ? (
        <div className="rounded-xl border border-slate-700/50 bg-slate-900/30 p-12 text-center">
          <Clock className="mx-auto h-12 w-12 text-gray-600 mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">
            No {statusFilter !== 'all' ? statusFilter : ''} executions yet
          </h3>
          <p className="text-sm text-gray-400">
            {statusFilter !== 'all'
              ? `No ${statusFilter} executions found. Try changing the filter.`
              : 'Your execution history will appear here once your strategies start running'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredExecutions.map((execution) => (
            <div
              key={execution.id}
              className="rounded-xl border border-slate-700/50 bg-slate-900/30 p-6 transition-colors hover:bg-slate-900/50"
            >
              <div className="flex items-start justify-between">
                {/* Left Side - Execution Details */}
                <div className="flex-1 space-y-3">
                  {/* Strategy Info & Status */}
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-white">
                        {execution.strategy?.pairId || 'Unknown Pair'}
                      </span>
                      <span className="text-xs text-gray-500">•</span>
                      <span className="text-xs text-gray-500">
                        {execution.strategy?.frequency || 'N/A'}
                      </span>
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${getStatusColor(execution.status)}`}
                    >
                      {getStatusLabel(execution.status)}
                    </span>
                  </div>

                  {/* Amounts */}
                  {execution.status === 'executed' && (
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500 text-xs">USDC Spent</span>
                        <p className="font-mono text-white mt-0.5">
                          {execution.usdcAmountIn
                            ? formatAmount(execution.usdcAmountIn, 6)
                            : formatAmount(execution.recommendedAmount, 6)}{' '}
                          USDC
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500 text-xs">WETH Received</span>
                        <p className="font-mono text-white mt-0.5">
                          {execution.wethAmountOut
                            ? formatAmount(execution.wethAmountOut, 18)
                            : 'N/A'}{' '}
                          WETH
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500 text-xs">Execution Price</span>
                        <p className="font-mono text-white mt-0.5">
                          {execution.executionPrice
                            ? formatCurrency(execution.executionPrice)
                            : 'N/A'}
                        </p>
                      </div>
                    </div>
                  )}

                  {execution.status === 'pending' && (
                    <div className="text-sm">
                      <span className="text-gray-500 text-xs">Recommended Amount</span>
                      <p className="font-mono text-white mt-0.5">
                        {formatAmount(execution.recommendedAmount, 6)} USDC
                      </p>
                    </div>
                  )}

                  {/* Timestamp */}
                  <div className="flex items-center space-x-2 text-xs text-gray-500">
                    <Clock className="h-3.5 w-3.5" />
                    <span>
                      {execution.executedAt
                        ? `Executed ${formatDate(execution.executedAt)}`
                        : `Created ${formatDate(execution.createdAt)}`}
                    </span>
                  </div>
                </div>

                {/* Right Side - Transaction Link */}
                {execution.txHash && (
                  <div>
                    <a
                      href={`https://sepolia.etherscan.io/tx/${execution.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center space-x-2 rounded-lg border border-slate-700/50 px-3 py-2 text-sm font-medium text-gray-400 transition-colors hover:bg-white/5 hover:text-white"
                    >
                      <span>View TX</span>
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
