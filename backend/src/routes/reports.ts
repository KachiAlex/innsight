import { Router } from 'express';
import { authenticate, requireTenantAccess, AuthRequest, requireRole } from '../middleware/auth';
import { startOfDay, endOfDay, startOfMonth, endOfMonth, format, subDays } from 'date-fns';
import { AppError } from '../middleware/errorHandler';
import { db, toDate, toTimestamp, now } from '../utils/firestore';
import { createAuditLog } from '../utils/audit';
import { createAlert } from '../utils/alerts';

export const reportRouter = Router({ mergeParams: true });

// GET /api/tenants/:tenantId/reports/revenue
reportRouter.get(
  '/revenue',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const { startDate, endDate, groupBy = 'day' } = req.query;

      const start = startDate ? new Date(startDate as string) : startOfMonth(new Date());
      const end = endDate ? new Date(endDate as string) : endOfDay(new Date());

      const startTimestamp = toTimestamp(start);
      const endTimestamp = toTimestamp(end);

      // Get all payments in date range from Firestore
      let paymentsSnapshot;
      try {
        paymentsSnapshot = await db.collection('payments')
          .where('tenantId', '==', tenantId)
          .where('status', '==', 'completed')
          .get();
      } catch (error: any) {
        // If collection doesn't exist or query fails, return empty data
        console.warn('Error fetching payments, returning empty revenue data:', error.message);
        res.json({
          success: true,
          data: {
            period: { start, end },
            totalRevenue: 0,
            paymentMethods: {},
            transactions: 0,
            dailyBreakdown: groupBy === 'day' ? {} : undefined,
          },
        });
        return;
      }

      // Filter by date range first, then enrich with room data
      const filteredDocs = paymentsSnapshot.docs.filter(doc => {
        const paymentData = doc.data();
        const createdAt = toDate(paymentData.createdAt);
        if (!createdAt) return false;
        return createdAt >= start && createdAt <= end;
      });

      // Enrich with room data (only for filtered payments)
      const payments = await Promise.all(
        filteredDocs.map(async (doc) => {
          const paymentData = doc.data();
          
          // Get folio and room data (optional, don't fail if missing)
          let roomNumber = null;
          try {
            if (paymentData.folioId) {
              const folioDoc = await db.collection('folios').doc(paymentData.folioId).get();
              if (folioDoc.exists && folioDoc.data()?.roomId) {
                const roomDoc = await db.collection('rooms').doc(folioDoc.data()?.roomId).get();
                if (roomDoc.exists) {
                  roomNumber = roomDoc.data()?.roomNumber || null;
                }
              }
            }
          } catch (error) {
            // Silently continue if room lookup fails
            console.warn('Error fetching room data for payment:', error);
          }

          return {
            id: doc.id,
            ...paymentData,
            amount: Number(paymentData.amount || 0),
            method: paymentData.method || 'unknown',
            createdAt: toDate(paymentData.createdAt),
            roomNumber,
          };
        })
      );

      // Calculate totals
      const totalRevenue = payments.reduce((sum, p) => sum + Number(p.amount), 0);
      const byMethod = payments.reduce((acc, p) => {
        const method = p.method || 'unknown';
        acc[method] = (acc[method] || 0) + Number(p.amount);
        return acc;
      }, {} as Record<string, number>);

      res.json({
        success: true,
        data: {
          period: { start, end },
          totalRevenue,
          paymentMethods: byMethod,
          transactions: payments.length,
          dailyBreakdown: groupBy === 'day' ? payments.reduce((acc, p) => {
            if (!p.createdAt) return acc;
            const date = p.createdAt.toISOString().split('T')[0];
            acc[date] = (acc[date] || 0) + Number(p.amount);
            return acc;
          }, {} as Record<string, number>) : undefined,
        },
      });
    } catch (error: any) {
      console.error('Error fetching revenue report:', error);
      throw new AppError(
        `Failed to fetch revenue report: ${error.message || 'Database connection error'}`,
        500
      );
    }
  }
);

