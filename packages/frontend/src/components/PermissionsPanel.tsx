'use client'

import { useState } from 'react'
import { usePermissions } from '@/providers/PermissionProvider'
import GrantPermissionsButton from './GrantPermissionsButton'
import { Shield, ChevronDown, ChevronRight, Info } from 'lucide-react'

export default function PermissionsPanel() {
  const { permission } = usePermissions()
  const [isExpanded, setIsExpanded] = useState(false)

  // Parse permission data if available
  const getPermissionDetails = () => {
    if (!permission) return null

    try {
      const permissionData = permission as any
      // This is a simplified version - adjust based on your actual permission structure
      return {
        type: 'USDC',
        dailyLimit: 50, // You'll need to extract this from permission.signerMeta
        used: 0, // Track this from executions
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Example
      }
    } catch {
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
          aria-label={isExpanded ? 'Collapse permissions' : 'Expand permissions'}
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
              {details.dailyLimit} USDC
            </p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
            <p className="mb-1 text-xs text-gray-500">Status</p>
            <div className="flex items-center space-x-1.5">
              <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-400"></div>
              <p className="text-sm font-semibold text-emerald-400">Active</p>
            </div>
          </div>
        </div>
      )}

      {/* Expandable Section */}
      {isExpanded && (
        <div className="space-y-4 border-t border-slate-800/50 pt-4">
          <div className="rounded-lg border border-slate-700/50 bg-slate-900/50 p-4">
            <p className="flex items-start space-x-3 text-sm text-gray-400">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" />
              <span>
                If you're seeing "allowance exceeded" errors, grant a new
                permission with a higher amount
              </span>
            </p>
          </div>

          <GrantPermissionsButton />
        </div>
      )}

      {!isExpanded && (
        <button
          onClick={() => setIsExpanded(true)}
          className="mt-2 w-full text-sm text-gray-400 transition-colors hover:text-white"
        >
          Update Allowance →
        </button>
      )}
    </div>
  )
}
