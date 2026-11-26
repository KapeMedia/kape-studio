import { connect } from "../src/server/db/connect";
import { seedDatabase } from "../src/server/db/seed";

const db = await connect();
const res = await seedDatabase(db);
console.log("Seed gata:", res);
process.exit(0);
