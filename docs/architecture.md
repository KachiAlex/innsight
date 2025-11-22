# InnSight PMS Architecture

## System Overview

InnSight PMS is a multi-tenant SaaS application built with:
- **Backend**: Node.js + TypeScript + Express.js
- **Database**: PostgreSQL + Prisma ORM
- **Frontend**: React + TypeScript + Vite
- **Authentication**: JWT with role-based access control (RBAC)

## Multi-Tenancy Model

### Data Isolation Strategy

The system uses **row-level tenancy** with `tenant_id` in every table. This approach:
- Provides strong data isolation
- Simplifies backup/restore per tenant
- Allows for future migration to separate databases for large tenants
- Maintains query performance with proper indexing

### Tenant Boundaries

- All data tables include `tenant_id` foreign key
- API routes enforce tenant access via middleware
- Users can only access their own tenant's data (except IITECH admins)
- Audit logs maintain tenant isolation

## Core Modules

### 1. Authentication & Authorization

**JWT-based authentication:**
- Access tokens (7 days expiry)
- Refresh tokens (30 days expiry)
- Token refresh endpoint

**Role-Based Access Control (RBAC):**
- 8 user roles with different permission levels
- Fine-grained permissions stored in user record
- Middleware enforces role-based access

### 2. Reservation & Front-Desk

**Features:**
- Multi-channel reservation creation
- Room availability checking
- Check-in/check-out workflows
- Guest information management
- Deposit handling

**Key Entities:**
- `Reservation`: Booking records
- `Room`: Physical rooms
- `RatePlan`: Pricing plans

### 3. Billing & Payments

**Folio System:**
- One folio per reservation/room
- Multiple charges (room rate, extras, taxes)
- Payment tracking and reconciliation
- Balance calculations

**Payment Methods:**
- Card (via payment gateways)
- Bank transfer
- Cash
- Manual entry

**Reconciliation:**
- Match PMS payments vs bank statements
- Flag unreconciled payments
- Variance alerts

### 4. Housekeeping & Maintenance

**Housekeeping:**
- Task assignment and tracking
- Photo proof capture
- Checklist completion
- Room status updates

**Maintenance:**
- Ticket creation and tracking
- Priority levels
- Assignment to staff
- Resolution tracking

### 5. Staff & Shift Management

**Shifts:**
- Shift creation and closure
- Cash float tracking
- Cash reconciliation
- Variance detection

**Activity Logs:**
- Track who performed what action
- Timestamp all operations
- Link to audit trail

### 6. Accounting & Reporting

**Reports:**
- Daily revenue reports
- Occupancy metrics (ADR, RevPAR)
- Shift reports
- Cash reconciliation

**Metrics:**
- Occupancy Rate
- Average Daily Rate (ADR)
- Revenue per Available Room (RevPAR)
- Total Revenue by period

### 7. Accountability & Anti-Fraud

**Audit Trail:**
- Immutable logs for all critical actions
- Before/after state capture
- User attribution
- Timestamp tracking

**Alerts:**
- Payment mismatches
- Room status anomalies
- Cash variances
- Suspicious activity patterns

**Photo Evidence:**
- Optional photo capture at check-in/out
- Stored in audit log
- Linked to reservations

### 8. Multi-Tenant Admin

**IITECH Admin:**
- Create/manage tenants
- View tenant statistics
- Support workflows
- Platform-level operations

**Tenant Onboarding:**
- Wizard-based setup
- Branding configuration
- Tax settings
- Initial user creation

## Database Schema

### Core Tables

- `tenants`: Hotel organizations
- `users`: System users (per tenant)
- `rooms`: Physical rooms
- `rate_plans`: Pricing plans
- `reservations`: Bookings
- `folios`: Guest accounts
- `folio_charges`: Individual charges
- `payments`: Payment records
- `housekeeping_tasks`: Cleaning tasks
- `maintenance_tickets`: Maintenance requests
- `shifts`: Staff shifts
- `audits`: Immutable audit logs
- `alerts`: System alerts

### IoT Tables (Optional Module)

- `iot_gateways`: IoT gateway devices
- `iot_sensors`: Sensor devices
- `iot_events`: Sensor event logs

## API Design

### RESTful Endpoints

All endpoints follow REST conventions:
- `GET /resource`: List resources
- `GET /resource/:id`: Get single resource
- `POST /resource`: Create resource
- `PATCH /resource/:id`: Update resource
- `DELETE /resource/:id`: Delete resource (where applicable)

### Multi-Tenant Path Structure

```
/api/tenants/:tenantId/resource
```

This ensures:
- Clear tenant context
- Easy tenant isolation
- Consistent API structure

### Response Format

**Success:**
```json
{
  "success": true,
  "data": { ... }
}
```

**Error:**
```json
{
  "success": false,
  "error": {
    "message": "Error message"
  }
}
```

## Security

### Authentication
- JWT tokens in Authorization header
- Token refresh mechanism
- Secure password hashing (bcrypt)

### Authorization
- Role-based access control
- Tenant isolation middleware
- Permission checks on sensitive operations

### Data Protection
- Encrypted storage for sensitive data
- Audit trails for compliance
- Secure API endpoints (HTTPS in production)

## IoT Integration (Optional)

### Architecture
- Gateway devices connect to API
- Sensors map to rooms
- Events trigger alerts and room status updates
- Occupancy validation against reservations

### API Endpoints
- `POST /iot/:gatewayId/event`: Ingest sensor events
- `GET /tenants/:tenantId/rooms/:roomId/occupancy`: Get occupancy state
- `GET /tenants/:tenantId/iot/alerts`: Get IoT alerts

## Scalability Considerations

### Current Architecture
- Single database with tenant_id isolation
- Stateless API servers
- Horizontal scaling ready

### Future Enhancements
- Separate databases for large tenants
- Caching layer (Redis)
- Message queue for async operations
- CDN for static assets
- Load balancing

## Deployment

### Development
- Local PostgreSQL database
- Hot-reload for both frontend and backend
- Prisma Studio for database management

### Production
- PostgreSQL on managed service
- Environment variables for configuration
- Process manager (PM2)
- Reverse proxy (Nginx)
- SSL/TLS certificates

## Monitoring & Logging

### Audit Trail
- All critical actions logged
- Immutable audit records
- Searchable by user, action, date range

### Alerts
- Real-time alert generation
- Email/SMS notifications (future)
- Dashboard for alert management

### Error Handling
- Centralized error handler
- Structured error responses
- Error logging for debugging

## Future Enhancements

1. **Payment Gateway Integration**
   - Paystack, Flutterwave, Stripe
   - Webhook handling
   - Payment reconciliation automation

2. **Channel Manager Integration**
   - OTA connectivity
   - Two-way sync
   - Rate management

3. **IoT Module**
   - Sensor management UI
   - Real-time occupancy tracking
   - Heatmap visualizations
   - Energy optimization

4. **Advanced Reporting**
   - Custom report builder
   - Scheduled reports
   - Export to Excel/PDF
   - Dashboard widgets

5. **Mobile Apps**
   - Housekeeping mobile app
   - Front-desk mobile app
   - Owner dashboard app
