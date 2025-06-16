import express from 'express';
import jwt from 'jsonwebtoken'; 
import Admin from '../models/Admin.js';
import Student from '../models/Student.js';
import Faculty from '../models/Faculty.js';
import Task from '../models/Task.js';
import Submission from '../models/Submission.js';
import Course from '../models/Course.js';  
import Batch from '../models/Batch.js';
import Setting from '../models/Settings.js';
import Grade from '../models/Grade.js';


const router = express.Router();









router.get('/fetch', async (req, res) => {
  try {
    
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'Access denied.' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'Admin') return res.status(403).json({ success: false, message: 'Forbidden.' });
    const adminUser = await Admin.findById(decoded.id);
    if (!adminUser) return res.status(404).json({ success: false, message: 'Admin user not found.' });

    
    const totalStudents = await Student.countDocuments();
    const totalFaculty = await Faculty.countDocuments();
    const now = new Date();
    const activeTasks = await Task.countDocuments({
      publishDate: { $lte: now },
      dueDate: { $gte: now },
    });

    
    const monthlyStats = [];
    for (let month = 1; month <= 12; month++) {
      const startDate = new Date(new Date().getFullYear(), month - 1, 1);
      const endDate = new Date(new Date().getFullYear(), month, 0);

      const [monthlyTasks, monthlyStudents, monthlyFaculty] = await Promise.all([
        Task.countDocuments({
          createdAt: { $gte: startDate, $lte: endDate }
        }),
        Student.countDocuments({
          createdAt: { $gte: startDate, $lte: endDate }
        }),
        Faculty.countDocuments({
          createdAt: { $gte: startDate, $lte: endDate }
        })
      ]);

      monthlyStats.push({
        month,
        tasks: monthlyTasks,
        students: monthlyStudents,
        faculty: monthlyFaculty
      });
    }

    
    const totalPossibleSubmissions = await Grade.countDocuments();
    const totalCompletedSubmissions = await Grade.countDocuments({ status: 'Graded' });
    const completionRate = totalPossibleSubmissions > 0 
      ? ((totalCompletedSubmissions / totalPossibleSubmissions) * 100).toFixed(1)
      : 0;

    
    let topStudents = await Grade.aggregate([
      { $match: { grade: { $exists: true, $ne: null } } },
      {
        $group: {
          _id: '$student',
          totalScore: { $sum: '$grade' },
          tasksCompleted: { $sum: 1 }
        }
      },
      { $sort: { totalScore: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'students', localField: '_id', foreignField: '_id', as: 'studentInfo' } },
      { $unwind: '$studentInfo' },
      {
        $project: {
          _id: 0,
          studentId: '$studentInfo._id',
          name: { $concat: ['$studentInfo.firstName', ' ', '$studentInfo.lastName'] },
          photo: '$studentInfo.photo',
          totalScore: 1,
          tasksCompleted: 1
        }
      }
    ]);

    if (topStudents.length < 5) {
      const additionalStudents = await Student.find({ _id: { $nin: topStudents.map(s => s.studentId) } })
        .limit(5 - topStudents.length)
        .select('_id firstName lastName photo').lean();
      topStudents = [...topStudents, ...additionalStudents.map(s => ({
        studentId: s._id,
        name: `${s.firstName} ${s.lastName}`,
        photo: s.photo || '',
        totalScore: 0,
        tasksCompleted: 0
      }))];
    }

    
    let topFaculty = await Task.aggregate([
      { $group: { _id: '$createdBy', tasksCreated: { $sum: 1 } } },
      { $sort: { tasksCreated: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'faculties', localField: '_id', foreignField: '_id', as: 'facultyInfo' } },
      { $unwind: '$facultyInfo' },
      { $project: { _id: 0, facultyId: '$facultyInfo._id', name: { $concat: ['$facultyInfo.firstName', ' ', '$facultyInfo.lastName'] }, photo: '$facultyInfo.photo', department: '$facultyInfo.department', tasksCreated: 1 } }
    ]);
    
    if (topFaculty.length < 5) {
      const additionalFaculty = await Faculty.find({ _id: { $nin: topFaculty.map(f => f.facultyId) }})
        .limit(5 - topFaculty.length)
        .select('_id firstName lastName photo department').lean();
      topFaculty = [...topFaculty, ...additionalFaculty.map(f => ({
        facultyId: f._id,
        name: `${f.firstName} ${f.lastName}`,
        photo: f.photo || '',
        department: f.department || 'N/A',
        tasksCreated: 0
      }))];
    }

    
    res.json({
      success: true,
      data: {
        kpis: {
          totalStudents,
          totalFaculty,
          activeTasks,
          completionRate: `${completionRate}%`,
        },
        monthlyStats,
        topStudents,
        topFaculty,
      }
    });

  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(403).json({ success: false, message: 'Invalid token.' });
    }
    console.error('Error fetching admin dashboard stats:', error);
    res.status(500).json({ success: false, message: 'Server error while fetching dashboard data.' });
  }
});


const authenticateAdmin = async (req, res, next) => {
  try {
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];
      if (!token) return res.status(401).json({ success: false, message: 'Access denied.' });

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.role !== 'Admin') return res.status(403).json({ success: false, message: 'Forbidden.' });
      
      
      const admin = await Admin.findById(decoded.id);
      if (!admin) return res.status(404).json({ success: false, message: 'Admin user not found.' });
      
      req.user = admin; 
      next();
  } catch (error) {
      return res.status(401).json({ success: false, message: 'Invalid token.' });
  }
};




