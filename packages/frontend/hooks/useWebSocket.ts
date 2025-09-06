'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export function useWebSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';
    
    const newSocket = io(wsUrl, {
      transports: ['websocket'],
      timeout: 20000,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    newSocket.on('connect', () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      setError(null);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      setIsConnected(false);
    });

    newSocket.on('connect_error', (err) => {
      console.error('WebSocket connection error:', err);
      setError(err.message);
      setIsConnected(false);
    });

    newSocket.on('reconnect', (attemptNumber) => {
      console.log('WebSocket reconnected after', attemptNumber, 'attempts');
      setIsConnected(true);
      setError(null);
    });

    newSocket.on('reconnect_error', (err) => {
      console.error('WebSocket reconnection error:', err);
      setError(err.message);
    });

    newSocket.on('reconnect_failed', () => {
      console.error('WebSocket reconnection failed');
      setError('Failed to reconnect to server');
      setIsConnected(false);
    });

    setSocket(newSocket);

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      newSocket.close();
    };
  }, []);

  const subscribeToBond = (bondId: number) => {
    if (socket && isConnected) {
      socket.emit('subscribe', { type: 'bond', id: bondId });
    }
  };

  const unsubscribeFromBond = (bondId: number) => {
    if (socket && isConnected) {
      socket.emit('unsubscribe', { type: 'bond', id: bondId });
    }
  };

  const subscribeToOrderBook = (bondId: number) => {
    if (socket && isConnected) {
      socket.emit('subscribe', { type: 'orderbook', id: bondId });
    }
  };

  const unsubscribeFromOrderBook = (bondId: number) => {
    if (socket && isConnected) {
      socket.emit('unsubscribe', { type: 'orderbook', id: bondId });
    }
  };

  const subscribeToTrades = (bondId: number) => {
    if (socket && isConnected) {
      socket.emit('subscribe', { type: 'trades', id: bondId });
    }
  };

  const unsubscribeFromTrades = (bondId: number) => {
    if (socket && isConnected) {
      socket.emit('unsubscribe', { type: 'trades', id: bondId });
    }
  };

  return {
    socket,
    isConnected,
    error,
    subscribeToBond,
    unsubscribeFromBond,
    subscribeToOrderBook,
    unsubscribeFromOrderBook,
    subscribeToTrades,
    unsubscribeFromTrades,
  };
}
