import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';

export interface WebSocketEvent<T = any> {
  event: string;
  site_id?: string;
  timestamp: string;
  data: T;
}

type EventCallback = (event: WebSocketEvent) => void;

interface WebSocketContextType {
  isConnected: boolean;
  subscribe: (eventType: string, callback: EventCallback) => () => void;
  sendMessage: (msg: string) => void;
}

const WebSocketContext = createContext<WebSocketContextType>({
  isConnected: false,
  subscribe: () => () => {},
  sendMessage: () => {},
});

interface WebSocketProviderProps {
  children: React.ReactNode;
  siteId?: string;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ children, siteId }) => {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const subscribersRef = useRef<Map<string, Set<EventCallback>>>(new Map());
  const reconnectTimeoutRef = useRef<any>(null);

  const connect = useCallback(() => {
    // Determine backend WS URL
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    // Default to port 8000 for backend if running vite dev on 5173
    const backendPort = '8000';
    const sitePath = siteId && siteId !== 'all' ? `/${siteId}` : '';
    const url = `${protocol}//${host}:${backendPort}/api/v1/ws${sitePath}`;

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        console.log(`[WebSocket] Connected to ${url}`);
      };

      ws.onmessage = (event) => {
        try {
          if (event.data === 'pong') return;
          const payload: WebSocketEvent = JSON.parse(event.data);
          
          // Trigger listeners for this event type
          const listeners = subscribersRef.current.get(payload.event);
          if (listeners) {
            listeners.forEach((cb) => {
              try {
                cb(payload);
              } catch (err) {
                console.error(`[WebSocket] Listener error for ${payload.event}:`, err);
              }
            });
          }

          // Trigger wildcard '*' listeners
          const wildcardListeners = subscribersRef.current.get('*');
          if (wildcardListeners) {
            wildcardListeners.forEach((cb) => {
              try {
                cb(payload);
              } catch (err) {
                console.error('[WebSocket] Wildcard listener error:', err);
              }
            });
          }
        } catch (parseErr) {
          // Non-JSON message, ignore or log
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        console.log('[WebSocket] Connection closed. Reconnecting in 3s...');
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 3000);
      };

      ws.onerror = (err) => {
        console.warn('[WebSocket] Connection error:', err);
        ws.close();
      };
    } catch (e) {
      console.error('[WebSocket] Failed to initialize WebSocket:', e);
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 3000);
    }
  }, [siteId]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  // Keep-alive ping every 25 seconds
  useEffect(() => {
    const pingInterval = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send('ping');
      }
    }, 25000);
    return () => clearInterval(pingInterval);
  }, []);

  const subscribe = useCallback((eventType: string, callback: EventCallback) => {
    if (!subscribersRef.current.has(eventType)) {
      subscribersRef.current.set(eventType, new Set());
    }
    subscribersRef.current.get(eventType)!.add(callback);

    // Return cleanup function to unsubscribe
    return () => {
      const set = subscribersRef.current.get(eventType);
      if (set) {
        set.delete(callback);
        if (set.size === 0) {
          subscribersRef.current.delete(eventType);
        }
      }
    };
  }, []);

  const sendMessage = useCallback((msg: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(msg);
    }
  }, []);

  return (
    <WebSocketContext.Provider value={{ isConnected, subscribe, sendMessage }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  return useContext(WebSocketContext);
};