router.post('/faculty/add', authenticateAdmin, async (req, res) => {
  try {
      const { firstName, lastName, email, username, password, department } = req.body;
      if (!firstName || !lastName || !email || !username || !password || !department) {
          return res.status(400).json({ success: false, message: 'Please provide all required fields.' });
      }
      const facultyExists = await Faculty.findOne({ $or: [{ email }, { username }] });
      if (facultyExists) {
          return res.status(409).json({ success: false, message: 'Faculty with this email or username already exists.' });
      }
      const newFaculty = new Faculty({ firstName, lastName, email, username, password, department });
      const savedFaculty = await newFaculty.save();
      const facultyResponse = savedFaculty.toObject();
      delete facultyResponse.password;
      res.status(201).json({ success: true, message: 'Faculty created successfully.', data: facultyResponse });
  } catch (error) {
      res.status(500).json({ success: false, message: 'Server error while adding faculty.' });
  }
});







router.get('/faculty/all', authenticateAdmin, async (req, res) => {
  try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const search = req.query.search || '';
      const sortBy = req.query.sortBy || 'createdAt';
      const sortOrder = req.query.sortOrder === 'desc' ? -1 : 1;

      const searchQuery = search ? {
          $or: [
              { firstName: { $regex: search, $options: 'i' } },
              { lastName: { $regex: search, $options: 'i' } },
              { email: { $regex: search, $options: 'i' } },
              { department: { $regex: search, $options: 'i' } }
          ]
      } : {};

      const totalFaculty = await Faculty.countDocuments(searchQuery);

      const facultyList = await Faculty.aggregate([
          
          { $match: searchQuery },

          
          { $sort: { [sortBy]: sortOrder } },
          { $skip: (page - 1) * limit },
          { $limit: limit },

          
          {
              $lookup: {
                  from: 'courses', 
                  let: { faculty_id: '$_id' }, 
                  pipeline: [
                      
                      {
                          $match: {
                              
                              $expr: {
                                  
                                  $in: ['$$faculty_id', '$faculty']
                              }
                          }
                      },
                      
                      {
                          $project: {
                              _id: 0,
                              title: 1
                          }
                      }
                  ],
                  as: 'coursesTaught' 
              }
          },
          
          
          {
              $project: {
                  _id: 1,
                  facultyId: 1,
                  firstName: 1,
                  lastName: 1,
                  email: 1,
                  username: 1,
                  department: 1,
                  photo: 1,
                  createdAt: 1,
                  
                  courses: '$coursesTaught.title'
              }
          }
      ]);

      res.json({
          success: true,
          data: facultyList,
          pagination: {
              total: totalFaculty,
              page,
              totalPages: Math.ceil(totalFaculty / limit)
          }
      });
  } catch (error) {
      console.error("Error fetching faculty list:", error);
      res.status(500).json({ success: false, message: 'Server error fetching faculty list.' });
  }
});




router.put('/faculty/update/:id', authenticateAdmin, async (req, res) => {
  try {
      const { firstName, lastName, email, username, department, isActive } = req.body;
      const faculty = await Faculty.findById(req.params.id);

      if (!faculty) {
          return res.status(404).json({ success: false, message: 'Faculty not found.' });
      }

      
      if (email && email !== faculty.email) {
          const exists = await Faculty.findOne({ email });
          if (exists) return res.status(409).json({ success: false, message: 'Email already in use.' });
      }
      if (username && username !== faculty.username) {
          const exists = await Faculty.findOne({ username });
          if (exists) return res.status(409).json({ success: false, message: 'Username already taken.' });
      }
      
      faculty.firstName = firstName || faculty.firstName;
      faculty.lastName = lastName || faculty.lastName;
      faculty.email = email || faculty.email;
      faculty.username = username || faculty.username;
      faculty.department = department || faculty.department;
      faculty.isActive = isActive !== undefined ? isActive : faculty.isActive;

      const updatedFaculty = await faculty.save();
      res.json({ success: true, message: 'Faculty updated successfully.', data: updatedFaculty });

  } catch (error) {
      res.status(500).json({ success: false, message: 'Server error updating faculty.' });
  }
});





router.delete('/faculty/delete/:id', authenticateAdmin, async (req, res) => {
  try {
      const faculty = await Faculty.findByIdAndDelete(req.params.id);

      if (!faculty) {
          return res.status(404).json({ success: false, message: 'Faculty not found.' });
      }

      res.json({ success: true, message: 'Faculty deleted successfully.' });
  } catch (err) {
      console.error('Error deleting faculty:', err);
      res.status(500).json({ success: false, message: 'Server error deleting faculty.' });
  }
});






router.post('/students/add', authenticateAdmin, async (req, res) => {
    try {
        const { batch: batchIds, ...studentData } = req.body;
        const { firstName, lastName, email, username, password, department, rollNumber } = studentData;
        if (!firstName || !lastName || !email || !username || !password || !department || !rollNumber) {
            return res.status(400).json({ success: false, message: 'All required fields must be filled.' });
        }
        const exists = await Student.findOne({ $or: [{ email }, { username }, { rollNumber }] });
        if (exists) return res.status(409).json({ success: false, message: 'Email, username, or roll number already exists.'});
        
        const newStudent = await Student.create({ ...studentData, batch: [] });

        if (batchIds && batchIds.length > 0) {
            await Batch.updateMany({ _id: { $in: batchIds } }, { $push: { students: newStudent._id } });
            await Course.updateMany({ batches: { $in: batchIds } }, { $push: { students: newStudent._id } });
        }
        
        res.status(201).json({ success: true, data: newStudent });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error adding student.' });
    }
});





