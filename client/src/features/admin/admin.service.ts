import axios from "@/lib/axios";
import {
  ReportDateRangeInput,
  AdminKYCQueryInput,
  RejectKYCInput,
  CreatePromotionInput,
  UpdatePromotionInput,
  PromotionQueryInput,
  ReleasePaymentInput,
  RefundPaymentInput,
  RunSettlementInput,
  SettlementHistoryQueryInput,
  ResolveDisputeInput,
  DisputeQueryInput,
  WithdrawQueryInput,
  RejectWithdrawInput,
  CreateCategoryInput,
  CreateLocationInput,
} from "./admin.schema";

const BASE_URL = "/api/admin";

export const AdminService = {
  getOverviewReport: async () => {
    const response = await axios.get(`${BASE_URL}/reports/overview`);
    return response.data;
  },

  getBookingsReport: async (params: ReportDateRangeInput) => {
    const response = await axios.get(`${BASE_URL}/reports/bookings`, { params });
    return response.data;
  },

  getRevenueReport: async (params: ReportDateRangeInput) => {
    const response = await axios.get(`${BASE_URL}/reports/revenue`, { params });
    return response.data;
  },

  getKycCustomers: async (params: AdminKYCQueryInput) => {
    const response = await axios.get(`${BASE_URL}/kyc/customers`, { params });
    return response.data;
  },

  approveKyc: async (userId: string) => {
    const response = await axios.post(`${BASE_URL}/kyc/customers/${userId}/approve`);
    return response.data;
  },

  rejectKyc: async (userId: string, dto: RejectKYCInput) => {
    const response = await axios.post(`${BASE_URL}/kyc/customers/${userId}/reject`, dto);
    return response.data;
  },

  getPendingCars: async () => {
    const response = await axios.get(`${BASE_URL}/cars/pending`);
    return response.data;
  },

  approveCar: async (carId: string) => {
    const response = await axios.post(`${BASE_URL}/cars/${carId}/approve`);
    return response.data;
  },

  rejectCar: async (carId: string, reason: string) => {
    const response = await axios.post(`${BASE_URL}/cars/${carId}/reject`, { reason });
    return response.data;
  },

  getAllCars: async (params?: { status?: string }) => {
    const response = await axios.get(`${BASE_URL}/cars/all`, { params });
    return response.data;
  },

  createPromotion: async (dto: CreatePromotionInput) => {
    const response = await axios.post(`${BASE_URL}/promotions`, dto);
    return response.data;
  },

  updatePromotion: async (id: string, dto: UpdatePromotionInput) => {
    const response = await axios.patch(`${BASE_URL}/promotions/${id}`, dto);
    return response.data;
  },

  getPromotions: async (params: PromotionQueryInput) => {
    const response = await axios.get(`${BASE_URL}/promotions`, { params });
    return response.data;
  },

  getPendingReleaseTrips: async (params: { page?: number; limit?: number }) => {
    const response = await axios.get(`${BASE_URL}/escrow/pending-release`, { params });
    return response.data;
  },

  releasePayment: async (dto: ReleasePaymentInput) => {
    const response = await axios.post(`${BASE_URL}/payments/release`, dto);
    return response.data;
  },

  refundPayment: async (dto: RefundPaymentInput) => {
    const response = await axios.post(`${BASE_URL}/payments/refund`, dto);
    return response.data;
  },

  autoReleasePayments: async () => {
    const response = await axios.post(`${BASE_URL}/settlements/auto-release`);
    return response.data;
  },

  runSettlement: async (dto: RunSettlementInput) => {
    const response = await axios.post(`${BASE_URL}/settlements/run`, dto);
    return response.data;
  },

  getSettlementHistory: async (params: SettlementHistoryQueryInput) => {
    const response = await axios.get(`${BASE_URL}/settlements/history`, { params });
    return response.data;
  },

  getDisputes: async (params: DisputeQueryInput) => {
    const response = await axios.get(`${BASE_URL}/disputes`, { params });
    return response.data;
  },

  resolveDispute: async (disputeId: string, dto: ResolveDisputeInput) => {
    const response = await axios.post(`${BASE_URL}/disputes/${disputeId}/resolve`, dto);
    return response.data;
  },

  getPendingWithdraws: async (params: WithdrawQueryInput) => {
    const response = await axios.get(`${BASE_URL}/withdraws/pending`, { params });
    return response.data;
  },

  approveWithdraw: async (id: string) => {
    const response = await axios.post(`${BASE_URL}/withdraws/${id}/approve`);
    return response.data;
  },

  rejectWithdraw: async (id: string, dto: RejectWithdrawInput) => {
    const response = await axios.post(`${BASE_URL}/withdraws/${id}/reject`, dto);
    return response.data;
  },

  createCategory: async (dto: CreateCategoryInput) => {
    const response = await axios.post(`${BASE_URL}/categories`, dto);
    return response.data;
  },

  createLocation: async (dto: CreateLocationInput) => {
    const response = await axios.post(`${BASE_URL}/locations`, dto);
    return response.data;
  },

  getPlatformWallet: async () => {
    const response = await axios.get(`${BASE_URL}/wallets/platform`);
    return response.data;
  },

  getAllBookings: async (params: { page?: number; limit?: number }) => {
    const response = await axios.get(`${BASE_URL}/bookings/all`, { params });
    return response.data;
  },

  getAllContracts: async (params: { page?: number; limit?: number }) => {
    const response = await axios.get(`${BASE_URL}/contracts/all`, { params });
    return response.data;
  },

  getUsers: async (params: { page?: number; limit?: number }) => {
    const response = await axios.get(`${BASE_URL}/users`, { params });
    return response.data;
  },

  updateUserStatus: async (userId: string, status: "ACTIVE" | "INACTIVE") => {
    const response = await axios.patch(`${BASE_URL}/users/${userId}/status`, { status });
    return response.data;
  },
};
