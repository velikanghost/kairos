'use client'

import { useAccount, useChainId, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { metaMask } from "wagmi/connectors";
import { useSessionAccount } from "@/providers/SessionAccountProvider";
import { usePermissions } from "@/providers/PermissionProvider";
import GrantPermissionsButton from "./GrantPermissionsButton";

export function Auth() {
  const { address, chainId: connectedChainId, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const currentChainId = useChainId();
  const { sessionAccount, createSessionAccount, isLoading: sessionLoading, error: sessionError } = useSessionAccount();
  const { permission } = usePermissions();

  // Not connected
  if (!isConnected) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold">Connect Wallet</h2>
        <button
          onClick={() => connect({ connector: metaMask() })}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Connect with MetaMask
        </button>
      </div>
    );
  }

  // Wrong chain
  if (connectedChainId !== currentChainId) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold">Switch Network</h2>
        <p className="text-sm text-gray-600">
          Please switch to Sepolia Testnet to continue
        </p>
        <button
          onClick={() => switchChain({ chainId: currentChainId })}
          className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
        >
          Switch to Sepolia Testnet
        </button>
      </div>
    );
  }

  // Connected and on correct chain
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Kairos Trading Agent</h2>

        {/* Wallet Info */}
        <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded space-y-2">
          <p><strong>Wallet Address:</strong></p>
          <code className="text-xs break-all">{address}</code>
        </div>

        {/* Session Account Info */}
        {sessionAccount && (
          <div className="p-4 bg-blue-50 dark:bg-blue-900 rounded space-y-2">
            <p className="font-semibold text-blue-800 dark:text-blue-200">
              ✓ Session Account Created
            </p>
            <p className="text-sm">This account will execute trades on your behalf</p>
            <code className="text-xs break-all block mt-2">{sessionAccount.address}</code>
          </div>
        )}

        {/* Permission Status */}
        {permission && (
          <div className="p-4 bg-green-50 dark:bg-green-900 rounded space-y-2">
            <p className="font-semibold text-green-800 dark:text-green-200">
              ✓ Permissions Granted
            </p>
            <p className="text-sm">Session account can execute DCA trades with your approval</p>
          </div>
        )}

        {/* Errors */}
        {sessionError && (
          <div className="p-3 bg-red-100 text-red-700 rounded">
            {sessionError}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="space-y-3">
        {/* Step 1: Create Session Account */}
        {!sessionAccount && (
          <div className="space-y-2">
            <div className="p-3 bg-blue-50 dark:bg-blue-900 rounded text-sm">
              <p className="font-semibold mb-1">Step 1: Create Session Account</p>
              <p>This creates a smart account that will execute trades on your behalf</p>
            </div>
            <button
              onClick={createSessionAccount}
              disabled={sessionLoading}
              className="w-full px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50"
            >
              {sessionLoading ? 'Creating Session Account...' : 'Create Session Account'}
            </button>
          </div>
        )}

        {/* Step 2: Grant Permissions */}
        {sessionAccount && !permission && (
          <div className="space-y-2">
            <div className="p-3 bg-green-50 dark:bg-green-900 rounded text-sm">
              <p className="font-semibold mb-1">Step 2: Grant Permissions</p>
              <p>Allow the session account to execute periodic trades (0.001 ETH/day)</p>
            </div>
            <GrantPermissionsButton />
          </div>
        )}

        {/* Step 3: Ready for Trading */}
        {permission && (
          <div className="p-3 bg-green-50 dark:bg-green-900 rounded text-sm">
            <p className="font-semibold mb-1">✓ Ready for DCA Trading!</p>
            <p>Your session account can now execute automated trades</p>
          </div>
        )}

        <button
          onClick={() => disconnect()}
          className="w-full px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
        >
          Disconnect
        </button>
      </div>
    </div>
  );
}