router.get('/students/all', authenticateAdmin, async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const search = req.query.search || '';
      const sortBy = req.query.sortBy || 'createdAt';
      const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
  
      const searchQuery = search ? {
        $or: [
          { firstName: { $regex: search, $options: 'i' } },
          { lastName: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { rollNumber: { $regex: search, $options: 'i' } },
          { department: { $regex: search, $options: 'i' } }
        ]
      } : {};
  
      const totalStudents = await Student.countDocuments(searchQuery);
  
      const studentList = await Student.aggregate([
        { $match: searchQuery },
        { $sort: { [sortBy]: sortOrder } },
        { $skip: (page - 1) * limit },
        { $limit: limit },
  
        
        {
          $lookup: {
            from: 'courses',
            let: { student_batches: { $ifNull: ['$batch', []] } }, 
            pipeline: [
              {
                $match: {
                  $expr: {
                    $gt: [
                      {
                        $size: {
                          $setIntersection: [
                            '$$student_batches',
                            { $ifNull: ['$batches', []] }
                          ]
                        }
                      },
                      0
                    ]
                  }
                }
              },
              {
                $project: {
                  _id: 1,
                  title: 1,
                  courseCode: 1
                }
              }
            ],
            as: 'matchedCourses'
          }
        },
  
        
        {
          $project: {
            _id: 1,
            firstName: 1,
            lastName: 1,
            email: 1,
            rollNumber: 1,
            department: 1,
            semester: 1,
            batch: 1, 
            photo: 1,
            username: 1,
            courses: {
              $map: {
                input: '$matchedCourses',
                as: 'course',
                in: {
                  id: '$$course._id',
                  title: '$$course.title',
                  code: '$$course.courseCode'
                }
              }
            }
          }
        }
      ]);
  
      res.json({
        success: true,
        data: studentList,
        pagination: {
          total: totalStudents,
          page,
          totalPages: Math.ceil(totalStudents / limit)
        }
      });
  
    } catch (error) {
      console.error('Error fetching students:', error);
      res.status(500).json({ success: false, message: 'Server error fetching students.' });
    }
  });
  





router.put('/students/update/:id', authenticateAdmin, async (req, res) => {
  try {
      const { firstName, lastName, email, username, department, rollNumber, semester } = req.body;
      const student = await Student.findById(req.params.id);
      if (!student) return res.status(404).json({ success: false, message: 'Student not found.' });

      
      if (email && email !== student.email && await Student.findOne({ email }))
          return res.status(409).json({ success: false, message: 'Email already in use.' });
      if (username && username !== student.username && await Student.findOne({ username }))
          return res.status(409).json({ success: false, message: 'Username already taken.' });
      if (rollNumber && rollNumber !== student.rollNumber && await Student.findOne({ rollNumber }))
          return res.status(409).json({ success: false, message: 'Roll number already exists.' });

      student.firstName = firstName ?? student.firstName;
      student.lastName = lastName ?? student.lastName;
      student.email = email ?? student.email;
      student.username = username ?? student.username;
      student.department = department ?? student.department;
      student.rollNumber = rollNumber ?? student.rollNumber;
      student.semester = semester ?? student.semester;

      const updatedStudent = await student.save();
      res.json({ success: true, data: updatedStudent });
  } catch (error) {
      res.status(500).json({ success: false, message: 'Server error updating student.' });
  }
});







router.delete('/students/delete/:id', authenticateAdmin, async (req, res) => {
  try {
      const studentId = req.params.id;
      const student = await Student.findById(studentId);
      if (!student) {
          return res.status(404).json({ success: false, message: 'Student not found.' });
      }

      const batchId = student.batch;

      
      await Promise.all([
          
          Batch.updateOne({ _id: batchId }, { $pull: { students: studentId } }),
          
          
          Course.updateMany({ batches: batchId }, { $pull: { students: studentId } }),
          
          
          Submission.deleteMany({ student: studentId }),

          
          Grade.deleteMany({ student: studentId }),
          
          
          Student.findByIdAndDelete(studentId)
      ]);

      res.json({ success: true, message: 'Student and all associated data deleted.' });

  } catch (error) {
      console.error("Error deleting student:", error);
      res.status(500).json({ success: false, message: 'Server error deleting student.' });
  }
});


router.get('/batches/all', authenticateAdmin, async (req, res) => {
  try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const search = req.query.search || '';

      const searchQuery = search ? { name: { $regex: search, $options: 'i' } } : {};

      const totalBatches = await Batch.countDocuments(searchQuery);
      
      
      const batches = await Batch.find(searchQuery)
          .populate('students', 'firstName lastName username photo') 
          .select('name academicYear department students createdAt') 
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit);

      res.json({
          success: true, data: batches,
          pagination: { total: totalBatches, page, totalPages: Math.ceil(totalBatches / limit) }
      });
  } catch (error) {
      res.status(500).json({ success: false, message: 'Server error fetching batches.' });
  }
});




