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

      const auditsSnapshot = await db.collection('nightAudits')
        .where('tenantId', '==', tenantId)
        .orderBy('auditDate', 'desc')
        .limit(Number(limit))
        .get();

      const audits = auditsSnapshot.docs.map(doc => {
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
