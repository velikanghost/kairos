"use client";

import { useAccount } from "wagmi";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Header from "@/components/Header";
import CreateStrategyForm from "@/components/CreateStrategyForm";
import StrategyList from "@/components/StrategyList";

export default function StrategiesPage() {
  const { isConnected } = useAccount();
  const router = useRouter();
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    if (!isConnected) {
      router.push("/");
    }
  }, [isConnected, router]);

  const handleStrategyCreated = () => {
    // Increment trigger to refresh strategy list
    setRefreshTrigger((prev) => prev + 1);
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
            <h1 className="text-3xl font-bold text-white">Strategies</h1>
            <p className="mt-2 text-sm text-gray-400">
              Create and manage your DCA strategies
            </p>
          </div>

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Create Strategy Form */}
            <div className="lg:col-span-1">
              <CreateStrategyForm onSuccess={handleStrategyCreated} />
            </div>

            {/* Strategy List */}
            <div className="lg:col-span-2">
              <StrategyList refreshTrigger={refreshTrigger} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
