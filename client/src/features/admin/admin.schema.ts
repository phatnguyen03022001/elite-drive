import { z } from "zod";

export const KYCStatus = z.enum(["NONE", "PENDING", "APPROVED", "REJECTED"]);
export const BookingStatus = z.enum(["PENDING", "APPROVED", "REJECTED", "CONFIRMED", "COMPLETED", "CANCELLED"]);
export const PaymentStatus = z.enum(["PENDING", "COMPLETED", "FAILED", "REFUNDED"]);
export const SettlementStatus = z.enum(["PENDING", "PROCESSING", "COMPLETED", "FAILED"]);
export const DisputeStatus = z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]);
export const FinalDisputeStatus = z.enum(["RESOLVED", "CLOSED"]);
export const CarStatus = z.enum(["DRAFT", "PENDING", "APPROVED", "REJECTED"]);

export const ReportDateRangeSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

export const OverviewReportSchema = z.object({
  totalUsers: z.number(),
  totalCars: z.number(),
  totalBookings: z.number(),
  totalRevenue: z.number(),
});

export const AdminKYCQuerySchema = z.object({
  status: KYCStatus.optional(),
  page: z.number().optional(),
  limit: z.number().optional(),
});

export const RejectKYCSchema = z.object({
  rejectionReason: z.string().min(1, "Vui lòng nhập lý do từ chối"),
});

export const KYCItemSchema = z.object({
  id: z.string(),
  userId: z.string(),
  status: KYCStatus,
  documentType: z.string().nullable(),
  documentNumber: z.string().nullable(),
  documentFrontUrl: z.string().nullable(),
  documentBackUrl: z.string().nullable(),
  faceImageUrl: z.string().nullable(),
  rejectionReason: z.string().nullable(),
  submittedAt: z.string(),
  user: z.object({
    id: z.string(),
    role: z.string(),
    email: z.string(),
    firstName: z.string().nullable(),
    lastName: z.string().nullable(),
    isActive: z.boolean(),
  }),
});

export const PendingCarSchema = z.object({
  id: z.string(),
  name: z.string(),
  brand: z.string(),
  licensePlate: z.string(),
  verificationStatus: z.string(),
  owner: z.object({
    id: z.string(),
    email: z.string(),
    firstName: z.string().nullable(),
    lastName: z.string().nullable(),
    phone: z.string().nullable(),
  }),
  documents: z.array(z.unknown()),
  createdAt: z.string(),
});

export const CreatePromotionSchema = z.object({
  code: z.string().min(1, "Mã khuyến mãi không được để trống"),
  description: z.string().optional(),
  discountType: z.enum(["PERCENTAGE", "FIXED"]),
  discountValue: z.number().positive("Giá trị giảm giá phải > 0"),
  maxUses: z.number().optional(),
  minBookingAmount: z.number().optional(),
  startDate: z.string(),
  endDate: z.string(),
});

export const UpdatePromotionSchema = CreatePromotionSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const PromotionQuerySchema = z.object({
  isActive: z.boolean().optional(),
});

export const ReleasePaymentSchema = z.object({
  bookingId: z.string().min(1),
  platformFeePercent: z.number().min(0).max(100).optional(),
});

export const RefundPaymentSchema = z.object({
  bookingId: z.string().min(1),
  refundPercent: z.number().min(1).max(100).optional(),
  reason: z.string().min(1, "Vui lòng nhập lý do hoàn tiền"),
});

export const RunSettlementSchema = z.object({
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Format phải là YYYY-MM"),
  ownerId: z.string().optional(),
});

export const SettlementHistoryQuerySchema = z.object({
  period: z.string().optional(),
  status: SettlementStatus.optional(),
  ownerId: z.string().optional(),
  page: z.number().optional(),
  limit: z.number().optional(),
});

export const ResolveDisputeSchema = z.object({
  resolution: z.string().min(1, "Vui lòng nhập giải pháp"),
  status: FinalDisputeStatus,
});

export const DisputeQuerySchema = z.object({
  status: DisputeStatus.optional(),
  page: z.number().optional(),
  limit: z.number().optional(),
});

export const WithdrawQuerySchema = z.object({
  page: z.number().optional(),
  limit: z.number().optional(),
});

export const RejectWithdrawSchema = z.object({
  reason: z.string().min(1, "Vui lòng nhập lý do từ chối"),
});

export const CreateCategorySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

export const CreateLocationSchema = z.object({
  name: z.string().min(1),
  address: z.string().min(1),
  city: z.string().min(1),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

export type ReportDateRangeInput = z.infer<typeof ReportDateRangeSchema>;
export type OverviewReport = z.infer<typeof OverviewReportSchema>;
export type AdminKYCQueryInput = z.infer<typeof AdminKYCQuerySchema>;
export type RejectKYCInput = z.infer<typeof RejectKYCSchema>;
export type KYCItem = z.infer<typeof KYCItemSchema>;
export type PendingCar = z.infer<typeof PendingCarSchema>;
export type CreatePromotionInput = z.infer<typeof CreatePromotionSchema>;
export type UpdatePromotionInput = z.infer<typeof UpdatePromotionSchema>;
export type PromotionQueryInput = z.infer<typeof PromotionQuerySchema>;
export type ReleasePaymentInput = z.infer<typeof ReleasePaymentSchema>;
export type RefundPaymentInput = z.infer<typeof RefundPaymentSchema>;
export type RunSettlementInput = z.infer<typeof RunSettlementSchema>;
export type SettlementHistoryQueryInput = z.infer<typeof SettlementHistoryQuerySchema>;
export type ResolveDisputeInput = z.infer<typeof ResolveDisputeSchema>;
export type DisputeQueryInput = z.infer<typeof DisputeQuerySchema>;
export type WithdrawQueryInput = z.infer<typeof WithdrawQuerySchema>;
export type RejectWithdrawInput = z.infer<typeof RejectWithdrawSchema>;
export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>;
export type CreateLocationInput = z.infer<typeof CreateLocationSchema>;
export type KYCStatusType = z.infer<typeof KYCStatus>;
export type CarStatusType = z.infer<typeof CarStatus>;
