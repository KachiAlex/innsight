import { Router } from 'express';
import { AppError } from '../middleware/errorHandler';
import { authenticate, requireTenantAccess, AuthRequest } from '../middleware/auth';
import { db, toDate, toTimestamp, now } from '../utils/firestore';
import { getPaginationParams, createPaginationResult } from '../utils/pagination';
import admin from 'firebase-admin';

export const lostFoundRouter = Router({ mergeParams: true });

// ============================================
// LOST & FOUND MANAGEMENT
// ============================================

// GET /api/tenants/:tenantId/lost-found - List lost items
lostFoundRouter.get('/', authenticate, requireTenantAccess, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.params.tenantId;
    const { page, limit } = getPaginationParams(req);
    const { status, category, search, foundAfter, foundBefore } = req.query;

    let query: admin.firestore.Query = db.collection('lost_items')
      .where('tenantId', '==', tenantId);

    if (status) {
      query = query.where('status', '==', status);
    }

    if (category) {
      query = query.where('category', '==', category);
    }

    if (foundAfter) {
      query = query.where('foundAt', '>=', toTimestamp(new Date(foundAfter as string)));
    }

    if (foundBefore) {
      query = query.where('foundAt', '<=', toTimestamp(new Date(foundBefore as string)));
    }

    const snapshot = await query.orderBy('foundAt', 'desc').get();

    let items = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      foundAt: toDate(doc.data().foundAt),
      reportedAt: doc.data().reportedAt ? toDate(doc.data().reportedAt) : null,
      claimedAt: doc.data().claimedAt ? toDate(doc.data().claimedAt) : null,
      disposedAt: doc.data().disposedAt ? toDate(doc.data().disposedAt) : null,
      createdAt: toDate(doc.data().createdAt),
      updatedAt: toDate(doc.data().updatedAt),
      value: doc.data().value ? Number(doc.data().value) : null,
    }));

    // Client-side search filtering
    if (search) {
      const searchLower = (search as string).toLowerCase();
      items = items.filter((item: any) =>
        item.itemName?.toLowerCase().includes(searchLower) ||
        item.description?.toLowerCase().includes(searchLower) ||
        item.brand?.toLowerCase().includes(searchLower) ||
        item.itemNumber?.toLowerCase().includes(searchLower) ||
        item.reportedByName?.toLowerCase().includes(searchLower)
      );
    }

    const total = items.length;
    const skip = (page - 1) * limit;
    const paginatedItems = items.slice(skip, skip + limit);

    const result = createPaginationResult(paginatedItems, total, page, limit);

    res.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error('Error fetching lost items:', error);
    throw new AppError(
      `Failed to fetch lost items: ${error.message || 'Unknown error'}`,
      500
    );
  }
});