// GET /api/tenants/:tenantId/reports/occupancy
reportRouter.get(
  '/occupancy',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const { startDate, endDate } = req.query;

      const start = startDate ? new Date(startDate as string) : startOfMonth(new Date());
      const end = endDate ? new Date(endDate as string) : endOfDay(new Date());

      // Get total rooms
      let roomsSnapshot;
      let reservationsSnapshot;
      
      try {
        roomsSnapshot = await db.collection('rooms')
          .where('tenantId', '==', tenantId)
          .get();
      } catch (error: any) {
        console.warn('Error fetching rooms, returning empty occupancy data:', error.message);
        res.json({
          success: true,
          data: {
            period: { start, end },
            totalRooms: 0,
            checkedIn: 0,
            totalNights: 0,
            occupancyRate: 0,
            adr: 0,
            revpar: 0,
          },
        });
        return;
      }

      const totalRooms = roomsSnapshot.size;

      // Get reservations that overlap with the date range
      try {
        reservationsSnapshot = await db.collection('reservations')
          .where('tenantId', '==', tenantId)
          .where('status', 'in', ['confirmed', 'checked_in', 'checked_out'])
          .get();
      } catch (error: any) {
        // If query fails (e.g., no index), try without status filter
        console.warn('Error fetching reservations with status filter, trying without:', error.message);
        try {
          reservationsSnapshot = await db.collection('reservations')
            .where('tenantId', '==', tenantId)
            .get();
        } catch (error2: any) {
          console.warn('Error fetching reservations, returning empty occupancy data:', error2.message);
          res.json({
            success: true,
            data: {
              period: { start, end },
              totalRooms,
              checkedIn: 0,
              totalNights: 0,
              occupancyRate: 0,
              adr: 0,
              revpar: 0,
            },
          });
          return;
        }
      }

      // Filter reservations that overlap with date range
      const reservations = reservationsSnapshot.docs
        .map(doc => {
          const resData = doc.data();
          return {
            id: doc.id,
            ...resData,
            checkInDate: toDate(resData.checkInDate),
            checkOutDate: toDate(resData.checkOutDate),
            rate: Number(resData.rate || 0),
            status: resData.status,
          };
        })
        .filter(r => {
          // Filter by status if not already filtered by query
          const validStatuses = ['confirmed', 'checked_in', 'checked_out'];
          if (!validStatuses.includes(r.status)) return false;
          
          if (!r.checkInDate || !r.checkOutDate) return false;
          // Check if reservation overlaps with date range
          return r.checkInDate <= end && r.checkOutDate >= start;
        });

      // Calculate occupancy metrics
      const checkedIn = reservations.filter(r => r.status === 'checked_in').length;
      const totalNights = reservations.reduce((sum, r) => {
        if (!r.checkInDate || !r.checkOutDate) return sum;
        const nights = Math.ceil(
          (Math.min(r.checkOutDate.getTime(), end.getTime()) -
            Math.max(r.checkInDate.getTime(), start.getTime())) /
            (1000 * 60 * 60 * 24)
        );
        return sum + Math.max(0, nights);
      }, 0);

      const availableNights = totalRooms * Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      const occupancyRate = availableNights > 0 ? (totalNights / availableNights) * 100 : 0;

      // Calculate ADR (Average Daily Rate)
      const totalRevenue = reservations.reduce((sum, r) => sum + Number(r.rate), 0);
      const adr = totalNights > 0 ? totalRevenue / totalNights : 0;

      // Calculate RevPAR (Revenue per Available Room)
      const revpar = adr * (occupancyRate / 100);

      res.json({
        success: true,
        data: {
          period: { start, end },
          totalRooms,
          checkedIn,
          totalNights,
          occupancyRate: Number(occupancyRate.toFixed(2)),
          adr: Number(adr.toFixed(2)),
          revpar: Number(revpar.toFixed(2)),
        },
      });
    } catch (error: any) {
      console.error('Error fetching occupancy report:', error);
      throw new AppError(
        `Failed to fetch occupancy report: ${error.message || 'Database connection error'}`,
        500
      );
    }
  }
);

// GET /api/tenants/:tenantId/reports/shift
reportRouter.get(
  '/shift',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const { shiftId } = req.query;

      if (!shiftId) {
        throw new AppError('shiftId is required', 400);
      }

      // Get shift from Firestore
      const shiftDoc = await db.collection('shifts').doc(shiftId as string).get();

      if (!shiftDoc.exists) {
        throw new AppError('Shift not found', 404);
      }

      const shiftData = shiftDoc.data();
      if (shiftData?.tenantId !== tenantId) {
        throw new AppError('Shift not found', 404);
      }

      // Get user data
      let user: { firstName: any; lastName: any } | null = null;
      if (shiftData?.userId) {
        const userDoc = await db.collection('users').doc(shiftData.userId).get();
        if (userDoc.exists) {
          user = {
            firstName: userDoc.data()?.firstName || null,
            lastName: userDoc.data()?.lastName || null,
          };
        }
      }

      const shiftStart = toDate(shiftData?.startTime);
      const shiftEnd = toDate(shiftData?.endTime) || new Date();

      // Get payments during shift
      const paymentsSnapshot = await db.collection('payments')
        .where('tenantId', '==', tenantId)
        .where('status', '==', 'completed')
        .get();

      const payments = await Promise.all(
        paymentsSnapshot.docs
          .filter(doc => {
            const paymentData = doc.data();
            const createdAt = toDate(paymentData.createdAt);
            if (!createdAt || !shiftStart) return false;
            return createdAt >= shiftStart && createdAt <= shiftEnd;
          })
          .map(async (doc) => {
            const paymentData = doc.data();
            
            // Get folio and room data
            let roomNumber = null;
            if (paymentData.folioId) {
              const folioDoc = await db.collection('folios').doc(paymentData.folioId).get();
              if (folioDoc.exists && folioDoc.data()?.roomId) {
                const roomDoc = await db.collection('rooms').doc(folioDoc.data()?.roomId).get();
                if (roomDoc.exists) {
                  roomNumber = roomDoc.data()?.roomNumber || null;
                }
              }
            }

            return {
              id: doc.id,
              ...paymentData,
              amount: Number(paymentData.amount || 0),
              createdAt: toDate(paymentData.createdAt),
              roomNumber,
            };
          })
      );

      const totalRevenue = payments.reduce((sum, p) => sum + Number(p.amount), 0);

      const shift = {
        id: shiftDoc.id,
        ...shiftData,
        user,
        startTime: shiftStart,
        endTime: shiftEnd,
      };

      res.json({
        success: true,
        data: {
          shift,
          totalRevenue,
          transactionCount: payments.length,
          payments,
        },
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Error fetching shift report:', error);
      throw new AppError(
        `Failed to fetch shift report: ${error.message || 'Database connection error'}`,
        500
      );
    }
  }
);

