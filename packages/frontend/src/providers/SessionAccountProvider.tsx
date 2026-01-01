"use client";

import { createContext, useState, useContext, useEffect } from "react";
import { useAccount } from "wagmi";

interface SessionAccountContext {
  sessionAccountAddress: string | null,
  createSessionAccount: () => Promise<void>,
  isLoading: boolean,
  error: string | null,
}

export const SessionAccountContext = createContext<SessionAccountContext>({
  sessionAccountAddress: null,
  createSessionAccount: async () => { },
  isLoading: false,
  error: null,
});

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

export const SessionAccountProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [sessionAccountAddress, setSessionAccountAddress] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { address: walletAddress } = useAccount();

  // Fetch existing session account on wallet connection
  useEffect(() => {
    const fetchExistingSessionAccount = async () => {
      if (!walletAddress) {
        setSessionAccountAddress(null);
        return;
      }

      try {
        setIsLoading(true);
        const response = await fetch(`${BACKEND_URL}/session-accounts/${walletAddress.toLowerCase()}`);

        if (response.ok) {
          const data = await response.json();
          // Backend returns array of session accounts, get the first active one
          if (Array.isArray(data) && data.length > 0 && data[0].address) {
            setSessionAccountAddress(data[0].address);
            console.log('Loaded existing session account:', data[0].address);
          }
        }
      } catch (err) {
        console.error('Error fetching session account:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchExistingSessionAccount();
  }, [walletAddress]);

  const createSessionAccount = async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (!walletAddress) {
        throw new Error("Wallet not connected");
      }

      // Call backend API to create or get session account
      const response = await fetch(`${BACKEND_URL}/session-accounts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: walletAddress.toLowerCase(), // Use wallet address as userId
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create session account: ${response.statusText}`);
      }

      const data = await response.json();
      setSessionAccountAddress(data.address);
    } catch (err) {
      console.error("Error creating a session account:", err);
      setError(err instanceof Error ? err.message : "Failed to create a session account");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SessionAccountContext.Provider
      value={{
        sessionAccountAddress,
        createSessionAccount,
        isLoading,
        error,
      }}
    >
      {children}
    </SessionAccountContext.Provider>
  );
};

export const useSessionAccount = () => {
  return useContext(SessionAccountContext);
};
