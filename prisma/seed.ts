import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const username = 'admin';
  const password = 'admin123';
  const hashedPassword = await bcrypt.hash(password, 10);

  const admin = await prisma.userProfile.upsert({
    where: { username },
    update: {
      password: hashedPassword,
      name: 'System Admin',
      role: Role.ADMIN,
      email: 'admin@tallyerp.com',
      isActive: true,
      pageAccess: ["dashboard", "companies", "company-data", "settings"],
    },
    create: {
      username,
      password: hashedPassword,
      name: 'System Admin',
      role: Role.ADMIN,
      email: 'admin@tallyerp.com',
      isActive: true,
      pageAccess: ["dashboard", "companies", "company-data", "settings"],
    },
  });

  console.log({ admin });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
