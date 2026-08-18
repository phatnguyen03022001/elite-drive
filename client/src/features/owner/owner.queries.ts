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
  cars: (params: unknown) => [...ownerKeys.all, "cars", params] as const,
  carDocuments: (carId: string) => [...ownerKeys.all, "cars", carId, "documents"] as const,
  calendar: (carId: string, params: unknown) => [...ownerKeys.all, "cars", carId, "calendar", params] as const,
  kyc: () => [...ownerKeys.all, "kyc"] as const,
  bookings: (params: unknown) => [...ownerKeys.all, "bookings", params] as const,
  trips: (params: unknown) => [...ownerKeys.all, "trips", params] as const,
  earnings: (params: unknown) => [...ownerKeys.all, "earnings", params] as const,
  transactions: (params: unknown) => [...ownerKeys.all, "transactions", params] as const,
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
      queryClient.invalidateQueries({ queryKey: ownerKeys.profile() });
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
      queryClient.invalidateQueries({ queryKey: ownerKeys.all, exact: false });
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
      queryClient.invalidateQueries({ queryKey: ownerKeys.all, exact: false });
    },
  });
};

export const useSubmitKyc = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      dto,
      files,
    }: {
      dto: CreateKYCInput;
      files: { documentFront?: File; documentBack?: File; faceImage?: File };
    }) => OwnerService.submitKyc(dto, files),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ownerKeys.kyc() });
      queryClient.invalidateQueries({ queryKey: ownerKeys.profile() });
    },
  });
};

export const useDeleteCar = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (carId: string) => OwnerService.deleteCar(carId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ownerKeys.cars({}) });
    },
  });
};

export const useKycStatus = () =>
  useQuery({
    queryKey: ownerKeys.kyc(),
    queryFn: async () => {
      const response = await OwnerService.getKycStatus();
      return response.data?.data || response.data || response;
    },
  });

export const useSubmitCarForReview = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (carId: string) => OwnerService.submitCarForReview(carId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ownerKeys.cars({}) });
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
      queryClient.invalidateQueries({ queryKey: ownerKeys.trips({}) });
    },
  });
};

export const useCheckoutTrip = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tripId, dto }: { tripId: string; dto: TripCheckoutInput }) => OwnerService.checkoutTrip(tripId, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ownerKeys.trips({}) });
      queryClient.invalidateQueries({ queryKey: ownerKeys.earnings({}) });
      queryClient.invalidateQueries({ queryKey: ownerKeys.wallet() });
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
      queryClient.invalidateQueries({ queryKey: ownerKeys.bookings({}) });
    },
  });
};

export const useRejectBooking = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ bookingId, dto }: { bookingId: string; dto: RejectBookingInput }) =>
      OwnerService.rejectBooking(bookingId, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ownerKeys.bookings({}) });
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
      queryClient.invalidateQueries({ queryKey: ownerKeys.wallet() });
      queryClient.invalidateQueries({ queryKey: ownerKeys.transactions({}) });
    },
  });
};

export const useOwnerDashboard = () =>
  useQuery({
    queryKey: ownerKeys.dashboard(),
    queryFn: OwnerService.getDashboardOverview,
  });
