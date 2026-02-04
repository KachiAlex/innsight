#!/usr/bin/env tsx

/**
 * Migration Script: Migrate Illuminate Tenant from Firebase to PostgreSQL
 * 
 * This script migrates:
 * 1. Illuminate tenant
 * 2. All users from illuminate tenant
 * 3. All rooms from illuminate tenant
 * 4. Room categories and rate plans
 */

import admin from 'firebase-admin';
import { prisma } from '../src/utils/prisma';
import { hashPassword } from '../src/utils/password';

// Initialize Firebase Admin
if (!admin.apps.length) {
  // You'll need to provide your Firebase service account key
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID || 'innsight-2025',
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  } catch (error) {
    console.error('Failed to initialize Firebase. Check your environment variables:');
    console.error('- FIREBASE_PROJECT_ID');
    console.error('- FIREBASE_CLIENT_EMAIL');
    console.error('- FIREBASE_PRIVATE_KEY');
    process.exit(1);
  }
}

const db = admin.firestore();

async function migrateIlluminateTenant() {
  console.log('🚀 Starting migration of Illuminate tenant from Firebase to PostgreSQL...');

  try {
    // Step 1: Find the illuminate tenant in Firebase
    console.log('📋 Step 1: Finding Illuminate tenant in Firebase...');
    const tenantsSnapshot = await db.collection('tenants')
      .where('slug', '==', 'illuminate')
      .get();

    if (tenantsSnapshot.empty) {
      throw new Error('Illuminate tenant not found in Firebase');
    }

    const tenantDoc = tenantsSnapshot.docs[0];
    const tenantData = tenantDoc.data();
    const tenantId = tenantDoc.id;

    console.log(`✅ Found Illuminate tenant: ${tenantData.name}`);

    // Step 2: Create tenant in PostgreSQL
    console.log('📋 Step 2: Creating tenant in PostgreSQL...');
    const postgresTenant = await prisma.tenant.upsert({
      where: { slug: 'illuminate' },
      update: {
        name: tenantData.name,
        email: tenantData.email,
        phone: tenantData.phone || null,
        address: tenantData.address || null,
        subscriptionStatus: tenantData.subscriptionStatus || 'active',
        updatedAt: new Date(),
      },
      create: {
        id: tenantId, // Keep same ID for consistency
        name: tenantData.name,
        slug: tenantData.slug,
        email: tenantData.email,
        phone: tenantData.phone || null,
        address: tenantData.address || null,
        subscriptionStatus: tenantData.subscriptionStatus || 'active',
      },
    });

    console.log(`✅ Created/updated tenant in PostgreSQL: ${postgresTenant.name}`);

    // Step 3: Migrate users
    console.log('📋 Step 3: Migrating users...');
    const usersSnapshot = await db.collection('users')
      .where('tenantId', '==', tenantId)
      .get();

    console.log(`Found ${usersSnapshot.size} users to migrate`);

    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      
      // Skip if user already exists
      const existingUser = await prisma.user.findFirst({
        where: {
          tenantId: postgresTenant.id,
          email: userData.email,
        },
      });

      if (existingUser) {
        console.log(`⚠️  User ${userData.email} already exists, skipping...`);
        continue;
      }

      await prisma.user.create({
        data: {
          id: userDoc.id,
          tenantId: postgresTenant.id,
          email: userData.email,
          passwordHash: userData.passwordHash || await hashPassword('temp123'), // Default password if missing
          firstName: userData.firstName || '',
          lastName: userData.lastName || '',
          phone: userData.phone || null,
          role: userData.role || 'front_desk',
          isActive: userData.isActive !== false,
          lastLogin: userData.lastLogin ? new Date(userData.lastLogin.toDate()) : null,
          createdAt: userData.createdAt ? new Date(userData.createdAt.toDate()) : new Date(),
          updatedAt: userData.updatedAt ? new Date(userData.updatedAt.toDate()) : new Date(),
        },
      });

      console.log(`✅ Migrated user: ${userData.email}`);
    }

    // Step 4: Migrate room categories
    console.log('📋 Step 4: Migrating room categories...');
    const categoriesSnapshot = await db.collection('roomCategories')
      .where('tenantId', '==', tenantId)
      .get();

    console.log(`Found ${categoriesSnapshot.size} room categories to migrate`);

    for (const categoryDoc of categoriesSnapshot.docs) {
      const categoryData = categoryDoc.data();
      
      await prisma.roomCategory.upsert({
        where: { id: categoryDoc.id },
        update: {
          name: categoryData.name,
          description: categoryData.description || null,
          color: categoryData.color || null,
          totalRooms: categoryData.totalRooms || 0,
          updatedAt: new Date(),
        },
        create: {
          id: categoryDoc.id,
          tenantId: postgresTenant.id,
          name: categoryData.name,
          description: categoryData.description || null,
          color: categoryData.color || null,
          totalRooms: categoryData.totalRooms || 0,
        },
      });

      console.log(`✅ Migrated room category: ${categoryData.name}`);
    }

    // Step 5: Migrate rate plans
    console.log('📋 Step 5: Migrating rate plans...');
    const ratePlansSnapshot = await db.collection('ratePlans')
      .where('tenantId', '==', tenantId)
      .get();

    console.log(`Found ${ratePlansSnapshot.size} rate plans to migrate`);

    for (const ratePlanDoc of ratePlansSnapshot.docs) {
      const ratePlanData = ratePlanDoc.data();
      
      await prisma.ratePlan.upsert({
        where: { id: ratePlanDoc.id },
        update: {
          name: ratePlanData.name,
          description: ratePlanData.description || null,
          currency: ratePlanData.currency || 'NGN',
          baseRate: ratePlanData.baseRate || 0,
          isActive: ratePlanData.isActive !== false,
          categoryId: ratePlanData.categoryId || null,
          updatedAt: new Date(),
        },
        create: {
          id: ratePlanDoc.id,
          tenantId: postgresTenant.id,
          name: ratePlanData.name,
          description: ratePlanData.description || null,
          currency: ratePlanData.currency || 'NGN',
          baseRate: ratePlanData.baseRate || 0,
          isActive: ratePlanData.isActive !== false,
          categoryId: ratePlanData.categoryId || null,
        },
      });

      console.log(`✅ Migrated rate plan: ${ratePlanData.name}`);
    }

    // Step 6: Migrate rooms
    console.log('📋 Step 6: Migrating rooms...');
    const roomsSnapshot = await db.collection('rooms')
      .where('tenantId', '==', tenantId)
      .get();

    console.log(`Found ${roomsSnapshot.size} rooms to migrate`);

    for (const roomDoc of roomsSnapshot.docs) {
      const roomData = roomDoc.data();
      
      await prisma.room.upsert({
        where: { id: roomDoc.id },
        update: {
          roomNumber: roomData.roomNumber || null,
          roomType: roomData.roomType || null,
          floor: roomData.floor || null,
          status: roomData.status || 'available',
          categoryId: roomData.categoryId || null,
          ratePlanId: roomData.ratePlanId || null,
          baseRate: roomData.baseRate || 0,
          customRate: roomData.customRate || null,
          capacity: roomData.capacity || 2,
          bedType: roomData.bedType || null,
          smokingAllowed: roomData.smokingAllowed || false,
          amenities: roomData.amenities || [],
          lastCleaned: roomData.lastCleaned ? new Date(roomData.lastCleaned.toDate()) : null,
          updatedAt: new Date(),
        },
        create: {
          id: roomDoc.id,
          tenantId: postgresTenant.id,
          roomNumber: roomData.roomNumber || null,
          roomType: roomData.roomType || null,
          floor: roomData.floor || null,
          status: roomData.status || 'available',
          categoryId: roomData.categoryId || null,
          ratePlanId: roomData.ratePlanId || null,
          baseRate: roomData.baseRate || 0,
          customRate: roomData.customRate || null,
          capacity: roomData.capacity || 2,
          bedType: roomData.bedType || null,
          smokingAllowed: roomData.smokingAllowed || false,
          amenities: roomData.amenities || [],
          lastCleaned: roomData.lastCleaned ? new Date(roomData.lastCleaned.toDate()) : null,
        },
      });

      console.log(`✅ Migrated room: ${roomData.roomNumber || roomDoc.id}`);
    }

    console.log('🎉 Migration completed successfully!');
    console.log('');
    console.log('📊 Migration Summary:');
    console.log(`- Tenant: ${postgresTenant.name} (${postgresTenant.slug})`);
    console.log(`- Users: ${usersSnapshot.size}`);
    console.log(`- Room Categories: ${categoriesSnapshot.size}`);
    console.log(`- Rate Plans: ${ratePlansSnapshot.size}`);
    console.log(`- Rooms: ${roomsSnapshot.size}`);
    console.log('');
    console.log('🔑 Login Credentials:');
    console.log('For migrated users, you can use their email with password: "temp123"');
    console.log('Or update passwords manually in PostgreSQL');
    console.log('');
    console.log('⚠️  Important: Update user passwords and set proper Firebase credentials in production!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
if (require.main === module) {
  migrateIlluminateTenant()
    .then(() => {
      console.log('✅ Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration script failed:', error);
      process.exit(1);
    });
}

export { migrateIlluminateTenant };
