import axios from "@/lib/axios";
import z from "zod";
import {
  ApplyPromotionInput,
  BookingQueryInput,
  ConfirmPaymentSchema,
  CreateBookingInput,
  CreateKYCInput,
  CreatePaymentInput,
  CreateReviewInput,
  CreateWalletTopupInput,
  SignContractInput,
  TripQuerySchema,
  UpdateCustomerProfileInput,
  WalletRefundInput,
} from "./customer.schema";

const BASE_URL = "/api/customer";

export const CustomerService = {
  getProfile: async () => {
    const response = await axios.get(`${BASE_URL}/profile`);
    return response.data;
  },

  updateProfile: async (dto: UpdateCustomerProfileInput | FormData) => {
    const response = await axios.put(`${BASE_URL}/profile`, dto);
    return response.data;
  },

  submitKyc: async (
    dto: CreateKYCInput,
    files: { documentFront?: File; documentBack?: File; faceImage?: File },
  ) => {
    const formData = new FormData();
    Object.entries(dto).forEach(([key, value]) => {
      if (value) formData.append(key, value);
    });
    if (files.documentFront) formData.append("documentFront", files.documentFront);
    if (files.documentBack) formData.append("documentBack", files.documentBack);
    if (files.faceImage) formData.append("faceImage", files.faceImage);

    const response = await axios.post(`${BASE_URL}/kyc`, formData);
    return response.data;
  },

  getKycStatus: async () => {
    const response = await axios.get(`${BASE_URL}/kyc/status`);
    return response.data;
  },

  createBooking: async (dto: CreateBookingInput) => {
    const response = await axios.post(`${BASE_URL}/bookings`, dto);
    return response.data;
  },

  getBookings: async (params: { page?: number; limit?: number } & BookingQueryInput) => {
    const response = await axios.get(`${BASE_URL}/bookings`, { params });
    return response.data;
  },

  getBookingDetail: async (bookingId: string) => {
    const response = await axios.get(`${BASE_URL}/bookings/${bookingId}`);
    return response.data;
  },

  cancelBooking: async (bookingId: string) => {
    const response = await axios.put(`${BASE_URL}/bookings/${bookingId}/cancel`);
    return response.data;
  },

  createPayment: async (dto: CreatePaymentInput) => {
    const response = await axios.post(`${BASE_URL}/payments/create`, dto);
    return response.data;
  },

  confirmPayment: async (dto: z.infer<typeof ConfirmPaymentSchema>) => {
    const response = await axios.post(`${BASE_URL}/payments/confirm`, dto);
    return response.data;
  },

  getPaymentByBooking: async (bookingId: string) => {
    const response = await axios.get(`${BASE_URL}/payments/${bookingId}`);
    return response.data;
  },

  getTrips: async (params: { page?: number; limit?: number } & z.infer<typeof TripQuerySchema>) => {
    const response = await axios.get(`${BASE_URL}/trips`, { params });
    return response.data;
  },

  signContract: async (bookingId: string, dto: SignContractInput) => {
    const response = await axios.post(`${BASE_URL}/contracts/${bookingId}/sign`, dto);
    return response.data;
  },

  requestRefund: async (dto: WalletRefundInput) => {
    const response = await axios.post(`${BASE_URL}/wallet/refund`, dto);
    return response.data;
  },

  getWallet: async () => {
    const response = await axios.get(`${BASE_URL}/wallet`);
    return response.data;
  },

  getWalletTransactions: async (params?: { page?: number; limit?: number }) => {
    const response = await axios.get(`${BASE_URL}/wallet/transactions`, { params });
    return response.data;
  },

  createWalletTopup: async (dto: CreateWalletTopupInput) => {
    const response = await axios.post(`${BASE_URL}/wallet/topup`, dto);
    return response.data;
  },

  createReview: async (dto: CreateReviewInput) => {
    const response = await axios.post(`${BASE_URL}/reviews`, dto);
    return response.data;
  },

  getActivePromotions: async () => {
    const response = await axios.get(`${BASE_URL}/promotions`);
    return response.data;
  },

  applyPromotion: async (dto: ApplyPromotionInput) => {
    const response = await axios.post(`${BASE_URL}/promotions/apply`, dto);
    return response.data;
  },
};
