"use client";

import { useState } from "react";
import { parseEther } from "viem";
import { erc7715ProviderActions } from "@metamask/smart-accounts-kit/actions";
import { useSessionAccount } from "@/providers/SessionAccountProvider";
import { usePermissions } from "@/providers/PermissionProvider";
import { useAccount, useChainId, useWalletClient } from "wagmi";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

export default function GrantPermissionsButton() {
  const { sessionAccountAddress } = useSessionAccount();
  const { savePermission } = usePermissions();
  const { data: walletClient } = useWalletClient();
  const { address: walletAddress } = useAccount();
  const chainId = useChainId();

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [ethAmount, setEthAmount] = useState<string>("0.01"); // Default to 0.01 ETH per day

  const handleGrantPermissions = async () => {
    if (!sessionAccountAddress) {
      setError("Session account not found");
      return;
    }

    if (!walletClient) {
      setError("Wallet client not connected");
      return;
    }

    if (!walletAddress) {
      setError("Wallet not connected");
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
            address: sessionAccountAddress as `0x${string}`,
          },
        },
        isAdjustmentAllowed: true,
        permission: {
          type: "native-token-periodic",
          data: {
            // User-specified ETH amount in WEI format
            periodAmount: parseEther(ethAmount),
            // 1 day in seconds
            periodDuration: 86400,
            justification: `Permission to transfer ${ethAmount} ETH every day for DCA trading`,
          },
        },
      }]);

      const grantedPermission = permissions[0];

      // Save to frontend state
      savePermission(grantedPermission);

      // Send permission to backend to store in database
      console.log("Sending permission to backend:", grantedPermission);

      // Ensure chainId is a decimal number
      const chainIdNumber = Number(chainId);

      // Extract delegationManager from signerMeta (it's nested in the permission object)
      const permissionData = grantedPermission as any;
      const delegationManager = permissionData.signerMeta?.delegationManager || "";

      const response = await fetch(`${BACKEND_URL}/permissions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: walletAddress.toLowerCase(),
          sessionAccountAddress: sessionAccountAddress,
          permissionContext: grantedPermission.context,
          delegationManager: delegationManager,
          permissionType: "native-token-periodic",
          chainId: chainIdNumber,
          permissionData: grantedPermission,
          expiresAt: new Date(expiry * 1000).toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to store permission: ${response.statusText}`);
      }

      console.log("Permission stored successfully in backend");
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

      <div className="space-y-2">
        <label htmlFor="ethAmount" className="block text-sm font-medium text-gray-700">
          Daily ETH Allowance
        </label>
        <input
          id="ethAmount"
          type="number"
          step="0.001"
          min="0.001"
          value={ethAmount}
          onChange={(e) => setEthAmount(e.target.value)}
          disabled={isLoading}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
          placeholder="0.01"
        />
        <p className="text-xs text-gray-500">
          Amount of ETH the session account can use per day for DCA trades
        </p>
      </div>

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
