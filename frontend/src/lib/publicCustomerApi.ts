import { AxiosResponse } from 'axios';
import { publicApi } from './publicApi';

type SignupPayload = {
  name: string;
  email: string;
  phone?: string;
  password: string;
  marketingOptIn?: boolean;
};

type PasswordLoginPayload = {
  email: string;
  password: string;
};

type ReservationLoginPayload = {
  reservationNumber: string;
  email?: string;
  phone?: string;
};

type OtpRequestPayload = {
  reservationNumber: string;
  channel: 'email' | 'sms';
};

type OtpVerifyPayload = {
  reservationNumber: string;
  code: string;
};

type CustomerAuthResponse<T = any> = {
  token?: string;
  guestSessionToken?: string;
  data: T;
};

type GuestAccount = {
  id: string;
  email: string;
  phone?: string | null;
  isEmailVerified?: boolean;
  isPhoneVerified?: boolean;
  marketingOptIn?: boolean;
  lastLoginAt?: string | null;
};

type CustomerReservation = {
  id: string;
  reservationNumber?: string;
  status?: string;
  checkInDate?: string;
  checkOutDate?: string;
  guestName?: string;
  room?: {
    id?: string;
    roomNumber?: string | null;
    roomType?: string | null;
  } | null;
  balance?: number | null;
};

type CustomerProfile = {
  reservation?: CustomerReservation | null;
  guestAccount?: GuestAccount | null;
  reservations?: CustomerReservation[];
  guestSessionToken?: string | null;
};

const unwrap = <T>(response: AxiosResponse<CustomerAuthResponse<T>>) => response.data;

export const signupCustomer = (tenantSlug: string, payload: SignupPayload) =>
  publicApi.post<CustomerAuthResponse<{ guestAccount: GuestAccount }>>(
    `/${tenantSlug}/signup`,
    payload
  ).then(unwrap);

export const loginCustomerWithPassword = (
  tenantSlug: string,
  payload: PasswordLoginPayload
) =>
  publicApi.post<
    CustomerAuthResponse<{ guestAccount: GuestAccount; reservations: CustomerReservation[] }>
  >(`/${tenantSlug}/login/password`, payload).then(unwrap);

export const loginWithReservationDetails = (
  tenantSlug: string,
  payload: ReservationLoginPayload
) =>
  publicApi.post<CustomerAuthResponse>(`/${tenantSlug}/login/reservation`, payload).then(unwrap);

export const requestReservationOtp = (tenantSlug: string, payload: OtpRequestPayload) =>
  publicApi.post<CustomerAuthResponse>(`/${tenantSlug}/login/otp/request`, payload).then(unwrap);

export const verifyReservationOtp = (tenantSlug: string, payload: OtpVerifyPayload) =>
  publicApi.post<CustomerAuthResponse>(`/${tenantSlug}/login/otp/verify`, payload).then(unwrap);

export const fetchCustomerProfile = (tenantSlug: string) =>
  publicApi.get<CustomerAuthResponse<CustomerProfile>>(`/${tenantSlug}/me`).then(unwrap);
