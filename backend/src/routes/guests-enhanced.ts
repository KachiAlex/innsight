import { Router } from 'express';
import { AppError } from '../middleware/errorHandler';
import { authenticate, requireTenantAccess, AuthRequest } from '../middleware/auth';
import { db, toDate, toTimestamp, now } from '../utils/firestore';
import { getPaginationParams, createPaginationResult } from '../utils/pagination';
import admin from 'firebase-admin';

export const guestEnhancedRouter = Router({ mergeParams: true });

// ============================================
// GUEST CRUD OPERATIONS
// ============================================

// POST /api/tenants/:tenantId/guests - Create or update guest
guestEnhancedRouter.post(
  '/',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const guestData = req.body;

      // Validate required fields
      if (!guestData.name) {
        throw new AppError('Guest name is required', 400);
      }

      if (!guestData.email && !guestData.phone) {
        throw new AppError('Either email or phone is required', 400);
      }

      // Check if guest already exists
      let existingGuestId: string | null = null;
      if (guestData.email) {
        const emailQuery = await db.collection('guests')
          .where('tenantId', '==', tenantId)
          .where('email', '==', guestData.email.toLowerCase())
          .limit(1)
          .get();
        
        if (!emailQuery.empty) {
          existingGuestId = emailQuery.docs[0].id;
        }
      }

      if (!existingGuestId && guestData.phone) {
        const phoneQuery = await db.collection('guests')
          .where('tenantId', '==', tenantId)
          .where('phone', '==', guestData.phone)
          .limit(1)
          .get();
        
        if (!phoneQuery.empty) {
          existingGuestId = phoneQuery.docs[0].id;
        }
      }

      const timestamp = now();
      const guestRecord = {
        tenantId,
        name: guestData.name,
        email: guestData.email?.toLowerCase() || null,
        phone: guestData.phone || null,
        idNumber: guestData.idNumber || admin.firestore.FieldValue.delete(),
        dateOfBirth: guestData.dateOfBirth ? toTimestamp(new Date(guestData.dateOfBirth)) : admin.firestore.FieldValue.delete(),
        nationality: guestData.nationality || admin.firestore.FieldValue.delete(),
        address: guestData.address || admin.firestore.FieldValue.delete(),
        city: guestData.city || admin.firestore.FieldValue.delete(),
        state: guestData.state || admin.firestore.FieldValue.delete(),
        country: guestData.country || admin.firestore.FieldValue.delete(),
        postalCode: guestData.postalCode || admin.firestore.FieldValue.delete(),
        
        // Preferences
        preferredRoomType: guestData.preferredRoomType || admin.firestore.FieldValue.delete(),
        preferredFloor: guestData.preferredFloor || admin.firestore.FieldValue.delete(),
        smokingPreference: guestData.smokingPreference || false,
        bedPreference: guestData.bedPreference || admin.firestore.FieldValue.delete(),
        pillowPreference: guestData.pillowPreference || admin.firestore.FieldValue.delete(),
        
        // Dietary & Special
        dietaryRestrictions: guestData.dietaryRestrictions || [],
        allergies: guestData.allergies || [],
        specialRequests: guestData.specialRequests || admin.firestore.FieldValue.delete(),
        
        // Marketing
        marketingOptIn: guestData.marketingOptIn !== false,
        emailOptIn: guestData.emailOptIn !== false,
        smsOptIn: guestData.smsOptIn !== false,
        
        updatedAt: timestamp,
      };

      let guestId: string;
      if (existingGuestId) {
        // Update existing guest
        await db.collection('guests').doc(existingGuestId).update(guestRecord);
        guestId = existingGuestId;

        // Log activity
        await db.collection('guest_activity_logs').add({
          tenantId,
          guestId,
          activityType: 'profile_updated',
          title: 'Profile Updated',
          description: 'Guest profile information was updated',
          metadata: { updatedBy: req.user?.id },
          performedBy: req.user?.id || null,
          createdAt: timestamp,
        });
      } else {
        // Create new guest
        const newGuest = {
          ...guestRecord,
          loyaltyTier: 'bronze',
          loyaltyPoints: 0,
          totalStays: 0,
          totalNights: 0,
          totalSpent: 0,
          isVIP: false,
          isBanned: false,
          createdAt: timestamp,
        };

        const docRef = await db.collection('guests').add(newGuest);
        guestId = docRef.id;

        // Log activity
        await db.collection('guest_activity_logs').add({
          tenantId,
          guestId,
          activityType: 'profile_created',
          title: 'Profile Created',
          description: 'Guest profile was created',
          metadata: { createdBy: req.user?.id },
          performedBy: req.user?.id || null,
          createdAt: timestamp,
        });
      }

      // Fetch and return the guest
      const guestDoc = await db.collection('guests').doc(guestId).get();
      const guest = { id: guestDoc.id, ...guestDoc.data() };

      res.json({
        success: true,
        data: guest,
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Error creating/updating guest:', error);
      throw new AppError(
        `Failed to create/update guest: ${error.message || 'Unknown error'}`,
        500
      );
    }
  }
);

