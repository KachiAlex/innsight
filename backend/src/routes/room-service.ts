import { Router } from 'express';
import { AppError } from '../middleware/errorHandler';
import { authenticate, requireTenantAccess, AuthRequest } from '../middleware/auth';
import { db, toDate, toTimestamp, now } from '../utils/firestore';
import { getPaginationParams, createPaginationResult } from '../utils/pagination';
import admin from 'firebase-admin';

export const roomServiceRouter = Router({ mergeParams: true });

// ============================================
// MENU MANAGEMENT
// ============================================

// GET /api/tenants/:tenantId/menu/categories - List menu categories
roomServiceRouter.get('/menu/categories', authenticate, requireTenantAccess, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.params.tenantId;

    const categoriesSnapshot = await db.collection('menu_categories')
      .where('tenantId', '==', tenantId)
      .where('isActive', '==', true)
      .orderBy('displayOrder', 'asc')
      .get();

    const categories = categoriesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: toDate(doc.data().createdAt),
      updatedAt: toDate(doc.data().updatedAt),
    }));

    res.json({
      success: true,
      data: categories,
    });
  } catch (error: any) {
    console.error('Error fetching menu categories:', error);
    throw new AppError(
      `Failed to fetch menu categories: ${error.message || 'Unknown error'}`,
      500
    );
  }
});

// POST /api/tenants/:tenantId/menu/categories - Create menu category
roomServiceRouter.post('/menu/categories', authenticate, requireTenantAccess, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.params.tenantId;
    const categoryData = req.body;

    if (!categoryData.name) {
      throw new AppError('Category name is required', 400);
    }

    const timestamp = now();
    const categoryRecord = {
      tenantId,
      name: categoryData.name,
      description: categoryData.description || null,
      displayOrder: categoryData.displayOrder || 0,
      isActive: categoryData.isActive !== false,
      imageUrl: categoryData.imageUrl || null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const docRef = await db.collection('menu_categories').add(categoryRecord);

    res.json({
      success: true,
      data: {
        id: docRef.id,
        ...categoryRecord,
        createdAt: toDate(timestamp),
        updatedAt: toDate(timestamp),
      },
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Error creating menu category:', error);
    throw new AppError(
      `Failed to create menu category: ${error.message || 'Unknown error'}`,
      500
    );
  }
});

// GET /api/tenants/:tenantId/menu/items - List menu items
roomServiceRouter.get('/menu/items', authenticate, requireTenantAccess, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.params.tenantId;
    const { categoryId, search, isActive = 'true' } = req.query;

    let query: admin.firestore.Query = db.collection('menu_items')
      .where('tenantId', '==', tenantId);

    if (isActive === 'true') {
      query = query.where('isActive', '==', true);
    }

    if (categoryId) {
      query = query.where('categoryId', '==', categoryId);
    }

    const itemsSnapshot = await query.get();

    let items: any[] = itemsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        price: Number(data.price),
        createdAt: toDate(data.createdAt),
        updatedAt: toDate(data.updatedAt),
      };
    });

    // Client-side search filtering
    if (search) {
      const searchLower = (search as string).toLowerCase();
      items = items.filter(item =>
        item.name?.toLowerCase().includes(searchLower) ||
        item.description?.toLowerCase().includes(searchLower)
      );
    }

    // Group by category if no specific category requested
    let response;
    if (!categoryId) {
      const groupedItems: Record<string, any[]> = {};
      items.forEach(item => {
        const catId = item.categoryId;
        if (!groupedItems[catId]) {
          groupedItems[catId] = [];
        }
        groupedItems[catId].push(item);
      });
      response = groupedItems;
    } else {
      response = items;
    }

    res.json({
      success: true,
      data: response,
    });
  } catch (error: any) {
    console.error('Error fetching menu items:', error);
    throw new AppError(
      `Failed to fetch menu items: ${error.message || 'Unknown error'}`,
      500
    );
  }
});

