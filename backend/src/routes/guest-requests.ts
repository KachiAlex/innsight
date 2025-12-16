import { Router } from 'express';
import { AppError } from '../middleware/errorHandler';
import { authenticate, requireTenantAccess, AuthRequest } from '../middleware/auth';
import { db, toDate, toTimestamp, now } from '../utils/firestore';
import { getPaginationParams, createPaginationResult } from '../utils/pagination';
import admin from 'firebase-admin';

export const guestRequestsRouter = Router({ mergeParams: true });

// ============================================
// GUEST REQUESTS MANAGEMENT
// ============================================

// GET /api/tenants/:tenantId/guest-requests - List guest requests
guestRequestsRouter.get('/', authenticate, requireTenantAccess, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.params.tenantId;
    const { page, limit } = getPaginationParams(req);
    const { status, priority, requestType, assignedTo, roomNumber } = req.query;

    let query: admin.firestore.Query = db.collection('guest_requests')
      .where('tenantId', '==', tenantId);

    if (status) {
      query = query.where('status', '==', status);
    }

    if (priority) {
      query = query.where('priority', '==', priority);
    }

    if (requestType) {
      query = query.where('requestType', '==', requestType);
    }

    if (assignedTo) {
      query = query.where('assignedTo', '==', assignedTo);
    }

    // Note: Firestore doesn't support multiple where clauses on different fields for roomNumber
    // We'll filter client-side for now, or implement composite queries if needed

    const snapshot = await query
      .orderBy('createdAt', 'desc')
      .get();

    let requests = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: toDate(doc.data().createdAt),
      updatedAt: toDate(doc.data().updatedAt),
      estimatedCompletion: doc.data().estimatedCompletion ? toDate(doc.data().estimatedCompletion) : null,
      actualCompletion: doc.data().actualCompletion ? toDate(doc.data().actualCompletion) : null,
      lastGuestUpdate: doc.data().lastGuestUpdate ? toDate(doc.data().lastGuestUpdate) : null,
    }));

    // Client-side filtering for fields not supported by Firestore compound queries
    if (roomNumber) {
      requests = requests.filter((req: any) => req.roomNumber === roomNumber);
    }

    const total = requests.length;
    const skip = (page - 1) * limit;
    const paginatedRequests = requests.slice(skip, skip + limit);

    const result = createPaginationResult(paginatedRequests, total, page, limit);

    res.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error('Error fetching guest requests:', error);
    throw new AppError(
      `Failed to fetch guest requests: ${error.message || 'Unknown error'}`,
      500
    );
  }
});

