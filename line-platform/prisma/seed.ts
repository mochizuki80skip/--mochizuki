import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL ?? "admin@example.com";
  const password = process.env.ADMIN_PASSWORD ?? "changeme";
  const passwordHash = await bcrypt.hash(password, 10);

  // super_admin で upsert
  const user = await prisma.adminUser.upsert({
    where: { email },
    create: {
      email,
      passwordHash,
      name: "Admin",
      role: "super_admin",
    },
    update: {
      passwordHash,
      role: "super_admin",
    },
  });

  console.log(`[seed] super_admin user: ${user.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
