import { Router } from 'express';
import { authenticate, requireTenantAccess, AuthRequest } from '../middleware/auth';
import { startOfDay, endOfDay, startOfMonth, endOfMonth } from 'date-fns';
import { AppError } from '../middleware/errorHandler';
import { db, toDate, toTimestamp } from '../utils/firestore';

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