// POST /api/tenants/:tenantId/guest-requests - Create guest request
guestRequestsRouter.post('/', authenticate, requireTenantAccess, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.params.tenantId;
    const requestData = req.body;

    // Validate required fields
    if (!requestData.title || !requestData.description) {
      throw new AppError('Title and description are required', 400);
    }

    if (!requestData.requestType || !['amenities', 'maintenance', 'housekeeping', 'concierge', 'other'].includes(requestData.requestType)) {
      throw new AppError('Valid request type is required', 400);
    }

    if (!requestData.priority || !['low', 'normal', 'high', 'urgent'].includes(requestData.priority)) {
      throw new AppError('Valid priority is required', 400);
    }

    // Generate request number
    const timestamp = now();
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
    const requestNumber = `GR-${dateStr}-${randomStr}`;

    const requestRecord = {
      tenantId,
      guestId: requestData.guestId || null,
      reservationId: requestData.reservationId || null,
      roomId: requestData.roomId || null,
      requestType: requestData.requestType,
      priority: requestData.priority,
      title: requestData.title,
      description: requestData.description,
      status: 'pending',
      guestName: requestData.guestName || null,
      guestPhone: requestData.guestPhone || null,
      guestEmail: requestData.guestEmail || null,
      roomNumber: requestData.roomNumber || null,
      assignedTo: requestData.assignedTo || null,
      department: requestData.department || null,
      estimatedCompletion: requestData.estimatedCompletion ? toTimestamp(new Date(requestData.estimatedCompletion)) : null,
      guestNotified: false,
      source: requestData.source || 'manual',
      tags: requestData.tags || [],
      createdBy: req.user?.id || 'system',
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const docRef = await db.collection('guest_requests').add(requestRecord);

    // Create initial status update
    await db.collection('guest_request_updates').add({
      tenantId,
      guestRequestId: docRef.id,
      previousStatus: null,
      newStatus: 'pending',
      updateType: 'status_change',
      notes: 'Request created',
      performedBy: req.user?.id || 'system',
      createdAt: timestamp,
    });

    // Log activity if guest is known
    if (requestData.guestId) {
      await db.collection('guest_activity_logs').add({
        tenantId,
        guestId: requestData.guestId,
        activityType: 'request',
        title: 'Service Request Created',
        description: requestData.title,
        metadata: { requestId: docRef.id, requestType: requestData.requestType },
        performedBy: req.user?.id || null,
        createdAt: timestamp,
      });
    }

    res.json({
      success: true,
      data: {
        id: docRef.id,
        requestNumber,
        ...requestRecord,
        createdAt: toDate(timestamp),
        updatedAt: toDate(timestamp),
        estimatedCompletion: requestRecord.estimatedCompletion ? toDate(requestRecord.estimatedCompletion) : null,
      },
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Error creating guest request:', error);
    throw new AppError(
      `Failed to create guest request: ${error.message || 'Unknown error'}`,
      500
    );
  }
});

// GET /api/tenants/:tenantId/guest-requests/:requestId - Get request details
guestRequestsRouter.get('/:requestId', authenticate, requireTenantAccess, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.params.tenantId;
    const requestId = req.params.requestId;

    const requestDoc = await db.collection('guest_requests').doc(requestId).get();

    if (!requestDoc.exists || requestDoc.data()?.tenantId !== tenantId) {
      throw new AppError('Guest request not found', 404);
    }

    // Get messages
    const messagesSnapshot = await db.collection('guest_request_messages')
      .where('tenantId', '==', tenantId)
      .where('guestRequestId', '==', requestId)
      .orderBy('createdAt', 'asc')
      .get();

    const messages = messagesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: toDate(doc.data().createdAt),
    }));

    // Get updates
    const updatesSnapshot = await db.collection('guest_request_updates')
      .where('tenantId', '==', tenantId)
      .where('guestRequestId', '==', requestId)
      .orderBy('createdAt', 'desc')
      .get();

    const updates = updatesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: toDate(doc.data().createdAt),
    }));

    const requestData = requestDoc.data();

    const request = {
      id: requestDoc.id,
      ...requestData,
      createdAt: toDate(requestData?.createdAt),
      updatedAt: toDate(requestData?.updatedAt),
      estimatedCompletion: requestData?.estimatedCompletion ? toDate(requestData.estimatedCompletion) : null,
      actualCompletion: requestData?.actualCompletion ? toDate(requestData.actualCompletion) : null,
      lastGuestUpdate: requestData?.lastGuestUpdate ? toDate(requestData.lastGuestUpdate) : null,
      messages,
      updates,
    };

    res.json({
      success: true,
      data: request,
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Error fetching guest request:', error);
    throw new AppError(
      `Failed to fetch guest request: ${error.message || 'Unknown error'}`,
      500
    );
  }
});

// PUT /api/tenants/:tenantId/guest-requests/:requestId - Update request
guestRequestsRouter.put('/:requestId', authenticate, requireTenantAccess, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.params.tenantId;
    const requestId = req.params.requestId;
    const updates = req.body;

    const requestDoc = await db.collection('guest_requests').doc(requestId).get();

    if (!requestDoc.exists || requestDoc.data()?.tenantId !== tenantId) {
      throw new AppError('Guest request not found', 404);
    }

    const currentData = requestDoc.data();
    const timestamp = now();

    // Track status changes
    if (updates.status && updates.status !== currentData?.status) {
      await db.collection('guest_request_updates').add({
        tenantId,
        guestRequestId: requestId,
        previousStatus: currentData?.status,
        newStatus: updates.status,
        updateType: 'status_change',
        notes: updates.statusNotes || `Status changed to ${updates.status}`,
        performedBy: req.user?.id || 'system',
        createdAt: timestamp,
      });

      // Set completion timestamp if completed
      if (updates.status === 'completed' && !currentData?.actualCompletion) {
        updates.actualCompletion = timestamp;
      }
    }

    // Track assignment changes
    if (updates.assignedTo && updates.assignedTo !== currentData?.assignedTo) {
      await db.collection('guest_request_updates').add({
        tenantId,
        guestRequestId: requestId,
        previousStatus: currentData?.status,
        newStatus: currentData?.status,
        updateType: 'assignment',
        notes: `Assigned to ${updates.assignedTo}`,
        performedBy: req.user?.id || 'system',
        createdAt: timestamp,
      });
    }

    const updatedData = {
      ...updates,
      updatedAt: timestamp,
    };

    // Handle date conversions
    if (updates.estimatedCompletion) {
      updatedData.estimatedCompletion = toTimestamp(new Date(updates.estimatedCompletion));
    }

    if (updates.lastGuestUpdate) {
      updatedData.lastGuestUpdate = toTimestamp(new Date(updates.lastGuestUpdate));
    }

    await db.collection('guest_requests').doc(requestId).update(updatedData);

    const updatedDoc = await db.collection('guest_requests').doc(requestId).get();
    const finalData = updatedDoc.data();

    res.json({
      success: true,
      data: {
        id: updatedDoc.id,
        ...finalData,
        createdAt: toDate(finalData?.createdAt),
        updatedAt: toDate(finalData?.updatedAt),
        estimatedCompletion: finalData?.estimatedCompletion ? toDate(finalData.estimatedCompletion) : null,
        actualCompletion: finalData?.actualCompletion ? toDate(finalData.actualCompletion) : null,
        lastGuestUpdate: finalData?.lastGuestUpdate ? toDate(finalData.lastGuestUpdate) : null,
      },
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Error updating guest request:', error);
    throw new AppError(
      `Failed to update guest request: ${error.message || 'Unknown error'}`,
      500
    );
  }
});

