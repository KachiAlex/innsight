import { Router } from 'express';
import { AppError } from '../middleware/errorHandler';
import { authenticate, requireTenantAccess, AuthRequest } from '../middleware/auth';
import { db, toDate, toTimestamp, now } from '../utils/firestore';
import admin from 'firebase-admin';

export const overbookingRouter = Router({ mergeParams: true });

// ============================================
// OVERBOOKING SETTINGS
// ============================================

// GET /api/tenants/:tenantId/overbooking/settings - Get overbooking settings
overbookingRouter.get('/settings', authenticate, requireTenantAccess, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.params.tenantId;

    const settingsSnapshot = await db.collection('overbooking_settings')
      .where('tenantId', '==', tenantId)
      .get();

    const settings = settingsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      maxOverbookingPercent: Number(doc.data().maxOverbookingPercent || 10),
      alertThresholdPercent: Number(doc.data().alertThresholdPercent || 5),
      criticalThresholdPercent: Number(doc.data().criticalThresholdPercent || 8),
      createdAt: toDate(doc.data().createdAt),
      updatedAt: toDate(doc.data().updatedAt),
    }));

    res.json({
      success: true,
      data: settings,
    });
  } catch (error: any) {
    console.error('Error fetching overbooking settings:', error);
    throw new AppError(
      `Failed to fetch overbooking settings: ${error.message || 'Unknown error'}`,
      500
    );
  }
});

