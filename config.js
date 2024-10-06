require('dotenv').config();

const DB_HOST = process.env.DATABASE_HOST || "localhost"
const DB_USER = process.env.DATABASE_USER || "root"
const DB_PASSWORD = process.env.DATABASE_PASSWORD || "Oneway64.77"
const DB_NAME = process.env.DATABASE_NAME || "db_kingBarberApp"
const DB_PORT = process.env.DB_PORT || 5432

// Cargar las variables de entorno

module.exports = {
  host: DB_HOST,
  username: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  port: DB_PORT,
};