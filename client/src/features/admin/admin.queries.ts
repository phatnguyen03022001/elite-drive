import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminPaymentQuery, AdminService } from "./admin.service";
import {
  AdminKYCQueryInput,
  ApproveWithdrawInput,
  CreateCategoryInput,
  CreateLocationInput,
  CreatePromotionInput,
  DisputeQueryInput,
  PromotionQueryInput,
  RefundPaymentInput,
  RejectKYCInput,
  RejectWithdrawInput,
  ReleasePaymentInput,
  ReportDateRangeInput,
  ResolveDisputeInput,
  RunSettlementInput,
  SettlementHistoryQueryInput,
  UpdatePromotionInput,
  WithdrawQueryInput,
} from "./admin.schema";

export const adminKeys = {
  all: ["admin"] as const,
  profile: () => [...adminKeys.all, "profile"] as const,
  reports: () => [...adminKeys.all, "reports"] as const,
  overview: () => [...adminKeys.reports(), "overview"] as const,
  bookings: (params: unknown) => [...adminKeys.reports(), "bookings", params] as const,
  revenue: (params: unknown) => [...adminKeys.reports(), "revenue", params] as const,
  paymentsRoot: () => [...adminKeys.all, "payments"] as const,
  payments: (params: unknown) => [...adminKeys.paymentsRoot(), params] as const,
  operations: () => [...adminKeys.all, "operations"] as const,
  operationalHealth: () => [...adminKeys.operations(), "health"] as const,
  kyc: () => [...adminKeys.all, "kyc"] as const,
  kycList: (params: unknown) => [...adminKeys.kyc(), "list", params] as const,
  cars: () => [...adminKeys.all, "cars"] as const,
  carList: (params: unknown) => [...adminKeys.cars(), "list", params] as const,
  pendingCars: () => [...adminKeys.cars(), "pending"] as const,
  promotionsRoot: () => [...adminKeys.all, "promotions"] as const,
  promotions: (params: unknown) => [...adminKeys.promotionsRoot(), params] as const,
  escrow: () => [...adminKeys.all, "escrow"] as const,
  pendingRelease: (params: unknown) => [...adminKeys.escrow(), "pending-release", params] as const,
  settlementsRoot: () => [...adminKeys.all, "settlements"] as const,
  settlements: (params: unknown) => [...adminKeys.settlementsRoot(), params] as const,
  disputesRoot: () => [...adminKeys.all, "disputes"] as const,
  disputes: (params: unknown) => [...adminKeys.disputesRoot(), params] as const,
  withdrawsRoot: () => [...adminKeys.all, "withdraws"] as const,
  withdraws: (params: unknown) => [...adminKeys.withdrawsRoot(), params] as const,
  platformWallet: () => [...adminKeys.all, "platform-wallet"] as const,
  usersRoot: () => [...adminKeys.all, "users"] as const,
  users: (params: unknown) => [...adminKeys.usersRoot(), params] as const,
};

export const useAdminProfile = () => useQuery({ queryKey: adminKeys.profile(), queryFn: AdminService.getProfile });
export const useUpdateAdminProfile = () => { const queryClient = useQueryClient(); return useMutation({ mutationFn: (dto: FormData | Record<string, unknown>) => AdminService.updateProfile(dto), onSuccess: () => void queryClient.invalidateQueries({ queryKey: adminKeys.profile() }) }); };
export const useOverviewReport = () => useQuery({ queryKey: adminKeys.overview(), queryFn: AdminService.getOverviewReport });
export const useBookingsReport = (params: ReportDateRangeInput) => useQuery({ queryKey: adminKeys.bookings(params), queryFn: () => AdminService.getBookingsReport(params) });
export const useRevenueReport = (params: ReportDateRangeInput) => useQuery({ queryKey: adminKeys.revenue(params), queryFn: () => AdminService.getRevenueReport(params) });
export const usePayments = (params: AdminPaymentQuery = {}) => useQuery({ queryKey: adminKeys.payments(params), queryFn: () => AdminService.getPayments(params) });
export const useOperationalHealth = () => useQuery({ queryKey: adminKeys.operationalHealth(), queryFn: AdminService.getOperationalHealth, refetchInterval: 60_000 });
export const useReconcileMomo = () => { const queryClient = useQueryClient(); return useMutation({ mutationFn: (limit?: number) => AdminService.reconcileMomoPayments(limit ?? 100), onSuccess: () => { void queryClient.invalidateQueries({ queryKey: adminKeys.paymentsRoot() }); void queryClient.invalidateQueries({ queryKey: adminKeys.operationalHealth() }); } }); };

