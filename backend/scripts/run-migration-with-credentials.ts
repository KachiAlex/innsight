#!/usr/bin/env tsx

/**
 * Setup Firebase credentials from service account file and run migration
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// Read the service account file
const serviceAccountPath = path.join(__dirname, '../serviceAccount.innsight-2025 (2).json');

try {
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
  
  console.log('🔧 Setting up Firebase credentials...');
  
  // Set environment variables
  process.env.FIREBASE_PROJECT_ID = serviceAccount.project_id;
  process.env.FIREBASE_CLIENT_EMAIL = serviceAccount.client_email;
  process.env.FIREBASE_PRIVATE_KEY = serviceAccount.private_key;
  
  console.log('✅ Firebase credentials loaded:');
  console.log(`- Project ID: ${serviceAccount.project_id}`);
  console.log(`- Client Email: ${serviceAccount.client_email}`);
  console.log(`- Private Key: [REDACTED]`);
  
  // Now run the migration script
  console.log('\n🚀 Starting Firebase migration...');
  
  // Import and run the migration
  const { migrateIlluminateTenant } = require('./migrate-illuminate-tenant.ts');
  
  migrateIlluminateTenant()
    .then(() => {
      console.log('✅ Migration completed successfully!');
      process.exit(0);
    })
    .catch((error: any) => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
    
} catch (error) {
  console.error('❌ Failed to read service account file:', error);
  console.log('\n📋 Make sure the service account file exists at:');
  console.log(serviceAccountPath);
  process.exit(1);
}
