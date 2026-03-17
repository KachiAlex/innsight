import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { verifyToken } from './jwt';

interface SocketUser {
  userId: string;
  tenantId: string;
  email: string;
  role: string;
}

interface ConnectionContext {
  socket: Socket;
  user: SocketUser | null;
  rooms: Set<string>;
}

class WebSocketManager {
  private io: SocketIOServer | null = null;
  private connections = new Map<string, ConnectionContext>();
  private tenantConnections = new Map<string, Set<string>>();

  /**
   * Initialize WebSocket server
   */
  initializeServer(httpServer: HTTPServer, corsOrigin?: string) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: corsOrigin || 'http://localhost:5173',
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    });

    // Authentication middleware
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        if (!token) {
          return next(new Error('Authentication error: No token provided'));
        }

        const decoded = verifyToken(token);
        if (!decoded) {
          return next(new Error('Authentication error: Invalid token'));
        }

        socket.data.user = decoded;
        next();
      } catch (err: any) {
        next(new Error(`Authentication error: ${err.message}`));
      }
    });

    // Connection handler
    this.io.on('connection', (socket) => {
      this.handleConnection(socket);
    });

    console.log('✅ WebSocket server initialized on', httpServer.address());
    return this.io;
  }

  /**
   * Handle new client connection
   */
  private handleConnection(socket: Socket) {
    const userId = socket.data.user?.userId;
    const tenantId = socket.data.user?.tenantId;

    if (!userId || !tenantId) {
      socket.disconnect(true);
      return;
    }

    const context: ConnectionContext = {
      socket,
      user: socket.data.user,
      rooms: new Set(),
    };

    this.connections.set(socket.id, context);

    // Track tenant connections
    if (!this.tenantConnections.has(tenantId)) {
      this.tenantConnections.set(tenantId, new Set());
    }
    this.tenantConnections.get(tenantId)!.add(socket.id);

    console.log(`👤 Client connected: ${socket.id} (User: ${userId}, Tenant: ${tenantId})`);

    // Join tenant room (for broadcast messages)
    socket.join(`tenant:${tenantId}`);

    // Join user-specific room (for personal messages)
    socket.join(`user:${userId}`);

    // Handle room subscriptions
    socket.on('subscribe:room', (roomId: string) => {
      this.subscribeToRoom(socket, roomId);
    });

    socket.on('unsubscribe:room', (roomId: string) => {
      this.unsubscribeFromRoom(socket, roomId);
    });

    // Handle custom events
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: Date.now() });
    });

    // Disconnect handler
    socket.on('disconnect', () => {
      this.handleDisconnection(socket.id, tenantId);
    });

    // Error handler
    socket.on('error', (error) => {
      console.error(`❌ Socket error (${socket.id}):`, error);
    });

    // Emit connection confirmation
    socket.emit('connected', {
      socketId: socket.id,
      userId,
      tenantId,
      timestamp: Date.now(),
    });
  }

  /**
   * Handle client disconnection
   */
  private handleDisconnection(socketId: string, tenantId: string) {
    const context = this.connections.get(socketId);
    if (context) {
      this.connections.delete(socketId);
      console.log(`👤 Client disconnected: ${socketId}`);
    }

    const tenantSockets = this.tenantConnections.get(tenantId);
    if (tenantSockets) {
      tenantSockets.delete(socketId);
      if (tenantSockets.size === 0) {
        this.tenantConnections.delete(tenantId);
      }
    }
  }

  /**
   * Subscribe to room updates
   */
  private subscribeToRoom(socket: Socket, roomId: string) {
    const context = this.connections.get(socket.id);
    if (!context) return;

    context.rooms.add(roomId);
    socket.join(`room:${roomId}`);
    console.log(`📌 Socket ${socket.id} subscribed to room:${roomId}`);

    // Emit subscription confirmation
    socket.emit('room:subscribed', { roomId });
  }

  /**
   * Unsubscribe from room updates
   */
  private unsubscribeFromRoom(socket: Socket, roomId: string) {
    const context = this.connections.get(socket.id);
    if (!context) return;

    context.rooms.delete(roomId);
    socket.leave(`room:${roomId}`);
    console.log(`📌 Socket ${socket.id} unsubscribed from room:${roomId}`);

    socket.emit('room:unsubscribed', { roomId });
  }

  /**
   * Broadcast to all connected clients in a tenant
   */
  broadcast(tenantId: string, event: string, data: any) {
    if (!this.io) return;
    this.io.to(`tenant:${tenantId}`).emit(event, data);
  }

  /**
   * Broadcast to specific room subscribers
   */
  broadcastToRoom(roomId: string, event: string, data: any) {
    if (!this.io) return;
    this.io.to(`room:${roomId}`).emit(event, data);
  }

  /**
   * Send message to specific user
   */
  sendToUser(userId: string, event: string, data: any) {
    if (!this.io) return;
    this.io.to(`user:${userId}`).emit(event, data);
  }

  /**
   * Broadcast to specific tenant's currently connected users
   */
  broadcastToTenant(tenantId: string, event: string, data: any) {
    this.broadcast(tenantId, event, data);
  }

  /**
   * Get connected clients count for tenant
   */
  getTenantConnectionCount(tenantId: string): number {
    return this.tenantConnections.get(tenantId)?.size || 0;
  }

  /**
   * Get all connected clients for tenant
   */
  getTenantConnections(tenantId: string): string[] {
    return Array.from(this.tenantConnections.get(tenantId) || []);
  }

  /**
   * Get socket instance
   */
  getIO(): SocketIOServer | null {
    return this.io;
  }

  /**
   * Close connection
   */
  close() {
    if (this.io) {
      this.io.close();
      this.connections.clear();
      this.tenantConnections.clear();
      console.log('🔌 WebSocket server closed');
    }
  }
}

export const ws = new WebSocketManager();
