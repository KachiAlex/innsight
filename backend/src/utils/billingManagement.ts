/**
 * Billing & Subscription Management
 * Handle subscription plans, tenant subscriptions, and invoices
 */

import { prisma } from './prisma';

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  billingCycle: 'monthly' | 'yearly';
  maxRooms: number;
  maxUsers: number;
  maxReservations: number;
  features: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TenantSubscription {
  id: string;
  tenantId: string;
  planId: string;
  status: 'active' | 'suspended' | 'trial' | 'cancelled';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelledAt?: Date;
  trialEndsAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Invoice {
  id: string;
  tenantId: string;
  subscriptionId: string;
  amount: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  issueDate: Date;
  dueDate: Date;
  paidDate?: Date;
  description: string;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

// Default subscription plans
const DEFAULT_PLANS: SubscriptionPlan[] = [
  {
    id: 'plan_starter',
    name: 'Starter',
    description: 'Perfect for small properties',
    price: 99,
    billingCycle: 'monthly',
    maxRooms: 20,
    maxUsers: 5,
    maxReservations: 1000,
    features: ['Basic reporting', 'Room management', 'User management', 'Email support'],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'plan_professional',
    name: 'Professional',
    description: 'For growing hotel businesses',
    price: 299,
    billingCycle: 'monthly',
    maxRooms: 100,
    maxUsers: 20,
    maxReservations: 10000,
    features: [
      'Advanced analytics',
      'Rate management',
      'Channel manager',
      'Payment processing',
      'Priority support',
    ],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'plan_enterprise',
    name: 'Enterprise',
    description: 'For large hotel chains',
    price: 999,
    billingCycle: 'monthly',
    maxRooms: 1000,
    maxUsers: 100,
    maxReservations: 100000,
    features: [
      'All features',
      'Custom integrations',
      'Dedicated account manager',
      '24/7 support',
      'Advanced reporting',
      'Multi-property management',
    ],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

/**
 * Get all subscription plans
 */
export async function getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  try {
    // In production, these would be stored in database
    // For now, return defaults
    return DEFAULT_PLANS;
  } catch (error) {
    console.error('Error fetching plans:', error);
    return DEFAULT_PLANS;
  }
}

/**
 * Get specific subscription plan
 */
export async function getSubscriptionPlan(planId: string): Promise<SubscriptionPlan | null> {
  try {
    const plans = await getSubscriptionPlans();
    return plans.find((p) => p.id === planId) || null;
  } catch (error) {
    console.error('Error fetching plan:', error);
    return null;
  }
}

/**
 * Get tenant's current subscription
 */
export async function getTenantSubscription(tenantId: string): Promise<TenantSubscription | null> {
  try {
    // Query from database
    // For now, return mock data
    return {
      id: `sub_${tenantId}`,
      tenantId,
      planId: 'plan_professional',
      status: 'active',
      currentPeriodStart: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(),
    };
  } catch (error) {
    console.error('Error fetching subscription:', error);
    return null;
  }
}

/**
 * Update tenant subscription plan
 */
export async function updateTenantSubscription(
  tenantId: string,
  planId: string,
  billingCycle: 'monthly' | 'yearly' = 'monthly'
): Promise<TenantSubscription> {
  try {
    const plan = await getSubscriptionPlan(planId);
    if (!plan) throw new Error('Plan not found');

    // In production, handle payment processing, invoice generation, etc.
    // For now, just update status
    const subscription: TenantSubscription = {
      id: `sub_${tenantId}`,
      tenantId,
      planId,
      status: 'active',
      currentPeriodStart: new Date(),
      currentPeriodEnd:
        billingCycle === 'yearly'
          ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return subscription;
  } catch (error) {
    console.error('Error updating subscription:', error);
    throw error;
  }
}

/**
 * Suspend tenant subscription
 */
export async function suspendTenantSubscription(tenantId: string): Promise<void> {
  try {
    // Update subscription status to suspended
    // In production, this would query and update database
    await prisma?.tenant.update({
      where: { id: tenantId },
      data: { subscriptionStatus: 'suspended' },
    });
  } catch (error) {
    console.error('Error suspending subscription:', error);
    throw error;
  }
}

/**
 * Resume tenant subscription
 */
export async function resumeTenantSubscription(tenantId: string): Promise<void> {
  try {
    await prisma?.tenant.update({
      where: { id: tenantId },
      data: { subscriptionStatus: 'active' },
    });
  } catch (error) {
    console.error('Error resuming subscription:', error);
    throw error;
  }
}

/**
 * Generate invoice for tenant
 */
export async function generateInvoice(
  tenantId: string,
  subscriptionId: string,
  plan: SubscriptionPlan
): Promise<Invoice> {
  try {
    const now = new Date();
    const dueDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 days

    const invoice: Invoice = {
      id: `inv_${Date.now()}`,
      tenantId,
      subscriptionId,
      amount: plan.price,
      status: 'sent',
      issueDate: now,
      dueDate,
      description: `${plan.name} subscription - ${plan.billingCycle}`,
      lineItems: [
        {
          description: plan.name,
          quantity: 1,
          unitPrice: plan.price,
          amount: plan.price,
        },
      ],
      createdAt: now,
      updatedAt: now,
    };

    // In production, save to database and send email
    return invoice;
  } catch (error) {
    console.error('Error generating invoice:', error);
    throw error;
  }
}

/**
 * Get tenant invoices
 */
export async function getTenantInvoices(tenantId: string, limit: number = 50): Promise<Invoice[]> {
  try {
    // Query from database
    // For now, return empty array
    return [];
  } catch (error) {
    console.error('Error fetching invoices:', error);
    return [];
  }
}

/**
 * Get billing metrics across platform
 */
export async function getBillingMetrics(): Promise<{
  activeSubscriptions: number;
  mrr: number;
  arr: number;
  churnRate: number;
  planDistribution: Record<string, number>;
  overdueInvoices: number;
}> {
  try {
    const tenants = await prisma?.tenant.findMany({
      where: { subscriptionStatus: 'active' },
    });

    const monthlyRevenue = tenants ? tenants.length * 299 : 0; // Assume average plan
    const annualRevenue = monthlyRevenue * 12;

    return {
      activeSubscriptions: tenants?.length || 0,
      mrr: monthlyRevenue,
      arr: annualRevenue,
      churnRate: 2.5, // Mock: 2.5% monthly churn
      planDistribution: {
        starter: Math.floor((tenants?.length || 0) * 0.3),
        professional: Math.floor((tenants?.length || 0) * 0.5),
        enterprise: Math.floor((tenants?.length || 0) * 0.2),
      },
      overdueInvoices: 0,
    };
  } catch (error) {
    console.error('Error fetching billing metrics:', error);
    return {
      activeSubscriptions: 0,
      mrr: 0,
      arr: 0,
      churnRate: 0,
      planDistribution: {},
      overdueInvoices: 0,
    };
  }
}
