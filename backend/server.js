import express, { json } from 'express';
import { config } from 'dotenv';
import cors from 'cors';
import connectDB from './config/db.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import AdminRoutes from './routes/admin.js';
import FacultyRoutes from './routes/faculty.js';
import StudentRoutes from './routes/student.js';
import UploadRoutes from './routes/upload.js';
import deleteRoute from './routes/delete-photo.js';
config();
connectDB();

const app = express();


const allowedOrigin = ['http://localhost:5173', 'http://192.168.150.175:5173', 'https://skillupnew.netlify.app/', 'https://skillupnew.innovlabs.tech/'];

app.use(cors({
  origin: allowedOrigin,
  credentials: true 
}));


app.use(json());


app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});


app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/admin', AdminRoutes);
app.use('/api/faculty', FacultyRoutes);
app.use('/api/student', StudentRoutes);
app.use('/api/upload', UploadRoutes);
app.use('/api/delete-photo', deleteRoute);

app.use('/uploads', express.static('uploads'));


app.get('/', (req, res) => {
  res.send('API is running...');
});


app.use((req, res) => {
  console.log('404 Not Found:', req.method, req.url);
  res.status(404).json({
    success: false,
    message: `Cannot ${req.method} ${req.url}`
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
