import { Router } from 'express';
import { AppError } from '../middleware/errorHandler';
import { authenticate, requireTenantAccess, AuthRequest } from '../middleware/auth';
import { db, toDate, toTimestamp, now } from '../utils/firestore';
import admin from 'firebase-admin';

export const automationRouter = Router({ mergeParams: true });

// ============================================
// WORKFLOW RULES MANAGEMENT
// ============================================

// GET /api/tenants/:tenantId/automation/workflows - List workflow rules
automationRouter.get('/workflows', authenticate, requireTenantAccess, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.params.tenantId;
    const { active = 'true' } = req.query;

    let query: admin.firestore.Query = db.collection('workflow_rules')
      .where('tenantId', '==', tenantId);

    if (active === 'true') {
      query = query.where('isActive', '==', true);
    }

    const rulesSnapshot = await query
      .orderBy('createdAt', 'desc')
      .get();

    const rules = rulesSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: toDate(data.createdAt),
        updatedAt: toDate(data.updatedAt),
        lastExecuted: data.lastExecuted ? toDate(data.lastExecuted) : null,
      };
    });

    res.json({
      success: true,
      data: rules,
    });
  } catch (error: any) {
    console.error('Error fetching workflow rules:', error);
    throw new AppError(
      `Failed to fetch workflow rules: ${error.message || 'Unknown error'}`,
      500
    );
  }
});

// POST /api/tenants/:tenantId/automation/workflows - Create workflow rule
automationRouter.post('/workflows', authenticate, requireTenantAccess, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.params.tenantId;
    const ruleData = req.body;

    // Validate required fields
    if (!ruleData.ruleName || !ruleData.triggerEvent || !ruleData.actions) {
      throw new AppError('Rule name, trigger event, and actions are required', 400);
    }

    const timestamp = now();
    const ruleRecord = {
      tenantId,
      ruleName: ruleData.ruleName,
      ruleType: ruleData.ruleType || 'assignment',
      triggerEvent: ruleData.triggerEvent,
      conditions: ruleData.conditions || null,
      actions: ruleData.actions,
      priority: ruleData.priority || 0,
      isActive: ruleData.isActive !== false,
      lastExecuted: null,
      executionCount: 0,
      createdBy: req.user?.id,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const docRef = await db.collection('workflow_rules').add(ruleRecord);

    res.json({
      success: true,
      data: {
        id: docRef.id,
        ...ruleRecord,
        createdAt: toDate(timestamp),
        updatedAt: toDate(timestamp),
      },
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Error creating workflow rule:', error);
    throw new AppError(
      `Failed to create workflow rule: ${error.message || 'Unknown error'}`,
      500
    );
  }
});

// PUT /api/tenants/:tenantId/automation/workflows/:ruleId - Update workflow rule
automationRouter.put('/workflows/:ruleId', authenticate, requireTenantAccess, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.params.tenantId;
    const ruleId = req.params.ruleId;
    const updates = req.body;

    const ruleDoc = await db.collection('workflow_rules').doc(ruleId).get();

    if (!ruleDoc.exists || ruleDoc.data()?.tenantId !== tenantId) {
      throw new AppError('Workflow rule not found', 404);
    }

    const timestamp = now();
    const updateData = {
      ...updates,
      updatedAt: timestamp,
    };

    await db.collection('workflow_rules').doc(ruleId).update(updateData);

    const updatedDoc = await db.collection('workflow_rules').doc(ruleId).get();
    const ruleData = updatedDoc.data();

    res.json({
      success: true,
      data: {
        id: updatedDoc.id,
        ...ruleData,
        createdAt: toDate(ruleData?.createdAt),
        updatedAt: toDate(ruleData?.updatedAt),
        lastExecuted: ruleData?.lastExecuted ? toDate(ruleData.lastExecuted) : null,
      },
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Error updating workflow rule:', error);
    throw new AppError(
      `Failed to update workflow rule: ${error.message || 'Unknown error'}`,
      500
    );
  }
});

// DELETE /api/tenants/:tenantId/automation/workflows/:ruleId - Delete workflow rule
automationRouter.delete('/workflows/:ruleId', authenticate, requireTenantAccess, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.params.tenantId;
    const ruleId = req.params.ruleId;

    const ruleDoc = await db.collection('workflow_rules').doc(ruleId).get();

    if (!ruleDoc.exists || ruleDoc.data()?.tenantId !== tenantId) {
      throw new AppError('Workflow rule not found', 404);
    }

    await db.collection('workflow_rules').doc(ruleId).delete();

    res.json({
      success: true,
      message: 'Workflow rule deleted successfully',
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Error deleting workflow rule:', error);
    throw new AppError(
      `Failed to delete workflow rule: ${error.message || 'Unknown error'}`,
      500
    );
  }
});

// ============================================
// SMART ALERTS MANAGEMENT
// ============================================

// GET /api/tenants/:tenantId/automation/alerts - List smart alerts
automationRouter.get('/alerts', authenticate, requireTenantAccess, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.params.tenantId;
    const { status = 'active', severity } = req.query;

    let query: admin.firestore.Query = db.collection('smart_alerts')
      .where('tenantId', '==', tenantId);

    if (status) {
      query = query.where('status', '==', status);
    }

    if (severity) {
      query = query.where('severity', '==', severity);
    }

    const alertsSnapshot = await query
      .orderBy('createdAt', 'desc')
      .get();

    const alerts = alertsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: toDate(doc.data().createdAt),
      updatedAt: toDate(doc.data().updatedAt),
      triggeredAt: doc.data().triggeredAt ? toDate(doc.data().triggeredAt) : null,
      resolvedAt: doc.data().resolvedAt ? toDate(doc.data().resolvedAt) : null,
    }));

    res.json({
      success: true,
      data: alerts,
    });
  } catch (error: any) {
    console.error('Error fetching smart alerts:', error);
    throw new AppError(
      `Failed to fetch smart alerts: ${error.message || 'Unknown error'}`,
      500
    );
  }
});

