// Firebase is no longer used - this file provides stubs for backward compatibility
// All data operations should now use PostgreSQL via Prisma

export const db = null;
export const admin = null;

// Helper to convert timestamp to Date (for compatibility)
export const toDate = (timestamp: any): Date | null => {
  if (!timestamp) return null;
  if (timestamp instanceof Date) return timestamp;
  if (typeof timestamp === 'string') return new Date(timestamp);
  return null;
};

// Helper to convert Date to timestamp (for compatibility)
export const toTimestamp = (date: Date | string | null | undefined): any => {
  if (!date) return null;
  if (date instanceof Date) return date;
  return new Date(date);
};

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

export const now = (): Date => new Date();

