import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CustomerService } from "./customer.service";
import {
  BookingQueryInput,
  UpdateCustomerProfileInput,
  CreateBookingInput,
  CreateWalletTopupInput,
  ApplyPromotionInput,
  CreatePaymentInput,
} from "./customer.schema";

export const customerKeys = {
  all: ["customer"] as const,
  profile: () => [...customerKeys.all, "profile"] as const,
  kyc: () => [...customerKeys.all, "kyc"] as const,
  bookingsRoot: () => [...customerKeys.all, "bookings"] as const,
  bookings: (params: unknown) => [...customerKeys.bookingsRoot(), params] as const,
  tripsRoot: () => [...customerKeys.all, "trips"] as const,
  trips: (params: unknown) => [...customerKeys.tripsRoot(), params] as const,
  paymentRoot: () => [...customerKeys.all, "payment"] as const,
  payment: (bookingId: string) => [...customerKeys.paymentRoot(), bookingId] as const,
  wallet: () => [...customerKeys.all, "wallet"] as const,
  walletTransactions: () => [...customerKeys.wallet(), "transactions"] as const,
};

export const useProfile = () =>
  useQuery({ queryKey: customerKeys.profile(), queryFn: CustomerService.getProfile });

export const useBookings = (params: { page?: number; limit?: number } & BookingQueryInput) =>
  useQuery({
    queryKey: customerKeys.bookings(params),
    queryFn: () => CustomerService.getBookings(params),
  });

export const useBookingDetail = (bookingId: string) =>
  useQuery({
    queryKey: [...customerKeys.bookingsRoot(), bookingId],
    queryFn: () => CustomerService.getBookingDetail(bookingId),
  });

export const useCancelBooking = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (bookingId: string) => CustomerService.cancelBooking(bookingId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: customerKeys.bookingsRoot() });
      void queryClient.invalidateQueries({ queryKey: customerKeys.wallet() });
      void queryClient.invalidateQueries({ queryKey: customerKeys.paymentRoot() });
    },
  });
};

export const useUpdateProfile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: UpdateCustomerProfileInput) => CustomerService.updateProfile(dto),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: customerKeys.profile() });
    },
  });
};

export const useCreateBooking = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateBookingInput) => CustomerService.createBooking(dto),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: customerKeys.bookingsRoot() });
    },
  });
};

export const useSubmitKyc = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ dto, files }: { dto: Parameters<typeof CustomerService.submitKyc>[0]; files: Parameters<typeof CustomerService.submitKyc>[1] }) =>
      CustomerService.submitKyc(dto, files),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: customerKeys.kyc() });
      void queryClient.invalidateQueries({ queryKey: customerKeys.profile() });
    },
  });
};

export const useWallet = () =>
  useQuery({ queryKey: customerKeys.wallet(), queryFn: CustomerService.getWallet });

export const useWalletTransactions = (params?: { page?: number; limit?: number }) =>
  useQuery({
    queryKey: [...customerKeys.walletTransactions(), params],
    queryFn: () => CustomerService.getWalletTransactions(params),
  });

export const useWalletTopup = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateWalletTopupInput) => CustomerService.createWalletTopup(dto),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: customerKeys.wallet() });
    },
  });
};

export const useKycStatus = () =>
  useQuery({ queryKey: customerKeys.kyc(), queryFn: CustomerService.getKycStatus });

export const useCreatePayment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreatePaymentInput) => CustomerService.createPayment(dto),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: customerKeys.paymentRoot() });
    },
  });
};

export const useConfirmPayment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: { bookingId: string; transactionId: string }) => CustomerService.confirmPayment(dto),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: customerKeys.bookingsRoot() });
      void queryClient.invalidateQueries({ queryKey: customerKeys.paymentRoot() });
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
  useQuery({ queryKey: ["promotions", "active"], queryFn: CustomerService.getActivePromotions });

export const useApplyPromotion = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: ApplyPromotionInput) => CustomerService.applyPromotion(dto),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: customerKeys.bookingsRoot() });
    },
  });
};