// POST /api/tenants/:tenantId/guest-requests/:requestId/messages - Add message
guestRequestsRouter.post('/:requestId/messages', authenticate, requireTenantAccess, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.params.tenantId;
    const requestId = req.params.requestId;
    const { message, messageType, isVisibleToGuest } = req.body;

    if (!message) {
      throw new AppError('Message content is required', 400);
    }

    const messageRecord = {
      tenantId,
      guestRequestId: requestId,
      message,
      messageType: messageType || 'note',
      isFromGuest: false,
      isVisibleToGuest: isVisibleToGuest || false,
      createdBy: req.user?.id || null,
      createdAt: now(),
    };

    const docRef = await db.collection('guest_request_messages').add(messageRecord);

    // Update request's last update timestamp
    await db.collection('guest_requests').doc(requestId).update({
      updatedAt: now(),
      lastGuestUpdate: messageRecord.isVisibleToGuest ? now() : undefined,
    });

    res.json({
      success: true,
      data: {
        id: docRef.id,
        ...messageRecord,
        createdAt: toDate(messageRecord.createdAt),
      },
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Error adding message:', error);
    throw new AppError(
      `Failed to add message: ${error.message || 'Unknown error'}`,
      500
    );
  }
});

// GET /api/tenants/:tenantId/guest-requests/stats/summary - Get request statistics
guestRequestsRouter.get('/stats/summary', authenticate, requireTenantAccess, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.params.tenantId;

    const requestsSnapshot = await db.collection('guest_requests')
      .where('tenantId', '==', tenantId)
      .get();

    const stats = {
      total: 0,
      pending: 0,
      inProgress: 0,
      completed: 0,
      urgent: 0,
      overdue: 0,
      averageResolutionTime: 0,
    };

    const now = new Date();
    let totalResolutionTime = 0;
    let completedCount = 0;

    requestsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      stats.total++;

      switch (data.status) {
        case 'pending':
          stats.pending++;
          break;
        case 'assigned':
        case 'in_progress':
          stats.inProgress++;
          break;
        case 'completed':
          stats.completed++;
          break;
      }

      if (data.priority === 'urgent') {
        stats.urgent++;
      }

      // Check for overdue items
      if (data.estimatedCompletion && data.status !== 'completed') {
        const estimated = toDate(data.estimatedCompletion);
        if (estimated && estimated < now) {
          stats.overdue++;
        }
      }

      // Calculate resolution time for completed items
      if (data.status === 'completed' && data.createdAt && data.actualCompletion) {
        const created = toDate(data.createdAt);
        const completed = toDate(data.actualCompletion);
        if (created && completed) {
          const resolutionTime = completed.getTime() - created.getTime();
          totalResolutionTime += resolutionTime;
          completedCount++;
        }
      }
    });

    if (completedCount > 0) {
      stats.averageResolutionTime = totalResolutionTime / completedCount / (1000 * 60 * 60); // Convert to hours
    }

    res.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    console.error('Error fetching request stats:', error);
    throw new AppError(
      `Failed to fetch request stats: ${error.message || 'Unknown error'}`,
      500
    );
  }
});
