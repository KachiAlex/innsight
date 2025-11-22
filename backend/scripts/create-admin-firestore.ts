import * as admin from 'firebase-admin';
import bcrypt from 'bcryptjs';

// Initialize Firebase Admin
try {
  // Try to initialize with explicit project ID if available
  const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || 'innsight-2025';
  
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    // Use service account key file
    const serviceAccount = require(process.env.GOOGLE_APPLICATION_CREDENTIALS);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: projectId,
    });
  } else {
    // Try default credentials (works in Firebase Functions or with gcloud auth)
    admin.initializeApp({
      projectId: projectId,
    });
  }
} catch (error: any) {
  // Already initialized
  if (error.code !== 'app/already-initialized') {
    console.error('Error initializing Firebase Admin:', error);
    console.log('\n💡 Tip: For local development, run:');
    console.log('   gcloud auth application-default login');
    console.log('   OR set GOOGLE_APPLICATION_CREDENTIALS to your service account key file');
    throw error;
  }
}

const db = admin.firestore();

interface User {
  tenantId: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: string;
  permissions?: any;
  isActive: boolean;
  lastLoginAt?: admin.firestore.Timestamp | null;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

interface Tenant {
  name: string;
  slug: string;
  email: string;
  phone?: string;
  address?: string;
  branding?: any;
  taxSettings?: any;
  subscriptionStatus: string;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

async function main() {
  console.log('🔐 Creating admin account in Firestore...');

  try {
    // Find or create IITECH tenant
    const tenantsRef = db.collection('tenants');
    let iitechTenantId: string | null = null;
    
    const tenantSnapshot = await tenantsRef.where('slug', '==', 'iitech').limit(1).get();
    
    if (!tenantSnapshot.empty) {
      const tenantDoc = tenantSnapshot.docs[0];
      iitechTenantId = tenantDoc.id;
      console.log('✅ Found existing IITECH tenant:', iitechTenantId);
    } else {
      // Create IITECH tenant
      const now = admin.firestore.Timestamp.now();
      const newTenant: Tenant = {
        name: 'IITECH Platform',
        slug: 'iitech',
        email: 'admin@iitech.com',
        phone: '+2341234567890',
        subscriptionStatus: 'active',
        createdAt: now,
        updatedAt: now,
      };
      
      const tenantRef = await tenantsRef.add(newTenant);
      iitechTenantId = tenantRef.id;
      console.log('✅ Created IITECH tenant:', iitechTenantId);
    }

    // Create or update admin user
    const passwordHash = await bcrypt.hash('admin123', 12);
    const usersRef = db.collection('users');
    
    // Check if admin user exists
    const userSnapshot = await usersRef
      .where('tenantId', '==', iitechTenantId)
      .where('email', '==', 'admin@insight.com')
      .limit(1)
      .get();

    const now = admin.firestore.Timestamp.now();
    let adminUserId: string;

    if (!userSnapshot.empty) {
      // Update existing user
      const userDoc = userSnapshot.docs[0];
      await userDoc.ref.update({
        passwordHash,
        firstName: 'Admin',
        lastName: 'User',
        role: 'iitech_admin',
        isActive: true,
        updatedAt: now,
      });
      adminUserId = userDoc.id;
      console.log('✅ Updated existing admin user:', adminUserId);
    } else {
      // Create new user
      const newUser: User = {
        tenantId: iitechTenantId!,
        email: 'admin@insight.com',
        passwordHash,
        firstName: 'Admin',
        lastName: 'User',
        role: 'iitech_admin',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };
      
      const userRef = await usersRef.add(newUser);
      adminUserId = userRef.id;
      console.log('✅ Created new admin user:', adminUserId);
    }

    console.log('\n✅ Admin account created successfully!');
    console.log('\n📝 Login Credentials:');
    console.log('   Email: admin@insight.com');
    console.log('   Password: admin123');
    console.log('   Role: iitech_admin');
    console.log(`   User ID: ${adminUserId}`);
    console.log(`   Tenant ID: ${iitechTenantId}`);
  } catch (error) {
    console.error('❌ Failed to create admin account:', error);
    throw error;
  }
}

main()
  .then(() => {
    console.log('\n🎉 Setup completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  });
