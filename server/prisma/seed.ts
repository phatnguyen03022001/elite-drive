import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import {
  BookingStatus,
  CarStatus,
  DisputeStatus,
  KYCStatus,
  PaymentStatus,
  PrismaClient,
  SettlementStatus,
  TripStatus,
  UserRole,
  VerificationStatus,
} from '@prisma/client';

const prisma = new PrismaClient();

const oid = (value: number) => value.toString(16).padStart(24, '0');
const DAY = 86_400_000;

function dateFromNow(offset: number, hour = 10) {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return date;
}

function monthKey(offset: number) {
  const date = new Date();
  date.setMonth(date.getMonth() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function tripDays(start: Date, end: Date) {
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY));
}

function money(value: number) {
  return Math.round(value / 1_000) * 1_000;
}

const ids = {
  admin: oid(1),
  owners: [oid(101), oid(102), oid(103), oid(104)],
  customers: [oid(201), oid(202), oid(203), oid(204), oid(205), oid(206), oid(207)],
  cars: Array.from({ length: 12 }, (_, index) => oid(301 + index)),
  bookings: Array.from({ length: 14 }, (_, index) => oid(401 + index)),
  trips: Array.from({ length: 9 }, (_, index) => oid(501 + index)),
  reviews: Array.from({ length: 8 }, (_, index) => oid(601 + index)),
  payments: Array.from({ length: 10 }, (_, index) => oid(701 + index)),
  disputes: [oid(801), oid(802)],
  messages: [oid(811), oid(812), oid(813), oid(814)],
};

const categories = [
  { name: 'Executive Sedan', description: 'Quiet premium sedans suited to business travel, airport runs, and longer city trips.' },
  { name: 'Luxury SUV', description: 'Comfort-focused SUVs with extra luggage room and a higher driving position.' },
  { name: 'Performance', description: 'Driver-focused premium cars for renters who value sharper handling and stronger powertrains.' },
  { name: 'Electric & Hybrid', description: 'Electrified vehicles for quiet urban driving and lower fuel consumption.' },
];

const locations = [
  { name: 'Nguyen Hue · District 1', address: 'Nguyen Hue, Ben Nghe Ward, District 1', city: 'Ho Chi Minh City', latitude: 10.7731, longitude: 106.7043 },
  { name: 'Thao Dien · Thu Duc', address: 'Xuan Thuy, Thao Dien Ward, Thu Duc City', city: 'Ho Chi Minh City', latitude: 10.8033, longitude: 106.7317 },
  { name: 'Tan Son Nhat · Tan Binh', address: 'Truong Son, Ward 2, Tan Binh District', city: 'Ho Chi Minh City', latitude: 10.8131, longitude: 106.6653 },
  { name: 'Landmark 81 · Binh Thanh', address: 'Nguyen Huu Canh, Ward 22, Binh Thanh District', city: 'Ho Chi Minh City', latitude: 10.7951, longitude: 106.7218 },
  { name: 'Phu My Hung · District 7', address: 'Nguyen Luong Bang, Tan Phu Ward, District 7', city: 'Ho Chi Minh City', latitude: 10.7294, longitude: 106.7216 },
  { name: 'Sala · Thu Duc', address: 'Mai Chi Tho, An Loi Dong Ward, Thu Duc City', city: 'Ho Chi Minh City', latitude: 10.7724, longitude: 106.7397 },
];