// POST /api/tenants/:tenantId/reports/night-audit - Run night audit for a specific date
reportRouter.post(
  '/night-audit',
  authenticate,
  requireTenantAccess,
  requireRole('owner', 'general_manager', 'accountant', 'iitech_admin'),
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const { auditDate } = req.body;

      // Use provided date or yesterday (typical night audit runs for previous day)
      const targetDate = auditDate ? new Date(auditDate) : subDays(new Date(), 1);
      const auditDayStart = startOfDay(targetDate);
      const auditDayEnd = endOfDay(targetDate);
      const auditDateStr = format(auditDayStart, 'yyyy-MM-dd');

      // Check if night audit already exists for this date
      const existingAuditSnapshot = await db.collection('nightAudits')
        .where('tenantId', '==', tenantId)
        .where('auditDate', '==', auditDateStr)
        .limit(1)
        .get();

      if (!existingAuditSnapshot.empty) {
        throw new AppError(`Night audit already completed for ${auditDateStr}`, 400);
      }

      // Get all rooms
      const roomsSnapshot = await db.collection('rooms')
        .where('tenantId', '==', tenantId)
        .get();

      const totalRooms = roomsSnapshot.size;

      // Get reservations for the audit day
      const reservationsSnapshot = await db.collection('reservations')
        .where('tenantId', '==', tenantId)
        .get();

      const reservations = reservationsSnapshot.docs
        .map(doc => {
          const resData = doc.data();
          return {
            id: doc.id,
            roomId: resData.roomId,
            ...resData,
            checkInDate: toDate(resData.checkInDate),
            checkOutDate: toDate(resData.checkOutDate),
            checkedInAt: toDate(resData.checkedInAt),
            checkedOutAt: toDate(resData.checkedOutAt),
            rate: Number(resData.rate || 0),
            status: resData.status,
          };
        })
        .filter(r => {
          if (!r.checkInDate || !r.checkOutDate) return false;
          // Include reservations that were active during the audit day
          return r.checkInDate <= auditDayEnd && r.checkOutDate >= auditDayStart;
        });

      // Calculate metrics
      const checkedIn = reservations.filter(r => {
        if (!r.checkInDate || !r.checkedInAt) return false;
        return r.status === 'checked_in' && 
               r.checkInDate <= auditDayEnd && 
               (r.checkOutDate === null || r.checkOutDate > auditDayStart);
      }).length;

      const checkedOut = reservations.filter(r => {
        if (!r.checkedOutAt) return false;
        return r.checkedOutAt >= auditDayStart && r.checkedOutAt <= auditDayEnd;
      }).length;

      const noShows = reservations.filter(r => 
        r.status === 'no_show' && 
        r.checkInDate && 
        r.checkInDate >= auditDayStart && 
        r.checkInDate <= auditDayEnd
      ).length;

      const cancellations = reservations.filter(r => 
        r.status === 'cancelled' && 
        r.checkInDate && 
        r.checkInDate >= auditDayStart && 
        r.checkInDate <= auditDayEnd
      ).length;

      // Calculate room nights
      const roomNights = reservations.reduce((sum, r) => {
        if (!r.checkInDate || !r.checkOutDate) return sum;
        if (r.status === 'checked_in' || r.status === 'checked_out') {
          // Count nights for this specific day
          const checkIn = r.checkInDate <= auditDayStart ? auditDayStart : r.checkInDate;
          const checkOut = r.checkOutDate > auditDayEnd ? auditDayEnd : r.checkOutDate;
          if (checkIn <= auditDayEnd && checkOut >= auditDayStart) {
            return sum + 1;
          }
        }
        return sum;
      }, 0);

      const occupancyRate = totalRooms > 0 ? (roomNights / totalRooms) * 100 : 0;

      // Get payments for the audit day
      const paymentsSnapshot = await db.collection('payments')
        .where('tenantId', '==', tenantId)
        .where('status', '==', 'completed')
        .get();

      const dayPayments = paymentsSnapshot.docs
        .map(doc => {
          const paymentData = doc.data();
          const createdAt = toDate(paymentData.createdAt);
          return {
            id: doc.id,
            ...paymentData,
            amount: Number(paymentData.amount || 0),
            method: paymentData.method || 'unknown',
            createdAt,
          };
        })
        .filter(p => {
          if (!p.createdAt) return false;
          return p.createdAt >= auditDayStart && p.createdAt <= auditDayEnd;
        });

      const totalRevenue = dayPayments.reduce((sum, p) => sum + p.amount, 0);
      const revenueByMethod = dayPayments.reduce((acc, p) => {
        const method = p.method || 'unknown';
        acc[method] = (acc[method] || 0) + p.amount;
        return acc;
      }, {} as Record<string, number>);

      // Calculate ADR and RevPAR
      const adr = roomNights > 0 ? totalRevenue / roomNights : 0;
      const revpar = adr * (occupancyRate / 100);

      // Get folios for the day
      const foliosSnapshot = await db.collection('folios')
        .where('tenantId', '==', tenantId)
        .get();

      const dayFolios = foliosSnapshot.docs
        .map(doc => {
          const folioData = doc.data();
          const createdAt = toDate(folioData.createdAt);
          return {
            id: doc.id,
            ...folioData,
            totalCharges: Number(folioData.totalCharges || 0),
            totalPayments: Number(folioData.totalPayments || 0),
            balance: Number(folioData.balance || 0),
            createdAt,
          };
        })
        .filter(f => {
          if (!f.createdAt) return false;
          return f.createdAt >= auditDayStart && f.createdAt <= auditDayEnd;
        });

      const totalCharges = dayFolios.reduce((sum, f) => sum + f.totalCharges, 0);
      const totalPayments = dayFolios.reduce((sum, f) => sum + f.totalPayments, 0);
      const outstandingBalance = dayFolios.reduce((sum, f) => sum + f.balance, 0);

      // Get open shifts
      const shiftsSnapshot = await db.collection('shifts')
        .where('tenantId', '==', tenantId)
        .where('status', '==', 'open')
        .get();

      const openShifts = shiftsSnapshot.size;

      // Update room statuses: checked-out rooms should become dirty
      const roomsToUpdate: string[] = [];
      for (const reservation of reservations) {
        if (reservation.status === 'checked_out' && 
            reservation.checkedOutAt && 
            reservation.checkedOutAt >= auditDayStart && 
            reservation.checkedOutAt <= auditDayEnd) {
          // Find the room and mark it as dirty
          const roomDoc = await db.collection('rooms').doc(reservation.roomId).get();
          if (roomDoc.exists) {
            const roomData = roomDoc.data();
            if (roomData?.status !== 'dirty' && roomData?.status !== 'out_of_order') {
              roomsToUpdate.push(roomDoc.id);
            }
          }
        }
      }

      // Update room statuses in batch
      const batch = db.batch();
      for (const roomId of roomsToUpdate) {
        const roomRef = db.collection('rooms').doc(roomId);
        batch.update(roomRef, {
          status: 'dirty',
          updatedAt: now(),
        });
      }
      await batch.commit();

      // Check for discrepancies
      const discrepancies: string[] = [];
      if (openShifts > 0) {
        discrepancies.push(`${openShifts} open shift(s) found`);
      }
      if (outstandingBalance > 0) {
        discrepancies.push(`Outstanding balance: ${outstandingBalance}`);
      }
      const revenueVariance = totalCharges - totalPayments;
      if (Math.abs(revenueVariance) > 0.01) {
        discrepancies.push(`Revenue variance: ${revenueVariance}`);
      }

      // Create night audit record
      const auditData = {
        tenantId,
        auditDate: auditDateStr,
        auditDateTime: now(),
        performedBy: req.user!.id,
        summary: {
          totalRooms,
          checkedIn,
          checkedOut,
          noShows,
          cancellations,
          roomNights,
          occupancyRate: Number(occupancyRate.toFixed(2)),
          totalRevenue,
          revenueByMethod,
          totalCharges,
          totalPayments,
          outstandingBalance,
          adr: Number(adr.toFixed(2)),
          revpar: Number(revpar.toFixed(2)),
          openShifts,
          roomsUpdated: roomsToUpdate.length,
        },
        discrepancies: discrepancies.length > 0 ? discrepancies : null,
        status: discrepancies.length > 0 ? 'completed_with_warnings' : 'completed',
        createdAt: now(),
        updatedAt: now(),
      };

      const auditRef = db.collection('nightAudits').doc();
      await auditRef.set(auditData);

      // Create alerts for discrepancies
      if (discrepancies.length > 0) {
        for (const discrepancy of discrepancies) {
          try {
            await createAlert({
              tenantId,
              alertType: 'night_audit_discrepancy',
              severity: 'medium',
              title: 'Night Audit Discrepancy',
              message: discrepancy,
              metadata: {
                auditId: auditRef.id,
                auditDate: auditDateStr,
              },
            });
          } catch (alertError) {
            console.error('Failed to create alert:', alertError);
          }
        }
      }

      // Create audit log
      try {
        await createAuditLog({
          tenantId,
          userId: req.user!.id,
          action: 'run_night_audit',
          entityType: 'night_audit',
          entityId: auditRef.id,
          afterState: auditData,
        });
      } catch (auditError) {
        console.error('Failed to create audit log:', auditError);
      }

      res.status(201).json({
        success: true,
        message: `Night audit completed for ${auditDateStr}`,
        data: {
          id: auditRef.id,
          ...auditData,
          auditDateTime: toDate(auditData.auditDateTime),
          createdAt: toDate(auditData.createdAt),
          updatedAt: toDate(auditData.updatedAt),
        },
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Error running night audit:', error);
      throw new AppError(
        `Failed to run night audit: ${error.message || 'Database connection error'}`,
        500
      );
    }
  }
);

