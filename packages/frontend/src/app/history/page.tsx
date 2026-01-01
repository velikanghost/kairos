"use client";

import { useAccount } from "wagmi";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Header from "@/components/Header";
import { Clock, ExternalLink, TrendingUp } from "lucide-react";

interface Execution {
  id: string;
  strategyId: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  txHash: string;
  executedAt: string;
  status: "success" | "failed" | "pending";
}

export default function HistoryPage() {
  const { isConnected, address } = useAccount();
  const router = useRouter();
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isConnected) {
      router.push("/");
    }
  }, [isConnected, router]);

  useEffect(() => {
    if (address) {
      fetchExecutionHistory();
    }
  }, [address]);

  const fetchExecutionHistory = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001"}/executions?userId=${address?.toLowerCase()}`
      );

      if (response.ok) {
        const data = await response.json();
        setExecutions(data);
      }
    } catch (error) {
      console.error("Failed to fetch execution history:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const formatAmount = (amount: string, decimals: number = 18) => {
    const value = Number(amount) / Math.pow(10, decimals);
    return value.toFixed(4);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "success":
        return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
      case "failed":
        return "text-red-400 bg-red-500/10 border-red-500/20";
      case "pending":
        return "text-amber-400 bg-amber-500/10 border-amber-500/20";
      default:
        return "text-gray-400 bg-gray-500/10 border-gray-500/20";
    }
  };

  if (!isConnected) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <Header />
      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="space-y-8">
          {/* Page Header */}
          <div>
            <h1 className="text-3xl font-bold text-white">History</h1>
            <p className="mt-2 text-sm text-gray-400">
              View all your past executions and transactions
            </p>
          </div>

          {/* Execution History */}
          <div className="max-w-5xl">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex items-center space-x-3 text-gray-400">
                  <Clock className="h-5 w-5 animate-spin" />
                  <span className="text-sm">Loading execution history...</span>
                </div>
              </div>
            ) : executions.length === 0 ? (
              <div className="rounded-xl border border-slate-700/50 bg-slate-900/30 p-12 text-center">
                <Clock className="mx-auto h-12 w-12 text-gray-600 mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">
                  No executions yet
                </h3>
                <p className="text-sm text-gray-400">
                  Your execution history will appear here once your strategies start running
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {executions.map((execution) => (
                  <div
                    key={execution.id}
                    className="rounded-xl border border-slate-700/50 bg-slate-900/30 p-6 transition-colors hover:bg-slate-900/50"
                  >
                    <div className="flex items-start justify-between">
                      {/* Left Side - Execution Details */}
                      <div className="flex-1 space-y-3">
                        {/* Swap Direction */}
                        <div className="flex items-center space-x-3">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium text-white">
                              {execution.tokenIn}
                            </span>
                            <TrendingUp className="h-4 w-4 text-gray-500" />
                            <span className="text-sm font-medium text-white">
                              {execution.tokenOut}
                            </span>
                          </div>
                          <span
                            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${getStatusColor(execution.status)}`}
                          >
                            {execution.status}
                          </span>
                        </div>

                        {/* Amounts */}
                        <div className="flex items-center space-x-6 text-sm">
                          <div>
                            <span className="text-gray-500">Spent: </span>
                            <span className="font-mono text-white">
                              {formatAmount(execution.amountIn)} {execution.tokenIn}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">Received: </span>
                            <span className="font-mono text-white">
                              {formatAmount(execution.amountOut)} {execution.tokenOut}
                            </span>
                          </div>
                        </div>

                        {/* Timestamp */}
                        <div className="flex items-center space-x-2 text-xs text-gray-500">
                          <Clock className="h-3.5 w-3.5" />
                          <span>{formatDate(execution.executedAt)}</span>
                        </div>
                      </div>

                      {/* Right Side - Transaction Link */}
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
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