const people = [
  {
    id: ids.admin,
    email: 'ops@elitedrive.example',
    firstName: 'Nora',
    lastName: 'Le',
    phone: '0900000101',
    role: UserRole.ADMIN,
    verificationStatus: VerificationStatus.APPROVED,
    city: 'Ho Chi Minh City',
    address: 'District 1',
    country: 'Vietnam',
  },
  {
    id: ids.owners[0],
    email: 'minh.tran@example.com',
    firstName: 'Minh',
    lastName: 'Tran',
    phone: '0903128401',
    role: UserRole.OWNER,
    verificationStatus: VerificationStatus.APPROVED,
    city: 'Ho Chi Minh City',
    address: 'Ben Nghe Ward, District 1',
    country: 'Vietnam',
    ownerCompanyName: 'Saigon Executive Mobility',
    ownerTaxId: 'SEED-SEM-02841',
    ownerBankAccountName: 'TRAN MINH',
    ownerBankAccountNumber: '0284106821',
    ownerBankCode: 'VCB',
  },
  {
    id: ids.owners[1],
    email: 'linh.nguyen@example.com',
    firstName: 'Linh',
    lastName: 'Nguyen',
    phone: '0918246772',
    role: UserRole.OWNER,
    verificationStatus: VerificationStatus.APPROVED,
    city: 'Ho Chi Minh City',
    address: 'Thao Dien Ward, Thu Duc City',
    country: 'Vietnam',
    ownerCompanyName: 'Thao Dien Auto Club',
    ownerTaxId: 'SEED-TDAC-18402',
    ownerBankAccountName: 'NGUYEN THUY LINH',
    ownerBankAccountNumber: '1840207314',
    ownerBankCode: 'TCB',
  },
  {
    id: ids.owners[2],
    email: 'quang.le@example.com',
    firstName: 'Quang',
    lastName: 'Le',
    phone: '0936739120',
    role: UserRole.OWNER,
    verificationStatus: VerificationStatus.APPROVED,
    city: 'Ho Chi Minh City',
    address: 'Tan Phu Ward, District 7',
    country: 'Vietnam',
    ownerCompanyName: 'Southside Signature Cars',
    ownerTaxId: 'SEED-SSC-63910',
    ownerBankAccountName: 'LE MINH QUANG',
    ownerBankAccountNumber: '6391052808',
    ownerBankCode: 'ACB',
  },
  {
    id: ids.owners[3],
    email: 'anh.vu@example.com',
    firstName: 'Anh',
    lastName: 'Vu',
    phone: '0987062145',
    role: UserRole.OWNER,
    verificationStatus: VerificationStatus.PENDING,
    city: 'Ho Chi Minh City',
    address: 'Ward 22, Binh Thanh District',
    country: 'Vietnam',
    ownerCompanyName: 'Anh Vu Private Host',
  },
  ...[
    ['mai.pham@example.com', 'Mai', 'Pham', '0908421506'],
    ['duc.hoang@example.com', 'Duc', 'Hoang', '0938217440'],
    ['thao.vo@example.com', 'Thao', 'Vo', '0917442038'],
    ['khanh.do@example.com', 'Khanh', 'Do', '0983129751'],
    ['bao.nguyen@example.com', 'Bao', 'Nguyen', '0906673815'],
    ['vy.le@example.com', 'Vy', 'Le', '0975134082'],
    ['nam.tran@example.com', 'Nam', 'Tran', '0924831970'],
  ].map(([email, firstName, lastName, phone], index) => ({
    id: ids.customers[index],
    email,
    firstName,
    lastName,
    phone,
    role: UserRole.CUSTOMER,
    verificationStatus:
      index < 5
        ? VerificationStatus.APPROVED
        : index === 5
          ? VerificationStatus.PENDING
          : VerificationStatus.REJECTED,
    city: 'Ho Chi Minh City',
    address: ['District 3', 'Phu Nhuan District', 'Thu Duc City', 'District 7', 'Binh Thanh District', 'District 10', 'Tan Binh District'][index],
    country: 'Vietnam',
    customerLicenseNumber: `B2-SEED-${12084 + index * 731}`,
    customerLicenseExpiry: dateFromNow(600 + index * 55),
    customerDateOfBirth: new Date(1992 + index, (index * 2) % 12, 5 + index * 2),
  })),
];