// GET /api/tenants/:tenantId/reports/night-audit/:date - Get night audit report for a specific date
reportRouter.get(
  '/night-audit/:date',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const auditDate = req.params.date;

      const auditSnapshot = await db.collection('nightAudits')
        .where('tenantId', '==', tenantId)
        .where('auditDate', '==', auditDate)
        .limit(1)
        .get();

      if (auditSnapshot.empty) {
        throw new AppError(`Night audit not found for date ${auditDate}`, 404);
      }

      const auditDoc = auditSnapshot.docs[0];
      const auditData = auditDoc.data();

      // Get user who performed the audit
      let performedByUser: {
        id: string;
        firstName: string | null;
        lastName: string | null;
        email: string | null;
      } | null = null;
      if (auditData.performedBy) {
        const userDoc = await db.collection('users').doc(auditData.performedBy).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          performedByUser = {
            id: userDoc.id,
            firstName: userData?.firstName || null,
            lastName: userData?.lastName || null,
            email: userData?.email || null,
          };
        }
      }

      const audit = {
        id: auditDoc.id,
        ...auditData,
        performedByUser,
        auditDateTime: toDate(auditData.auditDateTime),
        createdAt: toDate(auditData.createdAt),
        updatedAt: toDate(auditData.updatedAt),
      };

      res.json({
        success: true,
        data: audit,
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Error fetching night audit:', error);
      throw new AppError(
        `Failed to fetch night audit: ${error.message || 'Database connection error'}`,
        500
      );
    }
  }
);

