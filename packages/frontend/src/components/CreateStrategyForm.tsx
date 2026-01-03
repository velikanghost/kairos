"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { parseEther, parseUnits } from "viem";
import { formatErrorMessage } from "@/utils/errorFormatter";
import { Zap } from "lucide-react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

export default function CreateStrategyForm({ onSuccess }: { onSuccess?: () => void }) {
  const { address } = useAccount();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    pairId: "USDC/WETH",
    frequency: "5min" as "5min" | "hourly" | "daily" | "weekly",
    baseAmount: "10",
    slippage: 0.5,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!address) {
      setError("Wallet not connected");
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const isUsdcBased = formData.pairId.startsWith("USDC/");
      const baseAmountWei = isUsdcBased
        ? parseUnits(formData.baseAmount, 6)
        : parseEther(formData.baseAmount);

      const response = await fetch(`${BACKEND_URL}/strategies`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: address.toLowerCase(),
          pairId: formData.pairId,
          frequency: formData.frequency,
          baseAmount: baseAmountWei.toString(),
          slippage: formData.slippage,
          enableSmartSizing: true,
          enableVolatilityAdjustment: true,
          enableLiquidityCheck: true,
          router: "uniswap_v3",
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to create strategy: ${errorData}`);
      }

      const strategy = await response.json();
      console.log("Strategy created:", strategy);

      setSuccess(true);

      // Call onSuccess callback to refresh strategy list
      if (onSuccess) {
        onSuccess();
      }

      // Reset form
      setFormData({
        pairId: "USDC/WETH",
        frequency: "5min",
        baseAmount: "10",
        slippage: 0.5,
      });
    } catch (err) {
      console.error("Error creating strategy:", err);
      const errorMsg = err instanceof Error ? err.message : "Failed to create strategy";
      setError(formatErrorMessage(errorMsg));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
      <h2 className="text-xl font-bold text-white mb-6">Create DCA Strategy</h2>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 text-sm">
          ✓ Strategy created successfully! It will start executing based on your frequency.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Pair Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Token Pair
          </label>
          <select
            value={formData.pairId}
            onChange={(e) => {
              const newPairId = e.target.value;
              const isUsdcBased = newPairId.startsWith("USDC/");
              setFormData({
                ...formData,
                pairId: newPairId,
                baseAmount: isUsdcBased ? "10" : "0.001"
              });
            }}
            className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value="USDC/WETH">USDC → WETH (Recommended)</option>
            <option value="USDC/ETH">USDC → ETH</option>
            <option value="ETH/USDC">ETH → USDC</option>
            <option value="WETH/USDC">WETH → USDC</option>
          </select>
          <p className="text-xs text-gray-500 mt-1.5">
            {formData.pairId.startsWith("USDC/")
              ? "💰 Buying ETH with USDC - ideal for DCA investing"
              : "💵 Selling ETH for USDC - taking profits"}
          </p>
        </div>

        {/* Frequency */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Frequency
          </label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: "5min", label: "5 Min", badge: "Test" },
              { value: "hourly", label: "Hourly", badge: null },
              { value: "daily", label: "Daily", badge: "Popular" },
              { value: "weekly", label: "Weekly", badge: null },
            ].map((freq) => (
              <button
                key={freq.value}
                type="button"
                onClick={() => setFormData({ ...formData, frequency: freq.value as any })}
                className={`relative px-4 py-2.5 text-sm font-medium rounded-lg transition-all ${
                  formData.frequency === freq.value
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/30"
                    : "bg-slate-800 text-gray-300 hover:bg-slate-700 border border-slate-700"
                }`}
              >
                {freq.label}
                {freq.badge && (
                  <span className="absolute -top-1 -right-1 px-1.5 py-0.5 bg-amber-500 text-slate-950 text-[10px] font-bold rounded">
                    {freq.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Base Amount */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            {formData.pairId.startsWith("USDC/") ? "USDC Amount" : "ETH Amount"}
          </label>
          <div className="relative">
            <input
              type="number"
              step={formData.pairId.startsWith("USDC/") ? "1" : "0.001"}
              min={formData.pairId.startsWith("USDC/") ? "1" : "0.001"}
              value={formData.baseAmount}
              onChange={(e) => setFormData({ ...formData, baseAmount: e.target.value })}
              className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono"
              placeholder={formData.pairId.startsWith("USDC/") ? "10" : "0.001"}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium text-sm">
              {formData.pairId.startsWith("USDC/") ? "USDC" : "ETH"}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1.5">
            Per trade. Smart sizing may adjust based on market conditions.
          </p>
        </div>

        {/* Slippage */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Slippage Tolerance
          </label>
          <div className="relative">
            <input
              type="number"
              step="0.1"
              min="0.1"
              max="10"
              value={formData.slippage}
              onChange={(e) => setFormData({ ...formData, slippage: parseFloat(e.target.value) })}
              className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium text-sm">
              %
            </span>
          </div>
        </div>

        {/* Smart Features */}
        <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <Zap className="h-5 w-5 text-indigo-400" />
            <p className="font-semibold text-indigo-400 text-sm">Smart Features Enabled</p>
          </div>
          <ul className="space-y-1.5 text-xs text-indigo-300/80">
            <li className="flex items-center space-x-2">
              <span className="text-indigo-400">•</span>
              <span>Smart Sizing - Adjusts based on volatility & dips</span>
            </li>
            <li className="flex items-center space-x-2">
              <span className="text-indigo-400">•</span>
              <span>Volatility Protection - Reduces size in high vol</span>
            </li>
            <li className="flex items-center space-x-2">
              <span className="text-indigo-400">•</span>
              <span>Liquidity Check - Ensures sufficient pool depth</span>
            </li>
          </ul>
        </div>

        <button
          type="submit"
          disabled={isLoading || !address}
          className="w-full px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-500/30"
        >
          {isLoading ? (
            <span className="flex items-center justify-center space-x-2">
              <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
              <span>Creating...</span>
            </span>
          ) : (
            "Create Strategy"
          )}
        </button>
      </form>
    </div>
  );
}
