#!/usr/bin/env tsx

/**
 * Test Firebase connection
 */

import fs from 'fs';
import path from 'path';
import admin from 'firebase-admin';

async function testFirebaseConnection() {
  // Read the service account file
  const serviceAccountPath = path.join(__dirname, '../serviceAccount.innsight-2025 (2).json');

  try {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    
    console.log('🔧 Testing Firebase connection...');
    console.log(`- Project ID: ${serviceAccount.project_id}`);
    console.log(`- Client Email: ${serviceAccount.client_email}`);
    
    // Initialize Firebase
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    }
    
    const db = admin.firestore();
    
    // Test connection by trying to list collections
    console.log('\n📋 Testing database access...');
    
    // Try to list tenants
    const tenantsSnapshot = await db.collection('tenants').limit(1).get();
    console.log(`✅ Connected to Firebase! Found ${tenantsSnapshot.size} tenants (showing first 1)`);
    
    // Try to find illuminate tenant
    const illuminateSnapshot = await db.collection('tenants')
      .where('slug', '==', 'illuminate')
      .get();
      
    if (illuminateSnapshot.empty) {
      console.log('❌ Illuminate tenant not found in Firebase');
    } else {
      const tenant = illuminateSnapshot.docs[0].data();
      console.log(`✅ Found Illuminate tenant: ${tenant.name}`);
      
      // Count users
      const usersSnapshot = await db.collection('users')
        .where('tenantId', '==', illuminateSnapshot.docs[0].id)
        .get();
      console.log(`📊 Found ${usersSnapshot.size} users`);
      
      // Count rooms
      const roomsSnapshot = await db.collection('rooms')
        .where('tenantId', '==', illuminateSnapshot.docs[0].id)
        .get();
      console.log(`📊 Found ${roomsSnapshot.size} rooms`);
      
      // Count room categories
      const categoriesSnapshot = await db.collection('roomCategories')
        .where('tenantId', '==', illuminateSnapshot.docs[0].id)
        .get();
      console.log(`📊 Found ${categoriesSnapshot.size} room categories`);
      
      // Count rate plans
      const ratePlansSnapshot = await db.collection('ratePlans')
        .where('tenantId', '==', illuminateSnapshot.docs[0].id)
        .get();
      console.log(`📊 Found ${ratePlansSnapshot.size} rate plans`);
    }
    
    console.log('\n✅ Firebase connection test completed successfully!');
    
    // Clean up
    if (admin.apps.length > 0) {
      await admin.app().delete();
    }
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Firebase connection test failed:', error);
    console.log('\n🔧 Possible solutions:');
    console.log('1. Check internet connection');
    console.log('2. Verify Firebase project is active');
    console.log('3. Check service account permissions');
    console.log('4. Ensure Firestore database exists');
    process.exit(1);
  }
}

// Run the test
testFirebaseConnection();
