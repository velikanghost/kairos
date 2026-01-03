'use client'

import { useState } from 'react'
import { usePermissions } from '@/providers/PermissionProvider'
import { Shield, ChevronDown, ChevronRight, Info } from 'lucide-react'
import { formatUnits } from 'viem'

export default function PermissionsPanel() {
  const { permission, permissionMetadata } = usePermissions()
  const [isExpanded, setIsExpanded] = useState(false)

  // Parse permission data from the actual permission object
  const getPermissionDetails = () => {
    if (!permission) return null

    try {
      const permissionData = permission as any

      // Extract the permission type and amount from the nested structure
      // Structure: permission.permission.type and permission.permission.data.periodAmount
      const permissionInfo = permissionData.permission
      if (!permissionInfo) return null

      const isErc20 = permissionInfo.type === 'erc20-token-periodic'
      const isNative = permissionInfo.type === 'native-token-periodic'

      // Get period amount (stored as bigint/string in wei)
      const periodAmount = permissionInfo.data?.periodAmount
      if (!periodAmount) return null

      // Convert from wei to human-readable
      // USDC has 6 decimals, ETH has 18 decimals
      const decimals = isErc20 ? 6 : 18
      const dailyLimit = Number(formatUnits(BigInt(periodAmount), decimals))

      // Determine token type
      const tokenType = isErc20 ? 'USDC' : isNative ? 'ETH' : 'Unknown'

      return {
        type: tokenType,
        dailyLimit,
        expiresAt: permissionMetadata.expiresAt,
        permissionType:
          permissionMetadata.permissionType || permissionInfo.type,
      }
    } catch (err) {
      console.error('Error parsing permission details:', err)
      return null
    }
  }

  const details = getPermissionDetails()

  if (!permission) {
    return null // Don't show if no permission granted
  }

  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-900 p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500">
            <Shield className="h-6 w-6 text-slate-950" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Active Permissions</h3>
            <p className="text-xs text-gray-400">Manage trading allowances</p>
          </div>
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-gray-400 transition-colors hover:text-white"
          aria-label={
            isExpanded ? 'Collapse permissions' : 'Expand permissions'
          }
        >
          {isExpanded ? (
            <ChevronDown className="h-5 w-5" />
          ) : (
            <ChevronRight className="h-5 w-5" />
          )}
        </button>
      </div>

      {/* Permission Summary - Always Visible */}
      {details && (
        <div className="mb-4 grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
            <p className="mb-1 text-xs text-gray-500">Daily Limit</p>
            <p className="text-lg font-bold text-white">
              {details.type === 'USDC'
                ? `${details.dailyLimit.toFixed(2)} ${details.type}`
                : `${details.dailyLimit.toFixed(6)} ${details.type}`}
            </p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
            <p className="mb-1 text-xs text-gray-500">Status</p>
            <div className="flex items-center space-x-1.5">
              <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-400"></div>
              <p className="text-sm font-semibold text-emerald-400">Active</p>
            </div>
            {details.expiresAt && (
              <p className="mt-1 text-xs text-gray-500">
                Expires {details.expiresAt.toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Expandable Section */}
      {isExpanded && (
        <div className="border-t border-slate-800/50 pt-4">
          <div className="rounded-lg border border-slate-700/50 bg-slate-900/50 p-4">
            <p className="flex items-start space-x-3 text-sm text-gray-400">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" />
              <span>
                If you're seeing "allowance exceeded" errors, use the form below
                to grant a new permission with a higher amount
              </span>
            </p>
          </div>
        </div>
      )}

      {!isExpanded && (
        <button
          onClick={() => setIsExpanded(true)}
          className="mt-2 w-full text-sm text-gray-400 transition-colors hover:text-white"
        >
          View Details →
        </button>
      )}
    </div>
  )
}
