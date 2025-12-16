import { Router } from 'express';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler';
import { authenticate, requireTenantAccess, requireRole, AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/audit';
import { db, now, toDate } from '../utils/firestore';
import { hashPassword } from '../utils/password';

export const staffRouter = Router({ mergeParams: true });

const roleClassifications = ['normal_staff', 'supervisor', 'manager', 'senior_executive'] as const;

const createStaffSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
  role: z.string().min(1), // e.g., 'chef', 'housekeeper', 'front_desk', etc.
  roleClassification: z.enum(roleClassifications),
  roleDescription: z.string().optional(), // Custom description for the role
  isActive: z.boolean().default(true),
});

const updateStaffSchema = z.object({
  email: z.string().email().optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().optional(),
  role: z.string().min(1).optional(),
  roleClassification: z.enum(roleClassifications).optional(),
  roleDescription: z.string().optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(6).optional(),
});

// GET /api/tenants/:tenantId/staff
staffRouter.get(
  '/',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const { role, roleClassification, isActive, search } = req.query;

      // Build query - Firestore doesn't support != with other where clauses
      // So we'll filter out owners in memory
      let query: FirebaseFirestore.Query = db.collection('users')
        .where('tenantId', '==', tenantId);

      if (role) {
        query = query.where('role', '==', role);
      }

      if (roleClassification) {
        query = query.where('roleClassification', '==', roleClassification);
      }

      if (isActive !== undefined) {
        query = query.where('isActive', '==', isActive === 'true');
      }

      const snapshot = await query.get();
      let staff = snapshot.docs
        .filter(doc => {
          const data = doc.data();
          return data.role !== 'owner'; // Exclude owner from staff list
        })
        .map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            email: data.email,
            firstName: data.firstName,
            lastName: data.lastName,
            phone: data.phone || null,
            role: data.role,
            roleClassification: data.roleClassification || null,
            roleDescription: data.roleDescription || null,
            isActive: data.isActive !== undefined ? data.isActive : true,
            lastLoginAt: data.lastLoginAt ? toDate(data.lastLoginAt) : null,
            createdAt: toDate(data.createdAt),
            updatedAt: toDate(data.updatedAt),
          };
        });

      // Filter by search term if provided
      if (search) {
        const searchLower = String(search).toLowerCase();
        staff = staff.filter(s => 
          s.firstName.toLowerCase().includes(searchLower) ||
          s.lastName.toLowerCase().includes(searchLower) ||
          s.email.toLowerCase().includes(searchLower) ||
          s.role.toLowerCase().includes(searchLower) ||
          (s.roleDescription && s.roleDescription.toLowerCase().includes(searchLower))
        );
      }

      res.json({
        success: true,
        data: staff,
      });
    } catch (error: any) {
      console.error('Error fetching staff:', error);
      throw new AppError(
        `Failed to fetch staff: ${error.message || 'Database connection error'}`,
        500
      );
    }
  }
);

// GET /api/tenants/:tenantId/staff/:id
staffRouter.get(
  '/:id',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const staffId = req.params.id;

      const staffDoc = await db.collection('users').doc(staffId).get();

      if (!staffDoc.exists) {
        throw new AppError('Staff member not found', 404);
      }

      const staffData = staffDoc.data();
      if (staffData?.tenantId !== tenantId || staffData?.role === 'owner') {
        throw new AppError('Staff member not found', 404);
      }

      const staff = {
        id: staffDoc.id,
        email: staffData.email,
        firstName: staffData.firstName,
        lastName: staffData.lastName,
        phone: staffData.phone || null,
        role: staffData.role,
        roleClassification: staffData.roleClassification || null,
        roleDescription: staffData.roleDescription || null,
        isActive: staffData.isActive !== undefined ? staffData.isActive : true,
        lastLoginAt: staffData.lastLoginAt ? toDate(staffData.lastLoginAt) : null,
        createdAt: toDate(staffData.createdAt),
        updatedAt: toDate(staffData.updatedAt),
      };

      res.json({
        success: true,
        data: staff,
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Error fetching staff member:', error);
      throw new AppError(
        `Failed to fetch staff member: ${error.message || 'Database connection error'}`,
        500
      );
    }
  }
);

// POST /api/tenants/:tenantId/staff
staffRouter.post(
  '/',
  authenticate,
  requireTenantAccess,
  requireRole('owner', 'general_manager'),
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const data = createStaffSchema.parse(req.body);

      // Check if email already exists for this tenant
      const existingSnapshot = await db.collection('users')
        .where('tenantId', '==', tenantId)
        .where('email', '==', data.email)
        .limit(1)
        .get();

      if (!existingSnapshot.empty) {
        throw new AppError('Email already exists', 400);
      }

      // Hash password
      const passwordHash = await hashPassword(data.password);

      // Create staff member
      const staffRef = db.collection('users').doc();
      const staffData = {
        tenantId,
        email: data.email,
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone || null,
        role: data.role,
        roleClassification: data.roleClassification,
        roleDescription: data.roleDescription || null,
        isActive: data.isActive !== undefined ? data.isActive : true,
        createdAt: now(),
        updatedAt: now(),
      };

      await staffRef.set(staffData);

      const staff = {
        id: staffRef.id,
        email: staffData.email,
        firstName: staffData.firstName,
        lastName: staffData.lastName,
        phone: staffData.phone,
        role: staffData.role,
        roleClassification: staffData.roleClassification,
        roleDescription: staffData.roleDescription,
        isActive: staffData.isActive,
        createdAt: toDate(staffData.createdAt),
        updatedAt: toDate(staffData.updatedAt),
      };

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'create_staff',
        entityType: 'user',
        entityId: staffRef.id,
        afterState: staff,
      });

      res.status(201).json({
        success: true,
        data: staff,
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Error creating staff:', error);
      throw new AppError(
        `Failed to create staff: ${error.message || 'Database connection error'}`,
        500
      );
    }
  }
);

