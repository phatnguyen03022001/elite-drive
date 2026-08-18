import { z } from "zod";

export const UserRole = z.enum(["CUSTOMER", "OWNER", "ADMIN"]);
export const KYCStatus = z.enum(["PENDING", "APPROVED", "REJECTED"]);
export const BookingStatus = z.enum(["PENDING", "APPROVED", "REJECTED", "CONFIRMED", "COMPLETED", "CANCELLED"]);
export const TripStatus = z.enum(["UPCOMING", "ONGOING", "COMPLETED"]);
export const PaymentStatus = z.enum(["PENDING", "COMPLETED", "FAILED", "REFUNDED"]);

export const UpdateCustomerProfileSchema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters.").optional(),
  lastName: z.string().min(2, "Last name must be at least 2 characters.").optional(),
  phone: z
    .string()
    .regex(/^0\d{9}$/, "Phone number must start with 0 and contain 10 digits.")
    .optional(),
  avatar: z.any().optional(),
  dateOfBirth: z.string().optional().or(z.date()),
  address: z.string().min(1, "Address is required.").optional(),
  city: z.string().min(1, "City is required.").optional(),
  country: z.string().min(1, "Country is required.").optional(),
  postalCode: z.string().optional().nullable(),
});

export const CreateKYCSchema = z.object({
  documentType: z.string().min(1, "Document type is required."),
  documentNumber: z.string().min(1, "Document number is required."),
});

export const CreateBookingSchema = z
  .object({
    carId: z.string().min(1, "Select a vehicle."),
    startDate: z.string().transform((value) => new Date(value)),
    endDate: z.string().transform((value) => new Date(value)),
    pickupLocation: z.string().optional(),
    dropoffLocation: z.string().optional(),
    notes: z.string().optional(),
  })
  .refine((data) => data.endDate > data.startDate, {
    message: "Return date must be after the pick-up date.",
    path: ["endDate"],
  });

export const BookingQuerySchema = z.object({
  status: BookingStatus.optional(),
  carId: z.string().optional(),
});

export const TripQuerySchema = z.object({
  status: TripStatus.optional(),
});

export const CreatePaymentSchema = z.object({
  bookingId: z.string().min(1),
  paymentMethod: z.string().min(1, "Select a payment method."),
});

export const ConfirmPaymentSchema = z.object({
  bookingId: z.string().min(1),
  transactionId: z.string().min(1),
});

export const SignContractSchema = z.object({
  signatureData: z.string().min(1, "Signature is required."),
});

export const WalletRefundSchema = z.object({
  bookingId: z.string().min(1),
  amount: z.number().min(0, "Refund amount is invalid."),
  reason: z.string().min(1, "Refund reason is required."),
});

export const CreateReviewSchema = z.object({
  carId: z.string().min(1),
  bookingId: z.string().optional(),
  rating: z.number().min(1, "Rating must be at least 1 star.").max(5, "Rating cannot exceed 5 stars."),
  title: z.string().optional(),
  content: z.string().min(5, "Review must contain at least 5 characters.").optional(),
});

export const WalletSchema = z.object({
  id: z.string(),
  balance: z.number(),
  currency: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const WalletTransactionSchema = z.object({
  id: z.string(),
  amount: z.number(),
  type: z.string(),
  description: z.string().nullable(),
  createdAt: z.string(),
});

export const WalletTransactionListSchema = z.object({
  data: z.array(WalletTransactionSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
});

export const CreateWalletTopupSchema = z.object({
  amount: z.number().min(1000, "Minimum top-up amount is 1,000 VND."),
  paymentMethod: z.enum(["MOCK_QR", "VNPAY", "MOMO"]),
  description: z.string().optional(),
});

export const PromotionSchema = z.object({
  id: z.string(),
  code: z.string(),
  description: z.string().nullable(),
  discountType: z.enum(["PERCENTAGE", "FIXED"]),
  discountValue: z.number(),
  maxUses: z.number().nullable(),
  usedCount: z.number(),
  minBookingAmount: z.number().nullable(),
  startDate: z.string(),
  endDate: z.string(),
  isActive: z.boolean(),
});

export const ApplyPromotionSchema = z.object({
  bookingId: z.string().min(1),
  promoCode: z.string().min(1),
});

export const BookingDetailSchema = z.object({
  id: z.string(),
  status: BookingStatus,
  startDate: z.string(),
  endDate: z.string(),
  totalPrice: z.number(),
  discountAmount: z.number().nullable(),
  car: z.object({
    id: z.string(),
    name: z.string(),
    brand: z.string(),
    mainImageUrl: z.string().nullable(),
  }),
  payments: z.array(
    z.object({
      id: z.string(),
      amount: z.number(),
      status: PaymentStatus,
      paymentMethod: z.string(),
      paidAt: z.string().nullable(),
      createdAt: z.string(),
    }),
  ),
  contract: z.any().nullable(),
  trip: z.any().nullable(),
});

export type CreateWalletTopupInput = z.infer<typeof CreateWalletTopupSchema>;
export type UpdateCustomerProfileInput = z.infer<typeof UpdateCustomerProfileSchema>;
export type CreateKYCInput = z.infer<typeof CreateKYCSchema>;
export type CreateBookingInput = z.infer<typeof CreateBookingSchema>;
export type BookingQueryInput = z.infer<typeof BookingQuerySchema>;
export type BookingDetailResponse = z.infer<typeof BookingDetailSchema>;
export type CreatePaymentInput = z.infer<typeof CreatePaymentSchema>;
export type SignContractInput = z.infer<typeof SignContractSchema>;
export type WalletRefundInput = z.infer<typeof WalletRefundSchema>;
export type CreateReviewInput = z.infer<typeof CreateReviewSchema>;
export const CancelBookingResponseSchema = BookingDetailSchema;
export type Wallet = z.infer<typeof WalletSchema>;
export type WalletTransaction = z.infer<typeof WalletTransactionSchema>;
export type WalletTransactionList = z.infer<typeof WalletTransactionListSchema>;
export type Promotion = z.infer<typeof PromotionSchema>;
export type ApplyPromotionInput = z.infer<typeof ApplyPromotionSchema>;