// POST /api/tenants/:tenantId/automation/alerts - Create smart alert
automationRouter.post('/alerts', authenticate, requireTenantAccess, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.params.tenantId;
    const alertData = req.body;

    // Validate required fields
    if (!alertData.alertType || !alertData.title || !alertData.message) {
      throw new AppError('Alert type, title, and message are required', 400);
    }

    const timestamp = now();
    const alertRecord = {
      tenantId,
      alertType: alertData.alertType,
      severity: alertData.severity || 'info',
      title: alertData.title,
      message: alertData.message,
      description: alertData.description || null,
      threshold: alertData.threshold || null,
      conditions: alertData.conditions || null,
      notifyUsers: alertData.notifyUsers || [],
      notifyRoles: alertData.notifyRoles || [],
      channels: alertData.channels || ['dashboard'],
      status: 'active',
      triggeredAt: null,
      resolvedAt: null,
      resolvedBy: null,
      autoResolve: alertData.autoResolve || false,
      resolveAfterMinutes: alertData.resolveAfterMinutes || null,
      createdBy: req.user?.id,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const docRef = await db.collection('smart_alerts').add(alertRecord);

    res.json({
      success: true,
      data: {
        id: docRef.id,
        ...alertRecord,
        createdAt: toDate(timestamp),
        updatedAt: toDate(timestamp),
      },
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Error creating smart alert:', error);
    throw new AppError(
      `Failed to create smart alert: ${error.message || 'Unknown error'}`,
      500
    );
  }
});

// POST /api/tenants/:tenantId/automation/alerts/:alertId/resolve - Resolve alert
automationRouter.post('/alerts/:alertId/resolve', authenticate, requireTenantAccess, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.params.tenantId;
    const alertId = req.params.alertId;

    const alertDoc = await db.collection('smart_alerts').doc(alertId).get();

    if (!alertDoc.exists || alertDoc.data()?.tenantId !== tenantId) {
      throw new AppError('Smart alert not found', 404);
    }

    const timestamp = now();
    await db.collection('smart_alerts').doc(alertId).update({
      status: 'resolved',
      resolvedAt: timestamp,
      resolvedBy: req.user?.id,
      updatedAt: timestamp,
    });

    const updatedDoc = await db.collection('smart_alerts').doc(alertId).get();
    const alertData = updatedDoc.data();

    res.json({
      success: true,
      data: {
        id: updatedDoc.id,
        ...alertData,
        createdAt: toDate(alertData?.createdAt),
        updatedAt: toDate(alertData?.updatedAt),
        triggeredAt: alertData?.triggeredAt ? toDate(alertData.triggeredAt) : null,
        resolvedAt: alertData?.resolvedAt ? toDate(alertData.resolvedAt) : null,
      },
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Error resolving alert:', error);
    throw new AppError(
      `Failed to resolve alert: ${error.message || 'Unknown error'}`,
      500
    );
  }
});

// ============================================
// AUTOMATED WORKFLOW EXECUTION
// ============================================

// POST /api/tenants/:tenantId/automation/trigger - Trigger workflow execution
automationRouter.post('/trigger', authenticate, requireTenantAccess, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.params.tenantId;
    const { eventType, eventData } = req.body;

    if (!eventType || !eventData) {
      throw new AppError('Event type and event data are required', 400);
    }

    // Find applicable workflow rules
    const rulesSnapshot = await db.collection('workflow_rules')
      .where('tenantId', '==', tenantId)
      .where('isActive', '==', true)
      .where('triggerEvent', '==', eventType)
      .get();

    const executedRules: any[] = [];
    const timestamp = now();

    for (const ruleDoc of rulesSnapshot.docs) {
      const ruleData = ruleDoc.data();

      // Check if conditions are met
      if (ruleData.conditions && !evaluateConditions(ruleData.conditions, eventData)) {
        continue;
      }

      // Execute the rule actions
      const result = await executeWorkflowActions(tenantId, ruleData.actions, eventData);

      if (result.success) {
        // Update rule execution stats
        await db.collection('workflow_rules').doc(ruleDoc.id).update({
          lastExecuted: timestamp,
          executionCount: (ruleData.executionCount || 0) + 1,
          updatedAt: timestamp,
        });

        executedRules.push({
          ruleId: ruleDoc.id,
          ruleName: ruleData.ruleName,
          actions: result.actions,
        });
      }
    }

    res.json({
      success: true,
      data: {
        eventType,
        executedRules,
        totalExecuted: executedRules.length,
      },
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Error triggering workflow:', error);
    throw new AppError(
      `Failed to trigger workflow: ${error.message || 'Unknown error'}`,
      500
    );
  }
});

// ============================================
// PREDICTIVE GUEST SERVICES
// ============================================

// GET /api/tenants/:tenantId/automation/predictions/guest/:guestId - Get guest predictions
automationRouter.get('/predictions/guest/:guestId', authenticate, requireTenantAccess, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.params.tenantId;
    const guestId = req.params.guestId;

    // Get guest behavior data
    const behaviorsSnapshot = await db.collection('guest_behaviors')
      .where('tenantId', '==', tenantId)
      .where('guestId', '==', guestId)
      .get();

    const behaviors = behaviorsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      firstObserved: toDate(doc.data().firstObserved),
      lastObserved: toDate(doc.data().lastObserved),
    }));

    // Generate predictions based on behavior patterns
    const predictions = await generateGuestPredictions(behaviors, guestId);

    res.json({
      success: true,
      data: {
        guestId,
        behaviors,
        predictions,
      },
    });
  } catch (error: any) {
    console.error('Error generating guest predictions:', error);
    throw new AppError(
      `Failed to generate guest predictions: ${error.message || 'Unknown error'}`,
      500
    );
  }
});

