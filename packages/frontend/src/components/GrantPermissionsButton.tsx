"use client";

import { useState } from "react";
import { parseEther, parseUnits } from "viem";
import { erc7715ProviderActions } from "@metamask/smart-accounts-kit/actions";
import { useSessionAccount } from "@/providers/SessionAccountProvider";
import { usePermissions } from "@/providers/PermissionProvider";
import { useAccount, useChainId, useWalletClient } from "wagmi";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";
const USDC_ADDRESS = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"; // USDC on Sepolia

type PermissionType = "eth" | "usdc";

export default function GrantPermissionsButton() {
  const { sessionAccountAddress } = useSessionAccount();
  const { savePermission } = usePermissions();
  const { data: walletClient } = useWalletClient();
  const { address: walletAddress } = useAccount();
  const chainId = useChainId();

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionType, setPermissionType] = useState<PermissionType>("usdc");
  const [amount, setAmount] = useState<string>("50"); // Default to 50 USDC per day

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

      // Build permission config based on selected type
      const permissionConfig = permissionType === "usdc"
        ? {
            type: "erc20-token-periodic" as const,
            data: {
              tokenAddress: USDC_ADDRESS as `0x${string}`,
              periodAmount: parseUnits(amount, 6), // USDC has 6 decimals
              periodDuration: 86400, // 1 day in seconds
              justification: `Permission to transfer ${amount} USDC every day for DCA trading`,
            },
          }
        : {
            type: "native-token-periodic" as const,
            data: {
              periodAmount: parseEther(amount), // ETH has 18 decimals
              periodDuration: 86400, // 1 day in seconds
              justification: `Permission to transfer ${amount} ETH every day for DCA trading`,
            },
          };

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
        permission: permissionConfig,
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
          permissionType: permissionType === "usdc" ? "erc20-token-periodic" : "native-token-periodic",
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

      {/* Permission Type Selector */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Permission Type
        </label>
        <div className="flex space-x-4">
          <label className="flex items-center cursor-pointer">
            <input
              type="radio"
              value="usdc"
              checked={permissionType === "usdc"}
              onChange={(e) => {
                setPermissionType(e.target.value as PermissionType);
                setAmount(e.target.value === "usdc" ? "50" : "0.01");
              }}
              disabled={isLoading}
              className="mr-2"
            />
            <span className="text-sm text-gray-700">USDC (Recommended)</span>
          </label>
          <label className="flex items-center cursor-pointer">
            <input
              type="radio"
              value="eth"
              checked={permissionType === "eth"}
              onChange={(e) => {
                setPermissionType(e.target.value as PermissionType);
                setAmount(e.target.value === "usdc" ? "50" : "0.01");
              }}
              disabled={isLoading}
              className="mr-2"
            />
            <span className="text-sm text-gray-700">ETH</span>
          </label>
        </div>
        <p className="text-xs text-gray-500">
          {permissionType === "usdc"
            ? "Use USDC for stable DCA investments (recommended for most users)"
            : "Use ETH for native token permissions (gas fees will be higher)"}
        </p>
      </div>

      {/* Amount Input */}
      <div className="space-y-2">
        <label htmlFor="amount" className="block text-sm font-medium text-gray-700">
          Daily {permissionType.toUpperCase()} Allowance
        </label>
        <input
          id="amount"
          type="number"
          step={permissionType === "usdc" ? "1" : "0.001"}
          min={permissionType === "usdc" ? "1" : "0.001"}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={isLoading}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
          placeholder={permissionType === "usdc" ? "50" : "0.01"}
        />
        <p className="text-xs text-gray-500">
          Amount of {permissionType.toUpperCase()} the session account can use per day for DCA trades
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
