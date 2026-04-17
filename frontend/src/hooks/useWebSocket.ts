import { useEffect, useRef, useCallback, useState } from 'react';
import { io } from 'socket.io-client';
import type { Socket, ManagerOptions, SocketOptions } from 'socket.io-client';
import toast from 'react-hot-toast';

export interface RealTimeEvent {
  type: string;
  tenantId: string;
  timestamp: number;
  data: Record<string, any>;
  metadata?: {
    userId?: string;
    roomId?: string;
    reservationId?: string;
    priority?: 'low' | 'medium' | 'high' | 'critical';
  };
}

interface UseWebSocketOptions {
  token?: string;
  enabled?: boolean;
  autoReconnect?: boolean;
  onEvent?: (event: RealTimeEvent) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (error: string) => void;
}

/**
 * WebSocket Hook - Connect to real-time updates
 */
export const useWebSocket = (options: UseWebSocketOptions = {}) => {
  const {
    token,
    enabled = true,
    autoReconnect = true,
    onEvent,
    onConnected,
    onDisconnected,
    onError,
  } = options;

  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [socketId, setSocketId] = useState<string | null>(null);

  // Initialize connection
  useEffect(() => {
    if (!enabled || !token) return;

    try {
      const baseUrl = import.meta.env.VITE_API_URL || process.env.REACT_APP_API_URL || 'http://localhost:3001';
      const connectionOptions: Partial<ManagerOptions & SocketOptions> = {
        auth: { token },
        reconnection: autoReconnect,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5,
        transports: ['websocket', 'polling'],
      };

      socketRef.current = io(baseUrl, connectionOptions);

      // Connection handlers
      socketRef.current.on('connect', () => {
        console.log('✅ WebSocket connected:', socketRef.current?.id);
        setIsConnected(true);
        onConnected?.();
      });

      socketRef.current.on('connected', (data: any) => {
        console.log('👤 Connected to server:', data);
        setSocketId(data.socketId);
      });

      socketRef.current.on('disconnect', () => {
        console.log('❌ WebSocket disconnected');
        setIsConnected(false);
        onDisconnected?.();
      });

      // Real-time event handler
      socketRef.current.on('realtime:event', (event: RealTimeEvent) => {
        console.log('📡 Received event:', event.type);
        onEvent?.(event);
      });

      // Room subscription handlers
      socketRef.current.on('room:subscribed', (data: any) => {
        console.log('📌 Subscribed to room:', data.roomId);
      });

      socketRef.current.on('room:unsubscribed', (data: any) => {
        console.log('📌 Unsubscribed from room:', data.roomId);
      });

      // Error handler
      socketRef.current.on('connect_error', (error: any) => {
        console.error('❌ Connection error:', error);
        onError?.(error.message);
      });

      socketRef.current.on('error', (error: any) => {
        console.error('❌ Socket error:', error);
        onError?.(error);
      });

    } catch (error) {
      console.error('Failed to initialize WebSocket:', error);
      onError?.((error as Error).message);
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [enabled, token, autoReconnect, onEvent, onConnected, onDisconnected, onError]);

  // Subscribe to room
  const subscribeToRoom = useCallback((roomId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('subscribe:room', roomId);
    }
  }, []);

  // Unsubscribe from room
  const unsubscribeFromRoom = useCallback((roomId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('unsubscribe:room', roomId);
    }
  }, []);

  // Send custom event
  const emit = useCallback((event: string, data?: any) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data);
    }
  }, []);

  // Listen to custom event
  const on = useCallback((event: string, callback: (data: any) => void) => {
    if (socketRef.current) {
      socketRef.current.on(event, callback);
    }
  }, []);

  // Stop listening to event
  const off = useCallback((event: string) => {
    if (socketRef.current) {
      socketRef.current.off(event);
    }
  }, []);

  return {
    socket: socketRef.current,
    isConnected,
    socketId,
    subscribeToRoom,
    unsubscribeFromRoom,
    emit,
    on,
    off,
  };
};

/**
 * Hook to handle specific real-time event type
 */
export const useRealTimeEvent = (
  eventType: string,
  callback: (event: RealTimeEvent) => void,
  enabled = true
) => {
  const handleEvent = useCallback((event: RealTimeEvent) => {
    if (event.type === eventType && enabled) {
      callback(event);
    }
  }, [eventType, callback, enabled]);

  const { on, off } = useWebSocket({ onEvent: handleEvent });

  useEffect(() => {
    if (enabled) {
      on('realtime:event', handleEvent);
    }

    return () => {
      off('realtime:event');
    };
  }, [enabled, eventType, handleEvent, on, off]);
};

/**
 * Hook for room-specific real-time updates
 */
export const useRoomUpdates = (
  roomId: string | null,
  callback: (event: RealTimeEvent) => void,
  enabled = true
) => {
  const { subscribeToRoom, unsubscribeFromRoom } = useWebSocket();

  useEffect(() => {
    if (enabled && roomId) {
      subscribeToRoom(roomId);
    }

    return () => {
      if (roomId) {
        unsubscribeFromRoom(roomId);
      }
    };
  }, [roomId, enabled, subscribeToRoom, unsubscribeFromRoom]);

  useRealTimeEvent('room:status_changed', callback, enabled && !!roomId);
};

/**
 * Toast notification generator from real-time events
 */
export const useRealtimeNotifications = () => {
  const handleEvent = useCallback((event: RealTimeEvent) => {
    const priority = event.metadata?.priority || 'medium';

    switch (event.type) {
      case 'room:status_changed':
        toast.success(`Room ${event.data.roomId}: ${event.data.newStatus}`, {
          duration: 3000,
        });
        break;

      case 'reservation:checked_in':
        toast.success(`Guest checked in to room ${event.data.roomId}`, {
          duration: 4000,
        });
        break;

      case 'reservation:checked_out':
        toast.success(`Room ${event.data.roomId} is now checked out`, {
          duration: 3000,
        });
        break;

      case 'guest:request':
        const priorityIcon = priority === 'critical' ? '🚨' : priority === 'high' ? '⚠️' : 'ℹ️';
        toast(`${priorityIcon} Guest request: ${event.data.type || 'New request'}`, {
          duration: priority === 'critical' ? 10000 : 5000,
        });
        break;

      case 'task:assigned':
        toast.success(`New task assigned: ${event.data.taskType || 'Task'}`, {
          duration: 4000,
        });
        break;

      case 'payment:received':
        toast.success(`Payment received: ${event.data.currency || '$'}${event.data.amount}`, {
          duration: 3000,
        });
        break;

      case 'system:alert':
        toast.error(`⚠️ Alert: ${event.data.message}`, {
          duration: 10000,
        });
        break;

      case 'system:notification':
        toast(`${event.data.title}: ${event.data.message}`, {
          duration: 5000,
        });
        break;

      default:
        break;
    }
  }, []);

  useWebSocket({ onEvent: handleEvent });
};
