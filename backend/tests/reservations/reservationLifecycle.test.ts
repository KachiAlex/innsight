import request from 'supertest';
import { Prisma } from '@prisma/client';
import { app } from '../../src/index';
import { prismaTestClient } from '../utils/prismaTestClient';
import { setupTenantUserAndRoom } from '../helpers/factories';
import { authHeader } from '../helpers/auth';

jest.mock('../../src/utils/email', () => ({
  sendEmail: jest.fn().mockResolvedValue(undefined),
  generateReservationConfirmationEmail: jest.fn(() => '<html>confirmation</html>'),
  generateCheckInReminderEmail: jest.fn(() => '<html>checkin</html>'),
  generateCheckOutThankYouEmail: jest.fn(() => '<html>checkout</html>'),
  getTenantEmailSettings: jest.fn(async () => ({
    propertyName: 'Test Property',
    propertyAddress: '123 Test St',
    propertyPhone: '+1234567890',
    propertyEmail: 'info@test.com',
  })),
}));

const CHECK_IN_DATE = '2025-01-15T15:00:00.000Z';
const CHECK_OUT_DATE = '2025-01-18T11:00:00.000Z';

const createReservationRecord = async ({
  tenantId,
  roomId,
  userId,
  status = 'confirmed',
}: {
  tenantId: string;
  roomId: string;
  userId: string;
  status?: string;
}) => {
  return prismaTestClient.reservation.create({
    data: {
      tenantId,
      roomId,
      createdBy: userId,
      reservationNumber: `RES-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      guestName: 'Jane Doe',
      guestEmail: 'jane@example.com',
      guestPhone: '+1987456123',
      checkInDate: new Date(CHECK_IN_DATE),
      checkOutDate: new Date(CHECK_OUT_DATE),
      adults: 2,
      children: 0,
      status,
      source: 'manual',
      rate: new Prisma.Decimal(25000),
      depositAmount: null,
      specialRequests: 'Late arrival',
    },
  });
};

describe('Reservation lifecycle integration (Prisma)', () => {
  let tenantId: string;
  let userId: string;
  let roomId: string;

  beforeEach(async () => {
    const { tenant, user, room } = await setupTenantUserAndRoom();
    tenantId = tenant.id;
    userId = user.id;
    roomId = room.id;
  });

  const createReservationPayload = () => ({
    roomId,
    guestName: 'John Doe',
    guestEmail: 'john@example.com',
    guestPhone: '+1234567890',
    checkInDate: CHECK_IN_DATE,
    checkOutDate: CHECK_OUT_DATE,
    adults: 2,
    children: 1,
    rate: 45000,
    depositAmount: 15000,
    source: 'manual' as const,
    specialRequests: 'Sea view, please',
  });

  it('creates a reservation successfully', async () => {
    const response = await request(app)
      .post(`/api/tenants/${tenantId}/reservations`)
      .set(authHeader({ tenantId, userId }))
      .send(createReservationPayload())
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      guestName: 'John Doe',
      status: 'confirmed',
      roomId,
      tenantId,
    });

    const reservationInDb = await prismaTestClient.reservation.findUnique({
      where: { id: response.body.data.id },
    });

    expect(reservationInDb).not.toBeNull();
    expect(reservationInDb?.status).toBe('confirmed');
    expect(reservationInDb?.guestEmail).toBe('john@example.com');
  });

  it('checks in a confirmed reservation and creates folio/charges', async () => {
    const reservation = await createReservationRecord({
      tenantId,
      roomId,
      userId,
      status: 'confirmed',
    });

    const response = await request(app)
      .post(`/api/tenants/${tenantId}/reservations/${reservation.id}/checkin`)
      .set(authHeader({ tenantId, userId }))
      .send({ photo: 'base64-image' })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('checked_in');

    const updatedReservation = await prismaTestClient.reservation.findUnique({
      where: { id: reservation.id },
      include: {
        folios: {
          include: { charges: true },
        },
      },
    });

    expect(updatedReservation?.status).toBe('checked_in');
    const room = await prismaTestClient.room.findUnique({ where: { id: roomId } });
    expect(room?.status).toBe('occupied');
    expect(updatedReservation?.folios).toHaveLength(1);
    expect(updatedReservation?.folios[0].charges).toHaveLength(1);
  });

  it('completes the reservation lifecycle (create -> checkin -> checkout)', async () => {
    const createResponse = await request(app)
      .post(`/api/tenants/${tenantId}/reservations`)
      .set(authHeader({ tenantId, userId }))
      .send(createReservationPayload())
      .expect(201);

    const reservationId = createResponse.body.data.id;

    await request(app)
      .post(`/api/tenants/${tenantId}/reservations/${reservationId}/checkin`)
      .set(authHeader({ tenantId, userId }))
      .send({})
      .expect(200);

    const checkoutResponse = await request(app)
      .post(`/api/tenants/${tenantId}/reservations/${reservationId}/checkout`)
      .set(authHeader({ tenantId, userId }))
      .send({
        finalCharges: [{ description: 'Mini bar', amount: 7500 }],
        paymentInfo: { method: 'cash', amount: 7500 },
      })
      .expect(200);

    expect(checkoutResponse.body.success).toBe(true);
    expect(checkoutResponse.body.data.status).toBe('checked_out');

    const reservation = await prismaTestClient.reservation.findUnique({
      where: { id: reservationId },
      include: {
        room: true,
        folios: true,
      },
    });

    expect(reservation?.status).toBe('checked_out');
    expect(reservation?.room.status).toBe('dirty');
    reservation?.folios.forEach((folio) => {
      expect(folio.status).toBe('closed');
      expect(folio.closedAt).not.toBeNull();
    });
  });
});
