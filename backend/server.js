import express, { json } from 'express';
import { config } from 'dotenv';
import cors from 'cors';
import connectDB from './config/db.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import AdminRoutes from './routes/admin.js';
import FacultyRoutes from './routes/faculty.js';
import StudentRoutes from './routes/student.js';

// Load environment variables
config();

// Connect to database
connectDB();

const app = express();

// CORS Configuration
const allowedOrigin = 'http://localhost:5173';

app.use(cors({
  origin: allowedOrigin,
  credentials: true // Important if you're using cookies or authorization headers
}));

// Middleware
app.use(json());

// Debug middleware to log all requests
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/admin', AdminRoutes);
app.use('/api/faculty', FacultyRoutes);
app.use('/api/student', StudentRoutes);

// Default route
app.get('/', (req, res) => {
  res.send('API is running...');
});

// 404 handler
app.use((req, res) => {
  console.log('404 Not Found:', req.method, req.url);
  res.status(404).json({
    success: false,
    message: `Cannot ${req.method} ${req.url}`
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