// POST /api/tenants/:tenantId/overbooking/settings - Create overbooking setting
overbookingRouter.post('/settings', authenticate, requireTenantAccess, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.params.tenantId;
    const settingData = req.body;

    // Validate required fields
    if (typeof settingData.maxOverbookingPercent !== 'number' ||
        settingData.maxOverbookingPercent < 0 || settingData.maxOverbookingPercent > 100) {
      throw new AppError('Max overbooking percentage must be between 0 and 100', 400);
    }

    // Check for existing setting for same room category/type
    let existingQuery = db.collection('overbooking_settings')
      .where('tenantId', '==', tenantId);

    if (settingData.roomCategoryId) {
      existingQuery = existingQuery.where('roomCategoryId', '==', settingData.roomCategoryId);
    } else {
      existingQuery = existingQuery.where('roomCategoryId', '==', null);
    }

    if (settingData.roomType) {
      existingQuery = existingQuery.where('roomType', '==', settingData.roomType);
    } else {
      existingQuery = existingQuery.where('roomType', '==', null);
    }

    const existingSnapshot = await existingQuery.limit(1).get();
    if (!existingSnapshot.empty) {
      throw new AppError('Overbooking setting already exists for this room category/type combination', 400);
    }

    const timestamp = now();
    const settingRecord = {
      tenantId,
      roomCategoryId: settingData.roomCategoryId || null,
      roomType: settingData.roomType || null,
      maxOverbookingPercent: settingData.maxOverbookingPercent,
      maxOverbookingCount: settingData.maxOverbookingCount || null,
      alertThresholdPercent: settingData.alertThresholdPercent || 5,
      criticalThresholdPercent: settingData.criticalThresholdPercent || 8,
      allowOverbooking: settingData.allowOverbooking !== false,
      requireManagerApproval: settingData.requireManagerApproval !== false,
      blackoutDates: settingData.blackoutDates ? settingData.blackoutDates.map((date: string) => toTimestamp(new Date(date))) : [],
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const docRef = await db.collection('overbooking_settings').add(settingRecord);

    res.json({
      success: true,
      data: {
        id: docRef.id,
        ...settingRecord,
        blackoutDates: settingRecord.blackoutDates.map(date => toDate(date)),
        createdAt: toDate(timestamp),
        updatedAt: toDate(timestamp),
      },
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Error creating overbooking setting:', error);
    throw new AppError(
      `Failed to create overbooking setting: ${error.message || 'Unknown error'}`,
      500
    );
  }
});

// PUT /api/tenants/:tenantId/overbooking/settings/:settingId - Update overbooking setting
overbookingRouter.put('/settings/:settingId', authenticate, requireTenantAccess, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.params.tenantId;
    const settingId = req.params.settingId;
    const updates = req.body;

    const settingDoc = await db.collection('overbooking_settings').doc(settingId).get();

    if (!settingDoc.exists || settingDoc.data()?.tenantId !== tenantId) {
      throw new AppError('Overbooking setting not found', 404);
    }

    const timestamp = now();
    const updatedData = {
      ...updates,
      updatedAt: timestamp,
    };

    // Handle blackout dates
    if (updates.blackoutDates) {
      updatedData.blackoutDates = updates.blackoutDates.map((date: string) => toTimestamp(new Date(date)));
    }

    await db.collection('overbooking_settings').doc(settingId).update(updatedData);

    const updatedDoc = await db.collection('overbooking_settings').doc(settingId).get();
    const settingData = updatedDoc.data();

    res.json({
      success: true,
      data: {
        id: updatedDoc.id,
        ...settingData,
        maxOverbookingPercent: Number(settingData?.maxOverbookingPercent || 10),
        alertThresholdPercent: Number(settingData?.alertThresholdPercent || 5),
        criticalThresholdPercent: Number(settingData?.criticalThresholdPercent || 8),
        blackoutDates: settingData?.blackoutDates?.map(date => toDate(date)) || [],
        createdAt: toDate(settingData?.createdAt),
        updatedAt: toDate(settingData?.updatedAt),
      },
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Error updating overbooking setting:', error);
    throw new AppError(
      `Failed to update overbooking setting: ${error.message || 'Unknown error'}`,
      500
    );
  }
});

// DELETE /api/tenants/:tenantId/overbooking/settings/:settingId - Delete overbooking setting
overbookingRouter.delete('/settings/:settingId', authenticate, requireTenantAccess, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.params.tenantId;
    const settingId = req.params.settingId;

    const settingDoc = await db.collection('overbooking_settings').doc(settingId).get();

    if (!settingDoc.exists || settingDoc.data()?.tenantId !== tenantId) {
      throw new AppError('Overbooking setting not found', 404);
    }

    await db.collection('overbooking_settings').doc(settingId).delete();

    res.json({
      success: true,
      message: 'Overbooking setting deleted successfully',
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Error deleting overbooking setting:', error);
    throw new AppError(
      `Failed to delete overbooking setting: ${error.message || 'Unknown error'}`,
      500
    );
  }
});

// ============================================
// OVERBOOKING MONITORING
// ============================================

// GET /api/tenants/:tenantId/overbooking/status - Get current overbooking status
overbookingRouter.get('/status', authenticate, requireTenantAccess, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.params.tenantId;
    const { date } = req.query;

    const targetDate = date ? new Date(date as string) : new Date();
    const dateStr = targetDate.toISOString().split('T')[0];

    // Get all reservations for the target date
    const reservationsSnapshot = await db.collection('reservations')
      .where('tenantId', '==', tenantId)
      .where('checkInDate', '<=', toTimestamp(targetDate))
      .where('checkOutDate', '>', toTimestamp(targetDate))
      .where('status', 'in', ['confirmed', 'checked_in'])
      .get();

    // Count reservations by room type
    const roomTypeBookings: Record<string, number> = {};
    const roomCategoryBookings: Record<string, number> = {};

    // Get room details for each reservation
    for (const resDoc of reservationsSnapshot.docs) {
      const resData = resDoc.data();
      const roomDoc = await db.collection('rooms').doc(resData.roomId).get();

      if (roomDoc.exists) {
        const roomData = roomDoc.data();
        const roomType = roomData?.roomType || 'unknown';
        const roomCategoryId = roomData?.categoryId;

        roomTypeBookings[roomType] = (roomTypeBookings[roomType] || 0) + 1;

        if (roomCategoryId) {
          roomCategoryBookings[roomCategoryId] = (roomCategoryBookings[roomCategoryId] || 0) + 1;
        }
      }
    }

    // Get room counts by type/category
    const roomsSnapshot = await db.collection('rooms').where('tenantId', '==', tenantId).get();
    const roomTypeCounts: Record<string, number> = {};
    const roomCategoryCounts: Record<string, number> = {};

    roomsSnapshot.docs.forEach(doc => {
      const roomData = doc.data();
      const roomType = roomData.roomType || 'unknown';
      const roomCategoryId = roomData.categoryId;

      roomTypeCounts[roomType] = (roomTypeCounts[roomType] || 0) + 1;

      if (roomCategoryId) {
        roomCategoryCounts[roomCategoryId] = (roomCategoryCounts[roomCategoryId] || 0) + 1;
      }
    });

    // Get overbooking settings
    const settingsSnapshot = await db.collection('overbooking_settings')
      .where('tenantId', '==', tenantId)
      .get();

    const settings = settingsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        roomType: data.roomType || null,
        roomCategoryId: data.roomCategoryId || null,
        maxOverbookingPercent: Number(data.maxOverbookingPercent || 10),
        alertThresholdPercent: Number(data.alertThresholdPercent || 5),
        criticalThresholdPercent: Number(data.criticalThresholdPercent || 8),
        allowOverbooking: data.allowOverbooking !== false,
        requireManagerApproval: data.requireManagerApproval !== false,
      };
    });

    // Calculate overbooking status
    const overbookingStatus: any[] = [];
    const alerts: any[] = [];

    // Check by room type
    for (const roomType of Object.keys(roomTypeCounts)) {
      const totalRooms = roomTypeCounts[roomType];
      const bookedRooms = roomTypeBookings[roomType] || 0;
      const overbookingCount = Math.max(0, bookedRooms - totalRooms);
      const overbookingPercent = totalRooms > 0 ? (overbookingCount / totalRooms) * 100 : 0;

      // Find applicable setting
      let applicableSetting = settings.find(s => s.roomType === roomType && !s.roomCategoryId);
      if (!applicableSetting) {
        applicableSetting = settings.find(s => !s.roomType && !s.roomCategoryId); // Default setting
      }

      let status: 'normal' | 'warning' | 'critical' = 'normal';
      let alertLevel: 'none' | 'alert' | 'critical' = 'none';

      if (applicableSetting) {
        const maxAllowed = applicableSetting.maxOverbookingPercent || 10;

        if (overbookingPercent >= applicableSetting.criticalThresholdPercent) {
          status = 'critical';
          alertLevel = 'critical';
        } else if (overbookingPercent >= applicableSetting.alertThresholdPercent) {
          status = 'warning';
          alertLevel = 'alert';
        }
      }

      overbookingStatus.push({
        type: 'room_type',
        roomType,
        totalRooms,
        bookedRooms,
        overbookingCount,
        overbookingPercent: Math.round(overbookingPercent * 100) / 100,
        status,
        setting: applicableSetting,
      });

      if (alertLevel !== 'none') {
        alerts.push({
          type: 'room_type',
          roomType,
          alertLevel,
          overbookingPercent: Math.round(overbookingPercent * 100) / 100,
          maxAllowed: applicableSetting?.maxOverbookingPercent || 10,
          date: dateStr,
        });
      }
    }

    res.json({
      success: true,
      data: {
        date: dateStr,
        overbookingStatus,
        alerts,
        summary: {
          totalAlerts: alerts.length,
          criticalAlerts: alerts.filter(a => a.alertLevel === 'critical').length,
          warningAlerts: alerts.filter(a => a.alertLevel === 'alert').length,
        },
      },
    });
  } catch (error: any) {
    console.error('Error checking overbooking status:', error);
    throw new AppError(
      `Failed to check overbooking status: ${error.message || 'Unknown error'}`,
      500
    );
  }
});

