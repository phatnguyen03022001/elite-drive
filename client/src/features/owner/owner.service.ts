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

let lastWithdrawFingerprint = "";
let lastWithdrawKey = "";
let lastWithdrawAt = 0;

function getWithdrawIdempotencyKey(dto: WithdrawRequestInput) {
  const fingerprint = JSON.stringify([
    dto.amount,
    dto.bankAccountNumber ?? "",
    dto.bankAccountName ?? "",
    dto.description ?? "",
  ]);
  const now = Date.now();

  if (
    fingerprint === lastWithdrawFingerprint &&
    lastWithdrawKey &&
    now - lastWithdrawAt < WITHDRAW_DEDUPE_WINDOW_MS
  ) {
    return lastWithdrawKey;
  }

  const key = globalThis.crypto.randomUUID();
  lastWithdrawFingerprint = fingerprint;
  lastWithdrawKey = key;
  lastWithdrawAt = now;
  return key;
}

export const OwnerService = {
  getProfile: async () => {
    const response = await axios.get(`${BASE_URL}/profile`);
    return response.data;
  },

  updateProfile: async (dto: UpdateOwnerProfileInput) => {
    const response = await axios.put(`${BASE_URL}/profile`, dto);
    return response.data;
  },

  submitKyc: async (
    dto: CreateKYCInput,
    files: { documentFront?: File; documentBack?: File; faceImage?: File },
  ) => {
    const formData = new FormData();
    Object.entries(dto).forEach(([key, value]) => {
      if (value) formData.append(key, String(value));
    });
    if (files.documentFront) formData.append("documentFront", files.documentFront);
    if (files.documentBack) formData.append("documentBack", files.documentBack);
    if (files.faceImage) formData.append("faceImage", files.faceImage);

    const response = await axios.post(`${BASE_URL}/kyc`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  },

  getKycStatus: async () => {
    const response = await axios.get(`${BASE_URL}/kyc/status`);
    return response.data;
  },

  createCar: async (formData: FormData) => {
    return axios.post(`${BASE_URL}/cars`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  getMyCars: async (params?: { page?: number; limit?: number }) => {
    return axios.get(`${BASE_URL}/cars`, { params });
  },

  updateCar: async (carId: string, data: UpdateCarInput | FormData) => {
    if (data instanceof FormData) {
      return axios.put(`${BASE_URL}/cars/${carId}`, data, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    }
    return axios.put(`${BASE_URL}/cars/${carId}`, data);
  },

  deleteCar: async (carId: string) => {
    const response = await axios.delete(`${BASE_URL}/cars/${carId}`);
    return response.data;
  },

  submitCarForReview: async (carId: string) => {
    const response = await axios.post(`${BASE_URL}/cars/${carId}/submit-review`);
    return response.data;
  },

  addCarDocument: async (carId: string, dto: CreateCarDocumentInput) => {
    const response = await axios.post(`${BASE_URL}/cars/${carId}/documents`, dto);
    return response.data;
  },

  getCarDocuments: async (carId: string) => {
    const response = await axios.get(`${BASE_URL}/cars/${carId}/documents`);
    return response.data;
  },

  addPricing: async (carId: string, dto: CreatePricingInput) => {
    const response = await axios.post(`${BASE_URL}/cars/${carId}/pricing`, dto);
    return response.data;
  },

  blockCalendar: async (carId: string, dto: BlockCalendarInput) => {
    const response = await axios.post(`${BASE_URL}/cars/${carId}/calendar/block`, dto);
    return response.data;
  },

  getCalendar: async (carId: string, params?: { start_date?: string; end_date?: string }) => {
    const response = await axios.get(`${BASE_URL}/cars/${carId}/calendar`, { params });
    return response.data;
  },

  getBookings: async (params?: { page?: number; limit?: number; status?: string }) => {
    return axios.get(`${BASE_URL}/bookings`, { params });
  },

  approveBooking: async (bookingId: string) => {
    const response = await axios.post(`${BASE_URL}/bookings/${bookingId}/approve`);
    return response.data;
  },

  rejectBooking: async (bookingId: string, dto: RejectBookingInput) => {
    const response = await axios.post(`${BASE_URL}/bookings/${bookingId}/reject`, dto);
    return response.data;
  },

  getTrips: async (params?: { page?: number; limit?: number }) => {
    return axios.get(`${BASE_URL}/trips`, { params });
  },

  checkinTrip: async (tripId: string, dto: TripCheckinInput) => {
    const response = await axios.post(`${BASE_URL}/trips/${tripId}/checkin`, dto);
    return response.data;
  },

  checkoutTrip: async (tripId: string, dto: TripCheckoutInput) => {
    const response = await axios.post(`${BASE_URL}/trips/${tripId}/checkout`, dto);
    return response.data;
  },

  getEarnings: async (params?: { page?: number; limit?: number }) => {
    return axios.get(`${BASE_URL}/finance/earnings`, { params });
  },

  getTransactions: async (params?: { page?: number; limit?: number }) => {
    return axios.get(`${BASE_URL}/finance/transactions`, { params });
  },

  requestWithdraw: async (dto: WithdrawRequestInput) => {
    const response = await axios.post(`${BASE_URL}/finance/withdraw`, {
      ...dto,
      idempotencyKey: getWithdrawIdempotencyKey(dto),
    });
    return response.data;
  },

  getWallet: async () => {
    const response = await axios.get(`${BASE_URL}/wallet`);
    return response.data;
  },

  getDashboardOverview: async () => {
    const response = await axios.get(`${BASE_URL}/dashboard/overview`);
    return response.data;
  },

  respondDispute: async (disputeId: string, message: string) => {
    const response = await axios.post(`${BASE_URL}/disputes/${disputeId}/respond`, { message });
    return response.data;
  },
};
