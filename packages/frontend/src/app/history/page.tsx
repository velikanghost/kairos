"use client";

import { useAccount } from "wagmi";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Header from "@/components/Header";
import ExecutionHistory from "@/components/ExecutionHistory";

export default function HistoryPage() {
  const { isConnected } = useAccount();
  const router = useRouter();

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
            <h1 className="text-3xl font-bold text-white">History</h1>
            <p className="mt-2 text-sm text-gray-400">
              View all your past executions and transactions
            </p>
          </div>

          {/* Execution History */}
          <ExecutionHistory />
        </div>
      </main>
    </div>
  );
}
