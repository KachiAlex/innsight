// Temporary Firebase restoration for migration purposes
// TODO: Remove this after migration is complete

import admin from 'firebase-admin';

// Initialize Firebase if not already initialized
let firebaseDb: admin.firestore.Firestore | null = null;

export const initializeFirebase = () => {
  if (!firebaseDb && admin.apps.length > 0) {
    firebaseDb = admin.firestore();
  }
  return firebaseDb;
};

export const db = initializeFirebase();
export const adminSdk = admin;

// Helper to convert timestamp to Date
export const toDate = (timestamp: any): Date | null => {
  if (!timestamp) return null;
  if (timestamp instanceof Date) return timestamp;
  if (typeof timestamp === 'string') return new Date(timestamp);
  if (timestamp && typeof timestamp.toDate === 'function') {
    return timestamp.toDate();
  }
  return null;
};

// Helper to convert Date to timestamp
export const toTimestamp = (date: Date | string | null | undefined): any => {
  if (!date) return null;
  if (date instanceof Date) return admin.firestore.Timestamp.fromDate(date);
  return admin.firestore.Timestamp.fromDate(new Date(date));
};

// Helper to get current timestamp
export const now = () => admin.firestore.Timestamp.now();

// Stub functions for backward compatibility
export const docToObject = <T>(doc: any): T & { id: string } => {
  throw new Error('Firebase is no longer supported. Please use PostgreSQL via Prisma.');
};

export const snapshotToArray = <T>(snapshot: any): (T & { id: string })[] => {
  throw new Error('Firebase is no longer supported. Please use PostgreSQL via Prisma.');
};

export const paginateQuery = (query: any, page: number, limit: number): any => {
  throw new Error('Firebase is no longer supported. Please use PostgreSQL via Prisma.');
};

export const nowDate = (): Date => new Date();

