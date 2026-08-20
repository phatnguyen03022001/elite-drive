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
  ApproveWithdrawInput,
  RejectWithdrawInput,
  CreateCategoryInput,
  CreateLocationInput,
} from "./admin.schema";

const BASE_URL = "/api/admin";

export type AdminPaymentQuery = {
  page?: number;
  limit?: number;
  status?: "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED";
  from?: string;
  to?: string;
};

export const AdminService = {
  getProfile: () => axios.get(`${BASE_URL}/profile`),
  updateProfile: (dto: FormData | Record<string, unknown>) => axios.put(`${BASE_URL}/profile`, dto),
  getOverviewReport: () => axios.get(`${BASE_URL}/reports/overview`),
  getBookingsReport: (params: ReportDateRangeInput) => axios.get(`${BASE_URL}/reports/bookings`, { params }),
  getRevenueReport: (params: ReportDateRangeInput) => axios.get(`${BASE_URL}/reports/revenue`, { params }),
  getPayments: (params: AdminPaymentQuery = {}) => axios.get(`${BASE_URL}/payments`, { params }),
  getOperationalHealth: () => axios.get(`${BASE_URL}/operations/health`),
  reconcileMomoPayments: (limit = 100) => axios.post(`${BASE_URL}/payments/momo/reconcile`, undefined, { params: { limit } }),
  getKycCustomers: (params: AdminKYCQueryInput) => axios.get(`${BASE_URL}/kyc/customers`, { params }),
  approveKyc: (userId: string) => axios.post(`${BASE_URL}/kyc/customers/${userId}/approve`),
  rejectKyc: (userId: string, dto: RejectKYCInput) => axios.post(`${BASE_URL}/kyc/customers/${userId}/reject`, dto),
  getPendingCars: () => axios.get(`${BASE_URL}/cars/pending`),
  approveCar: (carId: string) => axios.post(`${BASE_URL}/cars/${carId}/approve`),
  rejectCar: (carId: string, reason: string) => axios.post(`${BASE_URL}/cars/${carId}/reject`, { reason }),
  getAllCars: (params?: { status?: string }) => axios.get(`${BASE_URL}/cars/all`, { params }),
  createPromotion: (dto: CreatePromotionInput) => axios.post(`${BASE_URL}/promotions`, dto),
  updatePromotion: (id: string, dto: UpdatePromotionInput) => axios.patch(`${BASE_URL}/promotions/${id}`, dto),
  getPromotions: (params: PromotionQueryInput) => axios.get(`${BASE_URL}/promotions`, { params }),
  getPendingReleaseTrips: (params: { page?: number; limit?: number }) => axios.get(`${BASE_URL}/escrow/pending-release`, { params }),
  releasePayment: (dto: ReleasePaymentInput) => axios.post(`${BASE_URL}/payments/release`, dto),
  refundPayment: (dto: RefundPaymentInput) => axios.post(`${BASE_URL}/payments/refund`, dto),
  autoReleasePayments: () => axios.post(`${BASE_URL}/settlements/auto-release`),
  runSettlement: (dto: RunSettlementInput) => axios.post(`${BASE_URL}/settlements/run`, dto),
  getSettlementHistory: (params: SettlementHistoryQueryInput) => axios.get(`${BASE_URL}/settlements/history`, { params }),
  getDisputes: (params: DisputeQueryInput) => axios.get(`${BASE_URL}/disputes`, { params }),
  startDisputeProcessing: (disputeId: string) => axios.patch(`${BASE_URL}/disputes/${disputeId}/process`),
  resolveDispute: (disputeId: string, dto: ResolveDisputeInput) => axios.post(`${BASE_URL}/disputes/${disputeId}/resolve`, dto),
  getPendingWithdraws: (params: WithdrawQueryInput) => axios.get(`${BASE_URL}/withdraws/pending`, { params }),
  approveWithdraw: (id: string, dto: ApproveWithdrawInput) => axios.post(`${BASE_URL}/withdraws/${id}/approve`, dto),
  rejectWithdraw: (id: string, dto: RejectWithdrawInput) => axios.post(`${BASE_URL}/withdraws/${id}/reject`, dto),
  createCategory: (dto: CreateCategoryInput) => axios.post(`${BASE_URL}/categories`, dto),
  createLocation: (dto: CreateLocationInput) => axios.post(`${BASE_URL}/locations`, dto),
  getPlatformWallet: () => axios.get(`${BASE_URL}/wallets/platform`),
  getWalletReconciliation: (params: { page?: number; limit?: number } = {}) => axios.get(`${BASE_URL}/wallets/reconciliation`, { params }),
  getAllBookings: (params: { page?: number; limit?: number }) => axios.get(`${BASE_URL}/bookings/all`, { params }),
  getAllContracts: (params: { page?: number; limit?: number }) => axios.get(`${BASE_URL}/contracts/all`, { params }),
  getUsers: (params: { page?: number; limit?: number }) => axios.get(`${BASE_URL}/users`, { params }),
  updateUserStatus: (userId: string, status: "ACTIVE" | "INACTIVE") => axios.patch(`${BASE_URL}/users/${userId}/status`, { status }),
};
