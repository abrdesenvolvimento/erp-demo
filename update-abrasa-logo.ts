import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { companies } from './drizzle/schema';
import { eq } from 'drizzle-orm';

const dbUrl = process.env.DATABASE_URL!;
const pool = mysql.createPool(dbUrl);
const db = drizzle(pool);

const [rows] = await db.select({ id: companies.id, tradeName: companies.tradeName, logoUrl: companies.logoUrl }).from(companies);
console.log('Companies:', rows);

const newLogoUrl = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663140687549/7RkrCeS5KipYf8hkuNqrCk/logo-abrasa-reune-v2_862dd2da.svg';
await db.update(companies).set({ logoUrl: newLogoUrl }).where(eq(companies.id, 2));
console.log('Updated!');

const [updated] = await db.select({ id: companies.id, tradeName: companies.tradeName, logoUrl: companies.logoUrl }).from(companies).where(eq(companies.id, 2));
console.log('New:', updated);

process.exit(0);
