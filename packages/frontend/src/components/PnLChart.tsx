'use client'

import { useState, useEffect } from 'react'
import { useAccount, usePublicClient } from 'wagmi'
import { formatUnits } from 'viem'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts'
import { TrendingUp, TrendingDown } from 'lucide-react'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'
const WETH_ADDRESS = '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14'
const USDC_ADDRESS = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238'

interface ChartDataPoint {
  timestamp: number
  date: string
  totalInvested: number
  portfolioValue: number
  pnl: number
  pnlPercent: number
}

interface PnLChartProps {
  sessionAccountAddress: string
}

export default function PnLChart({ sessionAccountAddress }: PnLChartProps) {
  const { address } = useAccount()
  const publicClient = usePublicClient()
  const [chartData, setChartData] = useState<ChartDataPoint[]>([])
  const [timeRange, setTimeRange] = useState<'7D' | '30D' | '90D' | 'ALL'>('30D')
  const [isLoading, setIsLoading] = useState(true)
  const [currentMetrics, setCurrentMetrics] = useState({
    totalInvested: 0,
    currentValue: 0,
    pnl: 0,
    pnlPercent: 0,
    wethPrice: 0
  })

  useEffect(() => {
    if (!address || !sessionAccountAddress || !publicClient) return
    fetchPnLData()
  }, [address, sessionAccountAddress, publicClient, timeRange])

  const fetchPnLData = async () => {
    try {
      setIsLoading(true)

      // Fetch current WETH price
      const priceResponse = await fetch(`${BACKEND_URL}/indexer/price?pairId=WETH-USDC`)
      const priceData = await priceResponse.json()
      const wethPrice = priceData.price

      // Fetch current balances
      const wethBalance = await publicClient!.readContract({
        address: WETH_ADDRESS,
        abi: [
          {
            inputs: [{ name: 'account', type: 'address' }],
            name: 'balanceOf',
            outputs: [{ name: '', type: 'uint256' }],
            stateMutability: 'view',
            type: 'function',
          },
        ],
        functionName: 'balanceOf',
        args: [sessionAccountAddress as `0x${string}`],
      })

      const usdcBalance = await publicClient!.readContract({
        address: USDC_ADDRESS,
        abi: [
          {
            inputs: [{ name: 'account', type: 'address' }],
            name: 'balanceOf',
            outputs: [{ name: '', type: 'uint256' }],
            stateMutability: 'view',
            type: 'function',
          },
        ],
        functionName: 'balanceOf',
        args: [sessionAccountAddress as `0x${string}`],
      })

      const wethBalanceFormatted = Number(formatUnits(wethBalance as bigint, 18))
      const usdcBalanceFormatted = Number(formatUnits(usdcBalance as bigint, 6))

      // Fetch all strategies and executions
      const strategiesResponse = await fetch(
        `${BACKEND_URL}/strategies/user/${address.toLowerCase()}`
      )

      if (!strategiesResponse.ok) {
        setIsLoading(false)
        return
      }

      const strategies = await strategiesResponse.json()

      // Collect all executions from all strategies
      const allExecutions: any[] = []
      for (const strategy of strategies) {
        const execResponse = await fetch(
          `${BACKEND_URL}/strategies/${strategy.id}/executions`
        )
        if (execResponse.ok) {
          const executions = await execResponse.json()
          // Only include successful executions
          const successfulExecs = executions.filter((e: any) => e.status === 'executed')
          allExecutions.push(...successfulExecs.map((e: any) => ({
            ...e,
            strategyId: strategy.id
          })))
        }
      }

      // Sort executions by date
      allExecutions.sort((a, b) => new Date(a.executedAt).getTime() - new Date(b.executedAt).getTime())

      // Filter by time range
      const now = Date.now()
      const timeRangeMs = {
        '7D': 7 * 24 * 60 * 60 * 1000,
        '30D': 30 * 24 * 60 * 60 * 1000,
        '90D': 90 * 24 * 60 * 60 * 1000,
        'ALL': Infinity
      }[timeRange]

      const filteredExecutions = timeRange === 'ALL'
        ? allExecutions
        : allExecutions.filter(e => now - new Date(e.executedAt).getTime() <= timeRangeMs)

      // Calculate cumulative PnL at each execution point
      let cumulativeInvested = 0
      let cumulativeWeth = 0
      const dataPoints: ChartDataPoint[] = []

      filteredExecutions.forEach((execution) => {
        const usdcSpent = execution.usdcAmountIn
          ? Number(execution.usdcAmountIn) / 1e6
          : Number(execution.recommendedAmount) / 1e6

        const wethReceived = execution.wethAmountOut
          ? Number(execution.wethAmountOut) / 1e18
          : 0

        cumulativeInvested += usdcSpent
        cumulativeWeth += wethReceived

        // Use execution price if available, otherwise use current price
        const priceAtExecution = execution.executionPrice || wethPrice
        const portfolioValue = cumulativeWeth * priceAtExecution
        const pnl = portfolioValue - cumulativeInvested
        const pnlPercent = cumulativeInvested > 0 ? (pnl / cumulativeInvested) * 100 : 0

        dataPoints.push({
          timestamp: new Date(execution.executedAt).getTime(),
          date: new Date(execution.executedAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: timeRange === 'ALL' ? 'numeric' : undefined
          }),
          totalInvested: cumulativeInvested,
          portfolioValue,
          pnl,
          pnlPercent
        })
      })

      // Add current point (most recent with current prices)
      if (dataPoints.length > 0) {
        const currentPortfolioValue = wethBalanceFormatted * wethPrice + usdcBalanceFormatted
        const totalInvested = cumulativeInvested
        const currentPnl = currentPortfolioValue - totalInvested
        const currentPnlPercent = totalInvested > 0 ? (currentPnl / totalInvested) * 100 : 0

        dataPoints.push({
          timestamp: now,
          date: 'Now',
          totalInvested,
          portfolioValue: currentPortfolioValue,
          pnl: currentPnl,
          pnlPercent: currentPnlPercent
        })

        setCurrentMetrics({
          totalInvested,
          currentValue: currentPortfolioValue,
          pnl: currentPnl,
          pnlPercent: currentPnlPercent,
          wethPrice
        })
      }

      setChartData(dataPoints)
    } catch (error) {
      console.error('Error fetching PnL data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 shadow-xl">
          <p className="text-xs text-gray-400 mb-2">{data.date}</p>
          <div className="space-y-1">
            <p className="text-sm text-white">
              <span className="text-gray-400">Portfolio: </span>
              <span className="font-semibold">{formatCurrency(data.portfolioValue)}</span>
            </p>
            <p className="text-sm text-white">
              <span className="text-gray-400">Invested: </span>
              <span className="font-semibold">{formatCurrency(data.totalInvested)}</span>
            </p>
            <p className={`text-sm font-semibold ${data.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              <span className="text-gray-400 font-normal">P/L: </span>
              {data.pnl >= 0 ? '+' : ''}{formatCurrency(data.pnl)} ({data.pnl >= 0 ? '+' : ''}{data.pnlPercent.toFixed(2)}%)
            </p>
          </div>
        </div>
      )
    }
    return null
  }

  if (isLoading) {
    return (
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6">
        <div className="flex items-center justify-center h-96">
          <div className="text-gray-400 text-sm">Loading performance data...</div>
        </div>
      </div>
    )
  }

  if (chartData.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6">
        <h2 className="text-xl font-bold text-white mb-4">Performance</h2>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <p className="text-gray-400 text-sm">No execution data yet</p>
            <p className="text-gray-500 text-xs mt-1">Start a DCA strategy to see your performance</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white">Performance</h2>

        {/* Time Range Selector */}
        <div className="flex items-center space-x-2">
          {(['7D', '30D', '90D', 'ALL'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                timeRange === range
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-800 text-gray-400 hover:bg-slate-700'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">Total Return</p>
          <div className="flex items-baseline space-x-2">
            <p className={`text-2xl font-bold ${currentMetrics.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {currentMetrics.pnl >= 0 ? '+' : ''}{formatCurrency(currentMetrics.pnl)}
            </p>
            {currentMetrics.pnl >= 0 ? (
              <TrendingUp className="h-5 w-5 text-emerald-400" />
            ) : (
              <TrendingDown className="h-5 w-5 text-red-400" />
            )}
          </div>
          <p className={`text-sm font-medium mt-1 ${currentMetrics.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {currentMetrics.pnl >= 0 ? '+' : ''}{currentMetrics.pnlPercent.toFixed(2)}%
          </p>
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">Total Invested</p>
          <p className="text-2xl font-bold text-white">{formatCurrency(currentMetrics.totalInvested)}</p>
          <p className="text-sm text-gray-500 mt-1">Cumulative USDC</p>
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">Current Value</p>
          <p className="text-2xl font-bold text-white">{formatCurrency(currentMetrics.currentValue)}</p>
          <p className="text-sm text-gray-500 mt-1">@ ${currentMetrics.wethPrice.toFixed(2)}/ETH</p>
        </div>
      </div>

      {/* Chart */}
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorPnl" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={currentMetrics.pnl >= 0 ? "#10b981" : "#ef4444"} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={currentMetrics.pnl >= 0 ? "#10b981" : "#ef4444"} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              dataKey="date"
              stroke="#64748b"
              style={{ fontSize: '12px' }}
            />
            <YAxis
              stroke="#64748b"
              style={{ fontSize: '12px' }}
              tickFormatter={(value) => `$${value.toFixed(0)}`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="portfolioValue"
              stroke={currentMetrics.pnl >= 0 ? "#10b981" : "#ef4444"}
              strokeWidth={2}
              fill="url(#colorPnl)"
            />
            <Line
              type="monotone"
              dataKey="totalInvested"
              stroke="#3b82f6"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center space-x-6 mt-4">
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${currentMetrics.pnl >= 0 ? 'bg-emerald-400' : 'bg-red-400'}`}></div>
          <span className="text-xs text-gray-400">Portfolio Value</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-0.5 bg-blue-500"></div>
          <span className="text-xs text-gray-400">Total Invested</span>
        </div>
      </div>
    </div>
  )
}
