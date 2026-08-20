import axios from "@/lib/axios";
import {
  BlockCalendarInput,
  CreateCarDocumentInput,
  CreateKYCInput,
  CreatePricingInput,
  RejectBookingInput,
  TripCheckinInput,
  TripCheckoutInput,
  UpdateCarInput,
  UpdateOwnerProfileInput,
  WithdrawRequestInput,
} from "./owner.schema";

const BASE_URL = "/api/owner";
const WITHDRAW_DEDUPE_WINDOW_MS = 10_000;

export type CreateOwnerDisputeInput = {
  type: string;
  bookingId?: string;
  title: string;
  description: string;
};

let lastWithdrawFingerprint = "";
let lastWithdrawKey = "";
let lastWithdrawAt = 0;

function getWithdrawIdempotencyKey(dto: WithdrawRequestInput) {
  const fingerprint = JSON.stringify([dto.amount, dto.bankAccountNumber ?? "", dto.bankAccountName ?? "", dto.description ?? ""]);
  const now = Date.now();
  if (fingerprint === lastWithdrawFingerprint && lastWithdrawKey && now - lastWithdrawAt < WITHDRAW_DEDUPE_WINDOW_MS) return lastWithdrawKey;
  const key = globalThis.crypto.randomUUID();
  lastWithdrawFingerprint = fingerprint;
  lastWithdrawKey = key;
  lastWithdrawAt = now;
  return key;
}

export const OwnerService = {
  getProfile: () => axios.get(`${BASE_URL}/profile`),
  updateProfile: (dto: UpdateOwnerProfileInput) => axios.put(`${BASE_URL}/profile`, dto),
  submitKyc: (dto: CreateKYCInput, files: { documentFront?: File; documentBack?: File; faceImage?: File }) => {
    const formData = new FormData();
    Object.entries(dto).forEach(([key, value]) => { if (value) formData.append(key, String(value)); });
    if (files.documentFront) formData.append("documentFront", files.documentFront);
    if (files.documentBack) formData.append("documentBack", files.documentBack);
    if (files.faceImage) formData.append("faceImage", files.faceImage);
    return axios.post(`${BASE_URL}/kyc`, formData);
  },
  getKycStatus: () => axios.get(`${BASE_URL}/kyc/status`),
  createCar: (formData: FormData) => axios.post(`${BASE_URL}/cars`, formData),
  getMyCars: (params?: { page?: number; limit?: number }) => axios.get(`${BASE_URL}/cars`, { params }),
  updateCar: (carId: string, data: UpdateCarInput | FormData) => axios.put(`${BASE_URL}/cars/${carId}`, data),
  deleteCar: (carId: string) => axios.delete(`${BASE_URL}/cars/${carId}`),
  submitCarForReview: (carId: string) => axios.post(`${BASE_URL}/cars/${carId}/submit-review`),
  addCarDocument: (carId: string, dto: CreateCarDocumentInput) => axios.post(`${BASE_URL}/cars/${carId}/documents`, dto),
  getCarDocuments: (carId: string) => axios.get(`${BASE_URL}/cars/${carId}/documents`),
  addPricing: (carId: string, dto: CreatePricingInput) => axios.post(`${BASE_URL}/cars/${carId}/pricing`, dto),
  blockCalendar: (carId: string, dto: BlockCalendarInput) => axios.post(`${BASE_URL}/cars/${carId}/calendar/block`, dto),
  getCalendar: (carId: string, params?: { start_date?: string; end_date?: string }) => axios.get(`${BASE_URL}/cars/${carId}/calendar`, { params }),
  getBookings: (params?: { page?: number; limit?: number; status?: string }) => axios.get(`${BASE_URL}/bookings`, { params }),
  approveBooking: (bookingId: string) => axios.post(`${BASE_URL}/bookings/${bookingId}/approve`),
  rejectBooking: (bookingId: string, dto: RejectBookingInput) => axios.post(`${BASE_URL}/bookings/${bookingId}/reject`, dto),
  getTrips: (params?: { page?: number; limit?: number }) => axios.get(`${BASE_URL}/trips`, { params }),
  checkinTrip: (tripId: string, dto: TripCheckinInput) => axios.post(`${BASE_URL}/trips/${tripId}/checkin`, dto),
  checkoutTrip: (tripId: string, dto: TripCheckoutInput) => axios.post(`${BASE_URL}/trips/${tripId}/checkout`, dto),
  getEarnings: (params?: { page?: number; limit?: number }) => axios.get(`${BASE_URL}/finance/earnings`, { params }),
  getTransactions: (params?: { page?: number; limit?: number }) => axios.get(`${BASE_URL}/finance/transactions`, { params }),
  requestWithdraw: (dto: WithdrawRequestInput) => axios.post(`${BASE_URL}/finance/withdraw`, { ...dto, idempotencyKey: getWithdrawIdempotencyKey(dto) }),
  getWallet: () => axios.get(`${BASE_URL}/wallet`),
  getDashboardOverview: () => axios.get(`${BASE_URL}/dashboard/overview`),
  getDisputes: () => axios.get(`${BASE_URL}/disputes`),
  createDispute: (dto: CreateOwnerDisputeInput) => axios.post(`${BASE_URL}/disputes`, dto),
  respondDispute: (disputeId: string, message: string) => axios.post(`${BASE_URL}/disputes/${disputeId}/respond`, { message }),
};
