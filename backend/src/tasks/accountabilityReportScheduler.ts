import { scheduler } from 'firebase-functions/v2/scheduler';
import { db } from '../utils/firestore';
import { createAccountabilityReportForTenant } from '../routes/rooms';

export const dailyAccountabilityReport = scheduler('0 6 * * *') // daily at 6 AM server time
  .timeZone('Africa/Lagos')
  .onRun(async () => {
    const tenantsSnapshot = await db.collection('tenants').get();
    await Promise.all(
      tenantsSnapshot.docs.map(async (tenantDoc) => {
        try {
          await createAccountabilityReportForTenant(tenantDoc.id, 'system');
        } catch (error) {
          console.error(`Failed to generate accountability report for tenant ${tenantDoc.id}:`, error);
        }
      })
    );
  });

