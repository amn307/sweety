
require("dotenv").config();

const app = require("./app");
const prisma = require("./lib/prisma");

const PORT = process.env.PORT || 5001;

const server = app.listen(PORT, () => {
  console.log(`Sweety API running on port ${PORT}`);
});

async function shutdown() {
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
