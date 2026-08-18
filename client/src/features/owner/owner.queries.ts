import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { OwnerService } from "./owner.service";
import {
  CreateKYCInput,
  RejectBookingInput,
  TripCheckinInput,
  TripCheckoutInput,
  UpdateCarInput,
  UpdateOwnerProfileInput,
  WithdrawRequestInput,
} from "./owner.schema";

export const ownerKeys = {
  all: ["owner"] as const,
  profile: () => [...ownerKeys.all, "profile"] as const,
  carsRoot: () => [...ownerKeys.all, "cars"] as const,
  cars: (params: unknown) => [...ownerKeys.carsRoot(), params] as const,
  carDocuments: (carId: string) => [...ownerKeys.carsRoot(), carId, "documents"] as const,
  calendar: (carId: string, params: unknown) => [...ownerKeys.carsRoot(), carId, "calendar", params] as const,
  kyc: () => [...ownerKeys.all, "kyc"] as const,
  bookingsRoot: () => [...ownerKeys.all, "bookings"] as const,
  bookings: (params: unknown) => [...ownerKeys.bookingsRoot(), params] as const,
  tripsRoot: () => [...ownerKeys.all, "trips"] as const,
  trips: (params: unknown) => [...ownerKeys.tripsRoot(), params] as const,
  earningsRoot: () => [...ownerKeys.all, "earnings"] as const,
  earnings: (params: unknown) => [...ownerKeys.earningsRoot(), params] as const,
  transactionsRoot: () => [...ownerKeys.all, "transactions"] as const,
  transactions: (params: unknown) => [...ownerKeys.transactionsRoot(), params] as const,
  wallet: () => [...ownerKeys.all, "wallet"] as const,
  dashboard: () => [...ownerKeys.all, "dashboard"] as const,
};

export const useOwnerProfile = () =>
  useQuery({ queryKey: ownerKeys.profile(), queryFn: OwnerService.getProfile });

export const useUpdateOwnerProfile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: UpdateOwnerProfileInput) => OwnerService.updateProfile(dto),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ownerKeys.profile() });
      void queryClient.invalidateQueries({ queryKey: ownerKeys.dashboard() });
    },
  });
};

export const useMyCars = (params?: { page?: number; limit?: number }) =>
  useQuery({
    queryKey: ownerKeys.cars(params),
    queryFn: () => OwnerService.getMyCars(params),
  });

export const useCreateCar = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (formData: FormData) => OwnerService.createCar(formData),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ownerKeys.carsRoot() });
      void queryClient.invalidateQueries({ queryKey: ownerKeys.dashboard() });
    },
  });
};

export const useUpdateCar = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ carId, data, dto }: { carId: string; data?: FormData; dto?: UpdateCarInput }) => {
      const payload = data ?? dto;
      if (!payload) throw new Error("Missing vehicle update payload");
      return OwnerService.updateCar(carId, payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ownerKeys.carsRoot() });
      void queryClient.invalidateQueries({ queryKey: ownerKeys.dashboard() });
    },
  });
};

export const useSubmitKyc = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ dto, files }: { dto: CreateKYCInput; files: { documentFront?: File; documentBack?: File; faceImage?: File } }) =>
      OwnerService.submitKyc(dto, files),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ownerKeys.kyc() });
      void queryClient.invalidateQueries({ queryKey: ownerKeys.profile() });
    },
  });
};

export const useDeleteCar = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (carId: string) => OwnerService.deleteCar(carId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ownerKeys.carsRoot() });
      void queryClient.invalidateQueries({ queryKey: ownerKeys.dashboard() });
    },
  });
};

export const useKycStatus = () =>
  useQuery({ queryKey: ownerKeys.kyc(), queryFn: OwnerService.getKycStatus });

export const useSubmitCarForReview = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (carId: string) => OwnerService.submitCarForReview(carId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ownerKeys.carsRoot() });
      void queryClient.invalidateQueries({ queryKey: ownerKeys.dashboard() });
    },
  });
};

export const useOwnerTrips = (params?: { page?: number; limit?: number }) =>
  useQuery({
    queryKey: ownerKeys.trips(params),
    queryFn: () => OwnerService.getTrips(params),
  });

export const useCheckinTrip = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tripId, dto }: { tripId: string; dto: TripCheckinInput }) => OwnerService.checkinTrip(tripId, dto),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ownerKeys.tripsRoot() });
      void queryClient.invalidateQueries({ queryKey: ownerKeys.dashboard() });
    },
  });
};

export const useCheckoutTrip = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tripId, dto }: { tripId: string; dto: TripCheckoutInput }) => OwnerService.checkoutTrip(tripId, dto),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ownerKeys.tripsRoot() });
      void queryClient.invalidateQueries({ queryKey: ownerKeys.earningsRoot() });
      void queryClient.invalidateQueries({ queryKey: ownerKeys.wallet() });
      void queryClient.invalidateQueries({ queryKey: ownerKeys.dashboard() });
    },
  });
};

export const useOwnerBookings = (params?: { page?: number; limit?: number; status?: string }) =>
  useQuery({
    queryKey: ownerKeys.bookings(params),
    queryFn: () => OwnerService.getBookings(params),
  });

export const useApproveBooking = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (bookingId: string) => OwnerService.approveBooking(bookingId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ownerKeys.bookingsRoot() });
      void queryClient.invalidateQueries({ queryKey: ownerKeys.dashboard() });
    },
  });
};

export const useRejectBooking = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ bookingId, dto }: { bookingId: string; dto: RejectBookingInput }) =>
      OwnerService.rejectBooking(bookingId, dto),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ownerKeys.bookingsRoot() });
      void queryClient.invalidateQueries({ queryKey: ownerKeys.dashboard() });
    },
  });
};

export const useOwnerWallet = () =>
  useQuery({ queryKey: ownerKeys.wallet(), queryFn: OwnerService.getWallet });

export const useOwnerEarnings = (params?: { page?: number; limit?: number }) =>
  useQuery({
    queryKey: ownerKeys.earnings(params),
    queryFn: () => OwnerService.getEarnings(params),
  });

export const useRequestWithdraw = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: WithdrawRequestInput) => OwnerService.requestWithdraw(dto),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ownerKeys.wallet() });
      void queryClient.invalidateQueries({ queryKey: ownerKeys.transactionsRoot() });
      void queryClient.invalidateQueries({ queryKey: ownerKeys.dashboard() });
    },
  });
};

export const useOwnerDashboard = () =>
  useQuery({ queryKey: ownerKeys.dashboard(), queryFn: OwnerService.getDashboardOverview });
