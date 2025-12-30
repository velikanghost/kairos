"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { parseEther, parseUnits } from "viem";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

export default function CreateStrategyForm() {
  const { address } = useAccount();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    pairId: "USDC/WETH",
    frequency: "hourly" as "hourly" | "daily" | "weekly",
    baseAmount: "10", // USDC amount to spend per trade
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
      // Convert amount based on token type
      // For USDC-based pairs (USDC/WETH, USDC/ETH), use 6 decimals
      // For ETH-based pairs (ETH/USDC, WETH/USDC), use 18 decimals
      const isUsdcBased = formData.pairId.startsWith("USDC/");
      const baseAmountWei = isUsdcBased
        ? parseUnits(formData.baseAmount, 6) // USDC has 6 decimals
        : parseEther(formData.baseAmount); // ETH has 18 decimals

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
          router: "uniswap_v3", // Updated to V3
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to create strategy: ${errorData}`);
      }

      const strategy = await response.json();
      console.log("Strategy created:", strategy);

      setSuccess(true);

      // Reset form
      setFormData({
        pairId: "USDC/WETH",
        frequency: "hourly",
        baseAmount: "10",
        slippage: 0.5,
      });
    } catch (err) {
      console.error("Error creating strategy:", err);
      setError(err instanceof Error ? err.message : "Failed to create strategy");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Create DCA Strategy</h2>

      {error && (
        <div className="p-3 bg-red-100 text-red-700 rounded">
          {error}
        </div>
      )}

      {success && (
        <div className="p-3 bg-green-100 text-green-700 rounded">
          Strategy created successfully! It will start executing based on your frequency.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Pair Selection */}
        <div>
          <label className="block text-sm font-medium mb-1">
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
                baseAmount: isUsdcBased ? "10" : "0.001" // Adjust default amount based on pair
              });
            }}
            className="w-full p-2 border rounded"
          >
            <option value="USDC/WETH">USDC/WETH (DCA with stablecoin - Recommended)</option>
            <option value="USDC/ETH">USDC/ETH (DCA with stablecoin)</option>
            <option value="ETH/USDC">ETH/USDC (Sell ETH for stablecoin)</option>
            <option value="WETH/USDC">WETH/USDC (Sell WETH for stablecoin)</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">
            {formData.pairId.startsWith("USDC/")
              ? "Using USDC to buy ETH/WETH - ideal for DCA investing"
              : "Using ETH/WETH to buy USDC - ideal for taking profits"}
          </p>
        </div>

        {/* Frequency */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Frequency
          </label>
          <select
            value={formData.frequency}
            onChange={(e) => setFormData({ ...formData, frequency: e.target.value as any })}
            className="w-full p-2 border rounded"
          >
            <option value="5min">Every 5 Minutes (Testing)</option>
            <option value="hourly">Every Hour</option>
            <option value="daily">Every Day</option>
            <option value="weekly">Every Week</option>
          </select>
        </div>

        {/* Base Amount */}
        <div>
          <label className="block text-sm font-medium mb-1">
            {formData.pairId.startsWith("USDC/")
              ? `USDC to Spend Per Trade`
              : `ETH to Spend Per Trade`}
          </label>
          <input
            type="number"
            step={formData.pairId.startsWith("USDC/") ? "1" : "0.001"}
            min={formData.pairId.startsWith("USDC/") ? "1" : "0.001"}
            value={formData.baseAmount}
            onChange={(e) => setFormData({ ...formData, baseAmount: e.target.value })}
            className="w-full p-2 border rounded"
            placeholder={formData.pairId.startsWith("USDC/") ? "10" : "0.001"}
          />
          <p className="text-xs text-gray-500 mt-1">
            {formData.pairId.startsWith("USDC/")
              ? "Amount of USDC to spend buying ETH/WETH each time. Smart sizing may adjust this based on market conditions."
              : "Amount of ETH to spend each time. Smart sizing may adjust this based on market conditions."}
          </p>
        </div>

        {/* Slippage */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Slippage Tolerance (%)
          </label>
          <input
            type="number"
            step="0.1"
            min="0.1"
            max="10"
            value={formData.slippage}
            onChange={(e) => setFormData({ ...formData, slippage: parseFloat(e.target.value) })}
            className="w-full p-2 border rounded"
          />
        </div>

        {/* Smart Features Info */}
        <div className="p-3 bg-blue-50 dark:bg-blue-900 rounded text-sm">
          <p className="font-semibold mb-1">Smart Features Enabled:</p>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li>Smart Sizing - Adjusts amount based on volatility and price dips</li>
            <li>Volatility Adjustment - Reduces size in high volatility</li>
            <li>Liquidity Check - Only executes with sufficient liquidity</li>
          </ul>
        </div>

        <button
          type="submit"
          disabled={isLoading || !address}
          className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {isLoading ? "Creating Strategy..." : "Create Strategy"}
        </button>
      </form>
    </div>
  );
}
