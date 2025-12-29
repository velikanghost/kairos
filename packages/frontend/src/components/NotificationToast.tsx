"use client";

import { useEffect } from "react";
import { useNotifications } from "@/providers/NotificationsProvider";

export default function NotificationToast() {
  const { notifications, clearNotifications } = useNotifications();

  // Auto-clear notifications after 10 seconds
  useEffect(() => {
    if (notifications.length > 0) {
      const timer = setTimeout(() => {
        clearNotifications();
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [notifications, clearNotifications]);

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-md">
      {notifications.map((notification, index) => (
        <div
          key={`${notification.executionId}-${index}`}
          className={`p-4 rounded-lg shadow-lg ${
            notification.error
              ? "bg-red-50 border-2 border-red-500"
              : "bg-green-50 border-2 border-green-500"
          }`}
        >
          <div className="flex items-start">
            <div className="flex-1">
              <h3
                className={`font-semibold ${
                  notification.error ? "text-red-800" : "text-green-800"
                }`}
              >
                {notification.error ? "❌ Execution Failed" : "✅ Execution Successful"}
              </h3>

              {notification.error && (
                <div className="mt-2 text-sm text-red-700">
                  <p className="font-medium">Error:</p>
                  <p className="break-words">
                    {notification.error.includes("transfer-amount-exceeded")
                      ? "⚠️ Daily ETH allowance exceeded. Please grant more permissions with a higher ETH amount."
                      : notification.error.includes("invalid-calldata")
                      ? "⚠️ Invalid transaction. The permission may not allow this type of operation."
                      : notification.error}
                  </p>
                </div>
              )}

              {notification.txHash && (
                <div className="mt-2 text-sm text-green-700">
                  <p className="font-medium">Transaction Hash:</p>
                  <a
                    href={`https://sepolia.etherscan.io/tx/${notification.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline break-all"
                  >
                    {notification.txHash}
                  </a>
                </div>
              )}

              <p className="mt-1 text-xs text-gray-600">
                {notification.timestamp.toLocaleTimeString()}
              </p>
            </div>

            <button
              onClick={() => {
                clearNotifications();
              }}
              className="ml-4 text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
