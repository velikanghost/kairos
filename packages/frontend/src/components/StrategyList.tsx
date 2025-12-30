"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { formatErrorMessage } from "@/utils/errorFormatter";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

interface Strategy {
  id: string;
  pairId: string;
  frequency: string;
  baseAmount: string;
  slippage: number;
  isActive: boolean;
  nextCheckTime: string;
  createdAt: string;
  router: string;
}

interface Execution {
  id: string;
  status: string;
  recommendedAmount: string;
  price: number;
  volatility: number;
  liquidityScore: number;
  trend: string;
  txHash?: string;
  errorMessage?: string;
  createdAt: string;
  executedAt?: string;
}

export default function StrategyList() {
  const { address } = useAccount();
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [selectedStrategy, setSelectedStrategy] = useState<string | null>(null);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch user's strategies
  useEffect(() => {
    if (!address) return;

    const fetchStrategies = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`${BACKEND_URL}/strategies/user/${address.toLowerCase()}`);

        if (!response.ok) {
          throw new Error("Failed to fetch strategies");
        }

        const data = await response.json();
        setStrategies(data);
      } catch (err) {
        console.error("Error fetching strategies:", err);
        const errorMsg = err instanceof Error ? err.message : "Failed to fetch strategies";
        setError(formatErrorMessage(errorMsg));
      } finally {
        setIsLoading(false);
      }
    };

    fetchStrategies();

    // Refresh every 30 seconds
    const interval = setInterval(fetchStrategies, 30000);
    return () => clearInterval(interval);
  }, [address]);

  // Fetch executions for selected strategy
  useEffect(() => {
    if (!selectedStrategy) return;

    const fetchExecutions = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/strategies/${selectedStrategy}/executions`);

        if (!response.ok) {
          throw new Error("Failed to fetch executions");
        }

        const data = await response.json();
        setExecutions(data);
      } catch (err) {
        console.error("Error fetching executions:", err);
      }
    };

    fetchExecutions();

    // Refresh every 10 seconds
    const interval = setInterval(fetchExecutions, 10000);
    return () => clearInterval(interval);
  }, [selectedStrategy]);

  const toggleStrategy = async (strategyId: string, currentStatus: boolean) => {
    try {
      const endpoint = currentStatus ? "deactivate" : "activate";
      const response = await fetch(`${BACKEND_URL}/strategies/${strategyId}/${endpoint}`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(`Failed to ${endpoint} strategy`);
      }

      // Refresh strategies
      const updatedStrategies = strategies.map((s) =>
        s.id === strategyId ? { ...s, isActive: !currentStatus } : s
      );
      setStrategies(updatedStrategies);
    } catch (err) {
      console.error("Error toggling strategy:", err);
      const errorMsg = err instanceof Error ? err.message : "Failed to toggle strategy";
      alert(formatErrorMessage(errorMsg));
    }
  };

  const formatAmount = (weiAmount: string, pairId: string) => {
    // For USDC-based pairs (USDC/WETH, USDC/ETH), amount is in USDC (6 decimals)
    // For ETH-based pairs (ETH/USDC, WETH/USDC), amount is in ETH (18 decimals)
    const isUsdcBased = pairId.startsWith("USDC/");
    const decimals = isUsdcBased ? 1e6 : 1e18;
    const amount = Number(weiAmount) / decimals;
    return amount.toFixed(isUsdcBased ? 2 : 6);
  };

  const getAmountLabel = (pairId: string) => {
    return pairId.startsWith("USDC/") ? "USDC" : "ETH";
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (isLoading) {
    return <div>Loading strategies...</div>;
  }

  if (error) {
    return <div className="p-3 bg-red-100 text-red-700 rounded">{error}</div>;
  }

  if (strategies.length === 0) {
    return (
      <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded">
        <p>No strategies created yet. Create your first DCA strategy above!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Your Strategies</h2>

      <div className="grid gap-4">
        {strategies.map((strategy) => (
          <div
            key={strategy.id}
            className="p-4 border rounded hover:border-blue-500 cursor-pointer"
            onClick={() => setSelectedStrategy(selectedStrategy === strategy.id ? null : strategy.id)}
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold text-lg">{strategy.pairId}</h3>
                <p className="text-sm text-gray-600">
                  {formatAmount(strategy.baseAmount, strategy.pairId)} {getAmountLabel(strategy.pairId)} · {strategy.frequency}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Next check: {formatDate(strategy.nextCheckTime)}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-1 text-xs rounded ${
                    strategy.isActive
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {strategy.isActive ? "Active" : "Paused"}
                </span>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleStrategy(strategy.id, strategy.isActive);
                  }}
                  className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  {strategy.isActive ? "Pause" : "Resume"}
                </button>
              </div>
            </div>

            {/* Execution History */}
            {selectedStrategy === strategy.id && (
              <div className="mt-4 pt-4 border-t space-y-2">
                <h4 className="font-semibold">Execution History</h4>

                {executions.length === 0 ? (
                  <p className="text-sm text-gray-500">No executions yet</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {executions.map((exec) => (
                      <div
                        key={exec.id}
                        className="p-2 bg-gray-50 dark:bg-gray-800 rounded text-sm"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <span
                              className={`inline-block px-2 py-0.5 text-xs rounded ${
                                exec.status === "executed"
                                  ? "bg-green-100 text-green-700"
                                  : exec.status === "failed"
                                  ? "bg-red-100 text-red-700"
                                  : exec.status === "skipped"
                                  ? "bg-yellow-100 text-yellow-700"
                                  : "bg-blue-100 text-blue-700"
                              }`}
                            >
                              {exec.status}
                            </span>
                            <p className="mt-1">
                              Amount: {formatAmount(exec.recommendedAmount, strategy.pairId)} {getAmountLabel(strategy.pairId)}
                            </p>
                            <p className="text-xs text-gray-500">
                              Price: ${exec.price.toFixed(2)} · Volatility: {exec.volatility.toFixed(2)}% ·
                              Liquidity: {exec.liquidityScore.toFixed(2)} · Trend: {exec.trend}
                            </p>
                            {exec.txHash && (
                              <p className="text-xs mt-1">
                                <a
                                  href={`https://sepolia.etherscan.io/tx/${exec.txHash}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-500 hover:underline"
                                >
                                  View Transaction →
                                </a>
                              </p>
                            )}
                            {exec.errorMessage && (
                              <p className="text-xs text-red-600 mt-1">
                                Error: {formatErrorMessage(exec.errorMessage)}
                              </p>
                            )}
                          </div>
                          <span className="text-xs text-gray-500">
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
  );
}
