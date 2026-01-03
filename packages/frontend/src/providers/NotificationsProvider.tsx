'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react'
import { useAccount } from 'wagmi'
import { io, Socket } from 'socket.io-client'

interface ExecutionNotification {
  executionId: string
  txHash?: string
  error?: string
  timestamp: Date
}

interface NotificationsContextType {
  notifications: ExecutionNotification[]
  clearNotifications: () => void
  /** Increments whenever an execution event is received - use as a dependency to trigger refetches */
  executionUpdateTrigger: number
}

const NotificationsContext = createContext<NotificationsContextType>({
  notifications: [],
  clearNotifications: () => {},
  executionUpdateTrigger: 0,
})

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'

export const NotificationsProvider = ({
  children,
}: {
  children: React.ReactNode
}) => {
  const [notifications, setNotifications] = useState<ExecutionNotification[]>(
    [],
  )
  const [socket, setSocket] = useState<Socket | null>(null)
  const [executionUpdateTrigger, setExecutionUpdateTrigger] = useState(0)
  const { address: walletAddress } = useAccount()

  // Trigger a refresh for subscribed components
  const triggerUpdate = useCallback(() => {
    setExecutionUpdateTrigger((prev) => prev + 1)
  }, [])

  useEffect(() => {
    if (!walletAddress) {
      // Disconnect socket if wallet disconnected
      if (socket) {
        socket.disconnect()
        setSocket(null)
      }
      setNotifications([])
      return
    }

    // Connect to WebSocket server with userId
    const newSocket = io(BACKEND_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      auth: {
        userId: walletAddress.toLowerCase(),
      },
    })

    newSocket.on('connect', () => {
      console.log('WebSocket connected')
    })

    newSocket.on('disconnect', () => {
      console.log('WebSocket disconnected')
    })

    // Listen for execution completed events
    newSocket.on(
      'execution:completed',
      (data: { executionId: string; txHash: string; timestamp: string }) => {
        console.log('Execution completed:', data)
        setNotifications((prev) => [
          ...prev,
          {
            executionId: data.executionId,
            txHash: data.txHash,
            timestamp: new Date(data.timestamp),
          },
        ])
        // Trigger refresh for subscribed components
        triggerUpdate()
      },
    )

    // Listen for execution failed events
    newSocket.on(
      'execution:failed',
      (data: { executionId: string; error: string; timestamp: string }) => {
        console.log('Execution failed:', data)
        setNotifications((prev) => [
          ...prev,
          {
            executionId: data.executionId,
            error: data.error,
            timestamp: new Date(data.timestamp),
          },
        ])
        // Trigger refresh for subscribed components
        triggerUpdate()
      },
    )

    setSocket(newSocket)

    return () => {
      newSocket.disconnect()
    }
  }, [walletAddress, triggerUpdate])

  const clearNotifications = () => {
    setNotifications([])
  }

  return (
    <NotificationsContext.Provider
      value={{
        notifications,
        clearNotifications,
        executionUpdateTrigger,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  )
}

export const useNotifications = () => {
  return useContext(NotificationsContext)
}