// GET /api/tenants/:tenantId/guests/:guestId - Get detailed guest profile
guestEnhancedRouter.get(
  '/:guestId',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const guestId = req.params.guestId;

      // Get guest document
      const guestDoc = await db.collection('guests').doc(guestId).get();

      if (!guestDoc.exists || guestDoc.data()?.tenantId !== tenantId) {
        throw new AppError('Guest not found', 404);
      }

      const guestData = guestDoc.data()!;

      // Get reservations for this guest
      const reservationsSnapshot = await db.collection('reservations')
        .where('tenantId', '==', tenantId)
        .where('guestId', '==', guestId)
        .orderBy('checkInDate', 'desc')
        .get();

      const reservations = await Promise.all(
        reservationsSnapshot.docs.map(async (doc) => {
          const resData = doc.data();
          const roomDoc = await db.collection('rooms').doc(resData.roomId).get();
          
          return {
            id: doc.id,
            ...resData,
            checkInDate: toDate(resData.checkInDate),
            checkOutDate: toDate(resData.checkOutDate),
            room: roomDoc.exists ? {
              roomNumber: roomDoc.data()?.roomNumber,
              roomType: roomDoc.data()?.roomType,
            } : null,
          };
        })
      );

      // Get activity logs
      const activityLogsSnapshot = await db.collection('guest_activity_logs')
        .where('tenantId', '==', tenantId)
        .where('guestId', '==', guestId)
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get();

      const activityLogs = activityLogsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: toDate(doc.data().createdAt),
      }));

      // Get notes
      const notesSnapshot = await db.collection('guest_notes')
        .where('tenantId', '==', tenantId)
        .where('guestId', '==', guestId)
        .orderBy('createdAt', 'desc')
        .get();

      const notes = notesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: toDate(doc.data().createdAt),
        updatedAt: toDate(doc.data().updatedAt),
      }));

      // Get loyalty transactions
      const loyaltyTransactionsSnapshot = await db.collection('loyalty_transactions')
        .where('tenantId', '==', tenantId)
        .where('guestId', '==', guestId)
        .orderBy('createdAt', 'desc')
        .limit(20)
        .get();

      const loyaltyTransactions = loyaltyTransactionsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: toDate(doc.data().createdAt),
      }));

      const guestProfile = {
        id: guestDoc.id,
        ...guestData,
        dateOfBirth: toDate(guestData.dateOfBirth),
        firstStayDate: toDate(guestData.firstStayDate),
        lastStayDate: toDate(guestData.lastStayDate),
        createdAt: toDate(guestData.createdAt),
        updatedAt: toDate(guestData.updatedAt),
        reservations,
        activityLogs,
        notes,
        loyaltyTransactions,
      };

      res.json({
        success: true,
        data: guestProfile,
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Error fetching guest profile:', error);
      throw new AppError(
        `Failed to fetch guest profile: ${error.message || 'Unknown error'}`,
        500
      );
    }
  }
);