export const useKycCustomers = (params: AdminKYCQueryInput) => useQuery({ queryKey: adminKeys.kycList(params), queryFn: async () => { const result = await AdminService.getKycCustomers(params); return result?.items ? result : { items: [], total: 0, page: 1, limit: 10 }; } });
export const useApproveKyc = () => { const queryClient = useQueryClient(); return useMutation({ mutationFn: ({ userId }: { userId: string }) => AdminService.approveKyc(userId), onSuccess: () => void queryClient.invalidateQueries({ queryKey: adminKeys.kyc() }) }); };
export const useRejectKyc = () => { const queryClient = useQueryClient(); return useMutation({ mutationFn: ({ userId, dto }: { userId: string; dto: RejectKYCInput }) => AdminService.rejectKyc(userId, dto), onSuccess: () => void queryClient.invalidateQueries({ queryKey: adminKeys.kyc() }) }); };
export const usePendingCars = () => useQuery({ queryKey: adminKeys.pendingCars(), queryFn: AdminService.getPendingCars });
export const useAllCars = (params: { status?: string } = {}) => useQuery({ queryKey: adminKeys.carList(params), queryFn: () => AdminService.getAllCars(params) });
export const useApproveCar = () => { const queryClient = useQueryClient(); return useMutation({ mutationFn: (carId: string) => AdminService.approveCar(carId), onSuccess: () => void queryClient.invalidateQueries({ queryKey: adminKeys.cars() }) }); };
export const useRejectCar = () => { const queryClient = useQueryClient(); return useMutation({ mutationFn: ({ carId, reason }: { carId: string; reason: string }) => AdminService.rejectCar(carId, reason), onSuccess: () => void queryClient.invalidateQueries({ queryKey: adminKeys.cars() }) }); };
export const usePromotions = (params: PromotionQueryInput = {}) => useQuery({ queryKey: adminKeys.promotions(params), queryFn: () => AdminService.getPromotions(params) });
export const useCreatePromotion = () => { const queryClient = useQueryClient(); return useMutation({ mutationFn: (dto: CreatePromotionInput) => AdminService.createPromotion(dto), onSuccess: () => void queryClient.invalidateQueries({ queryKey: adminKeys.promotionsRoot() }) }); };
export const useUpdatePromotion = () => { const queryClient = useQueryClient(); return useMutation({ mutationFn: ({ id, dto }: { id: string; dto: UpdatePromotionInput }) => AdminService.updatePromotion(id, dto), onSuccess: () => void queryClient.invalidateQueries({ queryKey: adminKeys.promotionsRoot() }) }); };
export const usePendingReleaseTrips = (params: { page?: number; limit?: number } = {}) => useQuery({ queryKey: adminKeys.pendingRelease(params), queryFn: () => AdminService.getPendingReleaseTrips(params) });
export const useReleasePayment = () => { const queryClient = useQueryClient(); return useMutation({ mutationFn: (dto: ReleasePaymentInput) => AdminService.releasePayment(dto), onSuccess: () => { void queryClient.invalidateQueries({ queryKey: adminKeys.escrow() }); void queryClient.invalidateQueries({ queryKey: adminKeys.platformWallet() }); void queryClient.invalidateQueries({ queryKey: adminKeys.paymentsRoot() }); } }); };
export const useRefundPayment = () => { const queryClient = useQueryClient(); return useMutation({ mutationFn: (dto: RefundPaymentInput) => AdminService.refundPayment(dto), onSuccess: () => { void queryClient.invalidateQueries({ queryKey: adminKeys.escrow() }); void queryClient.invalidateQueries({ queryKey: adminKeys.platformWallet() }); void queryClient.invalidateQueries({ queryKey: adminKeys.paymentsRoot() }); } }); };
export const useAutoReleasePayments = () => { const queryClient = useQueryClient(); return useMutation({ mutationFn: AdminService.autoReleasePayments, onSuccess: () => { void queryClient.invalidateQueries({ queryKey: adminKeys.escrow() }); void queryClient.invalidateQueries({ queryKey: adminKeys.platformWallet() }); } }); };
export const useRunSettlement = () => { const queryClient = useQueryClient(); return useMutation({ mutationFn: (dto: RunSettlementInput) => AdminService.runSettlement(dto), onSuccess: () => void queryClient.invalidateQueries({ queryKey: adminKeys.settlementsRoot() }) }); };
export const useSettlementHistory = (params: SettlementHistoryQueryInput = {}) => useQuery({ queryKey: adminKeys.settlements(params), queryFn: () => AdminService.getSettlementHistory(params) });
export const useDisputes = (params: DisputeQueryInput = {}) => useQuery({ queryKey: adminKeys.disputes(params), queryFn: () => AdminService.getDisputes(params) });
export const useStartDisputeProcessing = () => { const queryClient = useQueryClient(); return useMutation({ mutationFn: (disputeId: string) => AdminService.startDisputeProcessing(disputeId), onSuccess: () => void queryClient.invalidateQueries({ queryKey: adminKeys.disputesRoot() }) }); };
export const useResolveDispute = () => { const queryClient = useQueryClient(); return useMutation({ mutationFn: ({ disputeId, dto }: { disputeId: string; dto: ResolveDisputeInput }) => AdminService.resolveDispute(disputeId, dto), onSuccess: () => void queryClient.invalidateQueries({ queryKey: adminKeys.disputesRoot() }) }); };
export const usePendingWithdraws = (params: WithdrawQueryInput = {}) => useQuery({ queryKey: adminKeys.withdraws(params), queryFn: () => AdminService.getPendingWithdraws(params) });
export const useApproveWithdraw = () => { const queryClient = useQueryClient(); return useMutation({ mutationFn: ({ id, dto }: { id: string; dto: ApproveWithdrawInput }) => AdminService.approveWithdraw(id, dto), onSuccess: () => { void queryClient.invalidateQueries({ queryKey: adminKeys.withdrawsRoot() }); void queryClient.invalidateQueries({ queryKey: adminKeys.platformWallet() }); } }); };
export const useRejectWithdraw = () => { const queryClient = useQueryClient(); return useMutation({ mutationFn: ({ id, dto }: { id: string; dto: RejectWithdrawInput }) => AdminService.rejectWithdraw(id, dto), onSuccess: () => void queryClient.invalidateQueries({ queryKey: adminKeys.withdrawsRoot() }) }); };
export const useCreateCategory = () => { const queryClient = useQueryClient(); return useMutation({ mutationFn: (dto: CreateCategoryInput) => AdminService.createCategory(dto), onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["categories"] }) }); };
export const useCreateLocation = () => { const queryClient = useQueryClient(); return useMutation({ mutationFn: (dto: CreateLocationInput) => AdminService.createLocation(dto), onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["locations"] }) }); };
export const usePlatformWallet = () => useQuery({ queryKey: adminKeys.platformWallet(), queryFn: AdminService.getPlatformWallet, refetchInterval: 60_000 });
export const useUsers = (params: { page?: number; limit?: number } = {}) => useQuery({ queryKey: adminKeys.users(params), queryFn: () => AdminService.getUsers(params) });
export const useUpdateUserStatus = () => { const queryClient = useQueryClient(); return useMutation({ mutationFn: ({ userId, status }: { userId: string; status: "ACTIVE" | "INACTIVE" }) => AdminService.updateUserStatus(userId, status), onSuccess: () => void queryClient.invalidateQueries({ queryKey: adminKeys.usersRoot() }) }); };
