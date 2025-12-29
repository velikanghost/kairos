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

interface PermissionContextType {
  permission: Permission | null;
  savePermission: (permission: Permission) => void;
  fetchPermission: () => Permission | null;
  removePermission: () => void;
  isLoading: boolean;
}

export const PermissionContext = createContext<PermissionContextType>({
  permission: null,
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
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { address: walletAddress } = useAccount();

  // Fetch existing permissions on wallet connection
  useEffect(() => {
    const fetchExistingPermissions = async () => {
      if (!walletAddress) {
        setPermission(null);
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

  // Saves the permission to state and backend
  const savePermission = (permisison: Permission) => {
    setPermission(permisison);
  };

  // Fetches the permission from state
  const fetchPermission = () => {
    return permission;
  };

  // Removes the permission from state
  const removePermission = () => {
    setPermission(null);
  };

  return (
    <PermissionContext.Provider
      value={{
        permission,
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
