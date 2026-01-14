import { prisma } from './prisma';
import { AppError } from '../middleware/errorHandler';

type TenantSummary = {
  id: string;
  name: string;
  slug: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  branding: Record<string, unknown> | null;
};

type CacheEntry = {
  expiresAt: number;
  data: TenantSummary;
};

const CACHE_TTL_MS = Number(process.env.TENANT_CACHE_TTL_MS ?? 5 * 60 * 1000);
const tenantSlugCache = new Map<string, CacheEntry>();

const getCacheKey = (slug: string) => slug.trim().toLowerCase();

const getCachedTenant = (slug: string): TenantSummary | null => {
  const cacheKey = getCacheKey(slug);
  const hit = tenantSlugCache.get(cacheKey);
  if (!hit) {
    return null;
  }
  if (Date.now() > hit.expiresAt) {
    tenantSlugCache.delete(cacheKey);
    return null;
  }
  return hit.data;
};

const setCachedTenant = (slug: string, data: TenantSummary) => {
  tenantSlugCache.set(getCacheKey(slug), {
    data,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
};

/**
 * Clears cached tenant entries. If slug is provided, only the matching cache key is cleared.
 */
export const invalidateTenantSlugCache = (slug?: string) => {
  if (slug) {
    tenantSlugCache.delete(getCacheKey(slug));
  } else {
    tenantSlugCache.clear();
  }
};

/**
 * Resolves tenant context by slug and returns sanitized summary metadata.
 * Throws AppError if Prisma is unavailable or tenant cannot be found.
 */
export const resolveTenantBySlug = async (tenantSlug?: string): Promise<TenantSummary> => {
  const normalizedSlug = tenantSlug?.trim().toLowerCase();
  if (!normalizedSlug) {
    throw new AppError('Tenant slug is required', 400);
  }

  const cached = getCachedTenant(normalizedSlug);
  if (cached) {
    return cached;
  }

  if (!prisma) {
    throw new AppError('Database connection not initialized', 500);
  }

  const tenant = await prisma.tenant.findUnique({
    where: { slug: normalizedSlug },
    select: {
      id: true,
      name: true,
      slug: true,
      email: true,
      phone: true,
      address: true,
      branding: true,
    },
  });

  if (!tenant) {
    throw new AppError('Tenant not found', 404);
  }

  const summary: TenantSummary = {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    email: tenant.email ?? null,
    phone: tenant.phone ?? null,
    address: tenant.address ?? null,
    branding: (tenant.branding as Record<string, unknown> | null) ?? null,
  };

  setCachedTenant(normalizedSlug, summary);
  return summary;
};