// ============================================
// OVERBOOKING ALERTS
// ============================================

// GET /api/tenants/:tenantId/overbooking/alerts - Get overbooking alerts
overbookingRouter.get('/alerts', authenticate, requireTenantAccess, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.params.tenantId;
    const { status, limit = 50 } = req.query;

    let query: admin.firestore.Query = db.collection('overbooking_alerts')
      .where('tenantId', '==', tenantId);

    if (status) {
      query = query.where('status', '==', status);
    }

    const alertsSnapshot = await query
      .orderBy('createdAt', 'desc')
      .limit(parseInt(limit as string))
      .get();

    const alerts = alertsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      date: toDate(doc.data().date),
      resolvedAt: doc.data().resolvedAt ? toDate(doc.data().resolvedAt) : null,
      createdAt: toDate(doc.data().createdAt),
      updatedAt: toDate(doc.data().updatedAt),
      overbookingPercent: Number(doc.data().overbookingPercent),
    }));

    res.json({
      success: true,
      data: alerts,
    });
  } catch (error: any) {
    console.error('Error fetching overbooking alerts:', error);
    throw new AppError(
      `Failed to fetch overbooking alerts: ${error.message || 'Unknown error'}`,
      500
    );
  }
});

// POST /api/tenants/:tenantId/overbooking/alerts/:alertId/resolve - Resolve overbooking alert
overbookingRouter.post('/alerts/:alertId/resolve', authenticate, requireTenantAccess, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.params.tenantId;
    const alertId = req.params.alertId;
    const { resolutionNotes } = req.body;

    const alertDoc = await db.collection('overbooking_alerts').doc(alertId).get();

    if (!alertDoc.exists || alertDoc.data()?.tenantId !== tenantId) {
      throw new AppError('Overbooking alert not found', 404);
    }

    const timestamp = now();
    await db.collection('overbooking_alerts').doc(alertId).update({
      status: 'resolved',
      resolvedAt: timestamp,
      resolvedBy: req.user?.id || null,
      resolutionNotes: resolutionNotes || null,
      updatedAt: timestamp,
    });

    const updatedDoc = await db.collection('overbooking_alerts').doc(alertId).get();

    res.json({
      success: true,
      data: {
        id: updatedDoc.id,
        ...updatedDoc.data(),
        date: toDate(updatedDoc.data()?.date),
        resolvedAt: toDate(updatedDoc.data()?.resolvedAt),
        createdAt: toDate(updatedDoc.data()?.createdAt),
        updatedAt: toDate(updatedDoc.data()?.updatedAt),
      },
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Error resolving overbooking alert:', error);
    throw new AppError(
      `Failed to resolve overbooking alert: ${error.message || 'Unknown error'}`,
      500
    );
  }
});

