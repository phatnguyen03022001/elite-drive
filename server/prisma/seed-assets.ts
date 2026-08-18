import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const oid = (value: number) => value.toString(16).padStart(24, '0');

const carImages = Array.from({ length: 12 }, (_, index) => ({
  id: oid(301 + index),
  mainImageUrl: `/seed/cars/car-${index + 1}.jpg`,
  imageUrls: [
    `/seed/cars/car-${index + 1}.jpg`,
    `/seed/cars/car-${((index + 3) % 12) + 1}.jpg`,
    `/seed/cars/car-${((index + 7) % 12) + 1}.jpg`,
  ],
}));

const userAvatars = [
  oid(1),
  oid(101),
  oid(102),
  oid(103),
  oid(104),
  oid(201),
  oid(202),
  oid(203),
  oid(204),
  oid(205),
  oid(206),
  oid(207),
].map((id, index) => ({ id, avatar: `/seed/avatars/avt-${index + 1}.png` }));

async function main() {
  await Promise.all(
    carImages.map(({ id, ...data }) =>
      prisma.car.update({ where: { id }, data }),
    ),
  );

  await Promise.all(
    userAvatars.map(({ id, avatar }) =>
      prisma.user.update({ where: { id }, data: { avatar } }),
    ),
  );

  console.log('Seed visual assets linked: 12 unique vehicle images and 12 profile avatars.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
