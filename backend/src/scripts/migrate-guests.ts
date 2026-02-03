/**
 * Migration Script: Sync Guests from Reservations
 * 
 * This script migrates existing reservation data to create deduplicated guest records
 * in the guests collection. It also links reservations to their respective guests.
 */

// import { db, toDate, toTimestamp, now } from '../utils/firestore';
// import admin from 'firebase-admin';

interface GuestData {
  tenantId: string;
  name: string;
  email?: string;
  phone?: string;
  idNumber?: string;
  loyaltyTier: string;
  loyaltyPoints: number;
  totalStays: number;
  totalNights: number;
  totalSpent: number;
  firstStayDate: admin.firestore.Timestamp | null;
  lastStayDate: admin.firestore.Timestamp | null;
  preferredRoomType?: string;
  reservationIds: string[];
}

async function migrateGuests() {
  console.log('🚀 Starting guest migration...\n');

  try {
    // Get all tenants
    const tenantsSnapshot = await db.collection('tenants').get();
    console.log(`Found ${tenantsSnapshot.size} tenants\n`);

    for (const tenantDoc of tenantsSnapshot.docs) {
      const tenantId = tenantDoc.id;
      const tenantName = tenantDoc.data().name;
      console.log(`\n📋 Processing tenant: ${tenantName} (${tenantId})`);

      // Get all reservations for this tenant
      const reservationsSnapshot = await db.collection('reservations')
        .where('tenantId', '==', tenantId)
        .get();

      console.log(`  Found ${reservationsSnapshot.size} reservations`);

      // Build a map of unique guests
      const guestsMap = new Map<string, GuestData>();
      const reservationGuestMap = new Map<string, string>(); // reservationId -> guestKey

      for (const resDoc of reservationsSnapshot.docs) {
        const resData = resDoc.data();
        const guestEmail = resData.guestEmail?.toLowerCase() || '';
        const guestPhone = resData.guestPhone || '';
        const guestName = resData.guestName || '';
        const guestIdNumber = resData.guestIdNumber || '';

        // Create a unique key for the guest (prefer email, then phone, then name)
        const guestKey = guestEmail || guestPhone || guestName.toLowerCase();

        if (!guestKey) {
          console.log(`  ⚠️  Skipping reservation ${resDoc.id} - no guest identifier`);
          continue;
        }

        reservationGuestMap.set(resDoc.id, guestKey);

        if (!guestsMap.has(guestKey)) {
          guestsMap.set(guestKey, {
            tenantId,
            name: guestName,
            email: guestEmail || undefined,
            phone: guestPhone || undefined,
            idNumber: guestIdNumber || undefined,
            loyaltyTier: 'bronze',
            loyaltyPoints: 0,
            totalStays: 0,
            totalNights: 0,
            totalSpent: 0,
            firstStayDate: null,
            lastStayDate: null,
            reservationIds: [],
          });
        }

        const guest = guestsMap.get(guestKey)!;
        guest.reservationIds.push(resDoc.id);

        // Calculate statistics
        const checkIn = toDate(resData.checkInDate);
        const checkOut = toDate(resData.checkOutDate);

        if (checkIn && checkOut) {
          const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
          guest.totalNights += nights;
          guest.totalStays += 1;

          const firstStayDateTime = guest.firstStayDate ? toDate(guest.firstStayDate) : null;
          const lastStayDateTime = guest.lastStayDate ? toDate(guest.lastStayDate) : null;
          
          if (!firstStayDateTime || checkIn < firstStayDateTime) {
            guest.firstStayDate = toTimestamp(checkIn);
          }
          if (!lastStayDateTime || checkOut > lastStayDateTime) {
            guest.lastStayDate = toTimestamp(checkOut);
          }
        }

        guest.totalSpent += Number(resData.rate || 0);

        // Track preferred room type
        const roomDoc = await db.collection('rooms').doc(resData.roomId).get();
        if (roomDoc.exists) {
          const roomType = roomDoc.data()?.roomType;
          if (roomType && !guest.preferredRoomType) {
            guest.preferredRoomType = roomType;
          }
        }
      }

      console.log(`  Found ${guestsMap.size} unique guests`);

      // Create guest documents and link reservations
      const batch = db.batch();
      let batchCount = 0;
      const guestIdMap = new Map<string, string>(); // guestKey -> guestId

      for (const [guestKey, guestData] of guestsMap.entries()) {
        // Check if guest already exists
        let existingGuestId: string | null = null;
        
        if (guestData.email) {
          const emailQuery = await db.collection('guests')
            .where('tenantId', '==', tenantId)
            .where('email', '==', guestData.email)
            .limit(1)
            .get();
          
          if (!emailQuery.empty) {
            existingGuestId = emailQuery.docs[0].id;
          }
        }

        if (!existingGuestId && guestData.phone) {
          const phoneQuery = await db.collection('guests')
            .where('tenantId', '==', tenantId)
            .where('phone', '==', guestData.phone)
            .limit(1)
            .get();
          
          if (!phoneQuery.empty) {
            existingGuestId = phoneQuery.docs[0].id;
          }
        }

        const timestamp = now();
        let guestId: string;

        // Calculate loyalty tier based on stays
        let loyaltyTier = 'bronze';
        if (guestData.totalStays >= 50) loyaltyTier = 'vip';
        else if (guestData.totalStays >= 20) loyaltyTier = 'platinum';
        else if (guestData.totalStays >= 10) loyaltyTier = 'gold';
        else if (guestData.totalStays >= 5) loyaltyTier = 'silver';

        // Award initial loyalty points (10 points per night)
        const loyaltyPoints = guestData.totalNights * 10;

        const guestRecord = {
          ...guestData,
          loyaltyTier,
          loyaltyPoints,
          isVIP: guestData.totalStays >= 10,
          isBanned: false,
          marketingOptIn: true,
          emailOptIn: true,
          smsOptIn: true,
          updatedAt: timestamp,
        };

        delete (guestRecord as any).reservationIds;

        if (existingGuestId) {
          // Update existing guest
          guestId = existingGuestId;
          batch.update(db.collection('guests').doc(guestId), guestRecord);
        } else {
          // Create new guest
          const newGuestRef = db.collection('guests').doc();
          guestId = newGuestRef.id;
          batch.set(newGuestRef, {
            ...guestRecord,
            createdAt: timestamp,
          });
        }

        guestIdMap.set(guestKey, guestId);

        // Link reservations to guest
        for (const reservationId of guestData.reservationIds) {
          batch.update(db.collection('reservations').doc(reservationId), {
            guestId,
            updatedAt: timestamp,
          });
        }

        batchCount++;

        // Commit batch every 400 operations (Firestore limit is 500)
        if (batchCount >= 400) {
          await batch.commit();
          console.log(`  💾 Committed batch of ${batchCount} operations`);
          batchCount = 0;
        }
      }

      // Commit remaining operations
      if (batchCount > 0) {
        await batch.commit();
        console.log(`  💾 Committed final batch of ${batchCount} operations`);
      }

      console.log(`  ✅ Migrated ${guestsMap.size} guests for tenant: ${tenantName}`);

      // Create initial activity logs for guests
      console.log(`  📝 Creating activity logs...`);
      const activityBatch = db.batch();
      let activityCount = 0;

      for (const [guestKey, guestId] of guestIdMap.entries()) {
        const activityRef = db.collection('guest_activity_logs').doc();
        activityBatch.set(activityRef, {
          tenantId,
          guestId,
          activityType: 'profile_created',
          title: 'Profile Migrated',
          description: 'Guest profile was created from historical reservation data',
          metadata: { migration: true },
          performedBy: null,
          createdAt: now(),
        });
        activityCount++;

        if (activityCount >= 400) {
          await activityBatch.commit();
          console.log(`  💾 Committed activity batch of ${activityCount} logs`);
          activityCount = 0;
        }
      }

      if (activityCount > 0) {
        await activityBatch.commit();
        console.log(`  💾 Committed final activity batch of ${activityCount} logs`);
      }
    }

    console.log('\n\n✨ Guest migration completed successfully!');
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  }
}

// Run migration if executed directly
if (require.main === module) {
  migrateGuests()
    .then(() => {
      console.log('\n👋 Migration script finished');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Migration script failed:', error);
      process.exit(1);
    });
}

export { migrateGuests };

