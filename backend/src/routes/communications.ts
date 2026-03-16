import express, { Router, Request, Response } from 'express';
import { requireRole } from '../middleware/auth';
import * as communicationSettings from '../utils/communicationSettings';

const router = Router();

// Middleware to verify superadmin
router.use(requireRole('iitech_admin'));

// ===== Email Templates =====

// Get email templates
router.get('/templates', async (req: Request, res: Response) => {
  try {
    const { tenantId, limit = 50, offset = 0 } = req.query;

    const templates = await communicationSettings.getEmailTemplates(
      tenantId as string,
      parseInt(limit as string),
      parseInt(offset as string)
    );

    res.json({
      success: true,
      data: templates,
      count: templates.length,
    });
  } catch (error: any) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ success: false, error: { message: error.message } });
  }
});

// Get single email template
router.get('/templates/:templateId', async (req: Request, res: Response) => {
  try {
    const { templateId } = req.params;
    const template = await communicationSettings.getEmailTemplate(templateId);

    if (!template) {
      return res.status(404).json({ success: false, error: { message: 'Template not found' } });
    }

    res.json({ success: true, data: template });
  } catch (error: any) {
    console.error('Error fetching template:', error);
    res.status(500).json({ success: false, error: { message: error.message } });
  }
});

// Create email template
router.post('/templates', async (req: Request, res: Response) => {
  try {
    const { name, category, subject, htmlContent, plainTextContent, variables, tenantId } = req.body;

    if (!name || !category || !subject || !htmlContent) {
      return res.status(400).json({
        success: false,
        error: { message: 'name, category, subject, and htmlContent are required' },
      });
    }

    const template = await communicationSettings.createEmailTemplate({
      name,
      category,
      subject,
      htmlContent,
      plainTextContent,
      variables: variables || [],
      tenantId,
      defaultTemplate: false,
      enabled: true,
    });

    res.status(201).json({ success: true, data: template });
  } catch (error: any) {
    console.error('Error creating template:', error);
    res.status(500).json({ success: false, error: { message: error.message } });
  }
});

// Update email template
router.patch('/templates/:templateId', async (req: Request, res: Response) => {
  try {
    const { templateId } = req.params;
    const updates = req.body;

    const updated = await communicationSettings.updateEmailTemplate(templateId, updates);

    if (!updated) {
      return res.status(404).json({ success: false, error: { message: 'Template not found' } });
    }

    res.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('Error updating template:', error);
    res.status(500).json({ success: false, error: { message: error.message } });
  }
});

// Delete email template
router.delete('/templates/:templateId', async (req: Request, res: Response) => {
  try {
    const { templateId } = req.params;
    const deleted = await communicationSettings.deleteEmailTemplate(templateId);

    if (!deleted) {
      return res.status(404).json({ success: false, error: { message: 'Template not found' } });
    }

    res.json({ success: true, data: { message: 'Template deleted successfully' } });
  } catch (error: any) {
    console.error('Error deleting template:', error);
    res.status(500).json({ success: false, error: { message: error.message } });
  }
});

// ===== Notification Channels =====

// Get notification channels
router.get('/channels', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.query;
    const channels = await communicationSettings.getNotificationChannels(tenantId as string);

    res.json({
      success: true,
      data: channels,
      count: channels.length,
    });
  } catch (error: any) {
    console.error('Error fetching channels:', error);
    res.status(500).json({ success: false, error: { message: error.message } });
  }
});

// Create notification channel
router.post('/channels', async (req: Request, res: Response) => {
  try {
    const { type, name, config, tenantId } = req.body;

    if (!type || !name || !config) {
      return res.status(400).json({
        success: false,
        error: { message: 'type, name, and config are required' },
      });
    }

    const channel = await communicationSettings.createNotificationChannel({
      type: type as communicationSettings.NotificationChannel['type'],
      name,
      enabled: true,
      config,
      tenantId,
    });

    res.status(201).json({ success: true, data: channel });
  } catch (error: any) {
    console.error('Error creating channel:', error);
    res.status(500).json({ success: false, error: { message: error.message } });
  }
});

// ===== Notification Rules =====

// Get notification rules
router.get('/rules', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.query;
    const rules = await communicationSettings.getNotificationRules(tenantId as string);

    res.json({
      success: true,
      data: rules,
      count: rules.length,
    });
  } catch (error: any) {
    console.error('Error fetching rules:', error);
    res.status(500).json({ success: false, error: { message: error.message } });
  }
});

// Create notification rule
router.post('/rules', async (req: Request, res: Response) => {
  try {
    const { name, trigger, actions, tenantId } = req.body;

    if (!name || !trigger || !actions) {
      return res.status(400).json({
        success: false,
        error: { message: 'name, trigger, and actions are required' },
      });
    }

    const rule = await communicationSettings.createNotificationRule({
      name,
      enabled: true,
      trigger,
      actions,
      tenantId,
    });

    res.status(201).json({ success: true, data: rule });
  } catch (error: any) {
    console.error('Error creating rule:', error);
    res.status(500).json({ success: false, error: { message: error.message } });
  }
});

// Update notification rule
router.patch('/rules/:ruleId', async (req: Request, res: Response) => {
  try {
    const { ruleId } = req.params;
    const updates = req.body;

    const updated = await communicationSettings.updateNotificationRule(ruleId, updates);

    if (!updated) {
      return res.status(404).json({ success: false, error: { message: 'Rule not found' } });
    }

    res.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('Error updating rule:', error);
    res.status(500).json({ success: false, error: { message: error.message } });
  }
});

// ===== Communication Logs =====

// Get communication logs
router.get('/logs', async (req: Request, res: Response) => {
  try {
    const { tenantId, limit = 100, offset = 0 } = req.query;

    const logs = await communicationSettings.getCommunicationLogs(
      tenantId as string,
      parseInt(limit as string),
      parseInt(offset as string)
    );

    res.json({
      success: true,
      data: logs,
      count: logs.length,
    });
  } catch (error: any) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ success: false, error: { message: error.message } });
  }
});

// Get communication statistics
router.get('/stats/overview', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.query;
    const stats = await communicationSettings.getCommunicationStats(tenantId as string);

    res.json({ success: true, data: stats });
  } catch (error: any) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ success: false, error: { message: error.message } });
  }
});

export default router;
