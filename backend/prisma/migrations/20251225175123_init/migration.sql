-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "branding" JSONB,
    "taxSettings" JSONB,
    "subscriptionStatus" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "role" TEXT NOT NULL,
    "permissions" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rooms" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "roomNumber" TEXT NOT NULL,
    "roomType" TEXT NOT NULL,
    "floor" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'available',
    "maxOccupancy" INTEGER NOT NULL,
    "amenities" JSONB,
    "ratePlanId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_plans" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "baseRate" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "seasonalRules" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "guestId" TEXT,
    "groupBookingId" TEXT,
    "reservationNumber" TEXT NOT NULL,
    "guestName" TEXT NOT NULL,
    "guestEmail" TEXT,
    "guestPhone" TEXT,
    "guestIdNumber" TEXT,
    "checkInDate" TIMESTAMP(3) NOT NULL,
    "checkOutDate" TIMESTAMP(3) NOT NULL,
    "adults" INTEGER NOT NULL DEFAULT 1,
    "children" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'confirmed',
    "source" TEXT NOT NULL DEFAULT 'manual',
    "rate" DECIMAL(10,2) NOT NULL,
    "depositAmount" DECIMAL(10,2),
    "depositStatus" TEXT,
    "depositRequired" BOOLEAN NOT NULL DEFAULT true,
    "specialRequests" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "checkedInAt" TIMESTAMP(3),
    "checkedOutAt" TIMESTAMP(3),
    "checkedInBy" TEXT,
    "checkedOutBy" TEXT,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "folios" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "reservationId" TEXT,
    "roomId" TEXT NOT NULL,
    "guestName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "totalCharges" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalPayments" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "balance" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),
    "closedBy" TEXT,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "folios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "folio_charges" (
    "id" TEXT NOT NULL,
    "folioId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "total" DECIMAL(10,2) NOT NULL,
    "taxRate" DECIMAL(5,2),
    "taxAmount" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "folio_charges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "folioId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "method" TEXT NOT NULL,
    "reference" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "paymentGateway" TEXT,
    "gatewayTransactionId" TEXT,
    "reconciled" BOOLEAN NOT NULL DEFAULT false,
    "reconciledAt" TIMESTAMP(3),
    "reconciledBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "housekeeping_tasks" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "taskType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "assignedTo" TEXT,
    "completedBy" TEXT,
    "completedAt" TIMESTAMP(3),
    "photos" JSONB,
    "checklist" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "housekeeping_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_tickets" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "roomId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'open',
    "assignedTo" TEXT,
    "reportedBy" TEXT NOT NULL,
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "photos" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintenance_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shifts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "shiftType" TEXT NOT NULL,
    "cashFloat" DECIMAL(10,2),
    "cashReceived" DECIMAL(10,2),
    "cashCounted" DECIMAL(10,2),
    "variance" DECIMAL(10,2),
    "status" TEXT NOT NULL DEFAULT 'open',
    "notes" TEXT,
    "closedAt" TIMESTAMP(3),
    "closedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audits" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "beforeState" JSONB,
    "afterState" JSONB,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "alertType" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "status" TEXT NOT NULL DEFAULT 'open',
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "iot_gateways" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "gatewayId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastSeen" TIMESTAMP(3),
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "iot_gateways_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "iot_sensors" (
    "id" TEXT NOT NULL,
    "gatewayId" TEXT NOT NULL,
    "sensorId" TEXT NOT NULL,
    "roomId" TEXT,
    "sensorType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastEventAt" TIMESTAMP(3),
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "iot_sensors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "iot_events" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "gatewayId" TEXT NOT NULL,
    "sensorId" TEXT NOT NULL,
    "roomId" TEXT,
    "eventType" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "iot_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deposit_policies" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "appliesToAllRooms" BOOLEAN NOT NULL DEFAULT true,
    "roomCategoryIds" TEXT[],
    "ratePlanIds" TEXT[],
    "depositType" TEXT NOT NULL,
    "depositValue" DECIMAL(10,2) NOT NULL,
    "maxDepositAmount" DECIMAL(10,2),
    "minDepositAmount" DECIMAL(10,2),
    "dueDaysBeforeCheckIn" INTEGER NOT NULL,
    "refundableAfterDays" INTEGER,
    "cancellationFee" DECIMAL(5,2),
    "requiresForWeekends" BOOLEAN NOT NULL DEFAULT false,
    "requiresForHolidays" BOOLEAN NOT NULL DEFAULT false,
    "requiresForPeakSeason" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deposit_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deposit_payments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "method" TEXT NOT NULL,
    "reference" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paymentGateway" TEXT,
    "gatewayTransactionId" TEXT,
    "notes" TEXT,
    "paidAt" TIMESTAMP(3),
    "processedBy" TEXT,
    "refundedAt" TIMESTAMP(3),
    "refundedBy" TEXT,
    "refundAmount" DECIMAL(10,2),
    "refundReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deposit_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_bookings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "groupBookingNumber" TEXT NOT NULL,
    "groupName" TEXT NOT NULL,
    "groupType" TEXT NOT NULL,
    "contactPerson" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "expectedGuests" INTEGER NOT NULL,
    "confirmedGuests" INTEGER NOT NULL DEFAULT 0,
    "checkInDate" TIMESTAMP(3) NOT NULL,
    "checkOutDate" TIMESTAMP(3) NOT NULL,
    "totalRooms" INTEGER NOT NULL,
    "totalRevenue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "depositAmount" DECIMAL(10,2),
    "depositPaid" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "bookingProgress" TEXT NOT NULL DEFAULT 'initial_contact',
    "specialRequests" TEXT,
    "dietaryRequirements" TEXT,
    "setupRequirements" TEXT,
    "assignedTo" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "group_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_blocks" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "groupBookingId" TEXT NOT NULL,
    "roomCategoryId" TEXT NOT NULL,
    "roomType" TEXT NOT NULL,
    "totalRooms" INTEGER NOT NULL,
    "allocatedRooms" INTEGER NOT NULL DEFAULT 0,
    "availableRooms" INTEGER NOT NULL,
    "negotiatedRate" DECIMAL(10,2),
    "discountPercent" DECIMAL(5,2),
    "checkInDate" TIMESTAMP(3) NOT NULL,
    "checkOutDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "room_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "overbooking_settings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "roomCategoryId" TEXT,
    "roomType" TEXT,
    "maxOverbookingPercent" DECIMAL(5,2) NOT NULL DEFAULT 10,
    "maxOverbookingCount" INTEGER,
    "alertThresholdPercent" DECIMAL(5,2) NOT NULL DEFAULT 5,
    "criticalThresholdPercent" DECIMAL(5,2) NOT NULL DEFAULT 8,
    "allowOverbooking" BOOLEAN NOT NULL DEFAULT false,
    "requireManagerApproval" BOOLEAN NOT NULL DEFAULT true,
    "blackoutDates" TIMESTAMP(3)[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "overbooking_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "overbooking_alerts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "roomCategoryId" TEXT NOT NULL,
    "roomType" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "totalRooms" INTEGER NOT NULL,
    "bookedRooms" INTEGER NOT NULL,
    "overbookedRooms" INTEGER NOT NULL,
    "overbookingPercent" DECIMAL(5,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "resolutionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "overbooking_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guest_requests" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "guestId" TEXT,
    "reservationId" TEXT,
    "roomId" TEXT,
    "requestType" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "guestName" TEXT,
    "guestPhone" TEXT,
    "guestEmail" TEXT,
    "roomNumber" TEXT,
    "assignedTo" TEXT,
    "department" TEXT,
    "estimatedCompletion" TIMESTAMP(3),
    "actualCompletion" TIMESTAMP(3),
    "guestNotified" BOOLEAN NOT NULL DEFAULT false,
    "lastGuestUpdate" TIMESTAMP(3),
    "source" TEXT NOT NULL DEFAULT 'manual',
    "tags" TEXT[],
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guest_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guest_request_messages" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "guestRequestId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "messageType" TEXT NOT NULL DEFAULT 'note',
    "isFromGuest" BOOLEAN NOT NULL DEFAULT false,
    "isVisibleToGuest" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guest_request_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guest_request_updates" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "guestRequestId" TEXT NOT NULL,
    "previousStatus" TEXT NOT NULL,
    "newStatus" TEXT NOT NULL,
    "updateType" TEXT NOT NULL,
    "notes" TEXT,
    "performedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guest_request_updates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lost_items" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "itemNumber" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "color" TEXT,
    "brand" TEXT,
    "serialNumber" TEXT,
    "value" DECIMAL(10,2),
    "foundLocation" TEXT NOT NULL,
    "foundBy" TEXT,
    "foundAt" TIMESTAMP(3) NOT NULL,
    "circumstances" TEXT,
    "reportedByGuestId" TEXT,
    "reportedByName" TEXT,
    "reportedByPhone" TEXT,
    "reportedByEmail" TEXT,
    "reportedByRoom" TEXT,
    "reportedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'unclaimed',
    "storageLocation" TEXT,
    "storageNotes" TEXT,
    "claimedBy" TEXT,
    "claimedAt" TIMESTAMP(3),
    "claimMethod" TEXT,
    "returnedTo" TEXT,
    "returnMethod" TEXT,
    "disposedAt" TIMESTAMP(3),
    "disposedBy" TEXT,
    "disposalMethod" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lost_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_categories" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "menu_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_items" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(8,2) NOT NULL,
    "imageUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isVegetarian" BOOLEAN NOT NULL DEFAULT false,
    "isVegan" BOOLEAN NOT NULL DEFAULT false,
    "isGlutenFree" BOOLEAN NOT NULL DEFAULT false,
    "containsNuts" BOOLEAN NOT NULL DEFAULT false,
    "spiceLevel" TEXT NOT NULL DEFAULT 'mild',
    "preparationTime" INTEGER,
    "allergens" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "menu_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_service_orders" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "guestId" TEXT,
    "guestName" TEXT NOT NULL,
    "roomNumber" TEXT NOT NULL,
    "guestPhone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "orderType" TEXT NOT NULL DEFAULT 'room_service',
    "specialInstructions" TEXT,
    "estimatedDelivery" TIMESTAMP(3),
    "subtotal" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "serviceCharge" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "deliveredAt" TIMESTAMP(3),
    "deliveredBy" TEXT,
    "deliveryNotes" TEXT,
    "assignedTo" TEXT,
    "preparedAt" TIMESTAMP(3),
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "room_service_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_service_order_items" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(8,2) NOT NULL,
    "totalPrice" DECIMAL(8,2) NOT NULL,
    "specialRequests" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "preparedAt" TIMESTAMP(3),

    CONSTRAINT "room_service_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_metrics" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "metricKey" TEXT NOT NULL,
    "metricName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "value" DECIMAL(12,2),
    "previousValue" DECIMAL(12,2),
    "changePercent" DECIMAL(8,2),
    "targetValue" DECIMAL(12,2),
    "status" TEXT NOT NULL DEFAULT 'normal',
    "periodType" TEXT NOT NULL DEFAULT 'daily',
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    "lastCalculated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "predictive_models" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "modelType" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "modelData" JSONB,
    "accuracy" DECIMAL(5,2),
    "lastTrained" TIMESTAMP(3),
    "trainingDataSize" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "confidence" DECIMAL(5,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "predictive_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_rules" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ruleName" TEXT NOT NULL,
    "ruleType" TEXT NOT NULL,
    "triggerEvent" TEXT NOT NULL,
    "conditions" JSONB,
    "actions" JSONB,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastExecuted" TIMESTAMP(3),
    "executionCount" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "smart_alerts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "alertType" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "description" TEXT,
    "threshold" JSONB,
    "conditions" JSONB,
    "notifyUsers" TEXT[],
    "notifyRoles" TEXT[],
    "channels" TEXT[] DEFAULT ARRAY['dashboard']::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'active',
    "triggeredAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "autoResolve" BOOLEAN NOT NULL DEFAULT false,
    "resolveAfterMinutes" INTEGER,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "smart_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guest_behaviors" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "guestId" TEXT,
    "behaviorType" TEXT NOT NULL,
    "behaviorKey" TEXT NOT NULL,
    "behaviorValue" TEXT NOT NULL,
    "confidence" DECIMAL(5,2) NOT NULL DEFAULT 1,
    "firstObserved" TIMESTAMP(3) NOT NULL,
    "lastObserved" TIMESTAMP(3) NOT NULL,
    "observationCount" INTEGER NOT NULL DEFAULT 1,
    "contextData" JSONB,

    CONSTRAINT "guest_behaviors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_analytics" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "dailyUsage" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "weeklyUsage" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "monthlyUsage" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "predictedDailyUsage" DECIMAL(8,2),
    "predictedWeeklyUsage" DECIMAL(8,2),
    "reorderPoint" DECIMAL(8,2),
    "lowStockAlert" BOOLEAN NOT NULL DEFAULT false,
    "overStockAlert" BOOLEAN NOT NULL DEFAULT false,
    "lastCalculated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nextReorderDate" TIMESTAMP(3),

    CONSTRAINT "inventory_analytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guests" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "idNumber" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "nationality" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "postalCode" TEXT,
    "loyaltyTier" TEXT NOT NULL DEFAULT 'bronze',
    "loyaltyPoints" INTEGER NOT NULL DEFAULT 0,
    "totalStays" INTEGER NOT NULL DEFAULT 0,
    "totalNights" INTEGER NOT NULL DEFAULT 0,
    "totalSpent" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "preferredRoomType" TEXT,
    "preferredFloor" INTEGER,
    "smokingPreference" BOOLEAN NOT NULL DEFAULT false,
    "bedPreference" TEXT,
    "pillowPreference" TEXT,
    "dietaryRestrictions" JSONB,
    "allergies" JSONB,
    "specialRequests" TEXT,
    "isVIP" BOOLEAN NOT NULL DEFAULT false,
    "isBanned" BOOLEAN NOT NULL DEFAULT false,
    "bannedReason" TEXT,
    "bannedAt" TIMESTAMP(3),
    "marketingOptIn" BOOLEAN NOT NULL DEFAULT true,
    "emailOptIn" BOOLEAN NOT NULL DEFAULT true,
    "smsOptIn" BOOLEAN NOT NULL DEFAULT true,
    "firstStayDate" TIMESTAMP(3),
    "lastStayDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guest_activity_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "activityType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "performedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guest_activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guest_notes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "noteType" TEXT NOT NULL DEFAULT 'general',
    "note" TEXT NOT NULL,
    "isImportant" BOOLEAN NOT NULL DEFAULT false,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guest_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_programs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "programName" TEXT NOT NULL DEFAULT 'InnSight Rewards',
    "pointsPerNight" INTEGER NOT NULL DEFAULT 10,
    "pointsPerCurrency" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "silverThreshold" INTEGER NOT NULL DEFAULT 100,
    "goldThreshold" INTEGER NOT NULL DEFAULT 500,
    "platinumThreshold" INTEGER NOT NULL DEFAULT 1000,
    "vipThreshold" INTEGER NOT NULL DEFAULT 5000,
    "bronzeDiscount" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "silverDiscount" DECIMAL(5,2) NOT NULL DEFAULT 5,
    "goldDiscount" DECIMAL(5,2) NOT NULL DEFAULT 10,
    "platinumDiscount" DECIMAL(5,2) NOT NULL DEFAULT 15,
    "vipDiscount" DECIMAL(5,2) NOT NULL DEFAULT 20,
    "pointsRedemptionRate" DECIMAL(10,2) NOT NULL DEFAULT 100,
    "minRedemptionPoints" INTEGER NOT NULL DEFAULT 500,
    "pointsExpiryMonths" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loyalty_programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_transactions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "transactionType" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "balanceBefore" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "reservationId" TEXT,
    "metadata" JSONB,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loyalty_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE INDEX "users_tenantId_role_idx" ON "users"("tenantId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "users_tenantId_email_key" ON "users"("tenantId", "email");

-- CreateIndex
CREATE INDEX "rooms_tenantId_status_idx" ON "rooms"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "rooms_tenantId_roomNumber_key" ON "rooms"("tenantId", "roomNumber");

-- CreateIndex
CREATE UNIQUE INDEX "rate_plans_tenantId_name_key" ON "rate_plans"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "reservations_reservationNumber_key" ON "reservations"("reservationNumber");

-- CreateIndex
CREATE INDEX "reservations_tenantId_status_idx" ON "reservations"("tenantId", "status");

-- CreateIndex
CREATE INDEX "reservations_tenantId_checkInDate_checkOutDate_idx" ON "reservations"("tenantId", "checkInDate", "checkOutDate");

-- CreateIndex
CREATE INDEX "reservations_tenantId_guestId_idx" ON "reservations"("tenantId", "guestId");

-- CreateIndex
CREATE INDEX "reservations_tenantId_groupBookingId_idx" ON "reservations"("tenantId", "groupBookingId");

-- CreateIndex
CREATE INDEX "reservations_reservationNumber_idx" ON "reservations"("reservationNumber");

-- CreateIndex
CREATE INDEX "folios_tenantId_status_idx" ON "folios"("tenantId", "status");

-- CreateIndex
CREATE INDEX "folios_tenantId_roomId_idx" ON "folios"("tenantId", "roomId");

-- CreateIndex
CREATE INDEX "folio_charges_folioId_idx" ON "folio_charges"("folioId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_reference_key" ON "payments"("reference");

-- CreateIndex
CREATE INDEX "payments_tenantId_status_idx" ON "payments"("tenantId", "status");

-- CreateIndex
CREATE INDEX "payments_tenantId_reconciled_idx" ON "payments"("tenantId", "reconciled");

-- CreateIndex
CREATE INDEX "payments_folioId_idx" ON "payments"("folioId");

-- CreateIndex
CREATE INDEX "payments_reference_idx" ON "payments"("reference");

-- CreateIndex
CREATE INDEX "housekeeping_tasks_tenantId_status_idx" ON "housekeeping_tasks"("tenantId", "status");

-- CreateIndex
CREATE INDEX "housekeeping_tasks_tenantId_roomId_idx" ON "housekeeping_tasks"("tenantId", "roomId");

-- CreateIndex
CREATE INDEX "maintenance_tickets_tenantId_status_idx" ON "maintenance_tickets"("tenantId", "status");

-- CreateIndex
CREATE INDEX "maintenance_tickets_tenantId_priority_idx" ON "maintenance_tickets"("tenantId", "priority");

-- CreateIndex
CREATE INDEX "shifts_tenantId_userId_idx" ON "shifts"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "shifts_tenantId_status_idx" ON "shifts"("tenantId", "status");

-- CreateIndex
CREATE INDEX "audits_tenantId_action_idx" ON "audits"("tenantId", "action");

-- CreateIndex
CREATE INDEX "audits_tenantId_entityType_entityId_idx" ON "audits"("tenantId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "audits_tenantId_timestamp_idx" ON "audits"("tenantId", "timestamp");

-- CreateIndex
CREATE INDEX "alerts_tenantId_status_idx" ON "alerts"("tenantId", "status");

-- CreateIndex
CREATE INDEX "alerts_tenantId_alertType_idx" ON "alerts"("tenantId", "alertType");

-- CreateIndex
CREATE INDEX "alerts_tenantId_severity_idx" ON "alerts"("tenantId", "severity");

-- CreateIndex
CREATE UNIQUE INDEX "iot_gateways_gatewayId_key" ON "iot_gateways"("gatewayId");

-- CreateIndex
CREATE UNIQUE INDEX "iot_gateways_tenantId_gatewayId_key" ON "iot_gateways"("tenantId", "gatewayId");

-- CreateIndex
CREATE INDEX "iot_sensors_roomId_idx" ON "iot_sensors"("roomId");

-- CreateIndex
CREATE UNIQUE INDEX "iot_sensors_gatewayId_sensorId_key" ON "iot_sensors"("gatewayId", "sensorId");

-- CreateIndex
CREATE INDEX "iot_events_tenantId_roomId_idx" ON "iot_events"("tenantId", "roomId");

-- CreateIndex
CREATE INDEX "iot_events_tenantId_timestamp_idx" ON "iot_events"("tenantId", "timestamp");

-- CreateIndex
CREATE INDEX "iot_events_sensorId_idx" ON "iot_events"("sensorId");

-- CreateIndex
CREATE INDEX "deposit_policies_tenantId_isActive_idx" ON "deposit_policies"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "deposit_policies_tenantId_name_key" ON "deposit_policies"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "deposit_payments_reference_key" ON "deposit_payments"("reference");

-- CreateIndex
CREATE INDEX "deposit_payments_tenantId_status_idx" ON "deposit_payments"("tenantId", "status");

-- CreateIndex
CREATE INDEX "deposit_payments_tenantId_reservationId_idx" ON "deposit_payments"("tenantId", "reservationId");

-- CreateIndex
CREATE INDEX "deposit_payments_reference_idx" ON "deposit_payments"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "group_bookings_groupBookingNumber_key" ON "group_bookings"("groupBookingNumber");

-- CreateIndex
CREATE INDEX "group_bookings_tenantId_status_idx" ON "group_bookings"("tenantId", "status");

-- CreateIndex
CREATE INDEX "group_bookings_tenantId_checkInDate_checkOutDate_idx" ON "group_bookings"("tenantId", "checkInDate", "checkOutDate");

-- CreateIndex
CREATE INDEX "group_bookings_groupBookingNumber_idx" ON "group_bookings"("groupBookingNumber");

-- CreateIndex
CREATE INDEX "room_blocks_tenantId_groupBookingId_idx" ON "room_blocks"("tenantId", "groupBookingId");

-- CreateIndex
CREATE INDEX "room_blocks_tenantId_roomCategoryId_idx" ON "room_blocks"("tenantId", "roomCategoryId");

-- CreateIndex
CREATE INDEX "overbooking_settings_tenantId_idx" ON "overbooking_settings"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "overbooking_settings_tenantId_roomCategoryId_roomType_key" ON "overbooking_settings"("tenantId", "roomCategoryId", "roomType");

-- CreateIndex
CREATE INDEX "overbooking_alerts_tenantId_date_idx" ON "overbooking_alerts"("tenantId", "date");

-- CreateIndex
CREATE INDEX "overbooking_alerts_tenantId_status_idx" ON "overbooking_alerts"("tenantId", "status");

-- CreateIndex
CREATE INDEX "guest_requests_tenantId_status_idx" ON "guest_requests"("tenantId", "status");

-- CreateIndex
CREATE INDEX "guest_requests_tenantId_priority_idx" ON "guest_requests"("tenantId", "priority");

-- CreateIndex
CREATE INDEX "guest_requests_tenantId_requestType_idx" ON "guest_requests"("tenantId", "requestType");

-- CreateIndex
CREATE INDEX "guest_requests_tenantId_guestId_idx" ON "guest_requests"("tenantId", "guestId");

-- CreateIndex
CREATE INDEX "guest_requests_tenantId_assignedTo_idx" ON "guest_requests"("tenantId", "assignedTo");

-- CreateIndex
CREATE INDEX "guest_request_messages_tenantId_guestRequestId_idx" ON "guest_request_messages"("tenantId", "guestRequestId");

-- CreateIndex
CREATE INDEX "guest_request_updates_tenantId_guestRequestId_idx" ON "guest_request_updates"("tenantId", "guestRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "lost_items_itemNumber_key" ON "lost_items"("itemNumber");

-- CreateIndex
CREATE INDEX "lost_items_tenantId_status_idx" ON "lost_items"("tenantId", "status");

-- CreateIndex
CREATE INDEX "lost_items_tenantId_category_idx" ON "lost_items"("tenantId", "category");

-- CreateIndex
CREATE INDEX "lost_items_tenantId_foundAt_idx" ON "lost_items"("tenantId", "foundAt");

-- CreateIndex
CREATE UNIQUE INDEX "lost_items_tenantId_itemNumber_key" ON "lost_items"("tenantId", "itemNumber");

-- CreateIndex
CREATE INDEX "menu_categories_tenantId_isActive_idx" ON "menu_categories"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "menu_categories_tenantId_name_key" ON "menu_categories"("tenantId", "name");

-- CreateIndex
CREATE INDEX "menu_items_tenantId_isActive_idx" ON "menu_items"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "menu_items_tenantId_categoryId_idx" ON "menu_items"("tenantId", "categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "room_service_orders_orderNumber_key" ON "room_service_orders"("orderNumber");

-- CreateIndex
CREATE INDEX "room_service_orders_tenantId_status_idx" ON "room_service_orders"("tenantId", "status");

-- CreateIndex
CREATE INDEX "room_service_orders_tenantId_requestedAt_idx" ON "room_service_orders"("tenantId", "requestedAt");

-- CreateIndex
CREATE INDEX "room_service_orders_tenantId_roomNumber_idx" ON "room_service_orders"("tenantId", "roomNumber");

-- CreateIndex
CREATE UNIQUE INDEX "room_service_orders_tenantId_orderNumber_key" ON "room_service_orders"("tenantId", "orderNumber");

-- CreateIndex
CREATE INDEX "room_service_order_items_tenantId_orderId_idx" ON "room_service_order_items"("tenantId", "orderId");

-- CreateIndex
CREATE INDEX "room_service_order_items_tenantId_status_idx" ON "room_service_order_items"("tenantId", "status");

-- CreateIndex
CREATE INDEX "analytics_metrics_tenantId_category_idx" ON "analytics_metrics"("tenantId", "category");

-- CreateIndex
CREATE INDEX "analytics_metrics_tenantId_periodType_periodStart_idx" ON "analytics_metrics"("tenantId", "periodType", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "analytics_metrics_tenantId_metricKey_periodType_periodStart_key" ON "analytics_metrics"("tenantId", "metricKey", "periodType", "periodStart");

-- CreateIndex
CREATE INDEX "predictive_models_tenantId_modelType_idx" ON "predictive_models"("tenantId", "modelType");

-- CreateIndex
CREATE INDEX "predictive_models_tenantId_isActive_idx" ON "predictive_models"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "workflow_rules_tenantId_ruleType_idx" ON "workflow_rules"("tenantId", "ruleType");

-- CreateIndex
CREATE INDEX "workflow_rules_tenantId_triggerEvent_idx" ON "workflow_rules"("tenantId", "triggerEvent");

-- CreateIndex
CREATE INDEX "workflow_rules_tenantId_isActive_idx" ON "workflow_rules"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "smart_alerts_tenantId_alertType_idx" ON "smart_alerts"("tenantId", "alertType");

-- CreateIndex
CREATE INDEX "smart_alerts_tenantId_status_idx" ON "smart_alerts"("tenantId", "status");

-- CreateIndex
CREATE INDEX "smart_alerts_tenantId_severity_idx" ON "smart_alerts"("tenantId", "severity");

-- CreateIndex
CREATE INDEX "guest_behaviors_tenantId_behaviorType_idx" ON "guest_behaviors"("tenantId", "behaviorType");

-- CreateIndex
CREATE INDEX "guest_behaviors_tenantId_guestId_idx" ON "guest_behaviors"("tenantId", "guestId");

-- CreateIndex
CREATE INDEX "guest_behaviors_tenantId_behaviorKey_idx" ON "guest_behaviors"("tenantId", "behaviorKey");

-- CreateIndex
CREATE INDEX "inventory_analytics_tenantId_itemType_idx" ON "inventory_analytics"("tenantId", "itemType");

-- CreateIndex
CREATE INDEX "inventory_analytics_tenantId_lowStockAlert_idx" ON "inventory_analytics"("tenantId", "lowStockAlert");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_analytics_tenantId_itemType_itemId_key" ON "inventory_analytics"("tenantId", "itemType", "itemId");

-- CreateIndex
CREATE INDEX "guests_tenantId_loyaltyTier_idx" ON "guests"("tenantId", "loyaltyTier");

-- CreateIndex
CREATE INDEX "guests_tenantId_isVIP_idx" ON "guests"("tenantId", "isVIP");

-- CreateIndex
CREATE INDEX "guests_tenantId_email_idx" ON "guests"("tenantId", "email");

-- CreateIndex
CREATE INDEX "guests_tenantId_phone_idx" ON "guests"("tenantId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "guests_tenantId_email_key" ON "guests"("tenantId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "guests_tenantId_phone_key" ON "guests"("tenantId", "phone");

-- CreateIndex
CREATE INDEX "guest_activity_logs_tenantId_guestId_createdAt_idx" ON "guest_activity_logs"("tenantId", "guestId", "createdAt");

-- CreateIndex
CREATE INDEX "guest_activity_logs_tenantId_activityType_idx" ON "guest_activity_logs"("tenantId", "activityType");

-- CreateIndex
CREATE INDEX "guest_notes_tenantId_guestId_createdAt_idx" ON "guest_notes"("tenantId", "guestId", "createdAt");

-- CreateIndex
CREATE INDEX "guest_notes_tenantId_isImportant_idx" ON "guest_notes"("tenantId", "isImportant");

-- CreateIndex
CREATE INDEX "guest_notes_tenantId_isPinned_idx" ON "guest_notes"("tenantId", "isPinned");

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_programs_tenantId_key" ON "loyalty_programs"("tenantId");

-- CreateIndex
CREATE INDEX "loyalty_transactions_tenantId_guestId_createdAt_idx" ON "loyalty_transactions"("tenantId", "guestId", "createdAt");

-- CreateIndex
CREATE INDEX "loyalty_transactions_tenantId_transactionType_idx" ON "loyalty_transactions"("tenantId", "transactionType");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_ratePlanId_fkey" FOREIGN KEY ("ratePlanId") REFERENCES "rate_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "guests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_groupBookingId_fkey" FOREIGN KEY ("groupBookingId") REFERENCES "group_bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_checkedInBy_fkey" FOREIGN KEY ("checkedInBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_checkedOutBy_fkey" FOREIGN KEY ("checkedOutBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folios" ADD CONSTRAINT "folios_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folios" ADD CONSTRAINT "folios_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folios" ADD CONSTRAINT "folios_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folios" ADD CONSTRAINT "folios_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folio_charges" ADD CONSTRAINT "folio_charges_folioId_fkey" FOREIGN KEY ("folioId") REFERENCES "folios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_folioId_fkey" FOREIGN KEY ("folioId") REFERENCES "folios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "housekeeping_tasks" ADD CONSTRAINT "housekeeping_tasks_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "housekeeping_tasks" ADD CONSTRAINT "housekeeping_tasks_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "housekeeping_tasks" ADD CONSTRAINT "housekeeping_tasks_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "housekeeping_tasks" ADD CONSTRAINT "housekeeping_tasks_completedBy_fkey" FOREIGN KEY ("completedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_reportedBy_fkey" FOREIGN KEY ("reportedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_resolvedBy_fkey" FOREIGN KEY ("resolvedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audits" ADD CONSTRAINT "audits_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audits" ADD CONSTRAINT "audits_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_resolvedBy_fkey" FOREIGN KEY ("resolvedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iot_gateways" ADD CONSTRAINT "iot_gateways_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iot_sensors" ADD CONSTRAINT "iot_sensors_gatewayId_fkey" FOREIGN KEY ("gatewayId") REFERENCES "iot_gateways"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iot_sensors" ADD CONSTRAINT "iot_sensors_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iot_events" ADD CONSTRAINT "iot_events_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iot_events" ADD CONSTRAINT "iot_events_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposit_policies" ADD CONSTRAINT "deposit_policies_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposit_payments" ADD CONSTRAINT "deposit_payments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposit_payments" ADD CONSTRAINT "deposit_payments_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_bookings" ADD CONSTRAINT "group_bookings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_bookings" ADD CONSTRAINT "group_bookings_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_bookings" ADD CONSTRAINT "group_bookings_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_blocks" ADD CONSTRAINT "room_blocks_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_blocks" ADD CONSTRAINT "room_blocks_groupBookingId_fkey" FOREIGN KEY ("groupBookingId") REFERENCES "group_bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overbooking_settings" ADD CONSTRAINT "overbooking_settings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overbooking_alerts" ADD CONSTRAINT "overbooking_alerts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_requests" ADD CONSTRAINT "guest_requests_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_requests" ADD CONSTRAINT "guest_requests_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "guests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_requests" ADD CONSTRAINT "guest_requests_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_requests" ADD CONSTRAINT "guest_requests_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_request_messages" ADD CONSTRAINT "guest_request_messages_guestRequestId_fkey" FOREIGN KEY ("guestRequestId") REFERENCES "guest_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_request_updates" ADD CONSTRAINT "guest_request_updates_guestRequestId_fkey" FOREIGN KEY ("guestRequestId") REFERENCES "guest_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lost_items" ADD CONSTRAINT "lost_items_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lost_items" ADD CONSTRAINT "lost_items_foundBy_fkey" FOREIGN KEY ("foundBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lost_items" ADD CONSTRAINT "lost_items_reportedByGuestId_fkey" FOREIGN KEY ("reportedByGuestId") REFERENCES "guests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lost_items" ADD CONSTRAINT "lost_items_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_categories" ADD CONSTRAINT "menu_categories_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "menu_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_service_orders" ADD CONSTRAINT "room_service_orders_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_service_orders" ADD CONSTRAINT "room_service_orders_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "guests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_service_orders" ADD CONSTRAINT "room_service_orders_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_service_orders" ADD CONSTRAINT "room_service_orders_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_service_orders" ADD CONSTRAINT "room_service_orders_deliveredBy_fkey" FOREIGN KEY ("deliveredBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_service_order_items" ADD CONSTRAINT "room_service_order_items_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_service_order_items" ADD CONSTRAINT "room_service_order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "room_service_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_service_order_items" ADD CONSTRAINT "room_service_order_items_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_metrics" ADD CONSTRAINT "analytics_metrics_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "predictive_models" ADD CONSTRAINT "predictive_models_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_rules" ADD CONSTRAINT "workflow_rules_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_rules" ADD CONSTRAINT "workflow_rules_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "smart_alerts" ADD CONSTRAINT "smart_alerts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "smart_alerts" ADD CONSTRAINT "smart_alerts_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "smart_alerts" ADD CONSTRAINT "smart_alerts_resolvedBy_fkey" FOREIGN KEY ("resolvedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_behaviors" ADD CONSTRAINT "guest_behaviors_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_behaviors" ADD CONSTRAINT "guest_behaviors_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "guests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_analytics" ADD CONSTRAINT "inventory_analytics_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guests" ADD CONSTRAINT "guests_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_activity_logs" ADD CONSTRAINT "guest_activity_logs_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "guests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_notes" ADD CONSTRAINT "guest_notes_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "guests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_programs" ADD CONSTRAINT "loyalty_programs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_transactions" ADD CONSTRAINT "loyalty_transactions_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "guests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