// GET /api/tenants/:tenantId/reports/night-audit - List night audit history
reportRouter.get(
  '/night-audit',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const { limit = 30 } = req.query;

      let auditsSnapshot;
      try {
        // Try with orderBy first (requires composite index)
        auditsSnapshot = await db.collection('nightAudits')
          .where('tenantId', '==', tenantId)
          .orderBy('auditDate', 'desc')
          .limit(Number(limit))
          .get();
      } catch (error: any) {
        // If orderBy fails (missing index), fetch all and sort in memory
        if (error.code === 9 || error.message?.includes('index')) {
          console.warn('Firestore index missing for nightAudits, sorting in memory');
          auditsSnapshot = await db.collection('nightAudits')
            .where('tenantId', '==', tenantId)
            .get();
        } else {
          throw error;
        }
      }

      let audits = auditsSnapshot.docs.map(doc => {
        const auditData = doc.data();
        return {
          id: doc.id,
          auditDate: auditData.auditDate,
          status: auditData.status,
          summary: auditData.summary,
          discrepancies: auditData.discrepancies,
          auditDateTime: toDate(auditData.auditDateTime),
          createdAt: toDate(auditData.createdAt),
        };
      });

      // Sort by auditDate descending if not already sorted
      audits.sort((a, b) => {
        if (!a.auditDate || !b.auditDate) return 0;
        return b.auditDate.localeCompare(a.auditDate);
      });

      // Apply limit if sorting in memory
      if (audits.length > Number(limit)) {
        audits = audits.slice(0, Number(limit));
      }

      res.json({
        success: true,
        data: audits,
        total: audits.length,
      });
    } catch (error: any) {
      console.error('Error fetching night audit history:', error);
      throw new AppError(
        `Failed to fetch night audit history: ${error.message || 'Database connection error'}`,
        500
      );
    }
  }
);

