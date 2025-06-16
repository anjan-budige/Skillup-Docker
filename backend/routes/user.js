import express from 'express';
import Student from '../models/Student.js';
import Faculty from '../models/Faculty.js';
import Admin from '../models/Admin.js';

const router = express.Router();


router.get('/photo', async (req, res) => {
  const { id, role } = req.query;

  if (!id || !role) {
    return res.status(400).json({ success: false, message: 'Missing id or role' });
  }

  try {
    let user = null;

    if (role === 'Student') {
      user = await Student.findById(id).select('photo');
    } else if (role === 'Faculty') {
      user = await Faculty.findById(id).select('photo');
    } else if (role === 'Admin') {
      user = await Admin.findById(id).select('photo');
    } else {
      return res.status(400).json({ success: false, message: 'Invalid role' });
    }

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    return res.json({
      success: true,
      photo: user.photo || null
    });

  } catch (error) {
    console.error('Error fetching photo:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
