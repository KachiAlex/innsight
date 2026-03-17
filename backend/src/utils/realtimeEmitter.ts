import { ws } from './websocket';

/**
 * Real-time event types for the PMS system
 */
export enum RealTimeEventType {
  // Room events
  ROOM_STATUS_CHANGED = 'room:status_changed',
  ROOM_UPDATED = 'room:updated',

  // Reservation events
  RESERVATION_CREATED = 'reservation:created',
  RESERVATION_UPDATED = 'reservation:updated',
  RESERVATION_CANCELLED = 'reservation:cancelled',
  RESERVATION_CHECKED_IN = 'reservation:checked_in',
  RESERVATION_CHECKED_OUT = 'reservation:checked_out',

  // Guest events
  GUEST_MESSAGE = 'guest:message',
  GUEST_REQUEST = 'guest:request',
  GUEST_FEEDBACK = 'guest:feedback',

  // Task events
  TASK_ASSIGNED = 'task:assigned',
  TASK_UPDATED = 'task:updated',
  TASK_COMPLETED = 'task:completed',

  // Payment events
  PAYMENT_RECEIVED = 'payment:received',
  REFUND_PROCESSED = 'refund:processed',
  INVOICE_DUE = 'invoice:due',

  // System events
  NOTIFICATION = 'system:notification',
  ALERT = 'system:alert',
  UPDATE = 'system:update',
}

export interface RealTimeEvent {
  type: RealTimeEventType;
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

class RealTimeEventEmitter {
  /**
   * Emit room status change
   */
  emitRoomStatusChanged(
    tenantId: string,
    roomId: string,
    oldStatus: string,
    newStatus: string,
    details?: any
  ) {
    const event: RealTimeEvent = {
      type: RealTimeEventType.ROOM_STATUS_CHANGED,
      tenantId,
      timestamp: Date.now(),
      data: {
        roomId,
        oldStatus,
        newStatus,
        ...details,
      },
      metadata: {
        roomId,
      },
    };

    this.emitEvent(event);
  }

  /**
   * Emit reservation check-in
   */
  emitReservationCheckIn(tenantId: string, reservationId: string, details?: any) {
    const event: RealTimeEvent = {
      type: RealTimeEventType.RESERVATION_CHECKED_IN,
      tenantId,
      timestamp: Date.now(),
      data: {
        reservationId,
        ...details,
      },
      metadata: {
        reservationId,
        priority: 'high',
      },
    };

    this.emitEvent(event);
  }

  /**
   * Emit reservation check-out
   */
  emitReservationCheckOut(tenantId: string, reservationId: string, details?: any) {
    const event: RealTimeEvent = {
      type: RealTimeEventType.RESERVATION_CHECKED_OUT,
      tenantId,
      timestamp: Date.now(),
      data: {
        reservationId,
        ...details,
      },
      metadata: {
        reservationId,
        priority: 'high',
      },
    };

    this.emitEvent(event);
  }

  /**
   * Emit new reservation
   */
  emitReservationCreated(tenantId: string, reservationId: string, details?: any) {
    const event: RealTimeEvent = {
      type: RealTimeEventType.RESERVATION_CREATED,
      tenantId,
      timestamp: Date.now(),
      data: {
        reservationId,
        ...details,
      },
      metadata: {
        reservationId,
        priority: 'medium',
      },
    };

    this.emitEvent(event);
  }

  /**
   * Emit guest request
   */
  emitGuestRequest(tenantId: string, requestId: string, details?: any) {
    const event: RealTimeEvent = {
      type: RealTimeEventType.GUEST_REQUEST,
      tenantId,
      timestamp: Date.now(),
      data: {
        requestId,
        ...details,
      },
      metadata: {
        priority: details?.priority || 'medium',
      },
    };

    this.emitEvent(event);
  }

  /**
   * Emit task assignment
   */
  emitTaskAssigned(tenantId: string, taskId: string, userId: string, details?: any) {
    const event: RealTimeEvent = {
      type: RealTimeEventType.TASK_ASSIGNED,
      tenantId,
      timestamp: Date.now(),
      data: {
        taskId,
        userId,
        ...details,
      },
      metadata: {
        userId,
        priority: 'medium',
      },
    };

    this.emitEvent(event);
  }

  /**
   * Emit payment received
   */
  emitPaymentReceived(tenantId: string, paymentId: string, amount: number, details?: any) {
    const event: RealTimeEvent = {
      type: RealTimeEventType.PAYMENT_RECEIVED,
      tenantId,
      timestamp: Date.now(),
      data: {
        paymentId,
        amount,
        ...details,
      },
      metadata: {
        priority: 'high',
      },
    };

    this.emitEvent(event);
  }

  /**
   * Emit notification
   */
  emitNotification(tenantId: string, title: string, message: string, priority: 'low' | 'medium' | 'high' | 'critical' = 'medium', details?: any) {
    const event: RealTimeEvent = {
      type: RealTimeEventType.NOTIFICATION,
      tenantId,
      timestamp: Date.now(),
      data: {
        title,
        message,
        ...details,
      },
      metadata: {
        priority,
      },
    };

    this.emitEvent(event);
  }

  /**
   * Emit critical alert
   */
  emitAlert(tenantId: string, title: string, message: string, details?: any) {
    const event: RealTimeEvent = {
      type: RealTimeEventType.ALERT,
      tenantId,
      timestamp: Date.now(),
      data: {
        title,
        message,
        ...details,
      },
      metadata: {
        priority: 'critical',
      },
    };

    this.emitEvent(event);
  }

  /**
   * Core event emission logic
   */
  private emitEvent(event: RealTimeEvent) {
    console.log(`📡 [${event.type}] Broadcasting to tenant: ${event.tenantId}`);

    // Broadcast to entire tenant
    ws.broadcastToTenant(event.tenantId, 'realtime:event', event);

    // Broadcast to room if specified
    if (event.metadata?.roomId) {
      ws.broadcastToRoom(event.metadata.roomId, 'realtime:event', event);
    }

    // Send to specific user if specified
    if (event.metadata?.userId) {
      ws.sendToUser(event.metadata.userId, 'realtime:event', event);
    }

    // Log for analytics/debugging
    this.logEvent(event);
  }

  /**
   * Log event for debugging and analytics
   */
  private logEvent(event: RealTimeEvent) {
    const logEntry = {
      timestamp: new Date(event.timestamp).toISOString(),
      type: event.type,
      tenantId: event.tenantId,
      priority: event.metadata?.priority || 'normal',
    };

    // In production, send to monitoring/logging service
    if (process.env.NODE_ENV === 'production') {
      // send to monitoring service
    }
  }
}

export const realtimeEmitter = new RealTimeEventEmitter();
