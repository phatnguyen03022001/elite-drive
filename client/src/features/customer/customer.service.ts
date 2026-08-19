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
  MomoCheckoutSchema,
  MomoStatusSchema,
  SignContractInput,
  TripQuerySchema,
  UpdateCustomerProfileInput,
} from "./customer.schema";

const BASE_URL = "/api/customer";
const MOMO_BASE_URL = "/api/payments/momo";

type CreateDisputeInput = {
  type: string;
  bookingId?: string;
  title: string;
  description: string;
};

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
    return axios.get(`${BASE_URL}/bookings`, { params });
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

  createMomoCheckout: async (paymentId: string) => {
    const response = await axios.post(`${MOMO_BASE_URL}/${paymentId}/checkout`);
    return MomoCheckoutSchema.parse(response.data);
  },

  getMomoStatus: async (paymentId: string) => {
    const response = await axios.get(`${MOMO_BASE_URL}/${paymentId}/status`);
    return MomoStatusSchema.parse(response.data);
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
    return axios.get(`${BASE_URL}/trips`, { params });
  },

  signContract: async (bookingId: string, dto: SignContractInput) => {
    const response = await axios.post(`${BASE_URL}/contracts/${bookingId}/sign`, dto);
    return response.data;
  },

  getWallet: async () => {
    const response = await axios.get(`${BASE_URL}/wallet`);
    return response.data;
  },

  getWalletTransactions: async (params?: { page?: number; limit?: number }) => {
    return axios.get(`${BASE_URL}/wallet/transactions`, { params });
  },

  createWalletTopup: async (dto: CreateWalletTopupInput) => {
    const response = await axios.post(`${BASE_URL}/wallet/topup`, dto);
    return response.data;
  },

  createReview: async (dto: CreateReviewInput) => {
    const response = await axios.post(`${BASE_URL}/reviews`, dto);
    return response.data;
  },

  getMyReviews: async (params?: { page?: number; limit?: number }) => {
    return axios.get(`${BASE_URL}/reviews/my`, { params });
  },

  createDispute: async (dto: CreateDisputeInput) => {
    const response = await axios.post(`${BASE_URL}/disputes`, dto);
    return response.data;
  },

  getMyDisputes: async () => {
    const response = await axios.get(`${BASE_URL}/disputes`);
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
