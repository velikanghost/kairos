"use client";

import { useAccount } from "wagmi";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Header from "@/components/Header";
import StatsOverview from "@/components/StatsOverview";
import PortfolioOverview from "@/components/PortfolioOverview";
import { useSessionAccount } from "@/providers/SessionAccountProvider";

export default function OverviewPage() {
  const { isConnected } = useAccount();
  const router = useRouter();
  const { sessionAccountAddress } = useSessionAccount();

  useEffect(() => {
    if (!isConnected) {
      router.push("/");
    }
  }, [isConnected, router]);

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
            <h1 className="text-3xl font-bold text-white">Overview</h1>
            <p className="mt-2 text-sm text-gray-400">
              Overview of your DCA strategies and portfolio
            </p>
          </div>

          {/* Stats Grid */}
          <StatsOverview />

          {/* Portfolio Overview */}
          {sessionAccountAddress && (
            <div className="max-w-4xl">
              <PortfolioOverview sessionAccountAddress={sessionAccountAddress} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
