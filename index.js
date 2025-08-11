import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import db from './db.js';

import authRoutes from './routes/auth.js';
import studentRoutes from './routes/students.js';
import guardianRoutes from './routes/guardians.js';
import scanRoutes from './routes/scans.js';
import templateRoutes from './routes/templates.js';
import messageRoutes from './routes/messages.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// CORS
app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true
  })
);

// Parsers
app.use(cookieParser());
app.use(express.json());

// Health
app.get('/', (req, res) => {
  res.send('Kumon API is running!');
});

// Routes
app.use('/auth', authRoutes);
app.use('/students', studentRoutes);
app.use('/guardians', guardianRoutes);
app.use('/scan', scanRoutes);
app.use('/templates', templateRoutes);
app.use('/messages', messageRoutes);

// 404
app.use((req, res) => {
  res.status(404).json({ error: `Cannot ${req.method} ${req.originalUrl}` });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({ error: 'Internal Server Error', details: err.message });
});

app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});