// GET /api/tenants/:tenantId/reports/performance-metrics
reportRouter.get(
  '/performance-metrics',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const { startDate, endDate, metrics = 'all' } = req.query;

      const start = startDate ? new Date(startDate as string) : startOfMonth(new Date());
      const end = endDate ? new Date(endDate as string) : endOfDay(new Date());

      const startTimestamp = toTimestamp(start);
      const endTimestamp = toTimestamp(end);

      const metricsList = metrics === 'all' ? [
        'occupancy', 'revenue', 'guestSatisfaction', 'operationalEfficiency',
        'averageDailyRate', 'revpar', 'goppar'
      ] : (metrics as string).split(',');

      const result: any = {
        period: { start, end },
        metrics: {}
      };

      // Calculate occupancy rate
      if (metricsList.includes('occupancy')) {
        try {
          const occupancySnapshot = await db.collection('roomOccupancy')
            .where('tenantId', '==', tenantId)
            .where('date', '>=', startTimestamp)
            .where('date', '<=', endTimestamp)
            .get();

          const totalRooms = await db.collection('rooms')
            .where('tenantId', '==', tenantId)
            .get();

          const occupiedRoomDays = occupancySnapshot.docs.reduce((sum, doc) => {
            return sum + (doc.data().occupiedRooms || 0);
          }, 0);

          const totalRoomDays = totalRooms.docs.length * Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

          result.metrics.occupancy = {
            occupiedRoomDays,
            totalRoomDays,
            occupancyRate: totalRoomDays > 0 ? (occupiedRoomDays / totalRoomDays) * 100 : 0,
            totalRooms: totalRooms.docs.length
          };
        } catch (error) {
          console.warn('Error calculating occupancy metrics:', error);
          result.metrics.occupancy = { occupiedRoomDays: 0, totalRoomDays: 0, occupancyRate: 0, totalRooms: 0 };
        }
      }

      // Calculate revenue metrics
      if (metricsList.includes('revenue')) {
        try {
          const paymentsSnapshot = await db.collection('payments')
            .where('tenantId', '==', tenantId)
            .where('status', '==', 'completed')
            .get();

          const revenue = paymentsSnapshot.docs.reduce((sum, doc) => {
            const data = doc.data();
            const paymentDate = toDate(data.createdAt);
            if (paymentDate && paymentDate >= start && paymentDate <= end) {
              return sum + (data.amount || 0);
            }
            return sum;
          }, 0);

          result.metrics.revenue = {
            totalRevenue: revenue,
            transactionCount: paymentsSnapshot.docs.length
          };
        } catch (error) {
          console.warn('Error calculating revenue metrics:', error);
          result.metrics.revenue = { totalRevenue: 0, transactionCount: 0 };
        }
      }

      // Calculate guest satisfaction (placeholder - would integrate with feedback system)
      if (metricsList.includes('guestSatisfaction')) {
        try {
          const requestsSnapshot = await db.collection('guestRequests')
            .where('tenantId', '==', tenantId)
            .get();

          const resolvedRequests = requestsSnapshot.docs.filter(doc => {
            const data = doc.data();
            const createdAt = toDate(data.createdAt);
            return createdAt && createdAt >= start && createdAt <= end && data.status === 'resolved';
          }).length;

          const totalRequests = requestsSnapshot.docs.filter(doc => {
            const data = doc.data();
            const createdAt = toDate(data.createdAt);
            return createdAt && createdAt >= start && createdAt <= end;
          }).length;

          result.metrics.guestSatisfaction = {
            totalRequests,
            resolvedRequests,
            resolutionRate: totalRequests > 0 ? (resolvedRequests / totalRequests) * 100 : 0
          };
        } catch (error) {
          console.warn('Error calculating guest satisfaction metrics:', error);
          result.metrics.guestSatisfaction = { totalRequests: 0, resolvedRequests: 0, resolutionRate: 0 };
        }
      }

      // Calculate operational efficiency
      if (metricsList.includes('operationalEfficiency')) {
        try {
          const housekeepingTasks = await db.collection('housekeepingTasks')
            .where('tenantId', '==', tenantId)
            .get();

          const maintenanceTickets = await db.collection('maintenanceTickets')
            .where('tenantId', '==', tenantId)
            .get();

          const completedTasks = housekeepingTasks.docs.filter(doc => {
            const data = doc.data();
            const createdAt = toDate(data.createdAt);
            return createdAt && createdAt >= start && createdAt <= end && data.status === 'completed';
          }).length;

          const completedTickets = maintenanceTickets.docs.filter(doc => {
            const data = doc.data();
            const createdAt = toDate(data.createdAt);
            return createdAt && createdAt >= start && createdAt <= end && data.status === 'completed';
          }).length;

          const totalTasks = housekeepingTasks.docs.filter(doc => {
            const data = doc.data();
            const createdAt = toDate(data.createdAt);
            return createdAt && createdAt >= start && createdAt <= end;
          }).length;

          const totalTickets = maintenanceTickets.docs.filter(doc => {
            const data = doc.data();
            const createdAt = toDate(data.createdAt);
            return createdAt && createdAt >= start && createdAt <= end;
          }).length;

          result.metrics.operationalEfficiency = {
            totalTasks: totalTasks + totalTickets,
            completedTasks: completedTasks + completedTickets,
            completionRate: (totalTasks + totalTickets) > 0 ? ((completedTasks + completedTickets) / (totalTasks + totalTickets)) * 100 : 0
          };
        } catch (error) {
          console.warn('Error calculating operational efficiency metrics:', error);
          result.metrics.operationalEfficiency = { totalTasks: 0, completedTasks: 0, completionRate: 0 };
        }
      }

      // Calculate ADR (Average Daily Rate)
      if (metricsList.includes('averageDailyRate')) {
        try {
          const reservationsSnapshot = await db.collection('reservations')
            .where('tenantId', '==', tenantId)
            .where('checkOut', '>=', startTimestamp)
            .where('checkIn', '<=', endTimestamp)
            .get();

          const totalRevenue = reservationsSnapshot.docs.reduce((sum, doc) => {
            const data = doc.data();
            return sum + (data.totalAmount || 0);
          }, 0);

          const totalRoomNights = reservationsSnapshot.docs.reduce((sum, doc) => {
            const data = doc.data();
            const checkIn = toDate(data.checkIn);
            const checkOut = toDate(data.checkOut);
            if (checkIn && checkOut) {
              const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
              return sum + nights;
            }
            return sum;
          }, 0);

          result.metrics.averageDailyRate = {
            totalRevenue,
            totalRoomNights,
            adr: totalRoomNights > 0 ? totalRevenue / totalRoomNights : 0
          };
        } catch (error) {
          console.warn('Error calculating ADR metrics:', error);
          result.metrics.averageDailyRate = { totalRevenue: 0, totalRoomNights: 0, adr: 0 };
        }
      }

      // Calculate RevPAR (Revenue Per Available Room)
      if (metricsList.includes('revpar')) {
        try {
          const totalRooms = await db.collection('rooms')
            .where('tenantId', '==', tenantId)
            .get();

          const totalRoomDays = totalRooms.docs.length * Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

          const paymentsSnapshot = await db.collection('payments')
            .where('tenantId', '==', tenantId)
            .where('status', '==', 'completed')
            .get();

          const totalRevenue = paymentsSnapshot.docs.reduce((sum, doc) => {
            const data = doc.data();
            const paymentDate = toDate(data.createdAt);
            if (paymentDate && paymentDate >= start && paymentDate <= end) {
              return sum + (data.amount || 0);
            }
            return sum;
          }, 0);

          result.metrics.revpar = {
            totalRevenue,
            totalRoomDays,
            revpar: totalRoomDays > 0 ? totalRevenue / totalRoomDays : 0
          };
        } catch (error) {
          console.warn('Error calculating RevPAR metrics:', error);
          result.metrics.revpar = { totalRevenue: 0, totalRoomDays: 0, revpar: 0 };
        }
      }

      // Calculate GOPPAR (Gross Operating Profit Per Available Room)
      if (metricsList.includes('goppar')) {
        // This would require detailed cost data - placeholder for now
        result.metrics.goppar = {
          note: 'GOPPAR calculation requires detailed cost accounting integration',
          value: null
        };
      }

      res.json({
        success: true,
        data: result
      });
    } catch (error: any) {
      console.error('Error fetching performance metrics:', error);
      throw new AppError(
        `Failed to fetch performance metrics: ${error.message || 'Database connection error'}`,
        500
      );
    }
  }
);

