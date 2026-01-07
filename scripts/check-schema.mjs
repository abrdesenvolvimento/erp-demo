import { drizzle } from "drizzle-orm/mysql2";
import { sql } from "drizzle-orm";
import dotenv from "dotenv";

dotenv.config();

const db = drizzle(process.env.DATABASE_URL);

async function test() {
  try {
    const result = await db.execute(sql.raw(`DESCRIBE products`));
    console.log("Colunas da tabela products:");
    result[0].forEach(col => console.log(`  - ${col.Field}: ${col.Type}`));
  } catch (error) {
    console.error("Erro:", error.message);
  }
  process.exit(0);
}

test();