// POST /api/tenants/:tenantId/menu/items - Create menu item
roomServiceRouter.post('/menu/items', authenticate, requireTenantAccess, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.params.tenantId;
    const itemData = req.body;

    // Validate required fields
    if (!itemData.name || !itemData.categoryId || !itemData.price) {
      throw new AppError('Name, category, and price are required', 400);
    }

    // Verify category exists
    const categoryDoc = await db.collection('menu_categories').doc(itemData.categoryId).get();
    if (!categoryDoc.exists || categoryDoc.data()?.tenantId !== tenantId) {
      throw new AppError('Menu category not found', 404);
    }

    const timestamp = now();
    const itemRecord = {
      tenantId,
      categoryId: itemData.categoryId,
      name: itemData.name,
      description: itemData.description || null,
      price: Number(itemData.price),
      imageUrl: itemData.imageUrl || null,
      isActive: itemData.isActive !== false,
      isVegetarian: itemData.isVegetarian || false,
      isVegan: itemData.isVegan || false,
      isGlutenFree: itemData.isGlutenFree || false,
      containsNuts: itemData.containsNuts || false,
      spiceLevel: itemData.spiceLevel || 'mild',
      preparationTime: itemData.preparationTime || null,
      allergens: itemData.allergens || [],
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const docRef = await db.collection('menu_items').add(itemRecord);

    res.json({
      success: true,
      data: {
        id: docRef.id,
        ...itemRecord,
        createdAt: toDate(timestamp),
        updatedAt: toDate(timestamp),
      },
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Error creating menu item:', error);
    throw new AppError(
      `Failed to create menu item: ${error.message || 'Unknown error'}`,
      500
    );
  }
});

// ============================================
// ORDER MANAGEMENT
// ============================================

// GET /api/tenants/:tenantId/room-service/orders - List room service orders
roomServiceRouter.get('/orders', authenticate, requireTenantAccess, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.params.tenantId;
    const { page, limit } = getPaginationParams(req);
    const { status, roomNumber, date } = req.query;

    let query: admin.firestore.Query = db.collection('room_service_orders')
      .where('tenantId', '==', tenantId);

    if (status) {
      query = query.where('status', '==', status);
    }

    if (date) {
      const startOfDay = new Date(date as string);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date as string);
      endOfDay.setHours(23, 59, 59, 999);

      query = query.where('requestedAt', '>=', toTimestamp(startOfDay))
                   .where('requestedAt', '<=', toTimestamp(endOfDay));
    }

    const ordersSnapshot = await query
      .orderBy('requestedAt', 'desc')
      .get();

    let orders = ordersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      subtotal: Number(doc.data().subtotal || 0),
      taxAmount: Number(doc.data().taxAmount || 0),
      serviceCharge: Number(doc.data().serviceCharge || 0),
      totalAmount: Number(doc.data().totalAmount || 0),
      requestedAt: toDate(doc.data().requestedAt),
      confirmedAt: doc.data().confirmedAt ? toDate(doc.data().confirmedAt) : null,
      estimatedDelivery: doc.data().estimatedDelivery ? toDate(doc.data().estimatedDelivery) : null,
      deliveredAt: doc.data().deliveredAt ? toDate(doc.data().deliveredAt) : null,
      preparedAt: doc.data().preparedAt ? toDate(doc.data().preparedAt) : null,
    }));

    // Client-side filtering for room number
    if (roomNumber) {
      orders = orders.filter((order: any) => order.roomNumber === roomNumber);
    }

    const total = orders.length;
    const skip = (page - 1) * limit;
    const paginatedOrders = orders.slice(skip, skip + limit);

    const result = createPaginationResult(paginatedOrders, total, page, limit);

    res.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error('Error fetching room service orders:', error);
    throw new AppError(
      `Failed to fetch room service orders: ${error.message || 'Unknown error'}`,
      500
    );
  }
});

