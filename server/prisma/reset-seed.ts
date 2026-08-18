import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const oid = (value: number) => value.toString(16).padStart(24, '0');

const ids = {
  users: [oid(1), ...[101, 102, 103, 104, 201, 202, 203, 204, 205, 206, 207].map(oid)],
  cars: Array.from({ length: 12 }, (_, index) => oid(301 + index)),
  bookings: Array.from({ length: 14 }, (_, index) => oid(401 + index)),
  trips: Array.from({ length: 9 }, (_, index) => oid(501 + index)),
  reviews: Array.from({ length: 8 }, (_, index) => oid(601 + index)),
  payments: Array.from({ length: 10 }, (_, index) => oid(701 + index)),
  disputes: [oid(801), oid(802)],
  disputeMessages: [oid(811), oid(812), oid(813), oid(814)],
  kyc: Array.from({ length: 11 }, (_, index) => oid(901 + index)),
  wallets: [oid(951), oid(952), oid(953)],
  availability: [oid(1001), oid(1002), oid(1003), oid(1004)],
  contracts: Array.from({ length: 7 }, (_, index) => oid(1101 + index)),
  ownerTransactions: Array.from({ length: 6 }, (_, index) => oid(1201 + index)),
  walletTransactions: Array.from({ length: 6 }, (_, index) => oid(1301 + index)),
  settlements: [oid(1401), oid(1402), oid(1403), oid(1404)],
  promotions: [oid(1501), oid(1502), oid(1503), oid(1504)],
};

async function main() {
  // Delete only records owned by this deterministic sample dataset. Real user
  // data with different IDs is intentionally left untouched.
  await prisma.disputeMessage.deleteMany({ where: { id: { in: ids.disputeMessages } } });
  await prisma.dispute.deleteMany({ where: { id: { in: ids.disputes } } });
  await prisma.settlement.deleteMany({ where: { id: { in: ids.settlements } } });
  await prisma.ownerTransaction.deleteMany({ where: { id: { in: ids.ownerTransactions } } });
  await prisma.walletTransaction.deleteMany({ where: { id: { in: ids.walletTransactions } } });
  await prisma.contract.deleteMany({ where: { id: { in: ids.contracts } } });
  await prisma.review.deleteMany({ where: { id: { in: ids.reviews } } });
  await prisma.trip.deleteMany({ where: { id: { in: ids.trips } } });
  await prisma.payment.deleteMany({ where: { id: { in: ids.payments } } });
  await prisma.availability.deleteMany({ where: { id: { in: ids.availability } } });
  await prisma.booking.deleteMany({ where: { id: { in: ids.bookings } } });
  await prisma.car.deleteMany({ where: { id: { in: ids.cars } } });
  await prisma.kYC.deleteMany({ where: { id: { in: ids.kyc } } });
  await prisma.wallet.deleteMany({ where: { id: { in: ids.wallets } } });
  await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
  await prisma.promotion.deleteMany({ where: { id: { in: ids.promotions } } });

  console.log('Existing Elite Drive sample records cleared; non-seed data was preserved.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
