import * as bcrypt from 'bcrypt';
import {
  BookingStatus,
  CarStatus,
  KYCStatus,
  PaymentStatus,
  UserRole,
  VerificationStatus,
} from '@prisma/client';
import { PrismaService } from '../../src/prisma/prisma.service';

export const PASSWORD = 'integration-password-123';
export const IDS = {
  customer: '507f1f77bcf86cd799439101',
  customerTwo: '507f1f77bcf86cd799439102',
  owner: '507f1f77bcf86cd799439103',
  location: '507f1f77bcf86cd799439104',
  car: '507f1f77bcf86cd799439105',
  booking: '507f1f77bcf86cd799439106',
  payment: '507f1f77bcf86cd799439107',
};

const futureStart = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
const futureEnd = new Date(futureStart.getTime() + 2 * 24 * 60 * 60 * 1000);

export async function seedUsers(prisma: PrismaService) {
  const password = await bcrypt.hash(PASSWORD, 4);
  await prisma.user.createMany({
    data: [
      {
        id: IDS.customer,
        email: 'integration.customer@example.com',
        password,
        firstName: 'Integration',
        lastName: 'Customer',
        role: UserRole.CUSTOMER,
        isVerified: true,
        isActive: true,
        verificationStatus: VerificationStatus.APPROVED,
      },
      {
        id: IDS.customerTwo,
        email: 'integration.customer.two@example.com',
        password,
        role: UserRole.CUSTOMER,
        isVerified: true,
        isActive: true,
        verificationStatus: VerificationStatus.APPROVED,
      },
      {
        id: IDS.owner,
        email: 'integration.owner@example.com',
        password,
        firstName: 'Integration',
        lastName: 'Owner',
        role: UserRole.OWNER,
        isVerified: true,
        isActive: true,
        verificationStatus: VerificationStatus.APPROVED,
      },
    ],
  });
  await prisma.kYC.createMany({
    data: [
      { userId: IDS.customer, status: KYCStatus.APPROVED },
      { userId: IDS.customerTwo, status: KYCStatus.APPROVED },
    ],
  });
}

export async function seedCar(prisma: PrismaService) {
  await prisma.location.create({
    data: {
      id: IDS.location,
      name: 'Integration Location',
      address: '1 Test Street',
      city: 'Ho Chi Minh City',
    },
  });
  await prisma.car.create({
    data: {
      id: IDS.car,
      ownerId: IDS.owner,
      locationId: IDS.location,
      name: 'Integration Car',
      brand: 'Test',
      model: 'Model',
      year: 2025,
      licensePlate: 'INTEGRATION-01',
      seatCount: 4,
      imageUrls: [],
      pricePerDay: 500000,
      status: CarStatus.APPROVED,
      verificationStatus: VerificationStatus.APPROVED,
      isAvailable: true,
    },
  });
}

export async function seedBookingPayment(prisma: PrismaService) {
  await prisma.booking.create({
    data: {
      id: IDS.booking,
      customerId: IDS.customer,
      carId: IDS.car,
      startDate: futureStart,
      endDate: futureEnd,
      pickupLocation: 'Integration Location',
      dropoffLocation: 'Integration Location',
      totalPrice: 1000000,
      finalPrice: 1000000,
      status: BookingStatus.APPROVED,
    },
  });
  await prisma.payment.create({
    data: {
      id: IDS.payment,
      userId: IDS.customer,
      bookingId: IDS.booking,
      amount: 1000000,
      paymentMethod: 'MOCK_QR',
      status: PaymentStatus.PENDING,
      transactionId: 'INTEGRATION-PAYMENT-01',
    },
  });
}

export const bookingInput = {
  carId: IDS.car,
  startDate: futureStart.toISOString(),
  endDate: futureEnd.toISOString(),
  notes: 'integration concurrency',
};
