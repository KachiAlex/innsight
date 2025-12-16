import { Router } from 'express';
import { AppError } from '../middleware/errorHandler';
import { authenticate, requireTenantAccess, AuthRequest } from '../middleware/auth';
import { db, toDate, toTimestamp, now } from '../utils/firestore';
import { getPaginationParams, createPaginationResult } from '../utils/pagination';
import admin from 'firebase-admin';

export const depositRouter = Router({ mergeParams: true });

// ============================================
// DEPOSIT POLICIES
// ============================================

// GET /api/tenants/:tenantId/deposit-policies - List deposit policies
depositRouter.get('/policies', authenticate, requireTenantAccess, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.params.tenantId;

    const policiesSnapshot = await db.collection('deposit_policies')
      .where('tenantId', '==', tenantId)
      .orderBy('createdAt', 'desc')
      .get();

    const policies = policiesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: toDate(doc.data().createdAt),
      updatedAt: toDate(doc.data().updatedAt),
    }));

    res.json({
      success: true,
      data: policies,
    });
  } catch (error: any) {
    console.error('Error fetching deposit policies:', error);
    throw new AppError(
      `Failed to fetch deposit policies: ${error.message || 'Unknown error'}`,
      500
    );
  }
});

// POST /api/tenants/:tenantId/deposit-policies - Create deposit policy
depositRouter.post('/policies', authenticate, requireTenantAccess, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.params.tenantId;
    const policyData = req.body;

    // Validate required fields
    if (!policyData.name) {
      throw new AppError('Policy name is required', 400);
    }

    if (!policyData.depositType || !['percentage', 'fixed_amount', 'nights', 'custom'].includes(policyData.depositType)) {
      throw new AppError('Valid deposit type is required', 400);
    }

    if (policyData.depositType === 'percentage' && (policyData.depositValue < 0 || policyData.depositValue > 100)) {
      throw new AppError('Deposit percentage must be between 0 and 100', 400);
    }

    const timestamp = now();
    const policyRecord = {
      tenantId,
      name: policyData.name,
      description: policyData.description || null,
      isActive: policyData.isActive !== false,
      appliesToAllRooms: policyData.appliesToAllRooms !== false,
      roomCategoryIds: policyData.roomCategoryIds || [],
      ratePlanIds: policyData.ratePlanIds || [],
      depositType: policyData.depositType,
      depositValue: policyData.depositValue,
      maxDepositAmount: policyData.maxDepositAmount || null,
      minDepositAmount: policyData.minDepositAmount || null,
      dueDaysBeforeCheckIn: policyData.dueDaysBeforeCheckIn || 7,
      refundableAfterDays: policyData.refundableAfterDays || null,
      cancellationFee: policyData.cancellationFee || null,
      requiresForWeekends: policyData.requiresForWeekends || false,
      requiresForHolidays: policyData.requiresForHolidays || false,
      requiresForPeakSeason: policyData.requiresForPeakSeason || false,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const docRef = await db.collection('deposit_policies').add(policyRecord);

    res.json({
      success: true,
      data: {
        id: docRef.id,
        ...policyRecord,
        createdAt: toDate(timestamp),
        updatedAt: toDate(timestamp),
      },
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Error creating deposit policy:', error);
    throw new AppError(
      `Failed to create deposit policy: ${error.message || 'Unknown error'}`,
      500
    );
  }
});

// PUT /api/tenants/:tenantId/deposit-policies/:policyId - Update deposit policy
depositRouter.put('/policies/:policyId', authenticate, requireTenantAccess, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.params.tenantId;
    const policyId = req.params.policyId;
    const updates = req.body;

    const policyDoc = await db.collection('deposit_policies').doc(policyId).get();

    if (!policyDoc.exists || policyDoc.data()?.tenantId !== tenantId) {
      throw new AppError('Deposit policy not found', 404);
    }

    const timestamp = now();
    const updatedData = {
      ...updates,
      updatedAt: timestamp,
    };

    await db.collection('deposit_policies').doc(policyId).update(updatedData);

    const updatedDoc = await db.collection('deposit_policies').doc(policyId).get();

    res.json({
      success: true,
      data: {
        id: updatedDoc.id,
        ...updatedDoc.data(),
        createdAt: toDate(updatedDoc.data()?.createdAt),
        updatedAt: toDate(timestamp),
      },
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Error updating deposit policy:', error);
    throw new AppError(
      `Failed to update deposit policy: ${error.message || 'Unknown error'}`,
      500
    );
  }
});

// DELETE /api/tenants/:tenantId/deposit-policies/:policyId - Delete deposit policy
depositRouter.delete('/policies/:policyId', authenticate, requireTenantAccess, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.params.tenantId;
    const policyId = req.params.policyId;

    const policyDoc = await db.collection('deposit_policies').doc(policyId).get();

    if (!policyDoc.exists || policyDoc.data()?.tenantId !== tenantId) {
      throw new AppError('Deposit policy not found', 404);
    }

    await db.collection('deposit_policies').doc(policyId).delete();

    res.json({
      success: true,
      message: 'Deposit policy deleted successfully',
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Error deleting deposit policy:', error);
    throw new AppError(
      `Failed to delete deposit policy: ${error.message || 'Unknown error'}`,
      500
    );
  }
});

// ============================================
// DEPOSIT CALCULATION ENGINE
// ============================================

// POST /api/tenants/:tenantId/deposits/calculate - Calculate deposit for reservation
depositRouter.post('/calculate', authenticate, requireTenantAccess, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.params.tenantId;
    const { roomId, checkInDate, checkOutDate, rate, roomType, categoryId, ratePlanId } = req.body;

    if (!roomId || !checkInDate || !checkOutDate || !rate) {
      throw new AppError('Room ID, dates, and rate are required', 400);
    }

    // Get applicable deposit policies
    const policiesSnapshot = await db.collection('deposit_policies')
      .where('tenantId', '==', tenantId)
      .where('isActive', '==', true)
      .get();

    const policies = policiesSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name || '',
        depositType: data.depositType || 'percentage',
        depositValue: Number(data.depositValue || 0),
        maxDepositAmount: data.maxDepositAmount ? Number(data.maxDepositAmount) : null,
        minDepositAmount: data.minDepositAmount ? Number(data.minDepositAmount) : null,
        appliesToAllRooms: data.appliesToAllRooms || false,
        roomCategoryIds: data.roomCategoryIds || [],
        ratePlanIds: data.ratePlanIds || [],
        requiresForWeekends: data.requiresForWeekends || false,
      };
    });

    // Find the most specific applicable policy
    let applicablePolicy: any = null;

    // First, try to find policy that matches room category and rate plan
    if (categoryId && ratePlanId) {
      applicablePolicy = policies.find(policy =>
        policy.roomCategoryIds.includes(categoryId) &&
        policy.ratePlanIds.includes(ratePlanId)
      );
    }

    // Then try room category only
    if (!applicablePolicy && categoryId) {
      applicablePolicy = policies.find(policy =>
        policy.roomCategoryIds.includes(categoryId)
      );
    }

    // Then try rate plan only
    if (!applicablePolicy && ratePlanId) {
      applicablePolicy = policies.find(policy =>
        policy.ratePlanIds.includes(ratePlanId)
      );
    }

    // Finally, use the default policy (applies to all rooms)
    if (!applicablePolicy) {
      applicablePolicy = policies.find(policy => policy.appliesToAllRooms);
    }

    if (!applicablePolicy) {
      // No policy found, return zero deposit
      return res.json({
        success: true,
        data: {
          depositAmount: 0,
          depositRequired: false,
          policy: null,
          calculation: {
            type: 'no_policy',
            message: 'No applicable deposit policy found',
          },
        },
      });
    }

    // Calculate deposit based on policy
    let depositAmount = 0;
    const nights = Math.ceil(
      (new Date(checkOutDate).getTime() - new Date(checkInDate).getTime()) / (1000 * 60 * 60 * 24)
    );

    switch (applicablePolicy.depositType) {
      case 'percentage':
        depositAmount = (rate * applicablePolicy.depositValue) / 100;
        break;
      case 'fixed_amount':
        depositAmount = applicablePolicy.depositValue;
        break;
      case 'nights':
        depositAmount = rate * applicablePolicy.depositValue;
        break;
      case 'custom':
        // Custom logic can be implemented here
        depositAmount = applicablePolicy.depositValue;
        break;
      default:
        depositAmount = 0;
    }

    // Apply min/max limits
    if (applicablePolicy.maxDepositAmount && depositAmount > applicablePolicy.maxDepositAmount) {
      depositAmount = applicablePolicy.maxDepositAmount;
    }

    if (applicablePolicy.minDepositAmount && depositAmount < applicablePolicy.minDepositAmount) {
      depositAmount = applicablePolicy.minDepositAmount;
    }

    // Check special conditions
    const checkInDateObj = new Date(checkInDate);
    const isWeekend = [0, 6].includes(checkInDateObj.getDay()); // Sunday = 0, Saturday = 6
    const requiresDeposit = applicablePolicy.requiresForWeekends && isWeekend;

    res.json({
      success: true,
      data: {
        depositAmount: Math.round(depositAmount * 100) / 100, // Round to 2 decimal places
        depositRequired: applicablePolicy.appliesToAllRooms || requiresDeposit,
        policy: {
          id: applicablePolicy.id,
          name: applicablePolicy.name,
          depositType: applicablePolicy.depositType,
          depositValue: applicablePolicy.depositValue,
        },
        calculation: {
          type: applicablePolicy.depositType,
          nights,
          rate,
          rawAmount: depositAmount,
          adjustments: {
            minLimit: applicablePolicy.minDepositAmount,
            maxLimit: applicablePolicy.maxDepositAmount,
          },
        },
      },
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Error calculating deposit:', error);
    throw new AppError(
      `Failed to calculate deposit: ${error.message || 'Unknown error'}`,
      500
    );
  }
  return; // Ensure all code paths return a value
});