// POST /api/tenants/:tenantId/room-service/orders - Create room service order
roomServiceRouter.post('/orders', authenticate, requireTenantAccess, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.params.tenantId;
    const orderData = req.body;

    // Validate required fields
    if (!orderData.guestName || !orderData.roomNumber || !orderData.items || !orderData.items.length) {
      throw new AppError('Guest name, room number, and items are required', 400);
    }

    // Generate order number
    const timestamp = now();
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
    const orderNumber = `RS-${dateStr}-${randomStr}`;

    // Calculate totals
    let subtotal = 0;
    const orderItems: any[] = [];

    for (const item of orderData.items) {
      // Get menu item details
      const menuItemDoc = await db.collection('menu_items').doc(item.menuItemId).get();
      if (!menuItemDoc.exists) {
        throw new AppError(`Menu item ${item.menuItemId} not found`, 404);
      }

      const menuItem = menuItemDoc.data();
      const unitPrice = Number(menuItem?.price || 0);
      const quantity = item.quantity || 1;
      const totalPrice = unitPrice * quantity;

      subtotal += totalPrice;

      orderItems.push({
        orderId: '', // Will be set after order creation
        menuItemId: item.menuItemId,
        quantity,
        unitPrice,
        totalPrice,
        specialRequests: item.specialRequests || null,
        status: 'pending',
      });
    }

    // Calculate tax and service charge (you can customize these rates)
    const taxRate = 0.08; // 8% tax
    const serviceChargeRate = 0.10; // 10% service charge
    const taxAmount = subtotal * taxRate;
    const serviceCharge = subtotal * serviceChargeRate;
    const totalAmount = subtotal + taxAmount + serviceCharge;

    // Create order
    const orderRecord = {
      tenantId,
      orderNumber,
      guestId: orderData.guestId || null,
      guestName: orderData.guestName,
      roomNumber: orderData.roomNumber,
      guestPhone: orderData.guestPhone || null,
      status: 'pending',
      orderType: orderData.orderType || 'room_service',
      specialInstructions: orderData.specialInstructions || null,
      estimatedDelivery: orderData.estimatedDelivery ? toTimestamp(new Date(orderData.estimatedDelivery)) : null,
      subtotal: Math.round(subtotal * 100) / 100,
      taxAmount: Math.round(taxAmount * 100) / 100,
      serviceCharge: Math.round(serviceCharge * 100) / 100,
      totalAmount: Math.round(totalAmount * 100) / 100,
      requestedAt: timestamp,
      createdBy: req.user?.id || null,
      updatedAt: timestamp,
    };

    const orderRef = await db.collection('room_service_orders').add(orderRecord);

    // Create order items
    const batch = db.batch();
    orderItems.forEach(item => {
      const itemRef = db.collection('room_service_order_items').doc();
      batch.set(itemRef, {
        ...item,
        tenantId,
        orderId: orderRef.id,
      });
    });
    await batch.commit();

    // Log activity if guest is known
    if (orderData.guestId) {
      await db.collection('guest_activity_logs').add({
        tenantId,
        guestId: orderData.guestId,
        activityType: 'room_service_order',
        title: 'Room Service Order Placed',
        description: `Order ${orderNumber} placed for ${orderData.items.length} items`,
        metadata: { orderId: orderRef.id, orderNumber, roomNumber: orderData.roomNumber },
        performedBy: req.user?.id || null,
        createdAt: timestamp,
      });
    }

    res.json({
      success: true,
      data: {
        id: orderRef.id,
        ...orderRecord,
        items: orderItems.map(item => ({ ...item, orderId: orderRef.id })),
        requestedAt: toDate(timestamp),
      },
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Error creating room service order:', error);
    throw new AppError(
      `Failed to create room service order: ${error.message || 'Unknown error'}`,
      500
    );
  }
});

// GET /api/tenants/:tenantId/room-service/orders/:orderId - Get order details
roomServiceRouter.get('/orders/:orderId', authenticate, requireTenantAccess, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.params.tenantId;
    const orderId = req.params.orderId;

    const orderDoc = await db.collection('room_service_orders').doc(orderId).get();

    if (!orderDoc.exists || orderDoc.data()?.tenantId !== tenantId) {
      throw new AppError('Room service order not found', 404);
    }

    // Get order items
    const itemsSnapshot = await db.collection('room_service_order_items')
      .where('tenantId', '==', tenantId)
      .where('orderId', '==', orderId)
      .get();

    const items: any[] = [];
    for (const itemDoc of itemsSnapshot.docs) {
      const itemData = itemDoc.data();

      // Get menu item details
      const menuItemDoc = await db.collection('menu_items').doc(itemData.menuItemId).get();
      const menuItem = menuItemDoc.exists ? menuItemDoc.data() : null;

      items.push({
        id: itemDoc.id,
        ...itemData,
        unitPrice: Number(itemData.unitPrice),
        totalPrice: Number(itemData.totalPrice),
        menuItem: menuItem ? {
          name: (menuItem as any).name,
          description: (menuItem as any).description,
          categoryId: (menuItem as any).categoryId,
        } : null,
      });
    }

    const orderData = orderDoc.data();

    const order = {
      id: orderDoc.id,
      ...orderData,
      subtotal: Number(orderData?.subtotal || 0),
      taxAmount: Number(orderData?.taxAmount || 0),
      serviceCharge: Number(orderData?.serviceCharge || 0),
      totalAmount: Number(orderData?.totalAmount || 0),
      requestedAt: toDate(orderData?.requestedAt),
      confirmedAt: orderData?.confirmedAt ? toDate(orderData.confirmedAt) : null,
      estimatedDelivery: orderData?.estimatedDelivery ? toDate(orderData.estimatedDelivery) : null,
      deliveredAt: orderData?.deliveredAt ? toDate(orderData.deliveredAt) : null,
      preparedAt: orderData?.preparedAt ? toDate(orderData.preparedAt) : null,
      items,
    };

    res.json({
      success: true,
      data: order,
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Error fetching room service order:', error);
    throw new AppError(
      `Failed to fetch room service order: ${error.message || 'Unknown error'}`,
      500
    );
  }
});

