
const dotenv = require("dotenv");

dotenv.config({ path: ".env.test", override: true });

if (!process.env.DATABASE_URL?.includes("/sweety_test?")) {
  throw new Error("Tests must use the sweety_test database.");
}