// ============================================
// GUEST ACTIVITY LOGS
// ============================================

// POST /api/tenants/:tenantId/guests/:guestId/activity - Add activity log
guestEnhancedRouter.post(
  '/:guestId/activity',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const guestId = req.params.guestId;
      const { activityType, title, description, metadata } = req.body;

      if (!activityType || !title) {
        throw new AppError('Activity type and title are required', 400);
      }

      const timestamp = now();
      const activityLog = {
        tenantId,
        guestId,
        activityType,
        title,
        description: description || null,
        metadata: metadata || {},
        performedBy: req.user?.id || null,
        createdAt: timestamp,
      };

      const docRef = await db.collection('guest_activity_logs').add(activityLog);

      res.json({
        success: true,
        data: {
          id: docRef.id,
          ...activityLog,
          createdAt: toDate(timestamp),
        },
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Error adding activity log:', error);
      throw new AppError(
        `Failed to add activity log: ${error.message || 'Unknown error'}`,
        500
      );
    }
  }
);

// ============================================
// GUEST NOTES
// ============================================

// POST /api/tenants/:tenantId/guests/:guestId/notes - Add note
guestEnhancedRouter.post(
  '/:guestId/notes',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const guestId = req.params.guestId;
      const { noteType, note, isImportant, isPinned } = req.body;

      if (!note) {
        throw new AppError('Note content is required', 400);
      }

      const timestamp = now();
      const noteRecord = {
        tenantId,
        guestId,
        noteType: noteType || 'general',
        note,
        isImportant: isImportant || false,
        isPinned: isPinned || false,
        createdBy: req.user?.id || 'system',
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      const docRef = await db.collection('guest_notes').add(noteRecord);

      // Log activity
      await db.collection('guest_activity_logs').add({
        tenantId,
        guestId,
        activityType: 'note',
        title: 'Note Added',
        description: note.substring(0, 100),
        metadata: { noteId: docRef.id, noteType },
        performedBy: req.user?.id || null,
        createdAt: timestamp,
      });

      res.json({
        success: true,
        data: {
          id: docRef.id,
          ...noteRecord,
          createdAt: toDate(timestamp),
          updatedAt: toDate(timestamp),
        },
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Error adding note:', error);
      throw new AppError(
        `Failed to add note: ${error.message || 'Unknown error'}`,
        500
      );
    }
  }
);

// PUT /api/tenants/:tenantId/guests/:guestId/notes/:noteId - Update note
guestEnhancedRouter.put(
  '/:guestId/notes/:noteId',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const guestId = req.params.guestId;
      const noteId = req.params.noteId;
      const { note, isImportant, isPinned, noteType } = req.body;

      const noteDoc = await db.collection('guest_notes').doc(noteId).get();

      if (!noteDoc.exists || noteDoc.data()?.tenantId !== tenantId) {
        throw new AppError('Note not found', 404);
      }

      const updates: any = {
        updatedAt: now(),
      };

      if (note !== undefined) updates.note = note;
      if (isImportant !== undefined) updates.isImportant = isImportant;
      if (isPinned !== undefined) updates.isPinned = isPinned;
      if (noteType !== undefined) updates.noteType = noteType;

      await db.collection('guest_notes').doc(noteId).update(updates);

      const updatedDoc = await db.collection('guest_notes').doc(noteId).get();

      res.json({
        success: true,
        data: {
          id: updatedDoc.id,
          ...updatedDoc.data(),
          createdAt: toDate(updatedDoc.data()?.createdAt),
          updatedAt: toDate(updatedDoc.data()?.updatedAt),
        },
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Error updating note:', error);
      throw new AppError(
        `Failed to update note: ${error.message || 'Unknown error'}`,
        500
      );
    }
  }
);

// DELETE /api/tenants/:tenantId/guests/:guestId/notes/:noteId - Delete note
guestEnhancedRouter.delete(
  '/:guestId/notes/:noteId',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const noteId = req.params.noteId;

      const noteDoc = await db.collection('guest_notes').doc(noteId).get();

      if (!noteDoc.exists || noteDoc.data()?.tenantId !== tenantId) {
        throw new AppError('Note not found', 404);
      }

      await db.collection('guest_notes').doc(noteId).delete();

      res.json({
        success: true,
        message: 'Note deleted successfully',
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Error deleting note:', error);
      throw new AppError(
        `Failed to delete note: ${error.message || 'Unknown error'}`,
        500
      );
    }
  }
);

// ============================================
// LOYALTY MANAGEMENT
// ============================================

// POST /api/tenants/:tenantId/guests/:guestId/loyalty - Add loyalty points
guestEnhancedRouter.post(
  '/:guestId/loyalty',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const guestId = req.params.guestId;
      const { points, description, reservationId, metadata } = req.body;

      if (!points || points === 0) {
        throw new AppError('Points value is required', 400);
      }

      // Get guest document
      const guestDoc = await db.collection('guests').doc(guestId).get();

      if (!guestDoc.exists || guestDoc.data()?.tenantId !== tenantId) {
        throw new AppError('Guest not found', 404);
      }

      const guestData = guestDoc.data();
      const currentPoints = guestData?.loyaltyPoints || 0;
      const newPoints = currentPoints + points;

      // Determine new tier based on total points
      let newTier = 'bronze';
      // Get loyalty program settings or use defaults
      if (newPoints >= 5000) newTier = 'vip';
      else if (newPoints >= 1000) newTier = 'platinum';
      else if (newPoints >= 500) newTier = 'gold';
      else if (newPoints >= 100) newTier = 'silver';

      const timestamp = now();

      // Record transaction
      await db.collection('loyalty_transactions').add({
        tenantId,
        guestId,
        transactionType: points > 0 ? 'earned' : 'redeemed',
        points,
        balanceBefore: currentPoints,
        balanceAfter: newPoints,
        description: description || (points > 0 ? 'Points earned' : 'Points redeemed'),
        reservationId: reservationId || null,
        metadata: metadata || {},
        createdBy: req.user?.id || null,
        createdAt: timestamp,
      });

      // Update guest record
      await db.collection('guests').doc(guestId).update({
        loyaltyPoints: newPoints,
        loyaltyTier: newTier,
        updatedAt: timestamp,
      });

      // Log activity
      await db.collection('guest_activity_logs').add({
        tenantId,
        guestId,
        activityType: points > 0 ? 'loyalty_earned' : 'loyalty_redeemed',
        title: points > 0 ? 'Loyalty Points Earned' : 'Loyalty Points Redeemed',
        description: `${Math.abs(points)} points ${points > 0 ? 'earned' : 'redeemed'}`,
        metadata: { points, balanceAfter: newPoints, tier: newTier },
        performedBy: req.user?.id || null,
        createdAt: timestamp,
      });

      res.json({
        success: true,
        data: {
          points: newPoints,
          tier: newTier,
          transaction: {
            points,
            balanceBefore: currentPoints,
            balanceAfter: newPoints,
          },
        },
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Error adding loyalty points:', error);
      throw new AppError(
        `Failed to add loyalty points: ${error.message || 'Unknown error'}`,
        500
      );
    }
  }
);

// GET /api/tenants/:tenantId/guests/loyalty/program - Get loyalty program settings
guestEnhancedRouter.get(
  '/loyalty/program',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;

      const programSnapshot = await db.collection('loyalty_programs')
        .where('tenantId', '==', tenantId)
        .limit(1)
        .get();

      let program;
      if (programSnapshot.empty) {
        // Return default settings
        program = {
          isActive: true,
          programName: 'InnSight Rewards',
          pointsPerNight: 10,
          pointsPerCurrency: 1,
          silverThreshold: 100,
          goldThreshold: 500,
          platinumThreshold: 1000,
          vipThreshold: 5000,
          bronzeDiscount: 0,
          silverDiscount: 5,
          goldDiscount: 10,
          platinumDiscount: 15,
          vipDiscount: 20,
          pointsRedemptionRate: 100,
          minRedemptionPoints: 500,
          pointsExpiryMonths: null,
        };
      } else {
        const doc = programSnapshot.docs[0];
        program = {
          id: doc.id,
          ...doc.data(),
        };
      }

      res.json({
        success: true,
        data: program,
      });
    } catch (error: any) {
      console.error('Error fetching loyalty program:', error);
      throw new AppError(
        `Failed to fetch loyalty program: ${error.message || 'Unknown error'}`,
        500
      );
    }
  }
);