// ============================================
// DEPOSIT PAYMENTS
// ============================================

// GET /api/tenants/:tenantId/deposits/reservations/:reservationId - Get deposit payments for reservation
depositRouter.get('/reservations/:reservationId', authenticate, requireTenantAccess, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.params.tenantId;
    const reservationId = req.params.reservationId;

    const paymentsSnapshot = await db.collection('deposit_payments')
      .where('tenantId', '==', tenantId)
      .where('reservationId', '==', reservationId)
      .orderBy('createdAt', 'desc')
      .get();

    const payments = paymentsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      amount: Number(doc.data().amount),
      refundAmount: doc.data().refundAmount ? Number(doc.data().refundAmount) : null,
      paidAt: toDate(doc.data().paidAt),
      refundedAt: toDate(doc.data().refundedAt),
      createdAt: toDate(doc.data().createdAt),
      updatedAt: toDate(doc.data().updatedAt),
    }));

    res.json({
      success: true,
      data: payments,
    });
  } catch (error: any) {
    console.error('Error fetching deposit payments:', error);
    throw new AppError(
      `Failed to fetch deposit payments: ${error.message || 'Unknown error'}`,
      500
    );
  }
});

// POST /api/tenants/:tenantId/deposits - Record deposit payment
depositRouter.post('/', authenticate, requireTenantAccess, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.params.tenantId;
    const { reservationId, amount, method, reference, notes } = req.body;

    if (!reservationId || !amount || !method) {
      throw new AppError('Reservation ID, amount, and payment method are required', 400);
    }

    // Verify reservation exists and belongs to tenant
    const reservationDoc = await db.collection('reservations').doc(reservationId).get();
    if (!reservationDoc.exists || reservationDoc.data()?.tenantId !== tenantId) {
      throw new AppError('Reservation not found', 404);
    }

    const timestamp = now();
    const paymentRecord = {
      tenantId,
      reservationId,
      amount: Number(amount),
      currency: 'NGN',
      method,
      reference: reference || null,
      status: 'completed', // Assume completed for manual payments
      notes: notes || null,
      paidAt: timestamp,
      processedBy: req.user?.id || null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const docRef = await db.collection('deposit_payments').add(paymentRecord);

    // Update reservation deposit status
    const reservationData = reservationDoc.data();
    const totalDepositPaid = await getTotalDepositPaid(tenantId, reservationId) + Number(amount);
    const depositStatus = totalDepositPaid >= (reservationData?.depositAmount || 0) ? 'paid' : 'partial';

    await db.collection('reservations').doc(reservationId).update({
      depositStatus,
      updatedAt: timestamp,
    });

    res.json({
      success: true,
      data: {
        id: docRef.id,
        ...paymentRecord,
        paidAt: toDate(timestamp),
        createdAt: toDate(timestamp),
        updatedAt: toDate(timestamp),
      },
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Error recording deposit payment:', error);
    throw new AppError(
      `Failed to record deposit payment: ${error.message || 'Unknown error'}`,
      500
    );
  }
});

// POST /api/tenants/:tenantId/deposits/:paymentId/refund - Process deposit refund
depositRouter.post('/:paymentId/refund', authenticate, requireTenantAccess, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.params.tenantId;
    const paymentId = req.params.paymentId;
    const { refundAmount, refundReason } = req.body;

    const paymentDoc = await db.collection('deposit_payments').doc(paymentId).get();

    if (!paymentDoc.exists || paymentDoc.data()?.tenantId !== tenantId) {
      throw new AppError('Deposit payment not found', 404);
    }

    const paymentData = paymentDoc.data();
    const originalAmount = Number(paymentData?.amount || 0);
    const refundAmt = refundAmount ? Number(refundAmount) : originalAmount;

    if (refundAmt > originalAmount) {
      throw new AppError('Refund amount cannot exceed original payment amount', 400);
    }

    const timestamp = now();
    await db.collection('deposit_payments').doc(paymentId).update({
      status: 'refunded',
      refundedAt: timestamp,
      refundedBy: req.user?.id || null,
      refundAmount: refundAmt,
      refundReason: refundReason || null,
      updatedAt: timestamp,
    });

    // Update reservation deposit status if fully refunded
    if (paymentData?.reservationId) {
      const totalRemaining = await getTotalDepositPaid(tenantId, paymentData.reservationId) - refundAmt;
      const depositStatus = totalRemaining <= 0 ? 'refunded' : 'partial';

      await db.collection('reservations').doc(paymentData.reservationId).update({
        depositStatus,
        updatedAt: timestamp,
      });
    }

    const updatedDoc = await db.collection('deposit_payments').doc(paymentId).get();

    res.json({
      success: true,
      data: {
        id: updatedDoc.id,
        ...updatedDoc.data(),
        amount: Number(updatedDoc.data()?.amount),
        refundAmount: Number(updatedDoc.data()?.refundAmount),
        paidAt: toDate(updatedDoc.data()?.paidAt),
        refundedAt: toDate(updatedDoc.data()?.refundedAt),
        createdAt: toDate(updatedDoc.data()?.createdAt),
        updatedAt: toDate(updatedDoc.data()?.updatedAt),
      },
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Error processing deposit refund:', error);
    throw new AppError(
      `Failed to process deposit refund: ${error.message || 'Unknown error'}`,
      500
    );
  }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

async function getTotalDepositPaid(tenantId: string, reservationId: string): Promise<number> {
  try {
    const paymentsSnapshot = await db.collection('deposit_payments')
      .where('tenantId', '==', tenantId)
      .where('reservationId', '==', reservationId)
      .where('status', '!=', 'refunded')
      .get();

    let total = 0;
    paymentsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.status === 'completed') {
        total += Number(data.amount || 0);
      }
    });

    return total;
  } catch (error) {
    console.error('Error calculating total deposit paid:', error);
    return 0;
  }
}
