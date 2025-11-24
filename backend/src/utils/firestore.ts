import * as admin from 'firebase-admin';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

export const db = admin.firestore();

// Helper to convert Firestore timestamp to Date
export const toDate = (timestamp: admin.firestore.Timestamp | Date | string | null | undefined): Date | null => {
  if (!timestamp) return null;
  if (timestamp instanceof Date) return timestamp;
  if (typeof timestamp === 'string') return new Date(timestamp);
  if (timestamp instanceof admin.firestore.Timestamp) {
    try {
      return timestamp.toDate();
    } catch (error) {
      console.warn('Error converting timestamp to date:', error);
      return null;
    }
  }
  return null;
};

// Helper to convert Date to Firestore timestamp
export const toTimestamp = (date: Date | string | null | undefined): admin.firestore.Timestamp | null => {
  if (!date) return null;
  if (date instanceof Date) {
    return admin.firestore.Timestamp.fromDate(date);
  }
  return admin.firestore.Timestamp.fromDate(new Date(date));
};

// Helper to convert Firestore document to plain object
export const docToObject = <T>(doc: admin.firestore.DocumentSnapshot): T & { id: string } => {
  const data = doc.data();
  if (!data) {
    throw new Error('Document data is undefined');
  }
  return {
    id: doc.id,
    ...data,
  } as T & { id: string };
};

// Helper to convert Firestore query snapshot to array
export const snapshotToArray = <T>(snapshot: admin.firestore.QuerySnapshot): (T & { id: string })[] => {
  return snapshot.docs.map(doc => docToObject<T>(doc));
};

// Helper for pagination
export const paginateQuery = (
  query: admin.firestore.Query,
  page: number,
  limit: number
): admin.firestore.Query => {
  const skip = (page - 1) * limit;
  return query.limit(limit).offset(skip);
};

// Helper to get current timestamp
export const now = () => admin.firestore.Timestamp.now();

