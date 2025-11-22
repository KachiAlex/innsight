# InnSight PMS API Documentation

## Base URL
```
http://localhost:3001/api
```

## Authentication

Most endpoints require authentication via JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

## Endpoints

### Authentication

#### POST /auth/login
Login and receive JWT token.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "tenantId": "optional-tenant-id"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "jwt-token",
    "refreshToken": "refresh-token",
    "user": {
      "id": "user-id",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "front_desk",
      "tenantId": "tenant-id",
      "tenant": {
        "id": "tenant-id",
        "name": "Hotel Name",
        "slug": "hotel-slug"
      }
    }
  }
}
```

#### POST /auth/refresh
Refresh access token using refresh token.

**Request Body:**
```json
{
  "refreshToken": "refresh-token"
}
```

#### GET /auth/me
Get current user information.

---

### Tenants (IITECH Admin Only)

#### POST /tenants
Create a new tenant (hotel).

**Request Body:**
```json
{
  "name": "Hotel Name",
  "slug": "hotel-slug",
  "email": "hotel@example.com",
  "phone": "+2341234567890",
  "address": "Hotel Address",
  "branding": {},
  "taxSettings": {},
  "ownerEmail": "owner@example.com",
  "ownerPassword": "password123",
  "ownerFirstName": "Owner",
  "ownerLastName": "Name"
}
```

#### GET /tenants
List all tenants.

#### GET /tenants/:id
Get tenant details.

---

### Reservations

#### POST /tenants/:tenantId/reservations
Create a new reservation.

**Request Body:**
```json
{
  "roomId": "room-uuid",
  "guestName": "Guest Name",
  "guestEmail": "guest@example.com",
  "guestPhone": "+2341234567890",
  "checkInDate": "2024-01-15T14:00:00Z",
  "checkOutDate": "2024-01-17T11:00:00Z",
  "adults": 2,
  "children": 0,
  "rate": 15000,
  "depositAmount": 5000,
  "source": "manual"
}
```

#### GET /tenants/:tenantId/reservations
List reservations (supports filters: status, roomId, startDate, endDate).

#### GET /tenants/:tenantId/reservations/:id
Get reservation details.

#### POST /tenants/:tenantId/reservations/:id/checkin
Check in a guest.

**Request Body:**
```json
{
  "photo": "base64-or-url" // Optional
}
```

#### POST /tenants/:tenantId/reservations/:id/checkout
Check out a guest.

**Request Body:**
```json
{
  "finalCharges": {},
  "paymentInfo": {}
}
```

---

### Rooms

#### GET /tenants/:tenantId/rooms
List rooms (supports filters: status, roomType).

#### GET /tenants/:tenantId/rooms/:id
Get room details.

#### POST /tenants/:tenantId/rooms
Create a new room.

**Request Body:**
```json
{
  "roomNumber": "101",
  "roomType": "single",
  "floor": 1,
  "maxOccupancy": 2,
  "amenities": ["wifi", "tv"],
  "ratePlanId": "rate-plan-uuid"
}
```

#### PATCH /tenants/:tenantId/rooms/:id
Update room details.

---

### Folios

#### GET /tenants/:tenantId/folios
List folios (supports filters: status, roomId, reservationId).

#### GET /tenants/:tenantId/folios/:id
Get folio details with charges and payments.

#### POST /tenants/:tenantId/folios/:id/charges
Add a charge to a folio.

**Request Body:**
```json
{
  "description": "Extra bed",
  "category": "extra",
  "amount": 5000,
  "quantity": 1,
  "taxRate": 7.5
}
```

#### POST /tenants/:tenantId/folios/:id/void
Void a folio (requires manager/owner role).

---

### Payments

#### POST /tenants/:tenantId/payments
Create a payment.

**Request Body:**
```json
{
  "folioId": "folio-uuid",
  "amount": 15000,
  "method": "card",
  "reference": "PAY-123456",
  "paymentGateway": "paystack",
  "gatewayTransactionId": "gateway-ref",
  "notes": "Payment notes"
}
```

#### GET /tenants/:tenantId/payments/reconcile
Get list of unreconciled payments.

#### POST /tenants/:tenantId/payments/:id/reconcile
Mark a payment as reconciled.

---

### Housekeeping

#### GET /tenants/:tenantId/housekeeping
List housekeeping tasks (supports filters: status, roomId, assignedTo).

#### POST /tenants/:tenantId/housekeeping
Create a housekeeping task.

**Request Body:**
```json
{
  "roomId": "room-uuid",
  "taskType": "cleaning",
  "assignedTo": "user-uuid"
}
```

#### POST /tenants/:tenantId/housekeeping/:id/complete
Complete a housekeeping task.

**Request Body:**
```json
{
  "photos": ["photo-url-1", "photo-url-2"],
  "checklist": {},
  "notes": "Task completed"
}
```

---

### Maintenance

#### GET /tenants/:tenantId/maintenance
List maintenance tickets (supports filters: status, priority, roomId).

#### POST /tenants/:tenantId/maintenance
Create a maintenance ticket.

**Request Body:**
```json
{
  "roomId": "room-uuid",
  "title": "AC not working",
  "description": "AC unit in room 101 is not cooling",
  "priority": "high",
  "photos": []
}
```

#### PATCH /tenants/:tenantId/maintenance/:id
Update maintenance ticket.

---

### Shifts

#### GET /tenants/:tenantId/shifts
List shifts (supports filters: status, userId, startDate, endDate).

#### POST /tenants/:tenantId/shifts
Create a shift.

**Request Body:**
```json
{
  "userId": "user-uuid",
  "shiftType": "morning",
  "cashFloat": 50000
}
```

#### POST /tenants/:tenantId/shifts/:id/close
Close a shift.

**Request Body:**
```json
{
  "cashReceived": 150000,
  "cashCounted": 200000,
  "notes": "Shift notes"
}
```

---

### Audits

#### GET /tenants/:tenantId/audits
Get audit logs (supports filters: userId, action, entityType, entityId, startDate, endDate).

**Query Parameters:**
- `limit`: Number of records (default: 100)

---

### Alerts

#### GET /tenants/:tenantId/alerts
List alerts (supports filters: status, alertType, severity).

#### POST /tenants/:tenantId/alerts/:id/resolve
Resolve an alert.

---

### Reports

#### GET /tenants/:tenantId/reports/revenue
Get revenue report.

**Query Parameters:**
- `startDate`: Start date (ISO string)
- `endDate`: End date (ISO string)
- `groupBy`: Grouping (day, month)

#### GET /tenants/:tenantId/reports/occupancy
Get occupancy report (occupancy rate, ADR, RevPAR).

**Query Parameters:**
- `startDate`: Start date (ISO string)
- `endDate`: End date (ISO string)

#### GET /tenants/:tenantId/reports/shift
Get shift report.

**Query Parameters:**
- `shiftId`: Shift ID (required)

---

### IoT (Optional Module)

#### POST /iot/:gatewayId/event
Ingest IoT sensor event.

**Request Body:**
```json
{
  "sensorId": "sensor-123",
  "roomId": "room-uuid",
  "eventType": "occupied",
  "timestamp": "2024-01-15T14:00:00Z",
  "metadata": {}
}
```

#### GET /iot/tenants/:tenantId/rooms/:roomId/occupancy
Get current occupancy state for a room.

#### GET /iot/tenants/:tenantId/alerts
Get IoT-related alerts (occupancy mismatches).

---

## User Roles

- `owner`: Full access to tenant
- `general_manager`: Operations and approvals
- `front_desk`: Reservations, check-in/out, payments
- `housekeeping_supervisor`: Housekeeping management
- `housekeeping_staff`: Task completion
- `maintenance`: Maintenance tickets
- `accountant`: Financial reports and reconciliation
- `iitech_admin`: Platform admin (tenant management)

## Error Responses

All errors follow this format:

```json
{
  "success": false,
  "error": {
    "message": "Error message",
    "stack": "Stack trace (development only)"
  }
}
```

## Status Codes

- `200`: Success
- `201`: Created
- `400`: Bad Request
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found
- `500`: Internal Server Error
