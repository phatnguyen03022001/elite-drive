import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CustomerService } from "./customer.service";
import {
  BookingQueryInput,
  UpdateCustomerProfileInput,
  CreateBookingInput,
  CreateWalletTopupInput,
  ApplyPromotionInput,
  CreatePaymentInput,
} from "./customer.schema";

// --- KEYS ---
export const customerKeys = {
  all: ["customer"] as const,
  profile: () => [...customerKeys.all, "profile"] as const,
  kyc: () => [...customerKeys.all, "kyc"] as const,
  bookings: (params: unknown) => [...customerKeys.all, "bookings", params] as const,
  trips: (params: unknown) => [...customerKeys.all, "trips", params] as const,
  payment: (bookingId: string) => [...customerKeys.all, "payment", bookingId] as const,
};

export const useProfile = () =>
  useQuery({
    queryKey: customerKeys.profile(),
    queryFn: CustomerService.getProfile,
  });

export const useBookings = (params: { page?: number; limit?: number } & BookingQueryInput) =>
  useQuery({
    queryKey: customerKeys.bookings(params),
    queryFn: () => CustomerService.getBookings(params),
  });

export const useBookingDetail = (bookingId: string) =>
  useQuery({
    queryKey: ["booking", bookingId],
    queryFn: () => CustomerService.getBookingDetail(bookingId),
  });

export const useCancelBooking = () =>
  useMutation({
    mutationFn: (bookingId: string) => CustomerService.cancelBooking(bookingId),
  });

export const useUpdateProfile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: UpdateCustomerProfileInput) => CustomerService.updateProfile(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerKeys.profile() });
    },
  });
};

export const useCreateBooking = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateBookingInput) => CustomerService.createBooking(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerKeys.bookings({}) });
    },
  });
};

export const useSubmitKyc = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ dto, files }: { dto: Parameters<typeof CustomerService.submitKyc>[0]; files: Parameters<typeof CustomerService.submitKyc>[1] }) =>
      CustomerService.submitKyc(dto, files),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerKeys.kyc() });
      queryClient.invalidateQueries({ queryKey: customerKeys.profile() });
    },
  });
};

export const useWallet = () =>
  useQuery({
    queryKey: ["wallet"],
    queryFn: CustomerService.getWallet,
  });

export const useWalletTransactions = (params?: { page?: number; limit?: number }) =>
  useQuery({
    queryKey: ["wallet-transactions", params],
    queryFn: () => CustomerService.getWalletTransactions(params),
  });

export const useWalletTopup = () =>
  useMutation({
    mutationFn: (dto: CreateWalletTopupInput) => CustomerService.createWalletTopup(dto),
  });

export const useKycStatus = () =>
  useQuery({
    queryKey: customerKeys.kyc(),
    queryFn: async () => {
      const response = await CustomerService.getKycStatus();
      return response.data?.data || response.data || response;
    },
  });

export const useCreatePayment = () =>
  useMutation({
    mutationFn: (dto: CreatePaymentInput) => CustomerService.createPayment(dto),
  });

export const useConfirmPayment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: { bookingId: string; transactionId: string }) => CustomerService.confirmPayment(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerKeys.bookings({}) });
    },
  });
};

export const usePaymentDetail = (bookingId: string) =>
  useQuery({
    queryKey: customerKeys.payment(bookingId),
    queryFn: () => CustomerService.getPaymentByBooking(bookingId),
    enabled: Boolean(bookingId),
  });

export const useActivePromotions = () =>
  useQuery({
    queryKey: ["promotions", "active"],
    queryFn: CustomerService.getActivePromotions,
  });

export const useApplyPromotion = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: ApplyPromotionInput) => CustomerService.applyPromotion(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerKeys.bookings({}) });
    },
  });
};
