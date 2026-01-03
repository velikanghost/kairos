"use client";

import { useAccount } from "wagmi";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Header from "@/components/Header";
import PermissionsPanel from "@/components/PermissionsPanel";
import GrantPermissionsButton from "@/components/GrantPermissionsButton";
import { usePermissions } from "@/providers/PermissionProvider";
import { Info } from "lucide-react";

export default function PermissionsPage() {
  const { isConnected } = useAccount();
  const router = useRouter();
  const { permission } = usePermissions();

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
            <h1 className="text-3xl font-bold text-white">Permissions</h1>
            <p className="mt-2 text-sm text-gray-400">
              Manage your trading permissions and allowances
            </p>
          </div>

          {/* Permissions Content */}
          <div className="max-w-2xl mx-auto">
            {/* Active Permission Display */}
            {permission && (
              <div className="mb-6">
                <PermissionsPanel />
              </div>
            )}

            {/* Grant/Update Permission Section */}
            <div className="rounded-xl border border-slate-700/50 bg-slate-900/30 p-8">
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-white mb-2">
                  {permission ? "Update Permissions" : "Grant Permissions"}
                </h2>
                <p className="text-sm text-gray-400">
                  {permission
                    ? "Grant a new permission to increase your allowance or extend the expiration"
                    : "Grant permissions to allow automated trading within your defined limits"}
                </p>
              </div>

              {/* Info Box */}
              <div className="mb-6 rounded-lg border border-blue-500/20 bg-blue-500/10 p-4">
                <div className="flex items-start space-x-3">
                  <Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-400" />
                  <div className="text-sm">
                    <p className="font-medium text-blue-400 mb-1">How it works</p>
                    <p className="text-gray-400">
                      Permissions allow the smart contract to execute trades on your behalf
                      within the limits you set. You maintain full control and can revoke
                      permissions at any time.
                    </p>
                  </div>
                </div>
              </div>

              <GrantPermissionsButton />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
