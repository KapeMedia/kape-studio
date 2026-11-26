import { connect } from "../src/server/db/connect";

const db = await connect();
console.log("Migrații aplicate.", process.env.DATABASE_URL ? "(Postgres)" : "(PGlite .data/pglite)");
void db;
process.exit(0);