// GET /api/tenants/:tenantId/reports/guest-feedback
reportRouter.get(
  '/guest-feedback',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const { startDate, endDate, type = 'all' } = req.query;

      const start = startDate ? new Date(startDate as string) : subDays(new Date(), 30);
      const end = endDate ? new Date(endDate as string) : new Date();

      // This is a placeholder for a guest feedback system
      // In a real implementation, this would pull from a feedback collection
      const feedback = {
        period: { start, end },
        summary: {
          totalFeedback: 0,
          averageRating: 0,
          responseRate: 0,
          categories: {
            cleanliness: { count: 0, averageRating: 0 },
            service: { count: 0, averageRating: 0 },
            amenities: { count: 0, averageRating: 0 },
            value: { count: 0, averageRating: 0 },
            location: { count: 0, averageRating: 0 }
          }
        },
        recentFeedback: [],
        note: 'Guest feedback system not yet implemented. This endpoint is ready for integration with feedback collection services like ReviewPro, TripAdvisor, or custom feedback forms.'
      };

      res.json({
        success: true,
        data: feedback
      });
    } catch (error: any) {
      console.error('Error fetching guest feedback:', error);
      throw new AppError(
        `Failed to fetch guest feedback: ${error.message || 'Database connection error'}`,
        500
      );
    }
  }
);

// GET /api/tenants/:tenantId/reports/financial
reportRouter.get(
  '/financial',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const { startDate, endDate, reportType = 'summary' } = req.query;

      const start = startDate ? new Date(startDate as string) : startOfMonth(new Date());
      const end = endDate ? new Date(endDate as string) : endOfDay(new Date());

      const startTimestamp = toTimestamp(start);
      const endTimestamp = toTimestamp(end);

      const result: any = {
        period: { start, end },
        reportType,
        summary: {}
      };

      // Get revenue breakdown
      try {
        const paymentsSnapshot = await db.collection('payments')
          .where('tenantId', '==', tenantId)
          .where('status', '==', 'completed')
          .get();

        const revenueByMethod: any = {};
        let totalRevenue = 0;
        let totalTransactions = 0;

        paymentsSnapshot.docs.forEach(doc => {
          const data = doc.data();
          const paymentDate = toDate(data.createdAt);

          if (paymentDate && paymentDate >= start && paymentDate <= end) {
            const amount = data.amount || 0;
            const method = data.method || 'other';

            totalRevenue += amount;
            totalTransactions += 1;

            if (!revenueByMethod[method]) {
              revenueByMethod[method] = 0;
            }
            revenueByMethod[method] += amount;
          }
        });

        result.summary.revenue = {
          totalRevenue,
          totalTransactions,
          averageTransaction: totalTransactions > 0 ? totalRevenue / totalTransactions : 0,
          byMethod: revenueByMethod
        };
      } catch (error) {
        console.warn('Error calculating financial revenue:', error);
        result.summary.revenue = { totalRevenue: 0, totalTransactions: 0, averageTransaction: 0, byMethod: {} };
      }

      // Get expense breakdown (placeholder - would integrate with expense tracking)
      result.summary.expenses = {
        totalExpenses: 0,
        byCategory: {
          'Housekeeping': 0,
          'Maintenance': 0,
          'Utilities': 0,
          'Marketing': 0,
          'Administrative': 0
        },
        note: 'Expense tracking requires integration with accounting/expense management system'
      };

      // Calculate profit/loss
      result.summary.profitLoss = {
        grossRevenue: result.summary.revenue.totalRevenue,
        totalExpenses: result.summary.expenses.totalExpenses,
        netProfit: result.summary.revenue.totalRevenue - result.summary.expenses.totalExpenses,
        profitMargin: result.summary.revenue.totalRevenue > 0 ?
          ((result.summary.revenue.totalRevenue - result.summary.expenses.totalExpenses) / result.summary.revenue.totalRevenue) * 100 : 0
      };

      // Cash flow analysis
      result.cashFlow = {
        operatingCashFlow: result.summary.revenue.totalRevenue - result.summary.expenses.totalExpenses,
        investingCashFlow: 0, // Would track capital expenditures
        financingCashFlow: 0, // Would track loans, equity, etc.
        netCashFlow: result.summary.revenue.totalRevenue - result.summary.expenses.totalExpenses
      };

      res.json({
        success: true,
        data: result
      });
    } catch (error: any) {
      console.error('Error fetching financial report:', error);
      throw new AppError(
        `Failed to fetch financial report: ${error.message || 'Database connection error'}`,
        500
      );
    }
  }
);

