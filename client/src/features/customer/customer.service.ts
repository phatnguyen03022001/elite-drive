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
  getProfile: () => axios.get(`${BASE_URL}/profile`),
  updateProfile: (dto: UpdateCustomerProfileInput | FormData) => axios.put(`${BASE_URL}/profile`, dto),
  submitKyc: (
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
    return axios.post(`${BASE_URL}/kyc`, formData);
  },
  getKycStatus: () => axios.get(`${BASE_URL}/kyc/status`),
  createBooking: (dto: CreateBookingInput) => axios.post(`${BASE_URL}/bookings`, dto),
  getBookings: (params: { page?: number; limit?: number } & BookingQueryInput) => axios.get(`${BASE_URL}/bookings`, { params }),
  getBookingDetail: (bookingId: string) => axios.get(`${BASE_URL}/bookings/${bookingId}`),
  cancelBooking: (bookingId: string) => axios.put(`${BASE_URL}/bookings/${bookingId}/cancel`),
  createPayment: (dto: CreatePaymentInput) => axios.post(`${BASE_URL}/payments/create`, dto),
  createMomoCheckout: async (paymentId: string) => MomoCheckoutSchema.parse(await axios.post(`${MOMO_BASE_URL}/${paymentId}/checkout`)),
  getMomoStatus: async (paymentId: string) => MomoStatusSchema.parse(await axios.get(`${MOMO_BASE_URL}/${paymentId}/status`)),
  confirmPayment: (dto: z.infer<typeof ConfirmPaymentSchema>) => axios.post(`${BASE_URL}/payments/confirm`, dto),
  getPaymentByBooking: (bookingId: string) => axios.get(`${BASE_URL}/payments/${bookingId}`),
  getTrips: (params: { page?: number; limit?: number } & z.infer<typeof TripQuerySchema>) => axios.get(`${BASE_URL}/trips`, { params }),
  getTripStatus: (tripId: string) => axios.get(`${BASE_URL}/trips/${tripId}/status`),
  getContract: (bookingId: string) => axios.get(`${BASE_URL}/contracts/${bookingId}`),
  signContract: (bookingId: string, dto: SignContractInput) => axios.post(`${BASE_URL}/contracts/${bookingId}/sign`, dto),
  getWallet: () => axios.get(`${BASE_URL}/wallet`),
  getWalletTransactions: (params?: { page?: number; limit?: number }) => axios.get(`${BASE_URL}/wallet/transactions`, { params }),
  createWalletTopup: (dto: CreateWalletTopupInput) => axios.post(`${BASE_URL}/wallet/topup`, dto),
  createReview: (dto: CreateReviewInput) => axios.post(`${BASE_URL}/reviews`, dto),
  getMyReviews: (params?: { page?: number; limit?: number }) => axios.get(`${BASE_URL}/reviews/my`, { params }),
  createDispute: (dto: CreateDisputeInput) => axios.post(`${BASE_URL}/disputes`, dto),
  getMyDisputes: () => axios.get(`${BASE_URL}/disputes`),
  getActivePromotions: () => axios.get(`${BASE_URL}/promotions`),
  applyPromotion: (dto: ApplyPromotionInput) => axios.post(`${BASE_URL}/promotions/apply`, dto),
};
