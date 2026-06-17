import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	dialect: 'mysql',
	schema: './src/db/schema/*.ts',
	out: './drizzle',
	casing: 'snake_case',
	dbCredentials: {
		host: process.env.DB_HOST!,
		port: Number(process.env.DB_PORT ?? 3306),
		user: process.env.DB_USER!,
		password: process.env.DB_PASSWORD!,
		database: process.env.NODE_ENV !== 'production' ? process.env.DB_NAME_DEV! :  process.env.DB_NAME!,
	},
});
