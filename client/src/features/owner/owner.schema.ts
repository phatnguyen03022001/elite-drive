import { z } from "zod";

export const BookingStatus = z.enum(["PENDING", "APPROVED", "REJECTED", "CONFIRMED", "COMPLETED", "CANCELLED"]);
export const TripStatus = z.enum(["UPCOMING", "ONGOING", "COMPLETED"]);
export const CarStatus = z.enum(["DRAFT", "PENDING", "APPROVED", "REJECTED"]);

const integerVnd = z.coerce.number().int();

export const CreateCarSchema = z.object({
  name: z.string().min(1, "Tên xe không được để trống"),
  brand: z.string().min(1),
  model: z.string().min(1),
  year: z.coerce.number().int().min(1900).max(2100),
  licensePlate: z.string().min(1),
  seatCount: z.coerce.number().int().min(1).max(100),
  pricePerDay: integerVnd.min(1),
  pricePerHour: integerVnd.min(0).optional(),
  pricePerWeek: integerVnd.min(0).optional(),
  pricePerMonth: integerVnd.min(0).optional(),
  categoryId: z.string().optional(),
  locationId: z.string().optional(),
  color: z.string().optional(),
  transmission: z.string().optional(),
  fuelType: z.string().optional(),
  description: z.string().optional(),
});

export const UpdateCarSchema = z.object({
  name: z.string().min(1).optional(),
  brand: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  year: z.coerce.number().int().min(1900).max(2100).optional(),
  licensePlate: z.string().min(1).optional(),
  seatCount: z.coerce.number().int().min(1).max(100).optional(),
  pricePerDay: integerVnd.min(1).optional(),
  pricePerHour: integerVnd.min(0).optional(),
  categoryId: z.string().optional(),
  locationId: z.string().optional(),
});

export const CreateCarDocumentSchema = z.object({
  documentType: z.string().min(1),
  documentUrl: z.string().url(),
  expiryDate: z.string().optional(),
});

export const CreateKYCSchema = z.object({
  documentType: z.string().min(1, "Loại giấy tờ là bắt buộc"),
  documentNumber: z.string().min(1, "Số giấy tờ không được để trống"),
});

export const CreatePricingSchema = z.object({
  pricePerDay: z.number().int().min(1),
  pricePerHour: z.number().int().min(0).optional(),
  pricePerWeek: z.number().int().min(0).optional(),
  pricePerMonth: z.number().int().min(0).optional(),
  discountPercentage: z.number().min(0).max(100).optional(),
});

export const BlockCalendarSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}/, "Date must use YYYY-MM-DD format."),
  blockedReason: z.string().optional(),
  isBlocked: z.boolean().optional(),
});

export const TripCheckinSchema = z.object({
  startOdometer: z.coerce.number().min(0),
  startFuelLevel: z.coerce.number().min(0).max(100),
  pickupNotes: z.string().optional(),
});

export const TripCheckoutSchema = z.object({
  endOdometer: z.coerce.number().min(0),
  endFuelLevel: z.coerce.number().min(0).max(100),
  dropoffNotes: z.string().optional(),
});

export const RejectBookingSchema = z.object({
  reason: z.string().optional(),
});

export const WithdrawRequestSchema = z.object({
  amount: z.coerce.number().int().min(50000, "Số tiền tối thiểu 50,000 VND"),
  bankAccountNumber: z.string().optional(),
  bankAccountName: z.string().optional(),
  description: z.string().max(500).optional(),
});

export const UpdateOwnerProfileSchema = z.object({
  companyName: z.string().optional(),
  taxId: z.string().optional(),
  bankAccountName: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  bankCode: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
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
