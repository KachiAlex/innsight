# 🎯 Enhanced Guest Management System

## Overview

The InnSight PMS now features a comprehensive Guest Management System with:
- ✅ Dedicated guest profiles with complete history
- ✅ Guest activity logs tracking all interactions
- ✅ Loyalty program with points and tier system
- ✅ Staff notes and observations
- ✅ Advanced preferences tracking
- ✅ VIP and banned guest management

---

## 🗄️ Database Collections

### 1. **Guests Collection** (`guests`)
Stores unique guest records with comprehensive information.

**Fields:**
- **Basic Info**: name, email, phone, idNumber, dateOfBirth
- **Address**: address, city, state, country, postalCode, nationality
- **Loyalty**: loyaltyTier, loyaltyPoints, totalStays, totalNights, totalSpent
- **Preferences**: preferredRoomType, preferredFloor, smokingPreference, bedPreference, pillowPreference
- **Dietary**: dietaryRestrictions, allergies, specialRequests
- **Status**: isVIP, isBanned, bannedReason, bannedAt
- **Marketing**: marketingOptIn, emailOptIn, smsOptIn
- **Dates**: firstStayDate, lastStayDate, createdAt, updatedAt

**Loyalty Tiers:**
- Bronze (default)
- Silver (100+ points)
- Gold (500+ points)
- Platinum (1000+ points)
- VIP (5000+ points)

### 2. **Guest Activity Logs** (`guest_activity_logs`)
Immutable log of all guest interactions.

**Activity Types:**
- `profile_created` - Guest profile created
- `profile_updated` - Profile information updated
- `check_in` - Guest checked in
- `check_out` - Guest checked out
- `reservation` - Reservation made
- `cancellation` - Reservation cancelled
- `payment` - Payment received
- `complaint` - Complaint lodged
- `request` - Special request made
- `note` - Staff note added
- `loyalty_earned` - Loyalty points earned
- `loyalty_redeemed` - Loyalty points redeemed

### 3. **Guest Notes** (`guest_notes`)
Staff observations and notes about guests.

**Note Types:**
- `general` - General observation
- `complaint` - Guest complaint
- `compliment` - Guest compliment
- `special_request` - Special request
- `vip` - VIP-related note
- `warning` - Warning or concern

**Features:**
- Pin important notes
- Mark notes as important
- Track who created the note and when

### 4. **Loyalty Program** (`loyalty_programs`)
Per-tenant loyalty program configuration.

**Configuration:**
- Points per night stayed
- Points per currency unit spent
- Tier thresholds
- Tier discount percentages
- Redemption rates
- Points expiry settings

### 5. **Loyalty Transactions** (`loyalty_transactions`)
Track all loyalty points movements.

**Transaction Types:**
- `earned` - Points earned from stays/spending
- `redeemed` - Points redeemed for discounts
- `expired` - Points expired
- `adjusted` - Manual adjustment by staff

---

## 🔌 API Endpoints

### Guest Management

