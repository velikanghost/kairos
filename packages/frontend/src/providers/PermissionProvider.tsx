"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
} from "react";
import { useAccount } from "wagmi";
import { RequestExecutionPermissionsReturnType } from "@metamask/smart-accounts-kit/actions";

export type Permission = NonNullable<RequestExecutionPermissionsReturnType>[number];

interface PermissionMetadata {
  expiresAt: Date | null;
  permissionType: string | null;
}

interface PermissionContextType {
  permission: Permission | null;
  permissionMetadata: PermissionMetadata;
  savePermission: (permission: Permission, expiresAt?: Date, permissionType?: string) => void;
  fetchPermission: () => Permission | null;
  removePermission: () => void;
  isLoading: boolean;
}

export const PermissionContext = createContext<PermissionContextType>({
  permission: null,
  permissionMetadata: { expiresAt: null, permissionType: null },
  savePermission: () => {},
  fetchPermission: () => null,
  removePermission: () => {},
  isLoading: false,
});

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

export const PermissionProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [permission, setPermission] = useState<Permission | null>(null);
  const [permissionMetadata, setPermissionMetadata] = useState<PermissionMetadata>({
    expiresAt: null,
    permissionType: null,
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { address: walletAddress } = useAccount();

  // Fetch existing permissions on wallet connection
  useEffect(() => {
    const fetchExistingPermissions = async () => {
      if (!walletAddress) {
        setPermission(null);
        setPermissionMetadata({ expiresAt: null, permissionType: null });
        return;
      }

      try {
        setIsLoading(true);
        const response = await fetch(`${BACKEND_URL}/permissions/user/${walletAddress.toLowerCase()}`);

        if (response.ok) {
          const permissions = await response.json();

          // Find the first active (non-expired, non-revoked) permission
          const activePermission = permissions.find((p: any) => {
            const now = new Date();
            const expiresAt = new Date(p.expiresAt);
            return expiresAt > now && !p.revokedAt;
          });

          if (activePermission && activePermission.permissionData) {
            // Convert the stored permission data back to the Permission type
            setPermission(activePermission.permissionData as Permission);
            setPermissionMetadata({
              expiresAt: new Date(activePermission.expiresAt),
              permissionType: activePermission.permissionType,
            });
            console.log('Loaded existing permission:', activePermission.permissionContext);
          }
        }
      } catch (err) {
        console.error('Error fetching permissions:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchExistingPermissions();
  }, [walletAddress]);

  // Saves the permission to state
  const savePermission = (perm: Permission, expiresAt?: Date, permissionType?: string) => {
    setPermission(perm);
    if (expiresAt || permissionType) {
      setPermissionMetadata({
        expiresAt: expiresAt || null,
        permissionType: permissionType || null,
      });
    }
  };

  // Fetches the permission from state
  const fetchPermission = () => {
    return permission;
  };

  // Removes the permission from state
  const removePermission = () => {
    setPermission(null);
    setPermissionMetadata({ expiresAt: null, permissionType: null });
  };

  return (
    <PermissionContext.Provider
      value={{
        permission,
        permissionMetadata,
        savePermission,
        fetchPermission,
        removePermission,
        isLoading,
      }}
    >
      {children}
    </PermissionContext.Provider>
  );
};

export const usePermissions = () => {
  return useContext(PermissionContext);
};