router.post('/batches/add', authenticateAdmin, async (req, res) => {
  try {
      const { name, academicYear, students, department } = req.body;
      if (!name || !academicYear || !department) {
          return res.status(400).json({ success: false, message: 'Batch name, year, and department are required.' });
      }
      
      
      const exists = await Batch.findOne({ name, academicYear, department });
      if (exists) return res.status(409).json({ success: false, message: 'A batch with this name, year, and department already exists.' });

      const newBatch = await Batch.create({
          name: name.trim(),
          academicYear: academicYear.trim(),
          department: department.trim(),
          students: students || [],
          createdBy: req.user._id,
          creatorModel: 'Admin'
      });

      
      if (students && students.length > 0) {
          await Student.updateMany(
              { _id: { $in: students } },
              { $addToSet: { batch: newBatch._id } }  
          );
      }

      res.status(201).json({ success: true, data: newBatch, message: 'Batch created successfully' });
  } catch (error) {
      console.error('Error creating batch:', error);
      res.status(500).json({ success: false, message: 'Server error creating batch.' });
  }
});

router.put('/batches/update/:id', authenticateAdmin, async (req, res) => {
  try {
      const { name, academicYear, students, department } = req.body;
      const batchId = req.params.id;

      const batch = await Batch.findById(batchId);
      if (!batch) return res.status(404).json({ success: false, message: 'Batch not found.' });
      
      
      const originalStudentIds = batch.students.map(id => id.toString());
      const newStudentIds = students.map(id => id.toString());
      
      
      const removedStudentIds = originalStudentIds.filter(id => !newStudentIds.includes(id));
      const addedStudentIds = newStudentIds.filter(id => !originalStudentIds.includes(id));

      
      if (removedStudentIds.length > 0) {
          
          await Student.updateMany(
              { _id: { $in: removedStudentIds } },
              { $pull: { batch: batchId } }
          );

          
          const coursesWithThisBatch = await Course.find({ batches: batchId }).select('_id');
          const courseIds = coursesWithThisBatch.map(c => c._id);
          const tasksInTheseCourses = await Task.find({ course: { $in: courseIds } }).select('_id');
          const taskIds = tasksInTheseCourses.map(t => t._id);

          
          if (taskIds.length > 0) {
              await Grade.deleteMany({
                  task: { $in: taskIds },
                  student: { $in: removedStudentIds }
              });
          }
      }

      
      if (addedStudentIds.length > 0) {
          
          await Student.updateMany(
              { _id: { $in: addedStudentIds } },
              { $addToSet: { batch: batchId } }
          );

          
          const coursesWithThisBatch = await Course.find({ batches: batchId }).select('_id');
          const courseIds = coursesWithThisBatch.map(c => c._id);
          const tasksInTheseCourses = await Task.find({ course: { $in: courseIds } }).select('_id');
          const taskIds = tasksInTheseCourses.map(t => t._id);

          
          if (taskIds.length > 0) {
              const newGradePlaceholders = [];
              for (const studentId of addedStudentIds) {
                  for (const taskId of taskIds) {
                      const task = await Task.findById(taskId).select('course');
                      if (task) {
                          newGradePlaceholders.push({
                              task: taskId,
                              student: studentId,
                              course: task.course,
                              status: 'Pending'
                          });
                      }
                  }
              }
              
              if (newGradePlaceholders.length > 0) {
                  await Grade.insertMany(newGradePlaceholders, { ordered: false });
              }
          }
      }
    
      
      const updatedBatch = await Batch.findByIdAndUpdate(
          batchId,
          {
              $set: {
                  name: name ?? batch.name,
                  academicYear: academicYear ?? batch.academicYear,
                  department: department ?? batch.department,
                  students: students ?? batch.students
              }
          },
          { new: true }
      ).populate('students', 'firstName lastName');
        
      res.json({ 
          success: true, 
          data: updatedBatch, 
          message: 'Batch updated successfully. Student enrollments synchronized.' 
      });

  } catch (error) {
      res.status(500).json({ success: false, message: 'Server error updating batch.' });
  }
});






router.delete('/batches/delete/:id', authenticateAdmin, async (req, res) => {
  try {
      const batchId = req.params.id;
      const batch = await Batch.findById(batchId);
      if (!batch) return res.status(404).json({ success: false, message: 'Batch not found.' });

      const studentIdsInBatch = batch.students;

      
      const coursesWithBatch = await Course.find({ batches: batchId });
      const courseIds = coursesWithBatch.map(course => course._id);

      
      const tasks = await Task.find({ course: { $in: courseIds } });
      const taskIds = tasks.map(task => task._id);

      
      await Promise.all([
          
          Student.updateMany(
              { _id: { $in: studentIdsInBatch } }, 
              { $pull: { batch: batchId } }
          ),
          
          Course.updateMany(
              { batches: batchId }, 
              { $pull: { students: { $in: studentIdsInBatch }, batches: batchId } }
          ),
          
          Submission.deleteMany({
              student: { $in: studentIdsInBatch },
              task: { $in: taskIds }
          }),
          
          Grade.deleteMany({
              student: { $in: studentIdsInBatch },
              task: { $in: taskIds }
          }),
          
          Batch.findByIdAndDelete(batchId)
      ]);

      res.json({ success: true, message: 'Batch deleted and all associated data removed.' });
  } catch (error) {
      console.error('Error deleting batch:', error);
      res.status(500).json({ success: false, message: 'Server error deleting batch.' });
  }
});