// PUT /api/tenants/:tenantId/guests/loyalty/program - Update loyalty program settings
guestEnhancedRouter.put(
  '/loyalty/program',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const programData = req.body;

      const programSnapshot = await db.collection('loyalty_programs')
        .where('tenantId', '==', tenantId)
        .limit(1)
        .get();

      const timestamp = now();
      const programRecord = {
        tenantId,
        ...programData,
        updatedAt: timestamp,
      };

      let programId: string;
      if (programSnapshot.empty) {
        // Create new program
        const docRef = await db.collection('loyalty_programs').add({
          ...programRecord,
          createdAt: timestamp,
        });
        programId = docRef.id;
      } else {
        // Update existing program
        programId = programSnapshot.docs[0].id;
        await db.collection('loyalty_programs').doc(programId).update(programRecord);
      }

      const updatedDoc = await db.collection('loyalty_programs').doc(programId).get();

      res.json({
        success: true,
        data: {
          id: updatedDoc.id,
          ...updatedDoc.data(),
        },
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Error updating loyalty program:', error);
      throw new AppError(
        `Failed to update loyalty program: ${error.message || 'Unknown error'}`,
        500
      );
    }
  }
);

// GET /api/tenants/:tenantId/guests - List all guests with enhanced filtering
guestEnhancedRouter.get(
  '/',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const { page, limit } = getPaginationParams(req);
      const { loyaltyTier, isVIP, search } = req.query;

      let query: admin.firestore.Query = db.collection('guests')
        .where('tenantId', '==', tenantId);

      // Apply filters
      if (loyaltyTier) {
        query = query.where('loyaltyTier', '==', loyaltyTier);
      }

      if (isVIP === 'true') {
        query = query.where('isVIP', '==', true);
      }

      // Execute query with error handling
      let snapshot;
      try {
        snapshot = await query.orderBy('lastStayDate', 'desc').get();
      } catch (error) {
        // If orderBy fails (e.g., no index or field doesn't exist), query without ordering
        console.warn('Failed to order by lastStayDate, fetching without ordering:', error);
        snapshot = await query.get();
      }

      let guests = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          dateOfBirth: toDate(data.dateOfBirth),
          firstStayDate: toDate(data.firstStayDate),
          lastStayDate: toDate(data.lastStayDate),
          createdAt: toDate(data.createdAt),
          updatedAt: toDate(data.updatedAt),
        };
      });

      // Client-side search filter
      if (search) {
        const searchLower = (search as string).toLowerCase();
        guests = guests.filter((guest: any) => 
          guest.name?.toLowerCase().includes(searchLower) ||
          guest.email?.toLowerCase().includes(searchLower) ||
          guest.phone?.includes(searchLower) ||
          guest.idNumber?.includes(searchLower)
        );
      }

      const total = guests.length;
      const skip = (page - 1) * limit;
      const paginatedGuests = guests.slice(skip, skip + limit);

      const result = createPaginationResult(paginatedGuests, total, page, limit);

      res.json({
        success: true,
        ...result,
      });
    } catch (error: any) {
      console.error('Error fetching guests:', error);
      throw new AppError(
        `Failed to fetch guests: ${error.message || 'Unknown error'}`,
        500
      );
    }
  }
);