const carBlueprints = [
  {
    owner: 0,
    name: 'Mercedes-Benz E 300 AMG', brand: 'Mercedes-Benz', model: 'E 300 AMG', year: 2024,
    plate: '51K-728.41', color: 'Polar White', transmission: 'Automatic', fuelType: 'Gasoline', seats: 5,
    price: 2_850_000, weekly: 18_200_000, deposit: 20_000_000, category: 'Executive Sedan', location: 'Nguyen Hue · District 1', image: '/images/car1.png',
    description: 'A quiet executive sedan with a 360° camera, wireless phone integration, rear privacy shades, and a calm highway ride. Best suited to airport transfers and two-to-five day business trips. Delivered clean with at least 70% fuel.',
  },
  {
    owner: 1,
    name: 'BMW 520i M Sport', brand: 'BMW', model: '520i M Sport', year: 2024,
    plate: '51L-305.26', color: 'Black Sapphire', transmission: 'Automatic', fuelType: 'Gasoline', seats: 5,
    price: 2_650_000, weekly: 16_900_000, deposit: 20_000_000, category: 'Executive Sedan', location: 'Thao Dien · Thu Duc', image: '/images/car2.png',
    description: 'Balanced for city use with supportive seats, a clean cabin, adaptive lighting, and predictable parking dimensions. The owner includes a USB-C cable, toll tag, and a short vehicle handover checklist.',
  },
  {
    owner: 2,
    name: 'Audi A6 45 TFSI', brand: 'Audi', model: 'A6 45 TFSI', year: 2023,
    plate: '51H-918.07', color: 'Daytona Grey', transmission: 'Automatic', fuelType: 'Gasoline', seats: 5,
    price: 2_550_000, weekly: 16_100_000, deposit: 18_000_000, category: 'Executive Sedan', location: 'Phu My Hung · District 7', image: '/images/car3.png',
    description: 'Comfort-first A6 with a composed ride, strong air conditioning, digital cockpit, and generous rear space. A sensible choice for client visits, family dinners, and longer cross-city days.',
  },
  {
    owner: 0,
    name: 'Mercedes-Benz GLC 300 4MATIC', brand: 'Mercedes-Benz', model: 'GLC 300 4MATIC', year: 2024,
    plate: '51K-442.19', color: 'Obsidian Black', transmission: 'Automatic', fuelType: 'Gasoline', seats: 5,
    price: 3_250_000, weekly: 20_500_000, deposit: 25_000_000, category: 'Luxury SUV', location: 'Tan Son Nhat · Tan Binh', image: '/images/car4.png',
    description: 'Premium SUV with easy luggage loading, elevated seating, surround-view parking camera, and comfortable second-row space. Often booked for airport arrivals, weekend resorts, and small-family travel.',
  },
  {
    owner: 1,
    name: 'BMW X3 xDrive20i', brand: 'BMW', model: 'X3 xDrive20i', year: 2023,
    plate: '51K-175.63', color: 'Alpine White', transmission: 'Automatic', fuelType: 'Gasoline', seats: 5,
    price: 2_950_000, weekly: 18_700_000, deposit: 22_000_000, category: 'Luxury SUV', location: 'Landmark 81 · Binh Thanh', image: '/images/car1.png',
    description: 'A practical premium SUV with useful cargo space, a confident driving position, and a straightforward cabin. The owner keeps a child-seat anchor guide and compact umbrella in the luggage area.',
  },
  {
    owner: 2,
    name: 'Volvo XC60 Recharge', brand: 'Volvo', model: 'XC60 Recharge', year: 2024,
    plate: '51L-681.42', color: 'Denim Blue', transmission: 'Automatic', fuelType: 'Plug-in Hybrid', seats: 5,
    price: 3_400_000, weekly: 21_400_000, deposit: 25_000_000, category: 'Electric & Hybrid', location: 'Sala · Thu Duc', image: '/images/car2.png',
    description: 'Quiet plug-in hybrid SUV with supportive seats, strong safety equipment, and a refined cabin. Ideal for renters who want SUV comfort without giving up smooth low-speed electric driving.',
  },
  {
    owner: 1,
    name: 'Porsche Macan', brand: 'Porsche', model: 'Macan', year: 2023,
    plate: '51K-907.34', color: 'Jet Black', transmission: 'Automatic', fuelType: 'Gasoline', seats: 5,
    price: 4_500_000, weekly: 28_000_000, deposit: 35_000_000, category: 'Performance', location: 'Thao Dien · Thu Duc', image: '/images/car3.png',
    description: 'Driver-focused compact SUV with a firm, controlled ride and responsive steering. Submitted for marketplace review with recent maintenance records and a fresh tyre inspection.',
    status: CarStatus.PENDING,
    verificationStatus: VerificationStatus.PENDING,
  },
  {
    owner: 0,
    name: 'Mercedes-Benz C 300 AMG', brand: 'Mercedes-Benz', model: 'C 300 AMG', year: 2023,
    plate: '51K-263.58', color: 'Spectral Blue', transmission: 'Automatic', fuelType: 'Gasoline', seats: 5,
    price: 2_350_000, weekly: 14_900_000, deposit: 18_000_000, category: 'Performance', location: 'Nguyen Hue · District 1', image: '/images/car4.png',
    description: 'Compact premium sedan with a modern cabin, easy city dimensions, and a more responsive setup than the larger executive cars. Good for couples and solo business travel.',
  },
  {
    owner: 1,
    name: 'BMW 330i M Sport', brand: 'BMW', model: '330i M Sport', year: 2024,
    plate: '51L-114.86', color: 'Portimao Blue', transmission: 'Automatic', fuelType: 'Gasoline', seats: 5,
    price: 2_450_000, weekly: 15_400_000, deposit: 18_000_000, category: 'Performance', location: 'Landmark 81 · Binh Thanh', image: '/images/car1.png',
    description: 'A sharper sedan for renters who still need four doors and a usable rear seat. The owner maintains a documented pre-trip tyre and fuel check for every handover.',
  },
  {
    owner: 2,
    name: 'Audi Q5 45 TFSI', brand: 'Audi', model: 'Q5 45 TFSI', year: 2023,
    plate: '51H-550.92', color: 'Floret Silver', transmission: 'Automatic', fuelType: 'Gasoline', seats: 5,
    price: 3_100_000, weekly: 19_700_000, deposit: 23_000_000, category: 'Luxury SUV', location: 'Phu My Hung · District 7', image: '/images/car2.png',
    description: 'Comfortable five-seat SUV with sensible luggage room and clean highway manners. Frequently used for family weekends and client transport where a sedan feels too low or too tight.',
  },
  {
    owner: 0,
    name: 'Tesla Model 3 Long Range', brand: 'Tesla', model: 'Model 3 Long Range', year: 2024,
    plate: '51E-082.16', color: 'Pearl White', transmission: 'Automatic', fuelType: 'Electric', seats: 5,
    price: 2_750_000, weekly: 17_200_000, deposit: 20_000_000, category: 'Electric & Hybrid', location: 'Sala · Thu Duc', image: '/images/car3.png',
    description: 'Long-range EV with a minimalist cabin and quiet acceleration. The owner provides a charging card, a Type 2 cable, and a short charging guide for first-time EV renters.',
  },
  {
    owner: 2,
    name: 'Volvo S90 Recharge', brand: 'Volvo', model: 'S90 Recharge', year: 2023,
    plate: '51H-731.05', color: 'Vapour Grey', transmission: 'Automatic', fuelType: 'Plug-in Hybrid', seats: 5,
    price: 2_700_000, weekly: 17_000_000, deposit: 20_000_000, category: 'Electric & Hybrid', location: 'Phu My Hung · District 7', image: '/images/car4.png',
    description: 'Review note: the registration image needs a clearer resubmission before this listing can be approved. Vehicle details and pricing are otherwise complete.',
    status: CarStatus.REJECTED,
    verificationStatus: VerificationStatus.REJECTED,
  },
];