// PATCH /api/tenants/:tenantId/staff/:id
staffRouter.patch(
  '/:id',
  authenticate,
  requireTenantAccess,
  requireRole('owner', 'general_manager'),
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const staffId = req.params.id;
      const data = updateStaffSchema.parse(req.body);

      const staffDoc = await db.collection('users').doc(staffId).get();

      if (!staffDoc.exists) {
        throw new AppError('Staff member not found', 404);
      }

      const staffData = staffDoc.data();
      if (staffData?.tenantId !== tenantId || staffData?.role === 'owner') {
        throw new AppError('Staff member not found', 404);
      }

      // Check email uniqueness if email is being updated
      if (data.email && data.email !== staffData.email) {
        const existingSnapshot = await db.collection('users')
          .where('tenantId', '==', tenantId)
          .where('email', '==', data.email)
          .limit(1)
          .get();

        if (!existingSnapshot.empty) {
          throw new AppError('Email already exists', 400);
        }
      }

      const beforeState = {
        id: staffDoc.id,
        email: staffData.email,
        firstName: staffData.firstName,
        lastName: staffData.lastName,
        phone: staffData.phone || null,
        role: staffData.role,
        roleClassification: staffData.roleClassification || null,
        roleDescription: staffData.roleDescription || null,
        isActive: staffData.isActive !== undefined ? staffData.isActive : true,
        createdAt: toDate(staffData.createdAt),
        updatedAt: toDate(staffData.updatedAt),
      };

      // Update staff member
      const updateData: any = {
        updatedAt: now(),
      };

      if (data.email !== undefined) updateData.email = data.email;
      if (data.firstName !== undefined) updateData.firstName = data.firstName;
      if (data.lastName !== undefined) updateData.lastName = data.lastName;
      if (data.phone !== undefined) updateData.phone = data.phone || null;
      if (data.role !== undefined) updateData.role = data.role;
      if (data.roleClassification !== undefined) updateData.roleClassification = data.roleClassification;
      if (data.roleDescription !== undefined) updateData.roleDescription = data.roleDescription || null;
      if (data.isActive !== undefined) updateData.isActive = data.isActive;
      if (data.password !== undefined) {
        updateData.passwordHash = await hashPassword(data.password);
      }

      await staffDoc.ref.update(updateData);

      // Get updated staff member
      const updatedDoc = await db.collection('users').doc(staffId).get();
      const updatedData = updatedDoc.data();

      const updated = {
        id: updatedDoc.id,
        email: updatedData?.email,
        firstName: updatedData?.firstName,
        lastName: updatedData?.lastName,
        phone: updatedData?.phone || null,
        role: updatedData?.role,
        roleClassification: updatedData?.roleClassification || null,
        roleDescription: updatedData?.roleDescription || null,
        isActive: updatedData?.isActive !== undefined ? updatedData.isActive : true,
        createdAt: toDate(updatedData?.createdAt),
        updatedAt: toDate(updatedData?.updatedAt),
      };

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'update_staff',
        entityType: 'user',
        entityId: staffId,
        beforeState,
        afterState: updated,
      });

      res.json({
        success: true,
        data: updated,
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Error updating staff:', error);
      throw new AppError(
        `Failed to update staff: ${error.message || 'Database connection error'}`,
        500
      );
    }
  }
);

// DELETE /api/tenants/:tenantId/staff/:id
staffRouter.delete(
  '/:id',
  authenticate,
  requireTenantAccess,
  requireRole('owner', 'general_manager'),
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const staffId = req.params.id;

      const staffDoc = await db.collection('users').doc(staffId).get();

      if (!staffDoc.exists) {
        throw new AppError('Staff member not found', 404);
      }

      const staffData = staffDoc.data();
      if (staffData?.tenantId !== tenantId || staffData?.role === 'owner') {
        throw new AppError('Staff member not found', 404);
      }

      // Don't allow deleting yourself
      if (staffId === req.user!.id) {
        throw new AppError('Cannot delete your own account', 400);
      }

      const beforeState = {
        id: staffDoc.id,
        email: staffData.email,
        firstName: staffData.firstName,
        lastName: staffData.lastName,
        role: staffData.role,
        createdAt: toDate(staffData.createdAt),
        updatedAt: toDate(staffData.updatedAt),
      };

      // Soft delete - set isActive to false instead of deleting
      await staffDoc.ref.update({
        isActive: false,
        updatedAt: now(),
      });

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'delete_staff',
        entityType: 'user',
        entityId: staffId,
        beforeState,
        afterState: null,
      });

      res.json({
        success: true,
        message: 'Staff member deactivated successfully',
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Error deleting staff:', error);
      throw new AppError(
        `Failed to delete staff: ${error.message || 'Database connection error'}`,
        500
      );
    }
  }
);

