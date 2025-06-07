import express from 'express';
import jwt from 'jsonwebtoken'; // Make sure to import jwt
import Admin from '../models/Admin.js';
import Student from '../models/Student.js';
import Faculty from '../models/Faculty.js';
import Task from '../models/Task.js';
import Submission from '../models/Submission.js';
import Course from '../models/Course.js';  
import Batch from '../models/Batch.js';
import Grade from '../models/grade.js';
import Setting from '../models/Settings.js';


const router = express.Router();

// --- Your existing routes can go here ---

// @desc    Fetch statistics for the Admin Dashboard
// @route   GET /api/admin/fetch
// @access  Private/Admin
// @desc    Fetch statistics for the Admin Dashboard
// @route   GET /api/admin/fetch
// @access  Private/Admin
router.get('/fetch', async (req, res) => {
  try {
    // --- 1. Authentication & Authorization (No changes needed here) ---
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'Access denied.' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'Admin') return res.status(403).json({ success: false, message: 'Forbidden.' });
    const adminUser = await Admin.findById(decoded.id);
    if (!adminUser) return res.status(404).json({ success: false, message: 'Admin user not found.' });
    

    // --- 2. KPI Counts (with corrected completion rate) ---
    const totalStudents = await Student.countDocuments();
    const totalFaculty = await Faculty.countDocuments();
    const now = new Date();
    const activeTasks = await Task.countDocuments({
      publishDate: { $lte: now },
      dueDate: { $gte: now },
    });

    // --- CORRECTED Completion Rate Logic ---
    // Total possible submissions is the total number of grade slots created.
    const totalPossibleSubmissions = await Grade.countDocuments();
    // A submission is "completed" if it has been graded.
    const totalCompletedSubmissions = await Grade.countDocuments({ status: 'Graded' });

    const completionRate = totalPossibleSubmissions > 0 
      ? ((totalCompletedSubmissions / totalPossibleSubmissions) * 100).toFixed(1)
      : 0;

    // --- 3. CORRECTED Top Students Aggregation (from Grade model) ---
    let topStudents = await Grade.aggregate([
      { $match: { grade: { $exists: true, $ne: null } } },
      {
        $group: {
          _id: '$student', // Group by student ID
          totalScore: { $sum: '$grade' }, // Sum their numeric grades
          tasksCompleted: { $sum: 1 } // Count how many graded tasks they have
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

    // Fallback logic to fill the list up to 5 students (no changes needed here)
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

    // --- 4. Top Faculty Aggregation (No changes needed here, it was already correct) ---
    let topFaculty = await Task.aggregate([
      { $group: { _id: '$createdBy', tasksCreated: { $sum: 1 } } },
      { $sort: { tasksCreated: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'faculties', localField: '_id', foreignField: '_id', as: 'facultyInfo' } },
      { $unwind: '$facultyInfo' },
      { $project: { _id: 0, facultyId: '$facultyInfo._id', name: { $concat: ['$facultyInfo.firstName', ' ', '$facultyInfo.lastName'] }, photo: '$facultyInfo.photo', department: '$facultyInfo.department', tasksCreated: 1 } }
    ]);
    
    // Fallback logic for faculty (no changes needed here)
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

    // --- 5. Final Response ---
    res.json({
      success: true,
      data: {
        kpis: {
          totalStudents,
          totalFaculty,
          activeTasks,
          completionRate: `${completionRate}%`,
        },
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
      
      // Verify user still exists
      const admin = await Admin.findById(decoded.id);
      if (!admin) return res.status(404).json({ success: false, message: 'Admin user not found.' });
      
      req.user = admin; // Attach user to request
      next();
  } catch (error) {
      return res.status(401).json({ success: false, message: 'Invalid token.' });
  }
};

// @desc    Add a new faculty member
// @route   POST /api/admin/faculty/add
// @access  Private/Admin
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

// @desc    Fetch all faculty with search, sort, and pagination
// @route   GET /api/admin/faculty/all
// @access  Private/Admin
// @desc    Fetch all faculty with their course details, search, sort, and pagination
// @route   GET /api/admin/faculty/all
// @access  Private/Admin
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
          // Stage 1: Filter faculty based on search criteria
          { $match: searchQuery },

          // Stage 2: Sort and Paginate the faculty results first
          { $sort: { [sortBy]: sortOrder } },
          { $skip: (page - 1) * limit },
          { $limit: limit },

          // --- STAGE 3: THE CORRECTED LOOKUP ---
          {
              $lookup: {
                  from: 'courses', // The collection to join with
                  let: { faculty_id: '$_id' }, // Create a variable for the current faculty's ID
                  pipeline: [
                      // This sub-pipeline runs on the 'courses' collection
                      {
                          $match: {
                              // Find course documents where the 'faculty' array...
                              $expr: {
                                  // ...contains the faculty_id from the outer pipeline
                                  $in: ['$$faculty_id', '$faculty']
                              }
                          }
                      },
                      // We only need the title from the matched courses
                      {
                          $project: {
                              _id: 0,
                              title: 1
                          }
                      }
                  ],
                  as: 'coursesTaught' // The name of the new array field
              }
          },
          
          // Stage 4: Reshape the final output
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
                  // Use $map to extract just the titles from the coursesTaught array of objects
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

// @desc    Update a faculty member
// @route   PUT /api/admin/faculty/update/:id
// @access  Private/Admin
router.put('/faculty/update/:id', authenticateAdmin, async (req, res) => {
  try {
      const { firstName, lastName, email, username, department, isActive } = req.body;
      const faculty = await Faculty.findById(req.params.id);

      if (!faculty) {
          return res.status(404).json({ success: false, message: 'Faculty not found.' });
      }

      // Check for uniqueness if email or username is changed
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


// @desc    Delete a faculty member (soft delete)
// @route   DELETE /api/admin/faculty/delete/:id
// @access  Private/Admin
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


// @desc    Add a new student
// @route   POST /api/admin/students/add
// @desc    Add a new student
// @route   POST /api/admin/students/add
router.post('/students/add', authenticateAdmin, async (req, res) => {
  try {
      const { 
          firstName, lastName, email, username, password, 
          department, rollNumber, semester, batch 
      } = req.body;
      
      // --- Step 1: Validation ---
      if (!firstName || !lastName || !email || !username || !password || !department || !rollNumber) {
          return res.status(400).json({ success: false, message: 'Please provide all required fields.' });
      }

      const exists = await Student.findOne({ $or: [{ email }, { username }, { rollNumber }] });
      if (exists) {
          return res.status(409).json({ success: false, message: 'A student with this email, username, or roll number already exists.' });
      }

      // --- Step 2: Prepare the data for creation ---
      const studentData = {
          firstName, lastName, email, username, password,
          department, rollNumber, semester,
          // THIS IS THE FIX: Explicitly handle the batch value.
          // If the batch value from the form is an empty string, set it to null.
          batch: batch ? batch : null 
      };
      
      // --- Step 3: Create the Student Document ---
      const newStudent = await Student.create(studentData);
      
      // --- Step 4: Synchronize with the Batch document (Highly Recommended) ---
      if (newStudent.batch) {
          await Batch.findByIdAndUpdate(
              newStudent.batch,
              { $push: { students: newStudent._id } }
          );
      }
      
      // --- Step 5: Prepare and Send Response ---
      const studentResponse = newStudent.toObject();
      delete studentResponse.password;

      res.status(201).json({ 
          success: true, 
          data: studentResponse, 
          message: 'Student created successfully.' 
      });

  } catch (error) {
      // This will now catch other potential errors, since the CastError is fixed.
      if (error.name === 'CastError') {
          return res.status(400).json({ success: false, message: `Invalid data format for field: ${error.path}` });
      }
      console.error("Error adding student:", error);
      res.status(500).json({ success: false, message: 'Server error while adding student.' });
  }
});

// @desc    Fetch students with enrolled courses, search, sort, and pagination
// @route   GET /api/admin/students/all
// @desc    Fetch students with enrolled courses, search, sort, and pagination
// @route   GET /api/admin/students/all
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
        { department: { $regex: search, $options: 'i' } },
      ]
    } : {};

    const totalStudents = await Student.countDocuments(searchQuery);

    const studentList = await Student.aggregate([
      // Stage 1: Find matching students
      { $match: searchQuery },
      // Stage 2: Sort and Paginate
      { $sort: { [sortBy]: sortOrder } },
      { $skip: (page - 1) * limit },
      { $limit: limit },

      // Stage 3: Join with Courses collection
      {
        $lookup: {
          from: 'courses', // The collection to join
          let: { studentBatchId: '$batch' }, // Define a variable from the student's document
          pipeline: [
            // This pipeline runs on the 'courses' collection for each student
            {
              // Match courses where the student's batch ID is in the course's 'batches' array
              $match: {
                $expr: {
                  $in: ['$$studentBatchId', '$batches']
                }
              }
            },
            // Project only the fields we need from the matched courses
            {
              $project: {
                _id: 0, // Exclude the id
                title: 1 // Include the title
              }
            }
          ],
          as: 'enrolledCourses' // The name of the new array field
        }
      },
      
      // Stage 4: Reshape the final output
      {
        $project: {
          _id: 1, studentId: 1, firstName: 1, lastName: 1, email: 1,
          rollNumber: 1, department: 1, semester: 1, batch: 1,
          photo: 1, username: 1,
          // Extract just the titles from the joined documents
          courses: '$enrolledCourses.title'
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



// @desc    Update a student's details
// @route   PUT /api/admin/students/update/:id
router.put('/students/update/:id', authenticateAdmin, async (req, res) => {
  try {
      const { firstName, lastName, email, username, department, rollNumber, semester, batch } = req.body;
      const student = await Student.findById(req.params.id);
      if (!student) return res.status(404).json({ success: false, message: 'Student not found.' });

      // Uniqueness checks for fields that are being changed
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
      student.batch = batch ?? student.batch;

      const updatedStudent = await student.save();
      res.json({ success: true, data: updatedStudent });
  } catch (error) {
      res.status(500).json({ success: false, message: 'Server error updating student.' });
  }
});

// @desc    Permanently delete a student
// @route   DELETE /api/admin/students/delete/:id
// @desc    Permanently delete a student and all their associated data
// @route   DELETE /api/admin/students/delete/:id
// @desc    Permanently delete a student and all their associated data (with full sync)
// @route   DELETE /api/admin/students/delete/:id
router.delete('/students/delete/:id', authenticateAdmin, async (req, res) => {
  try {
      const studentId = req.params.id;
      const student = await Student.findById(studentId);
      if (!student) {
          return res.status(404).json({ success: false, message: 'Student not found.' });
      }

      const batchId = student.batch;

      // Perform all deletions in parallel
      await Promise.all([
          // Remove the student from their batch
          Batch.updateOne({ _id: batchId }, { $pull: { students: studentId } }),
          
          // --- NEW: Remove the student from all courses that contained their batch ---
          Course.updateMany({ batches: batchId }, { $pull: { students: studentId } }),
          
          // Delete all their submissions
          Submission.deleteMany({ student: studentId }),

          // Delete all their grade records
          Grade.deleteMany({ student: studentId }),
          
          // Finally, delete the student document
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
      
      // Use populate to get student details within each batch
      const batches = await Batch.find(searchQuery)
          .populate('students', 'firstName lastName username photo') // Populate students with selected fields
          .select('name academicYear department students createdAt') // Explicitly select fields including department
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


// @desc    Create a new batch
// @route   POST /api/admin/batches/add
router.post('/batches/add', authenticateAdmin, async (req, res) => {
  try {
      const { name, academicYear, students, department } = req.body;
      if (!name || !academicYear || !department) {
          return res.status(400).json({ success: false, message: 'Batch name, year, and department are required.' });
      }
      
      // Check for duplicate batch
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

      // --- CRUCIAL: Update the 'batch' field for all assigned students ---
      if (students && students.length > 0) {
          await Student.updateMany(
              { _id: { $in: students } },
              { $set: { batch: newBatch._id } }
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

      // --- SYNCHRONIZATION LOGIC ---

      const originalStudentIds = batch.students.map(id => id.toString());
      const newStudentIds = students.map(id => id.toString());
      
      // 1. Find which students were REMOVED from the batch
      const removedStudentIds = originalStudentIds.filter(id => !newStudentIds.includes(id));
      if (removedStudentIds.length > 0) {
          // A) Remove the batch reference from these students
          await Student.updateMany(
              { _id: { $in: removedStudentIds } },
              { $unset: { batch: "" } }
          );
          // B) Find all tasks associated with this batch and remove the grades for the removed students
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

      // 2. Find which students were ADDED to the batch
      const addedStudentIds = newStudentIds.filter(id => !originalStudentIds.includes(id));
      if (addedStudentIds.length > 0) {
          // A) Add the batch reference to these new students
          await Student.updateMany(
              { _id: { $in: addedStudentIds } },
              { $set: { batch: batchId } }
          );

          // B) --- RETROACTIVE ENROLLMENT ---
          // Find all courses and their tasks that this batch is enrolled in
          const coursesWithThisBatch = await Course.find({ batches: batchId }).select('_id');
          const courseIds = coursesWithThisBatch.map(c => c._id);
          const tasksInTheseCourses = await Task.find({ course: { $in: courseIds } }).select('_id');
          const taskIds = tasksInTheseCourses.map(t => t._id);
          
          if (taskIds.length > 0) {
              const newGradePlaceholders = [];
              // For each newly added student...
              for (const studentId of addedStudentIds) {
                  // ...and for each task in the courses this batch belongs to...
                  for (const taskId of taskIds) {
                      // ...create a new grade placeholder.
                      newGradePlaceholders.push({
                          task: taskId,
                          student: studentId,
                          course: courseIds[0], // Assuming tasks belong to one course in this context
                      });
                  }
              }
              
              if (newGradePlaceholders.length > 0) {
                  // Using insertMany is highly efficient for bulk operations.
                  await Grade.insertMany(newGradePlaceholders, { ordered: false });
              }
          }
      }
    
      // 3. Finally, update the batch document itself
      batch.name = name ?? batch.name;
      batch.academicYear = academicYear ?? batch.academicYear;
      batch.department = department ?? batch.department;
      batch.students = students ?? batch.students;

      await batch.save();
      
      const populatedBatch = await Batch.findById(batch._id).populate('students', 'firstName lastName');
        
      res.json({ success: true, data: populatedBatch, message: 'Batch updated successfully. Student enrollments synchronized.' });

  } catch (error) {
      console.error('Error updating batch:', error);
      res.status(500).json({ success: false, message: 'Server error updating batch.' });
  }
});


// @desc    Delete a batch and update its former students
// @route   DELETE /api/admin/batches/delete/:id
// @desc    Delete a batch and synchronize all related data
// @route   DELETE /api/admin/batches/delete/:id
router.delete('/batches/delete/:id', authenticateAdmin, async (req, res) => {
  try {
      const batchId = req.params.id;
      const batch = await Batch.findById(batchId);
      if (!batch) return res.status(404).json({ success: false, message: 'Batch not found.' });

      const studentIdsInBatch = batch.students;

      // Un-assign students from this batch and remove them from any course that had this batch
      await Promise.all([
          Student.updateMany({ _id: { $in: studentIdsInBatch } }, { $unset: { batch: "" } }),
          Course.updateMany({ batches: batchId }, { $pull: { students: { $in: studentIdsInBatch }, batches: batchId } }),
          Batch.findByIdAndDelete(batchId)
      ]);

      res.json({ success: true, message: 'Batch deleted and all associations removed.' });
  } catch (error) {
      res.status(500).json({ success: false, message: 'Server error deleting batch.' });
  }
});


// @desc    Search for students to add to a batch
// @route   GET /api/admin/students/search?q=...
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
      const limit = parseInt(req.query.limit) || 12; // Adjusted for card layout
      const search = req.query.search || '';
      const department = req.query.department || '';
      const batchId = req.query.batchId || '';

      // Build the query
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
          query.batches = batchId; // Find courses where the batchId is in the 'batches' array
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

// @desc    Get deep details for a single course (tasks and students)
// @route   GET /api/admin/courses/details/:id
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


// @desc    Create a new course
// @route   POST /api/admin/courses/add
router.post('/courses/add', authenticateAdmin, async (req, res) => {
  try {
      const { title, courseCode, description, photo, faculty, batches, department, academicYear, semester } = req.body;
      
      const courseExists = await Course.findOne({ courseCode });
      if (courseExists) return res.status(409).json({ success: false, message: 'Course code already exists.' });

      const newCourse = await Course.create({
          title, courseCode, description, photo, faculty, batches, department,
          academicYear, semester,
          createdBy: req.user._id,
          creatorModel: 'Admin' // Assuming only admin can create
      });
      res.status(201).json({ success: true, data: newCourse });
  } catch (error) {
      res.status(500).json({ success: false, message: 'Server error creating course.' });
  }
});

// @desc    Update a course
// @route   PUT /api/admin/courses/update/:id
router.put('/courses/update/:id', authenticateAdmin, async (req, res) => {
  try {
      const course = await Course.findByIdAndUpdate(req.params.id, req.body, {
          new: true,
          runValidators: true
      });
      if (!course) return res.status(404).json({ success: false, message: 'Course not found.' });
      res.json({ success: true, data: course });
  } catch (error) {
      res.status(500).json({ success: false, message: 'Server error updating course.' });
  }
});

// @desc    Delete a course
// @route   DELETE /api/admin/courses/delete/:id
router.delete('/courses/delete/:id', authenticateAdmin, async (req, res) => {
  try {
      const course = await Course.findByIdAndDelete(req.params.id);
      if (!course) return res.status(404).json({ success: false, message: 'Course not found.' });
      
      // Optional: Also delete all tasks associated with this course
      await Task.deleteMany({ course: course._id });

      res.json({ success: true, message: 'Course and associated tasks deleted.' });
  } catch (error) {
      res.status(500).json({ success: false, message: 'Server error deleting course.' });
  }
});

// @desc    Search for faculty/batches to assign to a course
// @route   GET /api/admin/search/assignables?type=...&q=...
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
      const limit = parseInt(req.query.limit) || 9; // divisible by 3 for card layout
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
          .populate('course', 'title courseCode') // Populate course title and code
          .populate('createdBy', 'firstName lastName photo') // Populate faculty creator details
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


// @desc    Admin: Get deep details for a single task (including submissions)
// @route   GET /api/admin/tasks/details/:id
// @desc    Admin: Get deep details and ENHANCED statistics for a single task
// @route   GET /api/admin/tasks/details/:id
router.get('/tasks/details/:id', authenticateAdmin, async (req, res) => {
  try {
      const taskId = req.params.id;

      const task = await Task.findById(taskId)
          .populate('course', 'title')
          .populate('createdBy', 'firstName lastName');

      if (!task) {
          return res.status(404).json({ success: false, message: 'Task not found' });
      }
    
      // --- NEW & CORRECTED STATISTICS LOGIC ---

      // We run all count queries in parallel for maximum efficiency
      const [totalEnrolled, totalSubmitted, totalGraded] = await Promise.all([
          // 1. Get total students for whom a grade slot exists for this task
          Grade.countDocuments({ task: taskId }),

          // 2. Get total students who have a non-null submission linked to their grade
          Grade.countDocuments({ task: taskId, submission: { $ne: null } }),

          // 3. Get total students whose grade status is 'Graded'
          Grade.countDocuments({ task: taskId, status: 'Graded' })
      ]);
    
      // Combine the results into a single, clean stats object
      const stats = {
          totalEnrolled,
          totalSubmitted,
          totalGraded
      };

      // --- END OF CORRECTED LOGIC ---

      res.json({ 
          success: true, 
          data: { 
              task, 
              stats // The frontend will now receive this object
          } 
      });
  } catch (error) {
      console.error("Error fetching task details:", error);
      res.status(500).json({ success: false, message: 'Server error fetching task details.' });
  }
});


// @desc    Admin: Delete a task and all associated grades and submissions
// @route   DELETE /api/admin/tasks/delete/:id
router.delete('/tasks/delete/:id', authenticateAdmin, async (req, res) => {
  try {
      const taskId = req.params.id;
      const task = await Task.findById(taskId);
      if (!task) return res.status(404).json({ success: false, message: 'Task not found.' });
      
      // Delete the task, and cascade delete all related documents
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

// @desc    Update an existing task
// @route   PUT /api/admin/tasks/update/:id
router.put('/tasks/update/:id', authenticateAdmin, async (req, res) => {
  try {
      const taskId = req.params.id;
      const { title, course, ...restOfBody } = req.body;

      const task = await Task.findById(taskId);
      if (!task) {
          return res.status(404).json({ success: false, message: 'Task not found.' });
      }

      // If course is being changed, we need to update grades
      if (course && course !== task.course.toString()) {
          const newCourse = await Course.findById(course).populate({ path: 'batches', select: 'students' });
          if (!newCourse || newCourse.faculty.length === 0) {
              return res.status(400).json({ success: false, message: 'New course is invalid or has no assigned faculty.' });
          }

          // Delete existing grades
          await Grade.deleteMany({ task: taskId });

          // Create new grade placeholders for students in the new course
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

      // Update task details
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

// @desc    Grade or update grades for a task, handling status changes
// @route   POST /api/admin/tasks/:id/grade
router.post('/tasks/:id/grade', authenticateAdmin, async (req, res) => {
  try {
      const gradesToUpdate = req.body.grades; // Expecting [{ gradeId, grade, feedback }]

      if (!gradesToUpdate || !Array.isArray(gradesToUpdate) || gradesToUpdate.length === 0) {
          return res.status(400).json({ success: false, message: 'No grade data provided.' });
      }

      const bulkOps = gradesToUpdate.map(g => {
          const numericGrade = (g.grade === '' || g.grade === null || g.grade === undefined) 
              ? null 
              : parseFloat(g.grade);

          // --- THIS IS THE KEY LOGIC CHANGE ---
          // Determine the new status based on whether a grade is present.
          const newStatus = (numericGrade === null) ? 'Pending' : 'Graded';
          // --- END OF CHANGE ---

          return {
              updateOne: {
                  filter: { _id: g.gradeId },
                  update: {
                      $set: {
                          grade: numericGrade,
                          feedback: g.feedback,
                          status: newStatus, // Use the dynamically determined status
                          gradedAt: newStatus === 'Graded' ? new Date() : null, // Only set gradedAt if it's graded
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

// The search endpoint now only needs to find courses.
// @desc    Search for courses to assign to a task
// @route   GET /api/admin/search/task-assignables?type=course&q=...
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
              grade: submission ? submission.grade : '', // Send empty string for input field
              feedback: submission ? submission.feedback : '',
              attachments: submission ? submission.attachments : [],
          };
      });

      res.json({ success: true, task, submissions: combinedSubmissions });
  } catch (error) {
      res.status(500).json({ success: false, message: 'Server error fetching submission details.' });
  }
});


// @desc    Grade or update grades for multiple submissions of a task
// @route   POST /api/admin/tasks/:id/grade
// @desc    Admin: Get all grades for a specific task (for the grading interface)
// @route   GET /api/admin/tasks/:id/grades
router.get('/tasks/:id/grades', authenticateAdmin, async (req, res) => {
  try {
      const taskId = req.params.id;
      const task = await Task.findById(taskId).populate('course', 'title maxPoints');
      if (!task) return res.status(404).json({ success: false, message: 'Task not found' });

      const grades = await Grade.find({ task: taskId })
          .populate('student', 'firstName lastName email rollNumber photo')
          .populate({
              path: 'submission',
              select: 'submittedAt status attachments'
          });

      res.json({ success: true, task, grades });
  } catch (error) {
      res.status(500).json({ success: false, message: 'Server error fetching grades.' });
  }
});

router.post('/tasks/:id/grade', authenticateAdmin, async (req, res) => {
  try {
      const gradesToUpdate = req.body.grades; // Expecting an array of { gradeId, grade, feedback }

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


// @desc    Fetch aggregated data for the Analytics Dashboard
// @route   GET /api/admin/analytics
router.get('/analytics', authenticateAdmin, async (req, res) => {
    try {
        const { startDate, endDate, department } = req.query;

        // --- 1. Define Date and Department Filters ---
        let dateFilter = {};
        if (startDate && endDate) {
            dateFilter.createdAt = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        let departmentFilter = {};
        if (department) {
            const coursesInDept = await Course.find({ department }).select('_id');
            const courseIdsInDept = coursesInDept.map(c => c._id);
            departmentFilter = { course: { $in: courseIdsInDept } };
        }

        const finalFilter = { ...dateFilter, ...departmentFilter };

        // --- 2. Run All Aggregations in Parallel ---
        const [
            kpiData,
            submissionTrend,
            coursePerformance,
            facultyPerformance
        ] = await Promise.all([
            // Aggregation for KPIs
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
            // Aggregation for Submission Trend Chart
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
            // Aggregation for Course Performance
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
            // Aggregation for Faculty Performance
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
                facultyPerformance
            }
        });

    } catch (error) {
        console.error("Analytics Error:", error);
        res.status(500).json({ success: false, message: 'Server error fetching analytics data.' });
    }
});


router.get('/settings', authenticateAdmin, async (req, res) => {
    try {
        // Find the single settings document. If it doesn't exist, create it.
        let settings = await Setting.findOne({ key: 'global' });
        if (!settings) {
            settings = await Setting.create({ key: 'global' });
        }
        res.json({ success: true, data: settings });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error fetching settings.' });
    }
});

// @desc    Update the global platform settings
// @route   PUT /api/admin/settings
router.put('/settings', authenticateAdmin, async (req, res) => {
    try {
        // Find the settings doc and update it. 'upsert: true' creates it if it doesn't exist.
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