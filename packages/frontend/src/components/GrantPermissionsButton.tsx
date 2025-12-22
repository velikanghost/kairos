"use client";

import { useState } from "react";
import { parseEther } from "viem";
import { erc7715ProviderActions } from "@metamask/smart-accounts-kit/actions";
import { useSessionAccount } from "@/providers/SessionAccountProvider";
import { usePermissions } from "@/providers/PermissionProvider";
import { useChainId, useWalletClient } from "wagmi";

export default function GrantPermissionsButton() {
  const { sessionAccount } = useSessionAccount();
  const { savePermission } = usePermissions();
  const { data: walletClient } = useWalletClient();
  const chainId = useChainId();

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleGrantPermissions = async () => {
    if (!sessionAccount) {
      setError("Session account not found");
      return;
    }

    if (!walletClient) {
      setError("Wallet client not connected");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const client = walletClient.extend(erc7715ProviderActions());
      const currentTime = Math.floor(Date.now() / 1000);
      // 30 days in seconds
      const expiry = currentTime + 24 * 60 * 60 * 30;

      const permissions = await client.requestExecutionPermissions([{
        chainId,
        expiry,
        signer: {
          type: "account",
          data: {
            address: sessionAccount.address,
          },
        },
        isAdjustmentAllowed: true,
        permission: {
          type: "native-token-periodic",
          data: {
            // 0.001 ETH in WEI format
            periodAmount: parseEther("0.001"),
            // 1 day in seconds
            periodDuration: 86400,
            justification: "Permission to transfer 0.001 ETH every day for DCA trading",
          },
        },
      }]);

      savePermission(permissions[0]);

      // TODO: Send permission to backend to store in database
      console.log("Permission granted:", permissions[0]);
    } catch (err) {
      console.error('Error granting permissions:', err);
      setError(err instanceof Error ? err.message : 'Failed to grant permissions');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 bg-red-100 text-red-700 rounded">
          {error}
        </div>
      )}

      <button
        onClick={handleGrantPermissions}
        disabled={isLoading}
        className="w-full px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
      >
        {isLoading ? "Granting Permissions..." : "Grant Permissions"}
      </button>
    </div>
  );
}