async function main() {
  const seedPassword = process.env.SEED_PASSWORD || 'LocalSeed!2026';
  const passwordHash = await bcrypt.hash(seedPassword, 10);

  const categoryIds = new Map<string, string>();
  for (const item of categories) {
    const record = await prisma.category.upsert({
      where: { name: item.name },
      update: { description: item.description },
      create: { id: oid(21 + categoryIds.size), ...item },
    });
    categoryIds.set(item.name, record.id);
  }

  const locationIds = new Map<string, string>();
  for (const item of locations) {
    const record = await prisma.location.upsert({
      where: { name: item.name },
      update: item,
      create: { id: oid(31 + locationIds.size), ...item },
    });
    locationIds.set(item.name, record.id);
  }

  for (let index = 0; index < people.length; index += 1) {
    const person = people[index];
    const createdAt = dateFromNow(-420 + index * 19, 9);
    await prisma.user.upsert({
      where: { id: person.id },
      update: { ...person, password: passwordHash, isVerified: true, isActive: true },
      create: { ...person, password: passwordHash, isVerified: true, isActive: true, createdAt },
    });
  }

  const kycProfiles = [
    ...ids.owners.map((userId, index) => ({
      userId,
      status: index === 3 ? KYCStatus.PENDING : KYCStatus.APPROVED,
      documentType: index === 3 ? 'PASSPORT' : 'NATIONAL_ID',
      documentNumber: `OWNER-${84021 + index * 7193}`,
      rejectionReason: null as string | null,
      verifiedAt: index === 3 ? null : dateFromNow(-220 + index * 17),
      submittedAt: dateFromNow(index === 3 ? -3 : -240 + index * 17),
    })),
    ...ids.customers.map((userId, index) => ({
      userId,
      status: index < 5 ? KYCStatus.APPROVED : index === 5 ? KYCStatus.PENDING : KYCStatus.REJECTED,
      documentType: index === 4 ? 'PASSPORT' : 'CCCD',
      documentNumber: `CUST-${29041 + index * 3811}`,
      rejectionReason: index === 6 ? 'The face photo is too dark to compare with the identity document. Upload a clearer front-facing image.' : null,
      verifiedAt: index < 5 ? dateFromNow(-160 + index * 13) : null,
      submittedAt: dateFromNow(index === 5 ? -2 : index === 6 ? -6 : -180 + index * 13),
    })),
  ];

  for (let index = 0; index < kycProfiles.length; index += 1) {
    const profile = kycProfiles[index];
    await prisma.kYC.upsert({
      where: { userId: profile.userId },
      update: profile,
      create: { id: oid(901 + index), ...profile },
    });
  }

  const walletBalances = [18_450_000, 12_880_000, 15_620_000];
  for (let index = 0; index < 3; index += 1) {
    await prisma.wallet.upsert({
      where: { userId: ids.owners[index] },
      update: { balance: walletBalances[index], currency: 'VND' },
      create: { id: oid(951 + index), userId: ids.owners[index], balance: walletBalances[index], currency: 'VND' },
    });
  }

  for (let index = 0; index < carBlueprints.length; index += 1) {
    const blueprint = carBlueprints[index];
    const carId = ids.cars[index];
    const status = blueprint.status ?? CarStatus.APPROVED;
    const verificationStatus = blueprint.verificationStatus ?? VerificationStatus.APPROVED;
    const carData = {
      ownerId: ids.owners[blueprint.owner],
      name: blueprint.name,
      brand: blueprint.brand,
      model: blueprint.model,
      year: blueprint.year,
      licensePlate: blueprint.plate,
      color: blueprint.color,
      transmission: blueprint.transmission,
      fuelType: blueprint.fuelType,
      seatCount: blueprint.seats,
      description: blueprint.description,
      mainImageUrl: blueprint.image,
      imageUrls: [blueprint.image, '/images/car1.png', '/images/car2.png', '/images/car3.png', '/images/car4.png'].filter((value, imageIndex, all) => all.indexOf(value) === imageIndex).slice(0, 3),
      pricePerDay: blueprint.price,
      pricePerHour: money(blueprint.price / 10),
      pricePerWeek: blueprint.weekly,
      pricePerMonth: money(blueprint.weekly * 3.25),
      discountPercentage: index % 5 === 0 ? 5 : 0,
      categoryId: categoryIds.get(blueprint.category)!,
      locationId: locationIds.get(blueprint.location)!,
      insurance: 350_000 + (index % 3) * 50_000,
      depositRequired: blueprint.deposit,
      isAvailable: true,
      status,
      verificationStatus,
      createdAt: dateFromNow(-120 + index * 7),
    };

    await prisma.car.upsert({
      where: { id: carId },
      update: carData,
      create: { id: carId, ...carData },
    });
  }

  const bookingInputs = [
    { customer: 0, car: 0, start: -46, end: -43, status: BookingStatus.COMPLETED, discount: 300_000, note: 'Airport pickup, Terminal 2 arrival.' },
    { customer: 1, car: 1, start: -38, end: -34, status: BookingStatus.COMPLETED, discount: 0, note: 'Client meetings across District 1 and Thu Duc.' },
    { customer: 2, car: 3, start: -30, end: -27, status: BookingStatus.COMPLETED, discount: 500_000, note: 'Family weekend to Ho Tram.' },
    { customer: 3, car: 5, start: -23, end: -20, status: BookingStatus.COMPLETED, discount: 0, note: 'Weekend trip, requested full-charge handover.' },
    { customer: 4, car: 10, start: -17, end: -14, status: BookingStatus.COMPLETED, discount: 250_000, note: 'First EV rental; charging walkthrough requested.' },
    { customer: 0, car: 2, start: -11, end: -9, status: BookingStatus.COMPLETED, discount: 0, note: 'Two-day business rental.' },
    { customer: 5, car: 4, start: 2, end: 5, status: BookingStatus.PENDING, discount: 0, note: 'Pickup after 18:00 if owner approves.' },
    { customer: 1, car: 5, start: 5, end: 8, status: BookingStatus.APPROVED, discount: 400_000, note: 'Owner approved; checkout not completed yet.' },
    { customer: 2, car: 7, start: 10, end: 13, status: BookingStatus.CONFIRMED, discount: 0, note: 'Anniversary weekend reservation.' },
    { customer: 3, car: 8, start: 15, end: 17, status: BookingStatus.CONFIRMED, discount: 200_000, note: 'Morning pickup before 08:30.' },
    { customer: 4, car: 0, start: 20, end: 22, status: BookingStatus.PENDING, discount: 0, note: 'Airport transfer plus two city days.' },
    { customer: 4, car: 9, start: 4, end: 6, status: BookingStatus.REJECTED, discount: 0, note: 'Owner unavailable for requested handover window.' },
    { customer: 5, car: 1, start: -6, end: -4, status: BookingStatus.CANCELLED, discount: 0, note: 'Customer changed travel dates before approval.' },
    { customer: 0, car: 9, start: -1, end: 2, status: BookingStatus.CONFIRMED, discount: 350_000, note: 'Current rental; return scheduled for late afternoon.' },
  ];

  const bookingRecords: Array<{ id: string; ownerId: string; customerId: string; carId: string; total: number; status: BookingStatus; start: Date; end: Date }> = [];

  for (let index = 0; index < bookingInputs.length; index += 1) {
    const input = bookingInputs[index];
    const car = carBlueprints[input.car];
    const start = dateFromNow(input.start, 9);
    const end = dateFromNow(input.end, 17);
    const days = tripDays(start, end);
    const insurance = 350_000;
    const total = money(car.price * days + insurance - input.discount);
    const record = {
      id: ids.bookings[index],
      customerId: ids.customers[input.customer],
      carId: ids.cars[input.car],
      startDate: start,
      endDate: end,
      pickupLocation: locations.find((location) => location.name === car.location)?.name,
      dropoffLocation: locations.find((location) => location.name === car.location)?.name,
      status: input.status,
      totalPrice: total,
      insurancePrice: insurance,
      depositAmount: car.deposit,
      discountAmount: input.discount,
      notes: input.note,
      createdAt: dateFromNow(Math.min(input.start - 12, -3), 14),
    };

    await prisma.booking.upsert({
      where: { id: record.id },
      update: record,
      create: record,
    });

    bookingRecords.push({
      id: record.id,
      ownerId: ids.owners[car.owner],
      customerId: record.customerId,
      carId: record.carId,
      total,
      status: record.status,
      start,
      end,
    });
  }

  const blockedDates = [
    { id: oid(1001), car: 3, offset: 7, reason: 'Scheduled service appointment' },
    { id: oid(1002), car: 0, offset: 14, reason: 'Owner-reserved date' },
    { id: oid(1003), car: 10, offset: 3, reason: 'Tyre inspection and alignment' },
    { id: oid(1004), car: 2, offset: 11, reason: 'Interior detailing' },
  ];

  for (const block of blockedDates) {
    await prisma.availability.upsert({
      where: { id: block.id },
      update: { carId: ids.cars[block.car], date: dateFromNow(block.offset, 0), isAvailable: false, blockedReason: block.reason },
      create: { id: block.id, carId: ids.cars[block.car], date: dateFromNow(block.offset, 0), isAvailable: false, blockedReason: block.reason },
    });
  }

  const paidBookingIndexes = [0, 1, 2, 3, 4, 5, 8, 9, 13];
  for (let paymentIndex = 0; paymentIndex < paidBookingIndexes.length; paymentIndex += 1) {
    const bookingIndex = paidBookingIndexes[paymentIndex];
    const booking = bookingRecords[bookingIndex];
    await prisma.payment.upsert({
      where: { id: ids.payments[paymentIndex] },
      update: {
        bookingId: booking.id,
        userId: booking.customerId,
        amount: booking.total,
        paymentMethod: 'SANDBOX',
        transactionId: `SEED-TXN-${String(paymentIndex + 1).padStart(4, '0')}`,
        status: PaymentStatus.COMPLETED,
        paidAt: dateFromNow(Math.min(bookingInputs[bookingIndex].start - 2, -1), 16),
      },
      create: {
        id: ids.payments[paymentIndex],
        bookingId: booking.id,
        userId: booking.customerId,
        amount: booking.total,
        paymentMethod: 'SANDBOX',
        transactionId: `SEED-TXN-${String(paymentIndex + 1).padStart(4, '0')}`,
        status: PaymentStatus.COMPLETED,
        paidAt: dateFromNow(Math.min(bookingInputs[bookingIndex].start - 2, -1), 16),
        createdAt: dateFromNow(Math.min(bookingInputs[bookingIndex].start - 3, -2), 15),
      },
    });
  }

  const approvedBooking = bookingRecords[7];
  await prisma.payment.upsert({
    where: { id: ids.payments[9] },
    update: {
      bookingId: approvedBooking.id,
      userId: approvedBooking.customerId,
      amount: approvedBooking.total,
      paymentMethod: 'SANDBOX',
      transactionId: 'SEED-TXN-PENDING-0001',
      status: PaymentStatus.PENDING,
      paidAt: null,
    },
    create: {
      id: ids.payments[9],
      bookingId: approvedBooking.id,
      userId: approvedBooking.customerId,
      amount: approvedBooking.total,
      paymentMethod: 'SANDBOX',
      transactionId: 'SEED-TXN-PENDING-0001',
      status: PaymentStatus.PENDING,
      createdAt: dateFromNow(-1, 12),
    },
  });

  const tripBookingIndexes = [0, 1, 2, 3, 4, 5, 8, 9, 13];
  for (let index = 0; index < tripBookingIndexes.length; index += 1) {
    const bookingIndex = tripBookingIndexes[index];
    const booking = bookingRecords[bookingIndex];
    const input = bookingInputs[bookingIndex];
    const completed = booking.status === BookingStatus.COMPLETED;
    const ongoing = bookingIndex === 13;
    const startOdometer = 12_400 + index * 7_860;
    const distance = 118 + index * 43;

    await prisma.trip.upsert({
      where: { id: ids.trips[index] },
      update: {
        bookingId: booking.id,
        customerId: booking.customerId,
        carId: booking.carId,
        status: completed ? TripStatus.COMPLETED : ongoing ? TripStatus.ONGOING : TripStatus.UPCOMING,
        startOdometer: completed || ongoing ? startOdometer : null,
        endOdometer: completed ? startOdometer + distance : null,
        startFuelLevel: completed || ongoing ? 0.82 - (index % 3) * 0.08 : null,
        endFuelLevel: completed ? 0.48 + (index % 4) * 0.07 : null,
        checkinTime: completed || ongoing ? dateFromNow(input.start, 9) : null,
        checkoutTime: completed ? dateFromNow(input.end, 16) : null,
        pickupNotes: completed || ongoing ? 'Vehicle condition checked with renter. No pre-trip damage noted.' : null,
        dropoffNotes: completed ? (index === 1 ? 'Returned clean. Minor dust on rear floor mat; no charge applied.' : 'Returned on time with no new exterior damage.') : null,
      },
      create: {
        id: ids.trips[index],
        bookingId: booking.id,
        customerId: booking.customerId,
        carId: booking.carId,
        status: completed ? TripStatus.COMPLETED : ongoing ? TripStatus.ONGOING : TripStatus.UPCOMING,
        startOdometer: completed || ongoing ? startOdometer : null,
        endOdometer: completed ? startOdometer + distance : null,
        startFuelLevel: completed || ongoing ? 0.82 - (index % 3) * 0.08 : null,
        endFuelLevel: completed ? 0.48 + (index % 4) * 0.07 : null,
        checkinTime: completed || ongoing ? dateFromNow(input.start, 9) : null,
        checkoutTime: completed ? dateFromNow(input.end, 16) : null,
        pickupNotes: completed || ongoing ? 'Vehicle condition checked with renter. No pre-trip damage noted.' : null,
        dropoffNotes: completed ? (index === 1 ? 'Returned clean. Minor dust on rear floor mat; no charge applied.' : 'Returned on time with no new exterior damage.') : null,
        createdAt: dateFromNow(input.start - 1, 17),
        damageImages: [],
      },
    });
  }

  const reviewContent = [
    { booking: 0, rating: 5, title: 'Quiet, spotless, easy handover', content: 'The E-Class was exactly as described. Airport pickup was coordinated clearly, the cabin was spotless, and the return inspection took less than ten minutes.' },
    { booking: 1, rating: 4, title: 'Great car for a client week', content: 'Very comfortable for meetings around the city. Pickup was about fifteen minutes later than planned, but communication was good and the car itself was excellent.' },
    { booking: 2, rating: 5, title: 'Perfect size for a family weekend', content: 'Enough luggage room for three adults and a child, strong air conditioning, and very easy highway driving. The 360 camera was useful in tighter hotel parking.' },
    { booking: 3, rating: 5, title: 'Relaxing hybrid SUV', content: 'The XC60 was calm and comfortable, especially in city traffic. The owner explained charging in a few minutes and the whole handover felt professional.' },
    { booking: 4, rating: 4, title: 'Good first EV rental', content: 'Range was more than enough for our itinerary and the charging card helped. I would rent it again, though a second charging cable would make longer trips easier.' },
    { booking: 5, rating: 5, title: 'A6 was better than expected', content: 'Clean interior, smooth ride and accurate listing details. Drop-off in District 7 was straightforward and there were no surprise charges.' },
  ];

  for (let index = 0; index < reviewContent.length; index += 1) {
    const item = reviewContent[index];
    const booking = bookingRecords[item.booking];
    await prisma.review.upsert({
      where: { id: ids.reviews[index] },
      update: {
        bookingId: booking.id,
        customerId: booking.customerId,
        carId: booking.carId,
        rating: item.rating,
        title: item.title,
        content: item.content,
        images: [],
        createdAt: dateFromNow(bookingInputs[item.booking].end + 1, 20),
      },
      create: {
        id: ids.reviews[index],
        bookingId: booking.id,
        customerId: booking.customerId,
        carId: booking.carId,
        rating: item.rating,
        title: item.title,
        content: item.content,
        images: [],
        createdAt: dateFromNow(bookingInputs[item.booking].end + 1, 20),
      },
    });
  }

  for (let carIndex = 0; carIndex < carBlueprints.length; carIndex += 1) {
    const carId = ids.cars[carIndex];
    const [reviewStats, completedTrips] = await Promise.all([
      prisma.review.aggregate({ where: { carId }, _avg: { rating: true } }),
      prisma.trip.count({ where: { carId, status: TripStatus.COMPLETED } }),
    ]);
    await prisma.car.update({
      where: { id: carId },
      data: { averageRating: Number((reviewStats._avg.rating ?? 0).toFixed(1)), totalTrips: completedTrips },
    });
  }

  const contractBookingIndexes = [0, 1, 2, 3, 8, 9, 13];
  for (let index = 0; index < contractBookingIndexes.length; index += 1) {
    const bookingIndex = contractBookingIndexes[index];
    const booking = bookingRecords[bookingIndex];
    const completed = booking.status === BookingStatus.COMPLETED;
    await prisma.contract.upsert({
      where: { bookingId: booking.id },
      update: {
        content: 'Elite Drive rental agreement generated for seeded portfolio data. Terms include approved driver use, return condition, fuel or charge expectations, and incident reporting.',
        customerSignedAt: dateFromNow(bookingInputs[bookingIndex].start - 1, 12),
        ownerSignedAt: dateFromNow(bookingInputs[bookingIndex].start - 1, 13),
        status: completed ? 'completed' : 'signed',
      },
      create: {
        id: oid(1101 + index),
        bookingId: booking.id,
        content: 'Elite Drive rental agreement generated for seeded portfolio data. Terms include approved driver use, return condition, fuel or charge expectations, and incident reporting.',
        customerSignedAt: dateFromNow(bookingInputs[bookingIndex].start - 1, 12),
        ownerSignedAt: dateFromNow(bookingInputs[bookingIndex].start - 1, 13),
        status: completed ? 'completed' : 'signed',
        createdAt: dateFromNow(bookingInputs[bookingIndex].start - 2, 11),
      },
    });
  }

  const completedBookings = bookingRecords.filter((booking) => booking.status === BookingStatus.COMPLETED);
  for (let index = 0; index < completedBookings.length; index += 1) {
    const booking = completedBookings[index];
    const ownerShare = money(booking.total * 0.85);
    const ownerIndex = ids.owners.indexOf(booking.ownerId);
    const walletId = oid(951 + ownerIndex);
    const txId = oid(1201 + index);

    await prisma.ownerTransaction.upsert({
      where: { id: txId },
      update: {
        ownerId: booking.ownerId,
        bookingId: booking.id,
        amount: ownerShare,
        type: 'RENTAL_INCOME',
        status: 'completed',
        description: `Rental income · ${carBlueprints[ids.cars.indexOf(booking.carId)].name}`,
        metadata: { bookingId: booking.id, shareRate: 0.85 },
      },
      create: {
        id: txId,
        ownerId: booking.ownerId,
        bookingId: booking.id,
        amount: ownerShare,
        type: 'RENTAL_INCOME',
        status: 'completed',
        description: `Rental income · ${carBlueprints[ids.cars.indexOf(booking.carId)].name}`,
        metadata: { bookingId: booking.id, shareRate: 0.85 },
        createdAt: new Date(booking.end.getTime() + DAY),
      },
    });

    await prisma.walletTransaction.upsert({
      where: { id: oid(1301 + index) },
      update: {
        walletId,
        amount: ownerShare,
        type: 'RENTAL_INCOME',
        description: `Rental income released for booking ${booking.id.slice(-6).toUpperCase()}`,
        metadata: { bookingId: booking.id },
      },
      create: {
        id: oid(1301 + index),
        walletId,
        amount: ownerShare,
        type: 'RENTAL_INCOME',
        description: `Rental income released for booking ${booking.id.slice(-6).toUpperCase()}`,
        metadata: { bookingId: booking.id },
        createdAt: new Date(booking.end.getTime() + DAY),
      },
    });
  }

  const settlementRows = [
    { id: oid(1401), ownerId: ids.owners[0], period: monthKey(-1), earnings: 21_640_000, payouts: 6_000_000, net: 15_640_000, status: SettlementStatus.COMPLETED, processedAt: dateFromNow(-18) },
    { id: oid(1402), ownerId: ids.owners[1], period: monthKey(-1), earnings: 17_980_000, payouts: 5_000_000, net: 12_980_000, status: SettlementStatus.COMPLETED, processedAt: dateFromNow(-17) },
    { id: oid(1403), ownerId: ids.owners[2], period: monthKey(-1), earnings: 19_220_000, payouts: 7_000_000, net: 12_220_000, status: SettlementStatus.COMPLETED, processedAt: dateFromNow(-16) },
    { id: oid(1404), ownerId: ids.owners[0], period: monthKey(0), earnings: 8_460_000, payouts: 0, net: 8_460_000, status: SettlementStatus.PENDING, processedAt: null },
  ];

  for (const row of settlementRows) {
    await prisma.settlement.upsert({
      where: { id: row.id },
      update: {
        ownerId: row.ownerId,
        period: row.period,
        totalEarnings: row.earnings,
        totalPayouts: row.payouts,
        netAmount: row.net,
        status: row.status,
        processedAt: row.processedAt,
      },
      create: {
        id: row.id,
        ownerId: row.ownerId,
        period: row.period,
        totalEarnings: row.earnings,
        totalPayouts: row.payouts,
        netAmount: row.net,
        status: row.status,
        processedAt: row.processedAt,
        createdAt: dateFromNow(row.status === SettlementStatus.COMPLETED ? -25 : -4),
      },
    });
  }

  const promotions = [
    { id: oid(1501), code: 'WEEKEND10', description: '10% off eligible weekend rentals of three days or more.', discountType: 'PERCENTAGE', discountValue: 10, maxUses: 120, usedCount: 37, minBookingAmount: 5_000_000, startDate: dateFromNow(-20), endDate: dateFromNow(45), isActive: true },
    { id: oid(1502), code: 'CITY300', description: '300,000 VND off city rentals above 4,000,000 VND.', discountType: 'FIXED', discountValue: 300_000, maxUses: 80, usedCount: 21, minBookingAmount: 4_000_000, startDate: dateFromNow(-12), endDate: dateFromNow(28), isActive: true },
    { id: oid(1503), code: 'LONGER8', description: '8% off bookings of five days or more on selected approved vehicles.', discountType: 'PERCENTAGE', discountValue: 8, maxUses: 60, usedCount: 14, minBookingAmount: 9_000_000, startDate: dateFromNow(-8), endDate: dateFromNow(60), isActive: true },
    { id: oid(1504), code: 'JULYDRIVE', description: 'Archived seasonal promotion retained for admin history.', discountType: 'PERCENTAGE', discountValue: 12, maxUses: 100, usedCount: 64, minBookingAmount: 6_000_000, startDate: dateFromNow(-70), endDate: dateFromNow(-25), isActive: false },
  ];

  for (const promotion of promotions) {
    await prisma.promotion.upsert({
      where: { code: promotion.code },
      update: promotion,
      create: promotion,
    });
  }

  await prisma.dispute.upsert({
    where: { id: ids.disputes[0] },
    update: {
      bookingId: bookingRecords[1].id,
      initiatedBy: ids.customers[1],
      title: 'Return inspection fee clarification',
      description: 'I wanted to confirm whether the small cleaning note on return would result in a charge. The vehicle was returned on time and there was no new damage.',
      attachments: [],
      status: DisputeStatus.RESOLVED,
      resolution: 'Operations confirmed that no cleaning fee was applied. The return note was informational only.',
      resolvedAt: dateFromNow(-31),
    },
    create: {
      id: ids.disputes[0],
      bookingId: bookingRecords[1].id,
      initiatedBy: ids.customers[1],
      title: 'Return inspection fee clarification',
      description: 'I wanted to confirm whether the small cleaning note on return would result in a charge. The vehicle was returned on time and there was no new damage.',
      attachments: [],
      status: DisputeStatus.RESOLVED,
      resolution: 'Operations confirmed that no cleaning fee was applied. The return note was informational only.',
      resolvedAt: dateFromNow(-31),
      createdAt: dateFromNow(-33),
    },
  });

  await prisma.dispute.upsert({
    where: { id: ids.disputes[1] },
    update: {
      bookingId: null,
      initiatedBy: ids.customers[5],
      title: 'Identity verification review timing',
      description: 'My verification has been pending since yesterday. I have a rental request coming up and want to know whether I need to upload anything else.',
      attachments: [],
      status: DisputeStatus.IN_PROGRESS,
      resolution: null,
      resolvedAt: null,
    },
    create: {
      id: ids.disputes[1],
      bookingId: null,
      initiatedBy: ids.customers[5],
      title: 'Identity verification review timing',
      description: 'My verification has been pending since yesterday. I have a rental request coming up and want to know whether I need to upload anything else.',
      attachments: [],
      status: DisputeStatus.IN_PROGRESS,
      createdAt: dateFromNow(-1, 9),
    },
  });

  const messages = [
    { id: ids.messages[0], disputeId: ids.disputes[0], senderId: ids.customers[1], message: 'The owner mentioned light dust on the rear floor mat. Can you confirm whether this changed the final charge?', createdAt: dateFromNow(-33, 15) },
    { id: ids.messages[1], disputeId: ids.disputes[0], senderId: ids.admin, message: 'We checked the return record. No cleaning fee or damage adjustment was added to this booking.', createdAt: dateFromNow(-32, 11) },
    { id: ids.messages[2], disputeId: ids.disputes[1], senderId: ids.customers[5], message: 'The document images were uploaded yesterday afternoon. Please let me know if another image is required.', createdAt: dateFromNow(-1, 10) },
    { id: ids.messages[3], disputeId: ids.disputes[1], senderId: ids.admin, message: 'Your submission is complete and remains in the review queue. No additional upload is required at this time.', createdAt: dateFromNow(-1, 14) },
  ];

  for (const message of messages) {
    await prisma.disputeMessage.upsert({
      where: { id: message.id },
      update: message,
      create: message,
    });
  }

  console.log('Elite Drive seed complete.');
  console.log(`Admin:  ops@elitedrive.example / ${seedPassword}`);
  console.log(`Owner:  minh.tran@example.com / ${seedPassword}`);
  console.log(`Renter: mai.pham@example.com / ${seedPassword}`);
  console.log('Seed records use fixed ObjectIds, so rerunning updates the same sample dataset instead of duplicating it.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
