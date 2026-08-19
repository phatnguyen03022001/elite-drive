import { z } from "zod";

export const BookingStatus = z.enum(["PENDING", "APPROVED", "REJECTED", "CONFIRMED", "COMPLETED", "CANCELLED"]);
export const TripStatus = z.enum(["UPCOMING", "ONGOING", "COMPLETED"]);
export const CarStatus = z.enum(["DRAFT", "PENDING", "APPROVED", "REJECTED"]);

const integerVnd = z.coerce.number().int().max(Number.MAX_SAFE_INTEGER);

export const CreateCarSchema = z.object({
  name: z.string().trim().min(1, "Tên xe không được để trống").max(120),
  brand: z.string().trim().min(1).max(80),
  model: z.string().trim().min(1).max(80),
  year: z.coerce.number().int().min(1900).max(2100),
  licensePlate: z.string().trim().min(1).max(30),
  seatCount: z.coerce.number().int().min(1).max(100),
  pricePerDay: integerVnd.min(1),
  pricePerHour: integerVnd.min(0).optional(),
  pricePerWeek: integerVnd.min(0).optional(),
  pricePerMonth: integerVnd.min(0).optional(),
  categoryId: z.string().max(64).optional(),
  locationId: z.string().max(64).optional(),
  color: z.string().trim().max(50).optional(),
  transmission: z.string().trim().max(50).optional(),
  fuelType: z.string().trim().max(50).optional(),
  description: z.string().trim().max(2000).optional(),
});

export const UpdateCarSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  brand: z.string().trim().min(1).max(80).optional(),
  model: z.string().trim().min(1).max(80).optional(),
  year: z.coerce.number().int().min(1900).max(2100).optional(),
  licensePlate: z.string().trim().min(1).max(30).optional(),
  seatCount: z.coerce.number().int().min(1).max(100).optional(),
  pricePerDay: integerVnd.min(1).optional(),
  pricePerHour: integerVnd.min(0).optional(),
  categoryId: z.string().max(64).optional(),
  locationId: z.string().max(64).optional(),
});

export const CreateCarDocumentSchema = z.object({
  documentType: z.string().trim().min(1).max(50),
  documentUrl: z.string().url().max(2048),
  expiryDate: z.string().optional(),
});

export const CreateKYCSchema = z.object({
  documentType: z.string().trim().min(1, "Loại giấy tờ là bắt buộc").max(50),
  documentNumber: z.string().trim().min(1, "Số giấy tờ không được để trống").max(100),
});

export const CreatePricingSchema = z.object({
  pricePerDay: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  pricePerHour: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional(),
  pricePerWeek: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional(),
  pricePerMonth: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional(),
  discountPercentage: z.number().min(0).max(100).optional(),
});

export const BlockCalendarSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}/, "Date must use YYYY-MM-DD format."),
  blockedReason: z.string().trim().max(500).optional(),
  isBlocked: z.boolean().optional(),
});

export const TripCheckinSchema = z.object({
  startOdometer: z.coerce.number().min(0),
  startFuelLevel: z.coerce.number().min(0).max(100),
  pickupNotes: z.string().trim().max(1000).optional(),
});

export const TripCheckoutSchema = z.object({
  endOdometer: z.coerce.number().min(0),
  endFuelLevel: z.coerce.number().min(0).max(100),
  dropoffNotes: z.string().trim().max(1000).optional(),
});

export const RejectBookingSchema = z.object({
  reason: z.string().trim().max(1000).optional(),
});

export const WithdrawRequestSchema = z.object({
  amount: integerVnd.min(50000, "Số tiền tối thiểu 50,000 VND"),
  bankAccountNumber: z.string().trim().min(1, "Số tài khoản là bắt buộc").max(100),
  bankAccountName: z.string().trim().min(1, "Tên chủ tài khoản là bắt buộc").max(200),
  description: z.string().trim().max(500).optional(),
});

export const UpdateOwnerProfileSchema = z.object({
  companyName: z.string().trim().max(200).optional(),
  taxId: z.string().trim().max(100).optional(),
  bankAccountName: z.string().trim().max(200).optional(),
  bankAccountNumber: z.string().trim().max(100).optional(),
  bankCode: z.string().trim().max(50).optional(),
  address: z.string().trim().max(300).optional(),
  city: z.string().trim().max(100).optional(),
  country: z.string().trim().max(100).optional(),
});

export const GetCalendarSchema = z.object({
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional(),
});

export type CreateCarInput = z.infer<typeof CreateCarSchema>;
export type UpdateCarInput = z.infer<typeof UpdateCarSchema>;
export type CreateKYCInput = z.infer<typeof CreateKYCSchema>;
export type CreateCarDocumentInput = z.infer<typeof CreateCarDocumentSchema>;
export type CreatePricingInput = z.infer<typeof CreatePricingSchema>;
export type BlockCalendarInput = z.infer<typeof BlockCalendarSchema>;
export type TripCheckinInput = z.infer<typeof TripCheckinSchema>;
export type TripCheckoutInput = z.infer<typeof TripCheckoutSchema>;
export type RejectBookingInput = z.infer<typeof RejectBookingSchema>;
export type WithdrawRequestInput = z.infer<typeof WithdrawRequestSchema>;
export type UpdateOwnerProfileInput = z.infer<typeof UpdateOwnerProfileSchema>;