router.get('/students/search', authenticateAdmin, async (req, res) => {
  try {
      const query = req.query.q || '';
      if (query.length < 2) {
          return res.json({ success: true, data: [] });
      }
      const students = await Student.find({
          $or: [
              { firstName: { $regex: query, $options: 'i' } },
              { lastName: { $regex: query, $options: 'i' } },
              { username: { $regex: query, $options: 'i' } },
              { rollNumber: { $regex: query, $options: 'i' } }
          ]
      }).select('firstName lastName username').limit(10);

      res.json({ success: true, data: students });
  } catch (error) {
      res.status(500).json({ success: false, message: 'Error searching students.' });
  }
});


router.get('/courses/all', authenticateAdmin, async (req, res) => {
  try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 12; 
      const search = req.query.search || '';
      const department = req.query.department || '';
      const batchId = req.query.batchId || '';

      
      let query = {};
      if (search) {
          query.$or = [
              { title: { $regex: search, $options: 'i' } },
              { courseCode: { $regex: search, $options: 'i' } },
          ];
      }
      if (department) {
          query.department = department;
      }
      if (batchId) {
          query.batches = batchId; 
      }

      const totalCourses = await Course.countDocuments(query);
      const courses = await Course.find(query)
          .populate('faculty', 'firstName lastName photo')
          .populate('batches', 'name')
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit);

      res.json({
          success: true,
          data: courses,
          pagination: { total: totalCourses, page, totalPages: Math.ceil(totalCourses / limit) }
      });
  } catch (error) {
      res.status(500).json({ success: false, message: 'Server error fetching courses.' });
  }
});



router.get('/courses/details/:id', authenticateAdmin, async (req, res) => {
  try {
      const course = await Course.findById(req.params.id)
          .populate('faculty', 'firstName lastName photo')
          .populate({
              path: 'batches',
              populate: {
                  path: 'students',
                  select: 'firstName lastName username photo'
              }
          });

      if (!course) return res.status(404).json({ success: false, message: 'Course not found' });
      
      const tasks = await Task.find({ course: course._id }).select('title dueDate');

      res.json({ success: true, data: { course, tasks } });
  } catch (error) {
      res.status(500).json({ success: false, message: 'Server error fetching course details.' });
  }
});




router.post('/courses/add', authenticateAdmin, async (req, res) => {
  try {
      const { title, courseCode, description, photo, faculty, batches, department, academicYear, semester } = req.body;
      
      const courseExists = await Course.findOne({ courseCode });
      if (courseExists) return res.status(409).json({ success: false, message: 'Course code already exists.' });

      const newCourse = await Course.create({
          title, courseCode, description, photo, faculty, batches, department,
          academicYear, semester,
          createdBy: req.user._id,
          creatorModel: 'Admin' 
      });
      res.status(201).json({ success: true, data: newCourse });
  } catch (error) {
      res.status(500).json({ success: false, message: 'Server error creating course.' });
  }
});



router.put('/courses/update/:id', authenticateAdmin, async (req, res) => {
  try {
      const { batches: newBatchIds, faculty: newFacultyIds, ...updateData } = req.body;
      const courseId = req.params.id;

      
      const currentCourse = await Course.findById(courseId);
      if (!currentCourse) {
          return res.status(404).json({ success: false, message: 'Course not found.' });
      }

      
      const course = await Course.findByIdAndUpdate(
          courseId, 
          { 
              ...updateData, 
              batches: newBatchIds || [], 
              faculty: newFacultyIds || [] 
          },
          {
              new: true,
              runValidators: true
          }
      );

      
      const tasks = await Task.find({ course: courseId });
      const taskIds = tasks.map(task => task._id);

      
      const oldBatchIds = currentCourse.batches.map(id => id.toString());
      const newBatchIdsStr = (newBatchIds || []).map(id => id.toString());

      
      const addedBatchIds = newBatchIdsStr.filter(id => !oldBatchIds.includes(id));
      if (addedBatchIds.length > 0) {
          
          const studentsInNewBatches = await Student.find({ batch: { $in: addedBatchIds } });
          
          
          for (const student of studentsInNewBatches) {
              
              await Student.findByIdAndUpdate(
                  student._id,
                  { $addToSet: { tasks: { $each: taskIds } } }
              );

              
              const gradePlaceholders = taskIds.map(taskId => ({
                  task: taskId,
                  student: student._id,
                  course: courseId,
              }));
              await Grade.insertMany(gradePlaceholders, { ordered: false });
          }
      }

      
      const removedBatchIds = oldBatchIds.filter(id => !newBatchIdsStr.includes(id));
      if (removedBatchIds.length > 0) {
          
          const studentsInRemovedBatches = await Student.find({ batch: { $in: removedBatchIds } });
          
          
          for (const student of studentsInRemovedBatches) {
              
              await Student.findByIdAndUpdate(
                  student._id,
                  { $pullAll: { tasks: taskIds } }
              );

              
              await Grade.deleteMany({
                  student: student._id,
                  task: { $in: taskIds }
              });
          }
      }

      
      const oldFacultyIds = currentCourse.faculty.map(id => id.toString());
      const newFacultyIdsStr = (newFacultyIds || []).map(id => id.toString());

      
      const removedFacultyIds = oldFacultyIds.filter(id => !newFacultyIdsStr.includes(id));
      if (removedFacultyIds.length > 0) {
          await Faculty.updateMany(
              { _id: { $in: removedFacultyIds } },
              { $pull: { courses: courseId } }
          );
      }

      
      const addedFacultyIds = newFacultyIdsStr.filter(id => !oldFacultyIds.includes(id));
      if (addedFacultyIds.length > 0) {
          await Faculty.updateMany(
              { _id: { $in: addedFacultyIds } },
              { $addToSet: { courses: courseId } }
          );
      }

      res.json({ success: true, data: course });
  } catch (error) {
      console.error('Error updating course:', error);
      res.status(500).json({ success: false, message: 'Server error updating course.' });
  }
});



