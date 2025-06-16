import { Router } from 'express';
import { config } from 'dotenv';
import Student from '../models/Student.js';
import Faculty from '../models/Faculty.js';
import Admin from '../models/Admin.js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import process from 'process';


config();

const router = Router();


const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
  }

  try {
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET is not defined in environment variables');
    }
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.user = verified;
    next();
  } catch {
    res.status(403).json({ success: false, message: 'Invalid token.' });
  }
};


const createHashedSession = (userData) => {
  const sessionData = {
    id: userData._id,
    role: userData.role,
    timestamp: Date.now()
  };
  
  
  const hash = crypto
    .createHmac('sha256', process.env.JWT_SECRET)
    .update(JSON.stringify(sessionData))
    .digest('hex');
    
  return { hash, sessionData };
};




router.post('/student/register', async (req, res) => {
  try {
    const { firstName, lastName, email, username, password, rollNumber, department } = req.body;

    
    const existingStudent = await Student.findOne({ 
      $or: [{ email }, { username }, { rollNumber }] 
    });
    if (existingStudent) {
      return res.status(400).json({ message: 'Email, username, or roll number already exists' });
    }

    
    const student = new Student({
      firstName,
      lastName,
      email,
      username: username.toUpperCase(),
      password,
      rollNumber: rollNumber.toUpperCase(),
      department
    });

    await student.save();

    
    const { hash } = createHashedSession({
      _id: student._id,
      role: 'Student'
    });

    
    const token = jwt.sign(
      { 
        id: student._id,
        role: 'Student',
        sessionHash: hash
      },
      process.env.JWT_SECRET || 'fake-secret-key',
      { expiresIn: '1h' }
    );

    res.status(201).json({
      message: 'Registration successful! Please sign in to continue.',
      token,
      user: {
        id: student._id,
        studentId: student.studentId,
        firstName: student.firstName,
        lastName: student.lastName,
        email: student.email,
        rollNumber: student.rollNumber,
        department: student.department,
        role: 'Student'
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});




router.post('/faculty/register', async (req, res) => {
  try {
    const { firstName, lastName, email, username, password, department } = req.body;

    
    const existingFaculty = await Faculty.findOne({ 
      $or: [{ email }, { username }] 
    });
    if (existingFaculty) {
      return res.status(400).json({ message: 'Email or username already exists' });
    }

    
    const faculty = new Faculty({
      firstName,
      lastName,
      email,
      username,
      password,
      department
    });

    await faculty.save();

    
    const { hash } = createHashedSession({
      _id: faculty._id,
      role: 'Faculty'
    });

    
    const token = jwt.sign(
      { 
        id: faculty._id,
        role: 'Faculty',
        sessionHash: hash
      },
      process.env.JWT_SECRET || 'fake-secret-key',
      { expiresIn: '1h' }
    );

    res.status(201).json({
      message: 'Registration successful! Please sign in to continue.',
      token,
      user: {
        id: faculty._id,
        facultyId: faculty.facultyId,
        firstName: faculty.firstName,
        lastName: faculty.lastName,
        email: faculty.email,
        username: faculty.username,
        department: faculty.department,
        role: 'Faculty'
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});




router.post('/admin/register', async (req, res) => {
  try {
    const { firstName, lastName, email, username, password } = req.body;

    
    const existingAdmin = await Admin.findOne({ 
      $or: [{ email }, { username }] 
    });
    if (existingAdmin) {
      return res.status(400).json({ message: 'Email or username already exists' });
    }

    
    const admin = new Admin({
      firstName,
      lastName,
      email,
      username,
      password
    });

    await admin.save();

    
    const token = jwt.sign(
      { id: admin._id, adminId: admin.adminId, role: 'Admin' },
      process.env.JWT_SECRET || 'fake-secret-key',
      { expiresIn: '1h' }
    );

    res.status(201).json({
      message: 'Registration successful! Please sign in to continue.',
      token,
      user: {
        id: admin._id,
        adminId: admin.adminId,
        firstName: admin.firstName,
        lastName: admin.lastName,
        email: admin.email,
        username: admin.username,
        role: 'Admin'
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});




router.post('/student/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    
    const student = await Student.findOne({
      username: { $regex: new RegExp(`^${username}$`, 'i') }
    });

    if (!student) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    
    const isMatch = await student.matchPassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    
    const { hash } = createHashedSession({
      _id: student._id,
      role: 'Student'
    });

    
    const token = jwt.sign(
      { 
        id: student._id,
        role: 'Student',
        sessionHash: hash
      },
      process.env.JWT_SECRET || 'fake-secret-key',
      { expiresIn: '1h' }
    );

    res.json({
      message: 'Login successful! Welcome back.',
      token,
      user: {
        id: student._id,
        studentId: student.studentId,
        firstName: student.firstName,
        lastName: student.lastName,
        email: student.email,
        rollNumber: student.rollNumber,
        department: student.department,
        role: 'Student'
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});




router.post('/faculty/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    
    const faculty = await Faculty.findOne({ 
      username: { $regex: new RegExp(`^${username}$`, 'i') }
    });
    if (!faculty) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    
    const isMatch = await faculty.matchPassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    
    const { hash } = createHashedSession({
      _id: faculty._id,
      role: 'Faculty'
    });

    
    const token = jwt.sign(
      { 
        id: faculty._id,
        role: 'Faculty',
        sessionHash: hash
      },
      process.env.JWT_SECRET || 'fake-secret-key',
      { expiresIn: '1h' }
    );

    res.json({
      message: 'Login successful! Welcome back.',
      token,
      user: {
        id: faculty._id,
        facultyId: faculty.facultyId,
        firstName: faculty.firstName,
        lastName: faculty.lastName,
        email: faculty.email,
        username: faculty.username,
        department: faculty.department,
        role: 'Faculty'
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});




router.post('/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    
    const admin = await Admin.findOne({ 
      username: { $regex: new RegExp(`^${username}$`, 'i') }
    });
    if (!admin) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    
    const isMatch = await admin.matchPassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    
    const token = jwt.sign(
      { id: admin._id, adminId: admin.adminId, role: 'Admin' },
      process.env.JWT_SECRET || 'fake-secret-key',
      { expiresIn: '1h' }
    );

    res.json({
      message: 'Login successful! Welcome back.',
      token,
      user: {
        id: admin._id,
        adminId: admin.adminId,
        firstName: admin.firstName,
        lastName: admin.lastName,
        email: admin.email,
        username: admin.username,
        role: 'Admin'
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});




router.post('/faculty/test-create', async (req, res) => {
  try {
    const testFaculty = {
      firstName: 'Test',
      lastName: 'Faculty',
      email: 'test.faculty@example.com',
      username: 'Sindhura',
      password: 'password123',
      department: 'Computer Science'
    };

    
    const existingFaculty = await Faculty.findOne({ 
      $or: [{ email: testFaculty.email }, { username: testFaculty.username }] 
    });
    
    if (existingFaculty) {
      return res.status(400).json({ 
        message: 'Test faculty already exists',
        faculty: {
          id: existingFaculty._id,
          facultyId: existingFaculty.facultyId,
          username: existingFaculty.username,
          email: existingFaculty.email
        }
      });
    }

    
    const faculty = new Faculty(testFaculty);
    await faculty.save();

    res.status(201).json({
      message: 'Test faculty created successfully',
      faculty: {
        id: faculty._id,
        facultyId: faculty.facultyId,
        username: faculty.username,
        email: faculty.email
      }
    });
  } catch (error) {
    console.error('Test faculty creation error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});


router.post('/user-details', authenticateToken, async (req, res) => {
  
  try {
    const { role, userId } = req.body;

    if (!role || !userId) {
      console.log('Missing role or userId');
      return res.status(400).json({
        success: false,
        message: 'Role and userId are required'
      });
    }

    let user;
    switch (role.toLowerCase()) {
      case 'admin':
        user = await Admin.findById(userId).select('-password');
        break;
      case 'faculty':
        user = await Faculty.findById(userId).select('-password');
        break;
      case 'student':
        user = await Student.findById(userId).select('-password');
        break;
      default:
        console.log('Invalid role:', role);
        return res.status(400).json({
          success: false,
          message: 'Invalid role'
        });
    }

    if (!user) {
      console.log('User not found');
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Error fetching user details:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user details',
      error: error.message
    });
  }
});




router.put('/update-profile', authenticateToken, async (req, res) => {
  try {
    const { firstName, lastName, email, photo, department } = req.body;
    const { role, id } = req.user;

    let user;
    switch (role.toLowerCase()) {
      case 'admin':
        user = await Admin.findById(id);
        break;
      case 'faculty':
        user = await Faculty.findById(id);
        break;
      case 'student':
        user = await Student.findById(id);
        break;
      default:
        return res.status(400).json({ success: false, message: 'Invalid role' });
    }

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    
    user.firstName = firstName;
    user.lastName = lastName;
    user.email = email;
    if (photo) user.photo = photo;
    if (role.toLowerCase() === 'faculty' && department) user.department = department;

    await user.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        photo: user.photo,
        department: user.department,
        role: role
      }
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ success: false, message: 'Error updating profile', error: error.message });
  }
});




router.put('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const { role, id } = req.user;

    let user;
    switch (role.toLowerCase()) {
      case 'admin':
        user = await Admin.findById(id);
        break;
      case 'faculty':
        user = await Faculty.findById(id);
        break;
      case 'student':
        user = await Student.findById(id);
        break;
      default:
        return res.status(400).json({ success: false, message: 'Invalid role' });
    }

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }

    
    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ success: false, message: 'Error changing password', error: error.message });
  }
});

export default router;