// POST /api/tenants/:tenantId/lost-found - Register found item
lostFoundRouter.post('/', authenticate, requireTenantAccess, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.params.tenantId;
    const itemData = req.body;

    // Validate required fields
    if (!itemData.itemName || !itemData.foundLocation) {
      throw new AppError('Item name and found location are required', 400);
    }

    if (!itemData.category || !['electronics', 'clothing', 'jewelry', 'documents', 'other'].includes(itemData.category)) {
      throw new AppError('Valid category is required', 400);
    }

    // Generate item number
    const timestamp = now();
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const sequence = Math.floor(Math.random() * 9999) + 1;
    const itemNumber = `LF-${dateStr}-${sequence.toString().padStart(4, '0')}`;

    const itemRecord = {
      tenantId,
      itemNumber,
      itemName: itemData.itemName,
      description: itemData.description || '',
      category: itemData.category,
      color: itemData.color || null,
      brand: itemData.brand || null,
      serialNumber: itemData.serialNumber || null,
      value: itemData.value ? Number(itemData.value) : null,
      foundLocation: itemData.foundLocation,
      foundBy: req.user?.id || null,
      foundAt: toTimestamp(new Date(itemData.foundAt || new Date())),
      circumstances: itemData.circumstances || null,
      storageLocation: itemData.storageLocation || null,
      storageNotes: itemData.storageNotes || null,
      status: 'unclaimed',
      createdBy: req.user?.id || 'system',
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const docRef = await db.collection('lost_items').add(itemRecord);

    res.json({
      success: true,
      data: {
        id: docRef.id,
        ...itemRecord,
        foundAt: toDate(itemRecord.foundAt),
        createdAt: toDate(timestamp),
        updatedAt: toDate(timestamp),
      },
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Error registering lost item:', error);
    throw new AppError(
      `Failed to register lost item: ${error.message || 'Unknown error'}`,
      500
    );
  }
});

// GET /api/tenants/:tenantId/lost-found/:itemId - Get item details
lostFoundRouter.get('/:itemId', authenticate, requireTenantAccess, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.params.tenantId;
    const itemId = req.params.itemId;

    const itemDoc = await db.collection('lost_items').doc(itemId).get();

    if (!itemDoc.exists || itemDoc.data()?.tenantId !== tenantId) {
      throw new AppError('Lost item not found', 404);
    }

    const itemData = itemDoc.data();

    const item = {
      id: itemDoc.id,
      ...itemData,
      foundAt: toDate(itemData?.foundAt),
      reportedAt: itemData?.reportedAt ? toDate(itemData.reportedAt) : null,
      claimedAt: itemData?.claimedAt ? toDate(itemData.claimedAt) : null,
      disposedAt: itemData?.disposedAt ? toDate(itemData.disposedAt) : null,
      createdAt: toDate(itemData?.createdAt),
      updatedAt: toDate(itemData?.updatedAt),
      value: itemData?.value ? Number(itemData.value) : null,
    };

    res.json({
      success: true,
      data: item,
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Error fetching lost item:', error);
    throw new AppError(
      `Failed to fetch lost item: ${error.message || 'Unknown error'}`,
      500
    );
  }
});

// PUT /api/tenants/:tenantId/lost-found/:itemId - Update item
lostFoundRouter.put('/:itemId', authenticate, requireTenantAccess, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.params.tenantId;
    const itemId = req.params.itemId;
    const updates = req.body;

    const itemDoc = await db.collection('lost_items').doc(itemId).get();

    if (!itemDoc.exists || itemDoc.data()?.tenantId !== tenantId) {
      throw new AppError('Lost item not found', 404);
    }

    const currentData = itemDoc.data();
    const timestamp = now();

    const updatedData = {
      ...updates,
      updatedAt: timestamp,
    };

    // Handle date conversions
    if (updates.reportedAt) {
      updatedData.reportedAt = toTimestamp(new Date(updates.reportedAt));
    }

    if (updates.claimedAt) {
      updatedData.claimedAt = toTimestamp(new Date(updates.claimedAt));
    }

    if (updates.disposedAt) {
      updatedData.disposedAt = toTimestamp(new Date(updates.disposedAt));
    }

    await db.collection('lost_items').doc(itemId).update(updatedData);

    // Log activity if status changed
    if (updates.status && updates.status !== currentData?.status) {
      const activityType = updates.status === 'claimed' ? 'item_claimed' :
                          updates.status === 'returned' ? 'item_returned' :
                          updates.status === 'disposed' ? 'item_disposed' : 'item_updated';

      if (currentData?.reportedByGuestId) {
        await db.collection('guest_activity_logs').add({
          tenantId,
          guestId: currentData.reportedByGuestId,
          activityType,
          title: `Lost Item ${updates.status}`,
          description: `${currentData.itemName} has been ${updates.status}`,
          metadata: { itemId, itemNumber: currentData.itemNumber },
          performedBy: req.user?.id || null,
          createdAt: timestamp,
        });
      }
    }

    const updatedDoc = await db.collection('lost_items').doc(itemId).get();
    const finalData = updatedDoc.data();

    res.json({
      success: true,
      data: {
        id: updatedDoc.id,
        ...finalData,
        foundAt: toDate(finalData?.foundAt),
        reportedAt: finalData?.reportedAt ? toDate(finalData.reportedAt) : null,
        claimedAt: finalData?.claimedAt ? toDate(finalData.claimedAt) : null,
        disposedAt: finalData?.disposedAt ? toDate(finalData.disposedAt) : null,
        createdAt: toDate(finalData?.createdAt),
        updatedAt: toDate(finalData?.updatedAt),
        value: finalData?.value ? Number(finalData.value) : null,
      },
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Error updating lost item:', error);
    throw new AppError(
      `Failed to update lost item: ${error.message || 'Unknown error'}`,
      500
    );
  }
});

// POST /api/tenants/:tenantId/lost-found/:itemId/report-lost - Report item as lost
lostFoundRouter.post('/:itemId/report-lost', authenticate, requireTenantAccess, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.params.tenantId;
    const itemId = req.params.itemId;
    const reportData = req.body;

    const itemDoc = await db.collection('lost_items').doc(itemId).get();

    if (!itemDoc.exists || itemDoc.data()?.tenantId !== tenantId) {
      throw new AppError('Lost item not found', 404);
    }

    const currentData = itemDoc.data();

    // Check if item matches description (basic matching)
    const matches = (
      currentData?.itemName?.toLowerCase().includes(reportData.itemName?.toLowerCase() || '') ||
      currentData?.description?.toLowerCase().includes(reportData.description?.toLowerCase() || '') ||
      currentData?.color === reportData.color ||
      currentData?.brand?.toLowerCase() === reportData.brand?.toLowerCase()
    );

    if (!matches) {
      // Still allow reporting, but flag as potential match
      await db.collection('lost_items').doc(itemId).update({
        reportedByGuestId: reportData?.guestId || null,
        reportedByName: reportData?.reportedByName,
        reportedByPhone: reportData?.reportedByPhone || null,
        reportedByEmail: reportData?.reportedByEmail || null,
        reportedByRoom: reportData?.reportedByRoom || null,
        reportedAt: now(),
        updatedAt: now(),
      });
    } else {
      // Item matches - link it
      await db.collection('lost_items').doc(itemId).update({
        reportedByGuestId: reportData?.guestId || null,
        reportedByName: reportData?.reportedByName,
        reportedByPhone: reportData?.reportedByPhone || null,
        reportedByEmail: reportData?.reportedByEmail || null,
        reportedByRoom: reportData?.reportedByRoom || null,
        reportedAt: now(),
        status: 'reported',
        updatedAt: now(),
      });

      // Notify staff about potential match
      // This could trigger an email/notification to staff
    }

    const updatedDoc = await db.collection('lost_items').doc(itemId).get();

    res.json({
      success: true,
      data: {
        id: updatedDoc.id,
        ...updatedDoc.data(),
        foundAt: toDate(updatedDoc.data()?.foundAt),
        reportedAt: toDate(updatedDoc.data()?.reportedAt),
        createdAt: toDate(updatedDoc.data()?.createdAt),
        updatedAt: toDate(updatedDoc.data()?.updatedAt),
      },
      message: matches ? 'Item reported and matched with found item!' : 'Item reported. We will check for matches.',
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Error reporting lost item:', error);
    throw new AppError(
      `Failed to report lost item: ${error.message || 'Unknown error'}`,
      500
    );
  }
});

// POST /api/tenants/:tenantId/lost-found/:itemId/claim - Claim found item
lostFoundRouter.post('/:itemId/claim', authenticate, requireTenantAccess, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.params.tenantId;
    const itemId = req.params.itemId;
    const claimData = req.body;

    const itemDoc = await db.collection('lost_items').doc(itemId).get();

    if (!itemDoc.exists || itemDoc.data()?.tenantId !== tenantId) {
      throw new AppError('Lost item not found', 404);
    }

    const currentData = itemDoc.data();

    if (currentData?.status === 'claimed') {
      throw new AppError('Item has already been claimed', 400);
    }

    const timestamp = now();
    await db.collection('lost_items').doc(itemId).update({
      status: 'claimed',
      claimedBy: claimData.claimedBy || req.user?.id || 'staff',
      claimedAt: timestamp,
      claimMethod: claimData.claimMethod || 'id_check',
      returnMethod: claimData.returnMethod || 'hand_delivered',
      returnedTo: claimData.returnedTo || null,
      updatedAt: timestamp,
    });

    // Log activity if guest is known
    if (currentData?.reportedByGuestId) {
      await db.collection('guest_activity_logs').add({
        tenantId,
        guestId: currentData.reportedByGuestId,
        activityType: 'item_claimed',
        title: 'Lost Item Claimed',
        description: `Successfully claimed ${currentData.itemName}`,
        metadata: { itemId, itemNumber: currentData.itemNumber },
        performedBy: req.user?.id || null,
        createdAt: timestamp,
      });
    }

    const updatedDoc = await db.collection('lost_items').doc(itemId).get();

    const updatedData = updatedDoc.data();
    res.json({
      success: true,
      data: {
        id: updatedDoc.id,
        ...updatedData,
        foundAt: toDate(updatedData?.foundAt),
        reportedAt: updatedData?.reportedAt ? toDate(updatedData.reportedAt) : null,
        claimedAt: updatedData?.claimedAt ? toDate(updatedData.claimedAt) : null,
        createdAt: toDate(updatedData?.createdAt),
        updatedAt: toDate(updatedData?.updatedAt),
      },
      message: 'Item successfully claimed and returned to guest',
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Error claiming item:', error);
    throw new AppError(
      `Failed to claim item: ${error.message || 'Unknown error'}`,
      500
    );
  }
});

// GET /api/tenants/:tenantId/lost-found/stats/summary - Get lost & found statistics
lostFoundRouter.get('/stats/summary', authenticate, requireTenantAccess, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.params.tenantId;

    const itemsSnapshot = await db.collection('lost_items')
      .where('tenantId', '==', tenantId)
      .get();

    const stats = {
      total: 0,
      unclaimed: 0,
      claimed: 0,
      returned: 0,
      disposed: 0,
      reported: 0,
      averageClaimTime: 0,
      totalValue: 0,
    };

    let totalClaimTime = 0;
    let claimedCount = 0;

    itemsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      stats.total++;

      switch (data.status) {
        case 'unclaimed':
          stats.unclaimed++;
          break;
        case 'claimed':
          stats.claimed++;
          break;
        case 'returned':
          stats.returned++;
          break;
        case 'disposed':
          stats.disposed++;
          break;
      }

      if (data.reportedAt) {
        stats.reported++;
      }

      if (data.value) {
        stats.totalValue += Number(data.value);
      }

      // Calculate claim time for claimed items
      if (data.status === 'claimed' && data.foundAt && data.claimedAt) {
        const found = toDate(data.foundAt);
        const claimed = toDate(data.claimedAt);
        if (found && claimed) {
          const claimTime = claimed.getTime() - found.getTime();
          totalClaimTime += claimTime;
          claimedCount++;
        }
      }
    });

    if (claimedCount > 0) {
      stats.averageClaimTime = totalClaimTime / claimedCount / (1000 * 60 * 60 * 24); // Convert to days
    }

    res.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    console.error('Error fetching lost & found stats:', error);
    throw new AppError(
      `Failed to fetch lost & found stats: ${error.message || 'Unknown error'}`,
      500
    );
  }
});

// GET /api/tenants/:tenantId/lost-found/categories - Get available categories
lostFoundRouter.get('/categories/list', authenticate, requireTenantAccess, async (req: AuthRequest, res) => {
  try {
    const categories = [
      { id: 'electronics', name: 'Electronics', description: 'Phones, laptops, chargers, etc.' },
      { id: 'clothing', name: 'Clothing', description: 'Shirts, jackets, hats, etc.' },
      { id: 'jewelry', name: 'Jewelry', description: 'Watches, rings, necklaces, etc.' },
      { id: 'documents', name: 'Documents', description: 'Passports, IDs, tickets, etc.' },
      { id: 'other', name: 'Other', description: 'Miscellaneous items' },
    ];

    res.json({
      success: true,
      data: categories,
    });
  } catch (error: any) {
    console.error('Error fetching categories:', error);
    throw new AppError(
      `Failed to fetch categories: ${error.message || 'Unknown error'}`,
      500
    );
  }
});