// ============================================
// WALK-IN GUEST MANAGEMENT
// ============================================

// POST /api/tenants/:tenantId/overbooking/walk-in - Handle walk-in guest
overbookingRouter.post('/walk-in', authenticate, requireTenantAccess, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.params.tenantId;
    const { roomId, guestName, guestEmail, guestPhone, specialRequests } = req.body;

    if (!roomId || !guestName) {
      throw new AppError('Room ID and guest name are required', 400);
    }

    // Check if room is available
    const roomDoc = await db.collection('rooms').doc(roomId).get();
    if (!roomDoc.exists || roomDoc.data()?.tenantId !== tenantId) {
      throw new AppError('Room not found', 404);
    }

    const roomData = roomDoc.data();
    if (roomData?.status !== 'available') {
      throw new AppError('Room is not available', 400);
    }

    const checkInDate = new Date();
    const checkOutDate = new Date();
    checkOutDate.setHours(23, 59, 59, 999); // End of day

    // Create walk-in reservation
    const reservationData = {
      tenantId,
      roomId,
      reservationNumber: `WI-${Date.now()}`,
      guestName,
      guestEmail: guestEmail || null,
      guestPhone: guestPhone || null,
      checkInDate: toTimestamp(checkInDate),
      checkOutDate: toTimestamp(checkOutDate),
      adults: 1,
      children: 0,
      status: 'checked_in',
      source: 'walk_in',
      rate: 0, // To be set by staff
      depositAmount: null,
      depositStatus: null,
      specialRequests: specialRequests || null,
      createdAt: now(),
      updatedAt: now(),
      checkedInAt: toTimestamp(checkInDate),
      checkedInBy: req.user?.id || null,
      createdBy: req.user?.id || 'system',
    };

    const reservationRef = await db.collection('reservations').add(reservationData);

    // Update room status
    await db.collection('rooms').doc(roomId).update({
      status: 'occupied',
      updatedAt: now(),
    });

    // Log activity
    await db.collection('room_logs').add({
      tenantId,
      roomId,
      type: 'walk_in_check_in',
      summary: `Walk-in guest ${guestName} checked in`,
      details: `Room assigned to walk-in guest. Special requests: ${specialRequests || 'None'}`,
      userId: req.user?.id || null,
      metadata: {
        reservationId: reservationRef.id,
        guestName,
        guestEmail,
        guestPhone,
      },
      createdAt: now(),
    });

    res.json({
      success: true,
      data: {
        reservationId: reservationRef.id,
        roomId,
        guestName,
        checkInDate: checkInDate.toISOString(),
        message: 'Walk-in guest checked in successfully',
      },
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Error handling walk-in guest:', error);
    throw new AppError(
      `Failed to handle walk-in guest: ${error.message || 'Unknown error'}`,
      500
    );
  }
});

// GET /api/tenants/:tenantId/overbooking/walk-in/availability - Get walk-in availability
overbookingRouter.get('/walk-in/availability', authenticate, requireTenantAccess, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.params.tenantId;
    const { roomType, floor } = req.query;

    let query: admin.firestore.Query = db.collection('rooms')
      .where('tenantId', '==', tenantId)
      .where('status', '==', 'available');

    if (roomType) {
      query = query.where('roomType', '==', roomType);
    }

    if (floor) {
      query = query.where('floor', '==', parseInt(floor as string));
    }

    const availableRoomsSnapshot = await query.get();
    const availableRooms = availableRoomsSnapshot.docs.map(doc => ({
      id: doc.id,
      roomNumber: doc.data().roomNumber,
      roomType: doc.data().roomType,
      floor: doc.data().floor,
      maxOccupancy: doc.data().maxOccupancy,
    }));

    res.json({
      success: true,
      data: {
        availableRooms,
        totalAvailable: availableRooms.length,
      },
    });
  } catch (error: any) {
    console.error('Error checking walk-in availability:', error);
    throw new AppError(
      `Failed to check walk-in availability: ${error.message || 'Unknown error'}`,
      500
    );
  }
});