#### **Create/Update Guest**
```http
POST /api/tenants/:tenantId/guests
```

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+1234567890",
  "dateOfBirth": "1990-01-15",
  "nationality": "US",
  "address": "123 Main St",
  "city": "New York",
  "preferredRoomType": "suite",
  "dietaryRestrictions": ["gluten-free"],
  "allergies": ["peanuts"],
  "smokingPreference": false
}
```

#### **Get Guest Profile**
```http
GET /api/tenants/:tenantId/guests/:guestId
```

**Response includes:**
- Complete guest information
- Reservation history
- Activity logs (last 50)
- Staff notes
- Loyalty transactions (last 20)

#### **List All Guests**
```http
GET /api/tenants/:tenantId/guests?page=1&limit=20&loyaltyTier=gold&isVIP=true&search=john
```

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20)
- `loyaltyTier` - Filter by tier (bronze, silver, gold, platinum, vip)
- `isVIP` - Filter VIP guests (true/false)
- `search` - Search by name, email, phone, or ID number

### Activity Logs

#### **Add Activity Log**
```http
POST /api/tenants/:tenantId/guests/:guestId/activity
```

**Request Body:**
```json
{
  "activityType": "complaint",
  "title": "Room Temperature Issue",
  "description": "Guest reported AC not working in room 305",
  "metadata": {
    "roomNumber": "305",
    "severity": "medium"
  }
}
```

### Guest Notes

#### **Add Note**
```http
POST /api/tenants/:tenantId/guests/:guestId/notes
```

**Request Body:**
```json
{
  "noteType": "special_request",
  "note": "Guest prefers room away from elevator",
  "isImportant": true,
  "isPinned": false
}
```

#### **Update Note**
```http
PUT /api/tenants/:tenantId/guests/:guestId/notes/:noteId
```

#### **Delete Note**
```http
DELETE /api/tenants/:tenantId/guests/:guestId/notes/:noteId
```

### Loyalty Management

#### **Add/Redeem Points**
```http
POST /api/tenants/:tenantId/guests/:guestId/loyalty
```

**Request Body:**
```json
{
  "points": 100,
  "description": "Earned from 10-night stay",
  "reservationId": "res_123",
  "metadata": {
    "nights": 10,
    "rate": 10000
  }
}
```

*Use negative points to redeem: `"points": -500`*

#### **Get Loyalty Program Settings**
```http
GET /api/tenants/:tenantId/guests/loyalty/program
```

#### **Update Loyalty Program**
```http
PUT /api/tenants/:tenantId/guests/loyalty/program
```

**Request Body:**
```json
{
  "isActive": true,
  "programName": "Elite Rewards",
  "pointsPerNight": 10,
  "pointsPerCurrency": 1,
  "silverThreshold": 100,
  "goldThreshold": 500,
  "platinumThreshold": 1000,
  "vipThreshold": 5000,
  "silverDiscount": 5,
  "goldDiscount": 10,
  "platinumDiscount": 15,
  "vipDiscount": 20,
  "pointsRedemptionRate": 100,
  "minRedemptionPoints": 500
}
```

---

## 📊 Data Migration

### Migrate Existing Guests

A migration script is provided to sync existing reservation data into the new guests collection:

```bash
cd backend
npx tsx src/scripts/migrate-guests.ts
```

**What it does:**
1. Scans all existing reservations
2. Creates unique guest records (by email → phone → name)
3. Calculates statistics (total stays, nights, spent)
4. Assigns loyalty tiers based on stay history
5. Awards initial loyalty points (10 points per night)
6. Links reservations to guest records
7. Creates activity logs for each guest

**Auto-linking:**
- Guests are automatically identified by email (preferred) or phone number
- Future reservations will automatically link to existing guest profiles

---

## 🎨 Frontend Integration

### Current Status
- ✅ Backend API fully implemented
- ✅ Guest profile routes created
- ✅ Activity logging system ready
- ✅ Loyalty system operational
- ⏳ Frontend UI needs to be enhanced

### Recommended Frontend Components

1. **Enhanced Guest List Page**
   - Display loyalty tiers with badges
   - Show VIP status
   - Quick filters (tier, VIP, recent stays)
   - Advanced search

2. **Guest Profile Page**
   - Tabs: Overview, History, Notes, Loyalty
   - Timeline of activities
   - Staff notes section
   - Loyalty points display with tier progress bar
   - Quick actions (add note, award points, mark as VIP)

3. **Guest Form/Modal**
   - Complete guest information
   - Preferences section
   - Dietary restrictions and allergies
   - Marketing preferences

4. **Loyalty Dashboard (Admin)**
   - Configure loyalty program
   - Set tier thresholds
   - Define discount percentages
   - Points redemption rates

5. **Quick Guest Actions (Staff)**
   - Add note button on all reservation pages
   - Quick loyalty points award
   - Mark as VIP/Remove VIP
   - Ban/unban guest

---

## 🔄 Integration with Existing Features

### Reservations
- When creating a reservation, automatically create/link guest profile
- Award loyalty points on check-out
- Log activity for check-in, check-out, cancellations

### Folios & Payments
- Award points based on spending (if configured)
- Apply loyalty discount at checkout
- Log payment activities

### Staff Actions
- Every staff interaction can be logged
- Notes can be added from any guest-related page

---

## 💡 Usage Examples

### Example 1: Check-in Flow with Loyalty

```typescript
// 1. Guest checks in
await api.post(`/tenants/${tenantId}/reservations/${resId}/check-in`);

