'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAccount } from 'wagmi'
import { Activity, Clock, TrendingUp, CheckCircle } from 'lucide-react'
import { useNotifications } from '@/providers/NotificationsProvider'

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'

interface Stats {
  totalStrategies: number
  activeStrategies: number
  totalExecutions: number
  successfulExecutions: number
  nextExecutionTime?: string
}

export default function StatsOverview() {
  const { address } = useAccount()
  const { executionUpdateTrigger } = useNotifications()
  const [stats, setStats] = useState<Stats>({
    totalStrategies: 0,
    activeStrategies: 0,
    totalExecutions: 0,
    successfulExecutions: 0,
  })
  const [countdownDisplay, setCountdownDisplay] = useState<string>('')

  // Fetch stats from backend
  const fetchStats = useCallback(async () => {
    if (!address) return

    try {
      const response = await fetch(
        `${BACKEND_URL}/strategies/user/${address.toLowerCase()}`,
      )
      if (!response.ok) return

      const strategies = await response.json()

      const totalStrategies = strategies.length
      const activeStrategies = strategies.filter((s: any) => s.isActive).length

      // Find next execution time (include past times, we'll handle display separately)
      const activeTimes = strategies
        .filter((s: any) => s.isActive)
        .map((s: any) => new Date(s.nextCheckTime).getTime())

      const nextExecutionTime =
        activeTimes.length > 0
          ? new Date(Math.min(...activeTimes)).toISOString()
          : undefined

      // Fetch execution stats
      let totalExecutions = 0
      let successfulExecutions = 0

      for (const strategy of strategies) {
        const execResponse = await fetch(
          `${BACKEND_URL}/strategies/${strategy.id}/executions`,
        )
        if (execResponse.ok) {
          const executions = await execResponse.json()
          totalExecutions += executions.length
          successfulExecutions += executions.filter(
            (e: any) => e.status === 'executed',
          ).length
        }
      }

      setStats({
        totalStrategies,
        activeStrategies,
        totalExecutions,
        successfulExecutions,
        nextExecutionTime,
      })
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }, [address])

  // Initial fetch + polling + WebSocket trigger
  useEffect(() => {
    fetchStats()
    const interval = setInterval(fetchStats, 30000) // Refresh every 30s
    return () => clearInterval(interval)
  }, [fetchStats, executionUpdateTrigger])

  // Real-time countdown update
  useEffect(() => {
    const updateCountdown = () => {
      // No active strategies
      if (stats.activeStrategies === 0) {
        setCountdownDisplay('No active strategies')
        return
      }

      // Has active strategies but no next time (shouldn't happen, but fallback)
      if (!stats.nextExecutionTime) {
        setCountdownDisplay('Waiting...')
        return
      }

      const now = Date.now()
      const target = new Date(stats.nextExecutionTime).getTime()
      const diff = target - now

      // Time has passed - show "Running..."
      if (diff <= 0) {
        setCountdownDisplay('Running...')
        return
      }

      // Calculate time remaining
      const totalSeconds = Math.floor(diff / 1000)
      const hours = Math.floor(totalSeconds / 3600)
      const minutes = Math.floor((totalSeconds % 3600) / 60)
      const seconds = totalSeconds % 60

      if (hours > 0) {
        setCountdownDisplay(`${hours}h ${minutes}m`)
      } else if (minutes > 0) {
        setCountdownDisplay(`${minutes}m ${seconds}s`)
      } else {
        setCountdownDisplay(`${seconds}s`)
      }
    }

    // Update immediately
    updateCountdown()

    // Update every second for real-time countdown
    const interval = setInterval(updateCountdown, 1000)
    return () => clearInterval(interval)
  }, [stats.nextExecutionTime, stats.activeStrategies])

  const successRate =
    stats.totalExecutions > 0
      ? ((stats.successfulExecutions / stats.totalExecutions) * 100).toFixed(1)
      : '0'

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Active Strategies */}
      <div className="rounded-xl border border-slate-700 bg-slate-900 p-6">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium text-gray-400">Active Strategies</p>
          <Activity className="h-5 w-5 text-amber-500" />
        </div>
        <p className="mb-1 text-3xl font-bold text-white">
          {stats.activeStrategies}
        </p>
        <p className="text-xs text-gray-500">
          of {stats.totalStrategies} total
        </p>
      </div>

      {/* Next Execution */}
      <div className="rounded-xl border border-slate-700 bg-slate-900 p-6">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium text-gray-400">Next Trade In</p>
          <Clock className="h-5 w-5 text-amber-500" />
        </div>
        <p className="mb-1 text-3xl font-bold text-white">{countdownDisplay}</p>
        <p className="text-xs text-gray-500">Automated execution</p>
      </div>

      {/* Total Executions */}
      <div className="rounded-xl border border-slate-700 bg-slate-900 p-6">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium text-gray-400">Total Executions</p>
          <TrendingUp className="h-5 w-5 text-amber-500" />
        </div>
        <p className="mb-1 text-3xl font-bold text-white">
          {stats.totalExecutions}
        </p>
        <p className="text-xs text-gray-500">
          {stats.successfulExecutions} successful
        </p>
      </div>

      {/* Success Rate */}
      <div className="rounded-xl border border-slate-700 bg-slate-900 p-6">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium text-gray-400">Success Rate</p>
          <CheckCircle className="h-5 w-5 text-emerald-400" />
        </div>
        <p className="mb-1 text-3xl font-bold text-white">{successRate}%</p>
        <p className="text-xs text-gray-500">All time</p>
      </div>
    </div>
  )
}
