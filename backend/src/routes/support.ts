import express, { Router, Request, Response } from 'express';
import { requireRole } from '../middleware/auth';
import * as supportTickets from '../utils/supportTickets';

const router = Router();

// Middleware to verify super admin
router.use(requireRole('iitech_admin'));

// Get all tickets with filters
router.get('/', async (req: Request, res: Response) => {
  try {
    const { tenantId, status, priority, category, assignedTo, limit = 50, offset = 0 } = req.query;

    const tickets = await supportTickets.getTickets(
      {
        tenantId: tenantId as string,
        status: status as supportTickets.TicketStatus,
        priority: priority as supportTickets.TicketPriority,
        category: category as supportTickets.TicketCategory,
        assignedTo: assignedTo as string,
      },
      parseInt(limit as string),
      parseInt(offset as string)
    );

    res.json({
      success: true,
      data: tickets,
      count: tickets.length,
    });
  } catch (error: any) {
    console.error('Error fetching tickets:', error);
    res.status(500).json({ success: false, error: { message: error.message } });
  }
});

// Get single ticket
router.get('/:ticketId', async (req: Request, res: Response) => {
  try {
    const { ticketId } = req.params;
    const ticket = await supportTickets.getTicket(ticketId);

    if (!ticket) {
      return res.status(404).json({ success: false, error: { message: 'Ticket not found' } });
    }

    res.json({ success: true, data: ticket });
  } catch (error: any) {
    console.error('Error fetching ticket:', error);
    res.status(500).json({ success: false, error: { message: error.message } });
  }
});

// Create ticket
router.post('/', async (req: Request, res: Response) => {
  try {
    const { subject, description, category, priority, requesterEmail, requesterName, tenantId } = req.body;

    if (!subject || !description || !category || !priority || !requesterEmail || !requesterName) {
      return res.status(400).json({
        success: false,
        error: { message: 'Missing required fields' },
      });
    }

    const ticket = await supportTickets.createTicket({
      subject,
      description,
      category,
      priority,
      requesterEmail,
      requesterName,
      tenantId,
      status: 'open',
    });

    res.status(201).json({ success: true, data: ticket });
  } catch (error: any) {
    console.error('Error creating ticket:', error);
    res.status(500).json({ success: false, error: { message: error.message } });
  }
});

// Update ticket
router.patch('/:ticketId', async (req: Request, res: Response) => {
  try {
    const { ticketId } = req.params;
    const updates = req.body;

    const updated = await supportTickets.updateTicket(ticketId, updates);

    if (!updated) {
      return res.status(404).json({ success: false, error: { message: 'Ticket not found' } });
    }

    res.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('Error updating ticket:', error);
    res.status(500).json({ success: false, error: { message: error.message } });
  }
});

// Add message to ticket
router.post('/:ticketId/messages', async (req: Request, res: Response) => {
  try {
    const { ticketId } = req.params;
    const { from, message, attachments } = req.body;

    if (!from || !message) {
      return res.status(400).json({
        success: false,
        error: { message: 'from and message are required' },
      });
    }

    const updated = await supportTickets.addTicketMessage(ticketId, {
      from,
      message,
      attachments,
    });

    if (!updated) {
      return res.status(404).json({ success: false, error: { message: 'Ticket not found' } });
    }

    res.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('Error adding message:', error);
    res.status(500).json({ success: false, error: { message: error.message } });
  }
});

// Get ticket statistics
router.get('/stats/overview', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.query;
    const stats = await supportTickets.getTicketStats(tenantId as string);

    res.json({ success: true, data: stats });
  } catch (error: any) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ success: false, error: { message: error.message } });
  }
});

export default router;