// 2. Log activity
await api.post(`/tenants/${tenantId}/guests/${guestId}/activity`, {
  activityType: 'check_in',
  title: 'Checked In',
  description: `Checked into room ${roomNumber}`,
  metadata: { reservationId: resId, roomNumber }
});

// 3. On check-out, award loyalty points
await api.post(`/tenants/${tenantId}/guests/${guestId}/loyalty`, {
  points: nights * 10, // 10 points per night
  description: `Earned from ${nights}-night stay`,
  reservationId: resId
});
```

### Example 2: Adding Staff Note

```typescript
await api.post(`/tenants/${tenantId}/guests/${guestId}/notes`, {
  noteType: 'special_request',
  note: 'Guest prefers higher floors and rooms away from ice machine',
  isImportant: true,
  isPinned: true
});
```

### Example 3: Loyalty Discount at Checkout

```typescript
// Get guest profile
const guest = await api.get(`/tenants/${tenantId}/guests/${guestId}`);

// Check tier discount
const loyaltyProgram = await api.get(`/tenants/${tenantId}/guests/loyalty/program`);
const discount = loyaltyProgram[`${guest.loyaltyTier}Discount`]; // e.g., goldDiscount = 10%

// Apply discount to folio
const discountAmount = totalCharges * (discount / 100);
await api.post(`/tenants/${tenantId}/folios/${folioId}/charges`, {
  description: `${guest.loyaltyTier.toUpperCase()} Loyalty Discount`,
  category: 'discount',
  amount: -discountAmount
});
```

---

## 🚀 Deployment Steps

1. **Deploy Backend**
   ```bash
   cd backend
   npm run build
   ```

2. **Run Migration** (one-time)
   ```bash
   npx tsx src/scripts/migrate-guests.ts
   ```

3. **Configure Loyalty Program** (optional)
   - Use API or add admin UI to configure settings
   - Default settings are already sensible

4. **Deploy to Production**
   ```bash
   firebase deploy --only functions
   ```

---

## 📈 Benefits

### For Guests
- ✨ Personalized service based on preferences
- 🎁 Loyalty rewards for repeat stays
- 📝 Special requests are remembered
- 🏆 Tier-based discounts

### For Staff
- 📋 Complete guest history at a glance
- 💬 Share observations via notes
- ⚡ Quick access to preferences and allergies
- 🎯 Identify VIP guests instantly

### For Management
- 📊 Track guest lifetime value
- 🔄 Encourage repeat business with loyalty program
- 📈 Identify most valuable guests
- 🎯 Targeted marketing based on guest segments

---

## 🔧 Configuration

### Default Loyalty Settings
- **Bronze**: 0% discount
- **Silver** (100+ points): 5% discount
- **Gold** (500+ points): 10% discount
- **Platinum** (1000+ points): 15% discount
- **VIP** (5000+ points): 20% discount

### Points Earning
- 10 points per night stayed
- 1 point per currency unit spent

### Points Redemption
- 100 points = 1 currency unit discount
- Minimum 500 points to redeem

---

## 🛠️ Next Steps

1. **Run the migration script** to populate guest data
2. **Update frontend** to use new guest endpoints
3. **Add loyalty badge displays** on guest cards
4. **Create loyalty dashboard** for admins
5. **Train staff** on using guest notes and activity logs
6. **Configure loyalty program** to match your business goals

---

## 📞 Support

For questions or issues with the guest management system, please refer to:
- API documentation: `/docs/api.md`
- Backend code: `/backend/src/routes/guests-enhanced.ts`
- Migration script: `/backend/src/scripts/migrate-guests.ts`

