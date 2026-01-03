'use client'

import { useState, useEffect } from 'react'
import { useAccount, usePublicClient } from 'wagmi'
import { formatUnits } from 'viem'

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'
const WETH_ADDRESS = '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14' // Sepolia WETH
const USDC_ADDRESS = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' // Sepolia USDC

interface PortfolioData {
  wethBalance: string
  usdcBalance: string
  wethPrice: number
  totalInvested: number
  totalValue: number
  profitLoss: number
  profitLossPercent: number
}

export default function PortfolioOverview({
  sessionAccountAddress,
}: {
  sessionAccountAddress?: string
}) {
  const { address } = useAccount()
  const publicClient = usePublicClient()
  const [portfolio, setPortfolio] = useState<PortfolioData>({
    wethBalance: '0',
    usdcBalance: '0',
    wethPrice: 0,
    totalInvested: 0,
    totalValue: 0,
    profitLoss: 0,
    profitLossPercent: 0,
  })

  useEffect(() => {
    if (!sessionAccountAddress || !publicClient || !address) return

    const fetchPortfolio = async () => {
      try {
        // Fetch WETH balance from session account
        const wethBalance = await publicClient.readContract({
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

        // Fetch USDC balance from session account
        const usdcBalance = await publicClient.readContract({
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

        const wethBalanceFormatted = formatUnits(wethBalance as bigint, 18)
        const usdcBalanceFormatted = formatUnits(usdcBalance as bigint, 6)

        // Fetch real-time ETH price from Pyth oracle
        const priceResponse = await fetch(`${BACKEND_URL}/indexer/price?pairId=WETH-USDC`)
        const priceData = await priceResponse.json()
        const wethPrice = priceData.price

        // Calculate total invested by summing all successful executions
        const strategiesResponse = await fetch(
          `${BACKEND_URL}/strategies/user/${address.toLowerCase()}`,
        )
        let totalInvested = 0

        if (strategiesResponse.ok) {
          const strategies = await strategiesResponse.json()
          console.log('Total strategies:', strategies.length)

          for (const strategy of strategies) {
            const execResponse = await fetch(
              `${BACKEND_URL}/strategies/${strategy.id}/executions`,
            )
            if (execResponse.ok) {
              const executions = await execResponse.json()
              console.log(`Strategy ${strategy.id}: ${executions.length} total executions`)

              const successfulExecs = executions.filter(
                (e: any) => e.status === 'executed',
              )

              // Sum up actual USDC amounts spent from successful executions
              // Use usdcAmountIn if available (actual amount), otherwise fall back to recommendedAmount
              const strategyInvested = successfulExecs.reduce(
                (sum: number, exec: any) => {
                  const usdcSpent = exec.usdcAmountIn
                    ? Number(exec.usdcAmountIn) / 1e6
                    : Number(exec.recommendedAmount) / 1e6
                  return sum + usdcSpent
                },
                0,
              )
              totalInvested += strategyInvested
            }
          }
        }

        const wethValue = parseFloat(wethBalanceFormatted) * wethPrice
        const usdcValue = parseFloat(usdcBalanceFormatted)
        const totalValue = wethValue + usdcValue
        const profitLoss = totalValue - totalInvested
        const profitLossPercent =
          totalInvested > 0 ? (profitLoss / totalInvested) * 100 : 0

        setPortfolio({
          wethBalance: wethBalanceFormatted,
          usdcBalance: usdcBalanceFormatted,
          wethPrice,
          totalInvested,
          totalValue,
          profitLoss,
          profitLossPercent,
        })
      } catch (error) {
        console.error('Error fetching portfolio:', error)
      }
    }

    fetchPortfolio()
    const interval = setInterval(fetchPortfolio, 30000) // Refresh every 30s
    return () => clearInterval(interval)
  }, [sessionAccountAddress, publicClient, address])

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  }

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white">Portfolio</h2>
        <div className="flex items-center space-x-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
          <div className="h-2 w-2 bg-emerald-400 rounded-full animate-pulse"></div>
          <span className="text-xs font-medium text-emerald-400">Live</span>
        </div>
      </div>

      {/* Total Value */}
      <div className="mb-6">
        <p className="text-sm text-gray-400 mb-1">Total Portfolio Value</p>
        <div className="flex items-baseline space-x-3">
          <h3 className="text-4xl font-bold text-white">
            {formatCurrency(portfolio.totalValue)}
          </h3>
          {portfolio.profitLoss !== 0 && (
            <div
              className={`flex items-center space-x-1 px-2 py-1 rounded ${
                portfolio.profitLoss >= 0
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'bg-red-500/10 text-red-400'
              }`}
            >
              <span className="text-sm font-medium">
                {portfolio.profitLoss >= 0 ? '+' : ''}
                {formatCurrency(portfolio.profitLoss)}
              </span>
              <span className="text-xs">
                ({portfolio.profitLoss >= 0 ? '+' : ''}
                {portfolio.profitLossPercent.toFixed(2)}%)
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Holdings */}
      <div className="grid grid-cols-2 gap-4">
        {/* WETH Holdings */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center space-x-2 mb-2">
            <div className="h-8 w-8 bg-amber-500 rounded-full flex items-center justify-center">
              <span className="text-slate-950 font-bold text-sm">W</span>
            </div>
            <div>
              <p className="text-xs text-gray-500">WETH Balance</p>
              <p className="text-sm font-mono font-semibold text-white">
                {parseFloat(portfolio.wethBalance).toFixed(6)}
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            ≈{' '}
            {formatCurrency(
              parseFloat(portfolio.wethBalance) * portfolio.wethPrice,
            )}
          </p>
        </div>

        {/* USDC Holdings */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center space-x-2 mb-2">
            <div className="h-8 w-8 bg-blue-500 rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-sm">$</span>
            </div>
            <div>
              <p className="text-xs text-gray-500">USDC Balance</p>
              <p className="text-sm font-mono font-semibold text-white">
                {parseFloat(portfolio.usdcBalance).toFixed(2)}
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">Ready to invest</p>
        </div>
      </div>

      {/* Investment Stats */}
      <div className="mt-4 pt-4 border-t border-slate-800">
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Total Invested</span>
          <span className="font-mono text-white">
            {formatCurrency(portfolio.totalInvested)}
          </span>
        </div>
        <div className="flex justify-between text-sm mt-2">
          <span className="text-gray-400">ETH Price</span>
          <span className="font-mono text-white">
            {formatCurrency(portfolio.wethPrice)}
          </span>
        </div>
      </div>
    </div>
  )
}