// PUT /api/tenants/:tenantId/room-service/orders/:orderId/status - Update order status
roomServiceRouter.put('/orders/:orderId/status', authenticate, requireTenantAccess, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.params.tenantId;
    const orderId = req.params.orderId;
    const { status, notes } = req.body;

    const validStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'];
    if (!status || !validStatuses.includes(status)) {
      throw new AppError('Valid status is required', 400);
    }

    const orderDoc = await db.collection('room_service_orders').doc(orderId).get();

    if (!orderDoc.exists || orderDoc.data()?.tenantId !== tenantId) {
      throw new AppError('Room service order not found', 404);
    }

    const currentData = orderDoc.data();
    const timestamp = now();

    const updates: any = {
      status,
      updatedAt: timestamp,
    };

    // Set timestamps based on status
    if (status === 'confirmed' && !currentData?.confirmedAt) {
      updates.confirmedAt = timestamp;
    } else if (status === 'ready' && !currentData?.preparedAt) {
      updates.preparedAt = timestamp;
    } else if (status === 'delivered' && !currentData?.deliveredAt) {
      updates.deliveredAt = timestamp;
      updates.deliveredBy = req.user?.id || null;
    }

    await db.collection('room_service_orders').doc(orderId).update(updates);

    // Update order items status if applicable
    if (status === 'preparing') {
      const itemsSnapshot = await db.collection('room_service_order_items')
        .where('tenantId', '==', tenantId)
        .where('orderId', '==', orderId)
        .where('status', '==', 'pending')
        .get();

      const batch = db.batch();
      itemsSnapshot.docs.forEach(doc => {
        batch.update(doc.ref, { status: 'preparing' });
      });
      await batch.commit();
    }

    // Log activity if guest is known
    if (currentData?.guestId && status === 'delivered') {
      await db.collection('guest_activity_logs').add({
        tenantId,
        guestId: currentData.guestId,
        activityType: 'room_service_delivered',
        title: 'Room Service Delivered',
        description: `Order ${currentData.orderNumber} delivered to room ${currentData.roomNumber}`,
        metadata: { orderId, orderNumber: currentData.orderNumber },
        performedBy: req.user?.id || null,
        createdAt: timestamp,
      });
    }

    const updatedDoc = await db.collection('room_service_orders').doc(orderId).get();
    const updatedData = updatedDoc.data();

    res.json({
      success: true,
      data: {
        id: updatedDoc.id,
        ...updatedData,
        requestedAt: toDate(updatedData?.requestedAt),
        confirmedAt: updatedData?.confirmedAt ? toDate(updatedData.confirmedAt) : null,
        deliveredAt: updatedData?.deliveredAt ? toDate(updatedData.deliveredAt) : null,
        preparedAt: updatedData?.preparedAt ? toDate(updatedData.preparedAt) : null,
      },
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Error updating order status:', error);
    throw new AppError(
      `Failed to update order status: ${error.message || 'Unknown error'}`,
      500
    );
  }
});

// GET /api/tenants/:tenantId/room-service/stats/summary - Get room service statistics
roomServiceRouter.get('/stats/summary', authenticate, requireTenantAccess, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.params.tenantId;
    const { startDate, endDate } = req.query;

    let query: admin.firestore.Query = db.collection('room_service_orders')
      .where('tenantId', '==', tenantId);

    if (startDate && endDate) {
      query = query.where('requestedAt', '>=', toTimestamp(new Date(startDate as string)))
                   .where('requestedAt', '<=', toTimestamp(new Date(endDate as string)));
    }

    const ordersSnapshot = await query.get();

    const stats = {
      totalOrders: 0,
      pendingOrders: 0,
      completedOrders: 0,
      cancelledOrders: 0,
      totalRevenue: 0,
      averageOrderValue: 0,
      popularItems: {} as Record<string, number>,
      peakHours: {} as Record<string, number>,
    };

    ordersSnapshot.docs.forEach(doc => {
      const data = doc.data();
      stats.totalOrders++;

      switch (data.status) {
        case 'pending':
        case 'confirmed':
        case 'preparing':
        case 'ready':
          stats.pendingOrders++;
          break;
        case 'delivered':
          stats.completedOrders++;
          stats.totalRevenue += Number((data as any).totalAmount || 0);
          break;
        case 'cancelled':
          stats.cancelledOrders++;
          break;
      }

      // Track peak hours
      const requestedAt = toDate((data as any).requestedAt);
      const hour = requestedAt ? requestedAt.getHours() : 0;
      stats.peakHours[hour] = (stats.peakHours[hour] || 0) + 1;
    });

    if (stats.completedOrders > 0) {
      stats.averageOrderValue = stats.totalRevenue / stats.completedOrders;
    }

    res.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    console.error('Error fetching room service stats:', error);
    throw new AppError(
      `Failed to fetch room service stats: ${error.message || 'Unknown error'}`,
      500
    );
  }
});