router.delete('/courses/delete/:id', authenticateAdmin, async (req, res) => {
  try {
      const course = await Course.findById(req.params.id);
      if (!course) return res.status(404).json({ success: false, message: 'Course not found.' });

      
      const tasks = await Task.find({ course: course._id });
      const taskIds = tasks.map(task => task._id);

      
      await Promise.all([
          Grade.deleteMany({ task: { $in: taskIds } }),
          Task.deleteMany({ course: course._id }),
          Course.findByIdAndDelete(course._id)
      ]);

      res.json({ success: true, message: 'Course, tasks, and grades deleted successfully.' });
  } catch (error) {
      console.error('Error deleting course:', error);
      res.status(500).json({ success: false, message: 'Server error deleting course.' });
  }
});



router.get('/search/assignables', authenticateAdmin, async (req, res) => {
  try {
      const { type, q } = req.query;
      if (!type || !q || q.length < 2) return res.json({ success: true, data: [] });

      let results;
      if (type === 'faculty') {
          results = await Faculty.find({
              $or: [
                  { firstName: { $regex: q, $options: 'i' } },
                  { lastName: { $regex: q, $options: 'i' } },
              ]
          }).select('firstName lastName').limit(10);
      } else if (type === 'batch') {
          results = await Batch.find({ name: { $regex: q, $options: 'i' } }).select('name academicYear').limit(10);
      } else {
          return res.status(400).json({ success: false, message: 'Invalid search type.' });
      }
      res.json({ success: true, data: results });
  } catch (error) {
      res.status(500).json({ success: false, message: 'Search failed.' });
  }
});

router.get('/tasks/all', authenticateAdmin, async (req, res) => {
  try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 9; 
      const search = req.query.search || '';
      const courseId = req.query.courseId || '';
      const facultyId = req.query.facultyId || '';

      let query = {};
      if (search) {
          query.title = { $regex: search, $options: 'i' };
      }
      if (courseId) {
          query.course = courseId;
      }
      if (facultyId) {
          query.createdBy = facultyId;
      }

      const totalTasks = await Task.countDocuments(query);
      const tasks = await Task.find(query)
          .populate('course', 'title courseCode') 
          .populate('createdBy', 'firstName lastName photo') 
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit);

      res.json({
          success: true,
          data: tasks,
          pagination: { total: totalTasks, page, totalPages: Math.ceil(totalTasks / limit) }
      });

  } catch (error) {
      res.status(500).json({ success: false, message: 'Server error fetching tasks.' });
  }
});






router.get('/tasks/details/:id', authenticateAdmin, async (req, res) => {
  try {
      const taskId = req.params.id;

      const task = await Task.findById(taskId)
          .populate('course', 'title')
          .populate('createdBy', 'firstName lastName');

      if (!task) {
          return res.status(404).json({ success: false, message: 'Task not found' });
      }
    
      

      
      const [totalEnrolled, totalSubmitted, totalGraded] = await Promise.all([
          
          Grade.countDocuments({ task: taskId }),

          
          Grade.countDocuments({ task: taskId, submission: { $ne: null } }),

          
          Grade.countDocuments({ task: taskId, status: 'Graded' })
      ]);
    
      
      const stats = {
          totalEnrolled,
          totalSubmitted,
          totalGraded
      };

      

      res.json({ 
          success: true, 
          data: { 
              task, 
              stats 
          } 
      });
  } catch (error) {
      console.error("Error fetching task details:", error);
      res.status(500).json({ success: false, message: 'Server error fetching task details.' });
  }
});




router.delete('/tasks/delete/:id', authenticateAdmin, async (req, res) => {
  try {
      const taskId = req.params.id;
      const task = await Task.findById(taskId);
      if (!task) return res.status(404).json({ success: false, message: 'Task not found.' });
      
      
      await Promise.all([
          Task.findByIdAndDelete(taskId),
          Submission.deleteMany({ task: taskId }),
          Grade.deleteMany({ task: taskId })
      ]);

      res.json({ success: true, message: 'Task, submissions, and grades deleted.' });
  } catch (error) {
      res.status(500).json({ success: false, message: 'Server error deleting task.' });
  }
});

router.post('/tasks/add', authenticateAdmin, async (req, res) => {
  try {
      const { title, course, ...restOfBody } = req.body;
      if (!title || !course) return res.status(400).json({ success: false, message: "Title and Course are required." });

      const selectedCourse = await Course.findById(course).populate({ path: 'batches', select: 'students' });
      if (!selectedCourse || selectedCourse.faculty.length === 0) {
          return res.status(400).json({ success: false, message: 'Course is invalid or has no assigned faculty.' });
      }
      
      const newTask = await Task.create({
          title, course, createdBy: selectedCourse.faculty[0], ...restOfBody
      });

      const allEnrolledStudentIds = selectedCourse.batches.flatMap(batch => batch.students);

      if (allEnrolledStudentIds.length > 0) {
          const gradePlaceholders = allEnrolledStudentIds.map(studentId => ({
              task: newTask._id,
              student: studentId,
              course: selectedCourse._id,
          }));
          await Grade.insertMany(gradePlaceholders, { ordered: false });
      }
      
      res.status(201).json({ success: true, data: newTask });
  } catch (error) {
      res.status(500).json({ success: false, message: 'Server error creating task.' });
  }
});



