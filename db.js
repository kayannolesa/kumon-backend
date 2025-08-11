import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

pool.on('connect', () => console.log('Connected to PostgreSQL'));
pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL error', err);
  process.exit(1);
});

const db = {
  query: (text, params) => pool.query(text, params),
  pool
};

export default db;
