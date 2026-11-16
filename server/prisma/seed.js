require("dotenv").config();

const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const email = "demo@sweety.com";
  const password = "DemoPass123!";

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      name: "Demo Patient",
      email,
      passwordHash: await bcrypt.hash(password, 12),
    },
  });

  const today = new Date();
  const slots = [
    "MORNING",
    "AFTER_BREAKFAST",
    "AFTER_LUNCH",
    "AFTER_DINNER",
  ];

  let created = 0;

  for (let daysAgo = 0; daysAgo < 45; daysAgo++) {
    const date = new Date(Date.UTC(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() - daysAgo
    ));

    for (let i = 0; i < slots.length; i++) {
      const value = 85 + ((daysAgo * 7 + i * 23) % 90);

      await prisma.reading.upsert({
        where: {
          userId_date_slot: {
            userId: user.id,
            date,
            slot: slots[i],
          },
        },
        update: {},
        create: {
          userId: user.id,
          date,
          slot: slots[i],
          value,
        },
      });

      created++;
    }
  }

  console.log("Demo data ready.");
  console.log(`Email: ${email}`);
  console.log(`Password: ${password}`);
  console.log(`Processed ${created} sample readings.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