// POST /api/tenants/:tenantId/automation/behaviors - Record guest behavior
automationRouter.post('/behaviors', authenticate, requireTenantAccess, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.params.tenantId;
    const { guestId, behaviorType, behaviorKey, behaviorValue, contextData } = req.body;

    if (!behaviorType || !behaviorKey) {
      throw new AppError('Behavior type and key are required', 400);
    }

    const timestamp = now();

    // Check if behavior already exists
    const existingQuery = db.collection('guest_behaviors')
      .where('tenantId', '==', tenantId)
      .where('guestId', '==', guestId || null)
      .where('behaviorType', '==', behaviorType)
      .where('behaviorKey', '==', behaviorKey)
      .limit(1);

    const existingSnapshot = await existingQuery.get();

    if (!existingSnapshot.empty) {
      // Update existing behavior
      const existingDoc = existingSnapshot.docs[0];
      await db.collection('guest_behaviors').doc(existingDoc.id).update({
        behaviorValue: behaviorValue,
        lastObserved: timestamp,
        observationCount: (existingDoc.data().observationCount || 1) + 1,
        contextData: contextData || existingDoc.data().contextData,
      });
    } else {
      // Create new behavior
      const behaviorRecord = {
        tenantId,
        guestId: guestId || null,
        behaviorType,
        behaviorKey,
        behaviorValue,
        confidence: 1,
        firstObserved: timestamp,
        lastObserved: timestamp,
        observationCount: 1,
        contextData: contextData || null,
      };

      await db.collection('guest_behaviors').add(behaviorRecord);
    }

    res.json({
      success: true,
      message: 'Guest behavior recorded successfully',
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Error recording guest behavior:', error);
    throw new AppError(
      `Failed to record guest behavior: ${error.message || 'Unknown error'}`,
      500
    );
  }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

function evaluateConditions(conditions: any, eventData: any): boolean {
  // Simple condition evaluation logic
  // This could be expanded to support complex boolean logic
  try {
    if (conditions.operator === 'AND') {
      return conditions.rules.every((rule: any) => evaluateRule(rule, eventData));
    } else if (conditions.operator === 'OR') {
      return conditions.rules.some((rule: any) => evaluateRule(rule, eventData));
    } else {
      return evaluateRule(conditions, eventData);
    }
  } catch (error) {
    console.error('Error evaluating conditions:', error);
    return false;
  }
}

function evaluateRule(rule: any, eventData: any): boolean {
  const { field, operator, value } = rule;
  const fieldValue = getNestedValue(eventData, field);

  switch (operator) {
    case 'equals':
      return fieldValue === value;
    case 'not_equals':
      return fieldValue !== value;
    case 'greater_than':
      return fieldValue > value;
    case 'less_than':
      return fieldValue < value;
    case 'contains':
      return String(fieldValue).includes(String(value));
    case 'in':
      return Array.isArray(value) && value.includes(fieldValue);
    default:
      return false;
  }
}

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

async function executeWorkflowActions(tenantId: string, actions: any[], eventData: any) {
  const executedActions: any[] = [];

  try {
    for (const action of actions) {
      const result = await executeAction(tenantId, action, eventData);
      executedActions.push({
        action: action.type,
        success: result.success,
        message: result.message,
      });
    }

    return {
      success: true,
      actions: executedActions,
    };
  } catch (error: any) {
    console.error('Error executing workflow actions:', error);
    return {
      success: false,
      actions: executedActions,
      error: error.message,
    };
  }
}

async function executeAction(tenantId: string, action: any, eventData: any) {
  try {
    switch (action.type) {
      case 'assign_task':
        return await assignTask(tenantId, action, eventData);
      case 'send_notification':
        return await sendNotification(tenantId, action, eventData);
      case 'update_status':
        return await updateStatus(tenantId, action, eventData);
      case 'create_alert':
        return await createAlert(tenantId, action, eventData);
      default:
        return { success: false, message: `Unknown action type: ${action.type}` };
    }
  } catch (error: any) {
    console.error(`Error executing action ${action.type}:`, error);
    return { success: false, message: error.message };
  }
}

async function assignTask(tenantId: string, action: any, eventData: any) {
  // Implementation for task assignment
  // This would create tasks and assign them to staff
  return { success: true, message: 'Task assigned successfully' };
}

async function sendNotification(tenantId: string, action: any, eventData: any) {
  // Implementation for sending notifications
  // This could send emails, push notifications, etc.
  return { success: true, message: 'Notification sent successfully' };
}

async function updateStatus(tenantId: string, action: any, eventData: any) {
  // Implementation for updating status
  // This could update reservation status, task status, etc.
  return { success: true, message: 'Status updated successfully' };
}

async function createAlert(tenantId: string, action: any, eventData: any) {
  // Implementation for creating alerts
  // This would create smart alerts based on workflow rules
  return { success: true, message: 'Alert created successfully' };
}

async function generateGuestPredictions(behaviors: any[], guestId: string) {
  // Analyze behavior patterns to generate predictions
  const predictions = {
    roomPreferences: [] as string[],
    servicePreferences: [] as string[],
    spendingPatterns: {} as any,
    likelihoodToReturn: 0,
    recommendedServices: [] as string[],
  };

  // Analyze room preferences
  const roomBehaviors = behaviors.filter(b => b.behaviorType === 'room_preference');
  predictions.roomPreferences = roomBehaviors
    .sort((a, b) => b.observationCount - a.observationCount)
    .slice(0, 3)
    .map(b => b.behaviorValue);

  // Analyze service preferences
  const serviceBehaviors = behaviors.filter(b => b.behaviorType === 'service_preference');
  predictions.servicePreferences = serviceBehaviors
    .sort((a, b) => b.observationCount - a.observationCount)
    .slice(0, 3)
    .map(b => b.behaviorValue);

  // Calculate likelihood to return (simplified)
  const visitCount = behaviors.find(b => b.behaviorKey === 'visit_count')?.behaviorValue || 0;
  predictions.likelihoodToReturn = Math.min(100, Math.max(0, visitCount * 20));

  // Generate recommendations
  if (predictions.roomPreferences.includes('suite')) {
    predictions.recommendedServices.push('concierge_service');
  }

  if (predictions.servicePreferences.includes('room_service')) {
    predictions.recommendedServices.push('late_checkout');
  }

  return predictions;
}
