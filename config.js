require('dotenv').config();

const DB_HOST = process.env.DATABASE_HOST || "localhost"
const DB_USER = process.env.DATABASE_USER || "root"
const DB_PASSWORD = process.env.DATABASE_PASSWORD || "Oneway64.77"
const DB_NAME = process.env.DATABASE_NAME || "db_kingBarberApp"
const DB_PORT = process.env.DB_PORT || 5432

// Cargar las variables de entorno

export const host = DB_HOST;
export const username = DB_USER;
export const password = DB_PASSWORD;
export const database = DB_NAME;
export const port = DB_PORT;