// POST /api/tenants/:tenantId/reports/custom
reportRouter.post(
  '/custom',
  authenticate,
  requireTenantAccess,
  requireRole('manager', 'admin'),
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const {
        name,
        description,
        dateRange,
        metrics,
        filters,
        groupBy,
        format = 'json'
      } = req.body;

      // Validate required fields
      if (!name || !dateRange || !metrics) {
        throw new AppError('Missing required fields: name, dateRange, metrics', 400);
      }

      const start = new Date(dateRange.start);
      const end = new Date(dateRange.end);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new AppError('Invalid date range', 400);
      }

      // Create custom report configuration
      const customReport = {
        id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        tenantId,
        name,
        description,
        dateRange: { start, end },
        metrics,
        filters: filters || {},
        groupBy: groupBy || 'day',
        format,
        createdBy: req.user?.id,
        createdAt: now(),
        status: 'processing'
      };

      // Save report configuration
      await db.collection('customReports').doc(customReport.id).set({
        ...customReport,
        dateRange: {
          start: toTimestamp(start),
          end: toTimestamp(end)
        }
      });

      // Process the report (this would typically be done asynchronously)
      const reportData = await generateCustomReport(tenantId, metrics, { start, end }, filters, groupBy);

      // Update report with results
      await db.collection('customReports').doc(customReport.id).update({
        status: 'completed',
        data: reportData,
        completedAt: now()
      });

      res.json({
        success: true,
        data: {
          ...customReport,
          data: reportData,
          status: 'completed'
        }
      });
    } catch (error: any) {
      console.error('Error creating custom report:', error);
      throw new AppError(
        `Failed to create custom report: ${error.message || 'Processing error'}`,
        500
      );
    }
  }
);

// GET /api/tenants/:tenantId/reports/custom
reportRouter.get(
  '/custom',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const { limit = 20 } = req.query;

      const reportsSnapshot = await db.collection('customReports')
        .where('tenantId', '==', tenantId)
        .orderBy('createdAt', 'desc')
        .limit(Number(limit))
        .get();

      const reports = reportsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name,
          description: data.description,
          dateRange: {
            start: toDate(data.dateRange.start),
            end: toDate(data.dateRange.end)
          },
          metrics: data.metrics,
          filters: data.filters,
          groupBy: data.groupBy,
          format: data.format,
          status: data.status,
          createdAt: toDate(data.createdAt),
          completedAt: data.completedAt ? toDate(data.completedAt) : null,
          createdBy: data.createdBy
        };
      });

      res.json({
        success: true,
        data: reports,
        total: reports.length
      });
    } catch (error: any) {
      console.error('Error fetching custom reports:', error);
      throw new AppError(
        `Failed to fetch custom reports: ${error.message || 'Database connection error'}`,
        500
      );
    }
  }
);

// Helper function to generate custom reports
async function generateCustomReport(
  tenantId: string,
  metrics: string[],
  dateRange: { start: Date; end: Date },
  filters: any = {},
  groupBy: string = 'day'
) {
  const startTimestamp = toTimestamp(dateRange.start);
  const endTimestamp = toTimestamp(dateRange.end);

  const result: any = {
    period: dateRange,
    groupBy,
    data: []
  };

  // This is a simplified implementation - in production, this would be more sophisticated
  // with proper aggregation and grouping logic

  if (metrics.includes('revenue')) {
    try {
      const paymentsSnapshot = await db.collection('payments')
        .where('tenantId', '==', tenantId)
        .where('status', '==', 'completed')
        .get();

      const revenueData: any = {};

      paymentsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const paymentDate = toDate(data.createdAt);

        if (paymentDate && paymentDate >= dateRange.start && paymentDate <= dateRange.end) {
          const dateKey = format(paymentDate, groupBy === 'month' ? 'yyyy-MM' : 'yyyy-MM-dd');
          const amount = data.amount || 0;

          if (!revenueData[dateKey]) {
            revenueData[dateKey] = { date: dateKey, revenue: 0, transactions: 0 };
          }
          revenueData[dateKey].revenue += amount;
          revenueData[dateKey].transactions += 1;
        }
      });

      result.revenue = Object.values(revenueData);
    } catch (error) {
      console.warn('Error generating revenue data for custom report:', error);
      result.revenue = [];
    }
  }

  if (metrics.includes('occupancy')) {
    try {
      const occupancySnapshot = await db.collection('roomOccupancy')
        .where('tenantId', '==', tenantId)
        .where('date', '>=', startTimestamp)
        .where('date', '<=', endTimestamp)
        .get();

      const occupancyData: any = {};

      occupancySnapshot.docs.forEach(doc => {
        const data = doc.data();
        const date = toDate(data.date);
        if (date) {
          const dateKey = format(date, groupBy === 'month' ? 'yyyy-MM' : 'yyyy-MM-dd');

          if (!occupancyData[dateKey]) {
            occupancyData[dateKey] = { date: dateKey, occupiedRooms: 0, totalRooms: data.totalRooms || 0 };
          }
          occupancyData[dateKey].occupiedRooms += data.occupiedRooms || 0;
        }
      });

      // Calculate occupancy rates
      Object.values(occupancyData).forEach((item: any) => {
        item.occupancyRate = item.totalRooms > 0 ? (item.occupiedRooms / item.totalRooms) * 100 : 0;
      });

      result.occupancy = Object.values(occupancyData);
    } catch (error) {
      console.warn('Error generating occupancy data for custom report:', error);
      result.occupancy = [];
    }
  }

  return result;
}