router.put('/tasks/update/:id', authenticateAdmin, async (req, res) => {
  try {
      const taskId = req.params.id;
      const { title, course, ...restOfBody } = req.body;

      const task = await Task.findById(taskId);
      if (!task) {
          return res.status(404).json({ success: false, message: 'Task not found.' });
      }

      
      if (course && course !== task.course.toString()) {
          const newCourse = await Course.findById(course).populate({ path: 'batches', select: 'students' });
          if (!newCourse || newCourse.faculty.length === 0) {
              return res.status(400).json({ success: false, message: 'New course is invalid or has no assigned faculty.' });
          }

          
          await Grade.deleteMany({ task: taskId });

          
          const newStudentIds = newCourse.batches.flatMap(batch => batch.students);
          if (newStudentIds.length > 0) {
              const gradePlaceholders = newStudentIds.map(studentId => ({
                  task: taskId,
                  student: studentId,
                  course: newCourse._id,
              }));
              await Grade.insertMany(gradePlaceholders, { ordered: false });
          }
      }

      
      task.title = title || task.title;
      task.course = course || task.course;
      Object.assign(task, restOfBody);

      const updatedTask = await task.save();
      res.json({ success: true, data: updatedTask });
  } catch (error) {
      console.error('Error updating task:', error);
      res.status(500).json({ success: false, message: 'Server error updating task.' });
  }
});



router.post('/tasks/:id/grade', authenticateAdmin, async (req, res) => {
  try {
      const gradesToUpdate = req.body.grades; 

      if (!gradesToUpdate || !Array.isArray(gradesToUpdate) || gradesToUpdate.length === 0) {
          return res.status(400).json({ success: false, message: 'No grade data provided.' });
      }

      const bulkOps = gradesToUpdate.map(g => {
          const numericGrade = (g.grade === '' || g.grade === null || g.grade === undefined) 
              ? null 
              : parseFloat(g.grade);

          
          
          const newStatus = (numericGrade === null) ? 'Pending' : 'Graded';
          

          return {
              updateOne: {
                  filter: { _id: g.gradeId },
                  update: {
                      $set: {
                          grade: numericGrade,
                          feedback: g.feedback,
                          status: newStatus, 
                          gradedAt: newStatus === 'Graded' ? new Date() : null, 
                          gradedBy: req.user._id,
                          graderModel: 'Admin'
                      }
                  }
              }
          };
      });

      if (bulkOps.length > 0) {
          await Grade.bulkWrite(bulkOps);
      }

      res.json({ success: true, message: 'Grades saved successfully.' });
  } catch (error) {
      console.error("Error saving grades:", error);
      res.status(500).json({ success: false, message: 'Server error while saving grades.' });
  }
});




router.get('/search/task-assignables', authenticateAdmin, async (req, res) => {
  try {
      const { type, q } = req.query;
      if (type !== 'course' || !q || q.length < 1) return res.json({ success: true, data: [] });

      const results = await Course.find({ 
          $or: [
              { title: { $regex: q, $options: 'i' } },
              { courseCode: { $regex: q, $options: 'i' } }
          ]
      }).select('title courseCode').limit(10);
      
      res.json({ success: true, data: results });
  } catch (error) {
      res.status(500).json({ success: false, message: 'Search failed.' });
  }
});


router.get('/tasks/:id/submissions', authenticateAdmin, async (req, res) => {
  try {
      const taskId = req.params.id;
      const task = await Task.findById(taskId).populate('course', 'title students');
      if (!task) return res.status(404).json({ success: false, message: 'Task not found' });

      const courseWithStudents = await Course.findById(task.course._id)
          .populate({
              path: 'batches',
              populate: { path: 'students', select: 'firstName lastName email rollNumber photo' }
          });

      const allEnrolledStudents = courseWithStudents.batches.flatMap(batch => batch.students);
      const actualSubmissions = await Submission.find({ task: taskId });
      const submissionMap = new Map(actualSubmissions.map(sub => [sub.student.toString(), sub]));

      const combinedSubmissions = allEnrolledStudents.map(student => {
          const submission = submissionMap.get(student._id.toString());
          return {
              student: student,
              submissionId: submission ? submission._id : null,
              status: submission ? submission.status : 'Not Submitted',
              submittedAt: submission ? submission.submittedAt : null,
              grade: submission ? submission.grade : '', 
              feedback: submission ? submission.feedback : '',
              attachments: submission ? submission.attachments : [],
          };
      });

      res.json({ success: true, task, submissions: combinedSubmissions });
  } catch (error) {
      res.status(500).json({ success: false, message: 'Server error fetching submission details.' });
  }
});






router.get('/tasks/:id/grades', authenticateAdmin, async (req, res) => {
  try {
      const taskId = req.params.id;
      const task = await Task.findById(taskId).populate('course', 'title maxPoints');
      if (!task) return res.status(404).json({ success: false, message: 'Task not found' });

      const grades = await Grade.find({ task: taskId })
          .populate('student', 'firstName lastName email rollNumber photo')
          .populate({
              path: 'submission',
              select: 'submittedAt status attachments content createdAt updatedAt'
          });

      res.json({ success: true, task, grades });
  } catch (error) {
      res.status(500).json({ success: false, message: 'Server error fetching grades.' });
  }
});

router.post('/tasks/:id/grade', authenticateAdmin, async (req, res) => {
  try {
      const gradesToUpdate = req.body.grades; 

      if (!gradesToUpdate || !Array.isArray(gradesToUpdate) || gradesToUpdate.length === 0) {
          return res.status(400).json({ success: false, message: 'No grade data provided.' });
      }

      const bulkOps = gradesToUpdate.map(g => ({
          updateOne: {
              filter: { _id: g.gradeId },
              update: {
                  $set: {
                      grade: g.grade,
                      feedback: g.feedback,
                      status: 'Graded',
                      gradedAt: new Date(),
                      gradedBy: req.user._id,
                      graderModel: 'Admin'
                  }
              }
          }
      }));

      await Grade.bulkWrite(bulkOps);
      res.json({ success: true, message: 'Grades saved successfully.' });
  } catch (error) {
      res.status(500).json({ success: false, message: 'Server error while saving grades.' });
  }
});




router.get('/analytics', authenticateAdmin, async (req, res) => {
    try {
        const { startDate, endDate, department } = req.query;

        
        let dateFilter = {};
        if (startDate && endDate) {
            dateFilter.createdAt = {
                $gte: new Date(new Date(startDate).toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })),
                $lte: new Date(new Date(endDate).toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
            };
        }

        let departmentFilter = {};
        if (department) {
            const coursesInDept = await Course.find({ department }).select('_id');
            const courseIdsInDept = coursesInDept.map(c => c._id);
            departmentFilter = { course: { $in: courseIdsInDept } };
        }

        const finalFilter = { ...dateFilter, ...departmentFilter };

        
        const [
            kpiData,
            submissionTrend,
            coursePerformance,
            facultyPerformance
        ] = await Promise.all([
            
            Grade.aggregate([
                { $match: finalFilter },
                {
                    $group: {
                        _id: null,
                        totalSubmissions: { $sum: { $cond: [{ $ne: ['$submission', null] }, 1, 0] } },
                        totalGraded: { $sum: { $cond: [{ $eq: ['$status', 'Graded'] }, 1, 0] } },
                        averageScore: { $avg: '$grade' }
                    }
                }
            ]),
            
            Submission.aggregate([
                { $match: dateFilter },
                {
                    $group: {
                        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { _id: 1 } }
            ]),
            
            Grade.aggregate([
                { $match: finalFilter },
                {
                    $group: {
                        _id: '$course',
                        averageGrade: { $avg: '$grade' },
                        submissionCount: { $sum: { $cond: [{ $ne: ['$submission', null] }, 1, 0] } }
                    }
                },
                { $sort: { averageGrade: -1 } },
                { $limit: 10 },
                { $lookup: { from: 'courses', localField: '_id', foreignField: '_id', as: 'courseInfo' } },
                { $unwind: '$courseInfo' },
                { $project: { _id: 0, courseName: '$courseInfo.title', averageGrade: 1, submissionCount: 1 } }
            ]),
            
            Task.aggregate([
                { $match: dateFilter },
                {
                    $lookup: {
                        from: 'grades',
                        localField: '_id',
                        foreignField: 'task',
                        as: 'grades'
                    }
                },
                { $unwind: '$grades' },
                {
                    $group: {
                        _id: '$createdBy',
                        tasksCreated: { $addToSet: '$_id' },
                        averageGrade: { $avg: '$grades.grade' }
                    }
                },
                { $sort: { averageGrade: -1 } },
                { $limit: 10 },
                { $lookup: { from: 'faculties', localField: '_id', foreignField: '_id', as: 'facultyInfo' } },
                { $unwind: '$facultyInfo' },
                { $project: { _id: 0, facultyName: { $concat: ['$facultyInfo.firstName', ' ', '$facultyInfo.lastName']}, averageGrade: 1, taskCount: { $size: '$tasksCreated' } } }
            ])
        ]);

        res.json({
            success: true,
            data: {
                kpis: kpiData[0] || { totalSubmissions: 0, totalGraded: 0, averageScore: 0 },
                submissionTrend,
                coursePerformance,
                facultyPerformance,
                dateRange: {
                    startDate: startDate ? new Date(startDate) : null,
                    endDate: endDate ? new Date(endDate) : null
                }
            }
        });

    } catch (error) {
        console.error("Analytics Error:", error);
        res.status(500).json({ success: false, message: 'Server error fetching analytics data.' });
    }
});


router.get('/settings', authenticateAdmin, async (req, res) => {
    try {
        
        let settings = await Setting.findOne({ key: 'global' });
        if (!settings) {
            settings = await Setting.create({ key: 'global' });
        }
        res.json({ success: true, data: settings });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error fetching settings.' });
    }
});



router.put('/settings', authenticateAdmin, async (req, res) => {
    try {
        
        const updatedSettings = await Setting.findOneAndUpdate(
            { key: 'global' },
            req.body,
            { new: true, upsert: true, runValidators: true }
        );
        res.json({ success: true, data: updatedSettings, message: 'Settings updated successfully.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error updating settings.' });
    }
});




export default router;