import express from 'express';
import jwt from 'jsonwebtoken';
import moment from 'moment'; // For date calculations

// Import all necessary models
import Faculty from '../models/Faculty.js';
import Course from '../models/Course.js';
import Task from '../models/Task.js';
import Grade from '../models/Grade.js';
import Submission from '../models/Submission.js';
import Student from '../models/Student.js';
import Batch from '../models/Batch.js';

const router = express.Router();

// --- Reusable Middleware for Faculty Authentication & Authorization ---
const authenticateFaculty = async (req, res, next) => {
    try {
        const token = req.headers['authorization']?.split(' ')[1];
        if (!token) return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.role !== 'Faculty') return res.status(403).json({ success: false, message: 'Forbidden. User is not Faculty.' });
        
        req.user = await Faculty.findById(decoded.id);
        if (!req.user) return res.status(404).json({ success: false, message: 'Faculty user not found.' });
        
        next();
    } catch (error) {
        return res.status(401).json({ success: false, message: 'Invalid token.' });
    }
};


// ===========================================
// === FACULTY DASHBOARD & STATS ===========
// ===========================================

// @desc    Fetch aggregated statistics for the logged-in faculty's dashboard
// @route   GET /api/faculty/dashboard-stats
router.get('/dashboard-stats', authenticateFaculty, async (req, res) => {
    try {
        const facultyId = req.user._id;

        // Find all courses and their associated batches for this faculty
        const myCourses = await Course.find({ faculty: facultyId })
            .populate({
                path: 'batches',
                select: '_id',
                populate: {
                    path: 'students',
                    select: '_id'
                }
            });

        // Get all unique student IDs from all batches in all courses
        const myStudentIds = [...new Set(
            myCourses.flatMap(course => 
                course.batches.flatMap(batch => 
                    batch.students.map(student => student._id)
                )
            )
        )];

        // Get all task IDs created by this faculty
        const myTaskIds = (await Task.find({ createdBy: facultyId }).select('_id')).map(t => t._id);

        // Run all aggregations in parallel
        const [kpiData, submissionTrend, topStudents, recentActivity] = await Promise.all([
            // KPIs
            Promise.all([
                Course.countDocuments({ faculty: facultyId }),
                Task.countDocuments({ createdBy: facultyId, dueDate: { $gte: new Date() } }),
                Grade.aggregate([
                    { $match: { task: { $in: myTaskIds }, grade: { $ne: null } } },
                    { 
                        $lookup: {
                            from: 'tasks',
                            localField: 'task',
                            foreignField: '_id',
                            as: 'taskInfo'
                        }
                    },
                    { $unwind: '$taskInfo' },
                    {
                        $group: {
                            _id: null,
                            totalPoints: { $sum: '$taskInfo.maxPoints' },
                            earnedPoints: { $sum: '$grade' },
                            count: { $sum: 1 }
                        }
                    }
                ])
            ]).then(([courseCount, activeAssignments, gradeResult]) => ({
                myCourses: courseCount,
                totalStudents: myStudentIds.length,
                activeAssignments,
                averageGrade: gradeResult[0] ? (gradeResult[0].earnedPoints / gradeResult[0].totalPoints) * 100 : 0
            })),
            // Submission Trend (last 7 days)
            Submission.aggregate([
                { $match: { task: { $in: myTaskIds }, createdAt: { $gte: moment().subtract(7, 'days').toDate() } } },
                { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
                { $sort: { _id: 1 } }
            ]),
            // Top Students
            Grade.aggregate([
                { $match: { student: { $in: myStudentIds }, grade: { $ne: null } } },
                {
                    $lookup: {
                        from: 'tasks',
                        localField: 'task',
                        foreignField: '_id',
                        as: 'taskInfo'
                    }
                },
                { $unwind: '$taskInfo' },
                {
                    $group: {
                        _id: '$student',
                        totalPoints: { $sum: '$taskInfo.maxPoints' },
                        earnedPoints: { $sum: '$grade' },
                        tasksCompleted: { $sum: 1 }
                    }
                },
                { $sort: { earnedPoints: -1 } },
                { $limit: 5 },
                { $lookup: { from: 'students', localField: '_id', foreignField: '_id', as: 'studentInfo' } },
                { $unwind: '$studentInfo' },
                {
                    $project: {
                        _id: 0,
                        name: { $concat: ['$studentInfo.firstName', ' ', '$studentInfo.lastName'] },
                        photo: '$studentInfo.photo',
                        totalScore: { $multiply: [{ $divide: ['$earnedPoints', '$totalPoints'] }, 100] },
                        tasksCompleted: 1
                    }
                }
            ]),
            // Recent Activity
            Submission.find({ task: { $in: myTaskIds } })
                .sort({ createdAt: -1 }).limit(5)
                .populate('student', 'firstName lastName photo')
                .populate({ path: 'task', select: 'title', populate: { path: 'course', select: 'title' } })
        ]);
        
        res.json({ success: true, data: { kpiData, submissionTrend, topStudents, recentActivity } });

    } catch (error) {
        console.error("Faculty Dashboard Stats Error:", error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});


// ===========================================
// === FACULTY TASK MANAGEMENT =============
// ===========================================

// @desc    Faculty: Fetch only the courses THEY are assigned to
// @route   GET /api/faculty/my-courses
router.get('/my-courses', authenticateFaculty, async (req, res) => {
    try {
        const courses = await Course.find({ faculty: req.user._id }).select('title courseCode');
        res.json({ success: true, data: courses });
    } catch (error) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

// @desc    Faculty: Fetch all tasks with pagination and filtering
// @route   GET /api/faculty/tasks/all
router.get('/tasks/all', authenticateFaculty, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 9;
        const search = req.query.search || '';
        const courseId = req.query.courseId || '';

        // First get all courses where faculty is an instructor
        const facultyCourses = await Course.find({ faculty: req.user._id }).select('_id');
        const courseIds = facultyCourses.map(course => course._id);

        let query = { course: { $in: courseIds } };
        if (search) {
            query.title = { $regex: search, $options: 'i' };
        }
        if (courseId) {
            query.course = courseId;
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

// @desc    Faculty: Get detailed statistics for a single task
// @route   GET /api/faculty/tasks/details/:id
router.get('/tasks/details/:id', authenticateFaculty, async (req, res) => {
    try {
        const taskId = req.params.id;
        const task = await Task.findOne({ _id: taskId })
            .populate({
                path: 'course',
                select: 'title faculty',
                match: { faculty: req.user._id }
            })
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

// @desc    Faculty: Create a new task
// @route   POST /api/faculty/tasks/add
router.post('/tasks/add', authenticateFaculty, async (req, res) => {
    try {
        const { title, course, ...restOfBody } = req.body;
        if (!title || !course) {
            return res.status(400).json({ success: false, message: "Title and Course are required." });
        }

        const courseDoc = await Course.findOne({ _id: course, faculty: req.user._id });
        if (!courseDoc) {
            return res.status(403).json({ success: false, message: "You can only create tasks for courses you teach." });
        }
        
        const newTask = await Task.create({
            title, course, createdBy: req.user._id, ...restOfBody
        });

        const allEnrolledStudentIds = (await Course.findById(course).populate('batches', 'students'))
            .batches.flatMap(b => b.students);

        if (allEnrolledStudentIds.length > 0) {
            const gradePlaceholders = allEnrolledStudentIds.map(studentId => ({
                task: newTask._id,
                student: studentId,
                course: courseDoc._id,
            }));
            await Grade.insertMany(gradePlaceholders, { ordered: false });
        }
        
        res.status(201).json({ success: true, data: newTask });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error creating task.' });
    }
});

// @desc    Faculty: Update their own task
// @route   PUT /api/faculty/tasks/update/:id
router.put('/tasks/update/:id', authenticateFaculty, async (req, res) => {
    try {
        const taskId = req.params.id;
        const { title, course, ...restOfBody } = req.body;

        const task = await Task.findOne({ _id: taskId })
            .populate({
                path: 'course',
                select: 'title faculty',
                match: { faculty: req.user._id }
            })
            .populate('createdBy', 'firstName lastName');
        if (!task) {
            return res.status(404).json({ success: false, message: 'Task not found.' });
        }

        if (course && course !== task.course.toString()) {
            const newCourse = await Course.findOne({ _id: course, faculty: req.user._id })
                .populate({ path: 'batches', select: 'students' });
            
            if (!newCourse) {
                return res.status(400).json({ success: false, message: 'New course is invalid or you are not authorized.' });
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

// @desc    Faculty: Delete their own task
// @route   DELETE /api/faculty/tasks/delete/:id
router.delete('/tasks/delete/:id', authenticateFaculty, async (req, res) => {
    try {
        const taskId = req.params.id;
        const task = await Task.findOne({ _id: taskId })
        .populate({
            path: 'course',
            select: 'title faculty',
            match: { faculty: req.user._id }
        })
        .populate('createdBy', 'firstName lastName');
        if (!task) {
            return res.status(404).json({ success: false, message: 'Task not found.' });
        }
        
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

// @desc    Search for courses to assign to a task
// @route   GET /api/faculty/search/task-assignables?type=course&q=...
router.get('/search/task-assignables', authenticateFaculty, async (req, res) => {
  try {
      const { type, q } = req.query;
      if (type !== 'course' || !q || q.length < 1) return res.json({ success: true, data: [] });

      // Only search courses where the faculty is assigned
      const results = await Course.find({ 
          faculty: req.user._id,
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

// @desc    Faculty: Get all grades for a specific task (for the grading interface)
// @route   GET /api/faculty/tasks/:id/grades
router.get('/tasks/:id/grades', authenticateFaculty, async (req, res) => {
  try {
      const taskId = req.params.id;
      
      // First verify the task exists and faculty has access
      const task = await Task.findById(taskId)
          .populate({
              path: 'course',
              select: 'title maxPoints faculty',
              match: { faculty: req.user._id }
          });

      if (!task || !task.course) {
          return res.status(404).json({ 
              success: false, 
              message: 'Task not found or you do not have access to it.' 
          });
      }

      // Get all grades for this task
      const grades = await Grade.find({ task: taskId })
          .populate('student', 'firstName lastName email rollNumber photo')
          .populate({
              path: 'submission',
              select: 'submittedAt status attachments content'
          });

      res.json({ success: true, task, grades });
  } catch (error) {
      console.error('Error fetching grades:', error);
      res.status(500).json({ 
          success: false, 
          message: 'Server error fetching grades.',
          error: error.message 
      });
  }
});

// @desc    Faculty: Grade or update grades for multiple submissions of a task
// @route   POST /api/faculty/tasks/:id/grade
router.post('/tasks/:id/grade', authenticateFaculty, async (req, res) => {
  try {
      const taskId = req.params.id;
      const task = await Task.findById(taskId);
      
      if (!task) {
          return res.status(404).json({ success: false, message: 'Task not found' });
      }

      // Verify faculty owns this task
      const course = await Course.findById(task.course);
      if (!course || !course.faculty.some(facultyId => facultyId.equals(req.user._id))) {
          return res.status(403).json({ success: false, message: 'Not authorized to grade this task' });
      }

      const gradesToUpdate = req.body.grades; // Expecting [{ gradeId, grade, feedback }]

      if (!gradesToUpdate || !Array.isArray(gradesToUpdate) || gradesToUpdate.length === 0) {
          return res.status(400).json({ success: false, message: 'No grade data provided.' });
      }

      const bulkOps = gradesToUpdate.map(g => {
          const numericGrade = (g.grade === '' || g.grade === null || g.grade === undefined) 
              ? null 
              : parseFloat(g.grade);

          // Determine the new status based on whether a grade is present
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
                          graderModel: 'Faculty'
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

// @desc    Faculty: Get all submissions for a specific task
// @route   GET /api/faculty/tasks/:id/submissions
router.get('/tasks/:id/submissions', authenticateFaculty, async (req, res) => {
  try {
      const taskId = req.params.id;
      const task = await Task.findById(taskId).populate('course', 'title students');
      if (!task) return res.status(404).json({ success: false, message: 'Task not found' });

      // Verify faculty owns this task
      const course = await Course.findById(task.course);
      if (!course || !course.faculty.some(facultyId => facultyId.equals(req.user._id))) {
          return res.status(403).json({ success: false, message: 'Not authorized to grade this task' });
      }
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

// @desc    Faculty: Get analytics for faculty's courses, grades, and students
// @route   GET /api/faculty/analytics
router.get('/analytics', authenticateFaculty, async (req, res) => {
    try {
        const facultyId = req.user._id;
        const { startDate, endDate } = req.query;

        // Define date filter if dates provided
        let dateFilter = {};
        if (startDate && endDate) {
            dateFilter.createdAt = {
                $gte: new Date(new Date(startDate).toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })),
                $lte: new Date(new Date(endDate).toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
            };
        }

        // Get all courses for this faculty
        const myCourses = await Course.find({ faculty: facultyId }).select('_id title');

        // Run analytics aggregations in parallel
        const [
            kpiData,
            submissionTrend,
            coursePerformance,
            studentPerformance
        ] = await Promise.all([
            // KPI Data (Total Submissions, Graded, Average Score)
            Grade.aggregate([
                { 
                    $match: { 
                        ...dateFilter,
                        course: { $in: myCourses.map(c => c._id) }
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalSubmissions: { $sum: { $cond: [{ $ne: ['$submission', null] }, 1, 0] } },
                        totalGraded: { $sum: { $cond: [{ $eq: ['$status', 'Graded'] }, 1, 0] } },
                        averageScore: { $avg: '$grade' }
                    }
                }
            ]),
            // Submission Trend
            Submission.aggregate([
                { 
                    $match: { 
                        ...dateFilter,
                        task: { 
                            $in: await Task.find({ course: { $in: myCourses.map(c => c._id) } }).select('_id')
                        }
                    }
                },
                {
                    $group: {
                        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { _id: 1 } }
            ]),
            // Course Performance
            Grade.aggregate([
                { 
                    $match: { 
                        ...dateFilter,
                        course: { $in: myCourses.map(c => c._id) }
                    }
                },
                {
                    $group: {
                        _id: '$course',
                        averageGrade: { $avg: '$grade' },
                        submissionCount: { $sum: { $cond: [{ $ne: ['$submission', null] }, 1, 0] } }
                    }
                },
                { $sort: { averageGrade: -1 } },
                { $lookup: { from: 'courses', localField: '_id', foreignField: '_id', as: 'courseInfo' } },
                { $unwind: '$courseInfo' },
                { $project: { _id: 0, courseName: '$courseInfo.title', averageGrade: 1, submissionCount: 1 } }
            ]),
            // Top Performing Students
            Grade.aggregate([
                { 
                    $match: { 
                        ...dateFilter,
                        course: { $in: myCourses.map(c => c._id) }
                    }
                },
                {
                    $group: {
                        _id: '$student',
                        averageGrade: { $avg: '$grade' },
                        submissionCount: { $sum: { $cond: [{ $ne: ['$submission', null] }, 1, 0] } }
                    }
                },
                { $sort: { averageGrade: -1 } },
                { $limit: 10 },
                { $lookup: { from: 'students', localField: '_id', foreignField: '_id', as: 'studentInfo' } },
                { $unwind: '$studentInfo' },
                { 
                    $project: { 
                        _id: 0, 
                        studentName: { $concat: ['$studentInfo.firstName', ' ', '$studentInfo.lastName'] },
                        rollNumber: '$studentInfo.rollNumber',
                        averageGrade: 1, 
                        submissionCount: 1 
                    }
                }
            ])
        ]);

        res.json({
            success: true,
            data: {
                kpis: kpiData[0] || { totalSubmissions: 0, totalGraded: 0, averageScore: 0 },
                submissionTrend,
                coursePerformance,
                studentPerformance,
                dateRange: {
                    startDate: startDate ? new Date(startDate) : null,
                    endDate: endDate ? new Date(endDate) : null
                }
            }
        });

    } catch (error) {
        console.error("Faculty Analytics Error:", error);
        res.status(500).json({ success: false, message: 'Server error fetching faculty analytics data.' });
    }
});



// @desc    Faculty: Fetch ALL students, and for each, individually query and LOG their relevant courses.
// @route   GET /api/faculty/students
router.get('/students', authenticateFaculty, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || '';
        const sortBy = req.query.sortBy || 'createdAt';
        const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
        const facultyId = req.user._id;

        // Get all courses where faculty is assigned
        const myCourses = await Course.find({ faculty: facultyId }).select('_id title');

        // Fetch students based on search and pagination
        const searchQuery = search ? {
            $or: [
                { firstName: { $regex: search, $options: 'i' } },
                { lastName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { rollNumber: { $regex: search, $options: 'i' } },
            ]
        } : {};
        
        const totalStudents = await Student.countDocuments(searchQuery);
        const studentList = await Student.find(searchQuery)
            .sort({ [sortBy]: sortOrder })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();

        // Find courses for each student
        const finalStudentList = await Promise.all(studentList.map(async student => {
            const studentBatchIds = student.batch || [];
            const coursesForThisStudent = new Set();

            // For each batch the student is in, find courses that:
            // 1. Have this batch in their batches array
            // 2. Have the current faculty in their faculty array
            for (const batchId of studentBatchIds) {
                const coursesInBatch = await Course.find({
                    batches: batchId,
                    faculty: facultyId
                }).select('title');

                coursesInBatch.forEach(course => {
                    coursesForThisStudent.add(course.title);
                });
            }

            return {
                ...student,
                courses: Array.from(coursesForThisStudent)
            };
        }));

        res.json({
            success: true, 
            data: finalStudentList,
            pagination: { total: totalStudents, page, totalPages: Math.ceil(totalStudents / limit) }
        });

    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error fetching students.' });
    }
});



router.post('/students', authenticateFaculty, async (req, res) => {
    try {
        const newStudent = await Student.create(req.body);
        
        const studentResponse = newStudent.toObject();
        delete studentResponse.password;
        res.status(201).json({ success: true, data: studentResponse });
    } catch (error) {
        if (error.code === 11000) return res.status(409).json({ success: false, message: 'Email, username, or roll number already exists.'});
        res.status(500).json({ success: false, message: 'Server error adding student.' });
    }
});


// @desc    Faculty: Get batches THEY teach for dropdowns
// @route   GET /api/faculty/my-batches
router.get('/my-batches', authenticateFaculty, async (req, res) => {
    try {
        // 1. Find all courses taught by the logged-in faculty
        const myCourses = await Course.find({ faculty: req.user._id }).select('batches');

        if (!myCourses || myCourses.length === 0) {
            // If the faculty teaches no courses, they have no batches
            return res.json({ success: true, data: [] });
        }

        // 2. Collect all batch IDs from all those courses
        const batchIds = myCourses.flatMap(course => course.batches);

        // 3. Get a unique set of batch IDs to prevent duplicates
        const uniqueBatchIds = [...new Set(batchIds.map(id => id.toString()))];

        // 4. Find all batch documents corresponding to the unique IDs
        const batches = await Batch.find({ _id: { $in: uniqueBatchIds } })
            .select('name academicYear')
            .sort({ academicYear: -1, name: 1 }); // Sort for a clean dropdown

        res.json({ success: true, data: batches });
    } catch (error) {
        console.error("Error fetching faculty's batches:", error);
        res.status(500).json({ success: false, message: 'Could not fetch batches.' });
    }
});


// @desc    Faculty: Update a student's details
// @route   PUT /api/faculty/students/:id
router.put('/students/:id', authenticateFaculty, async (req, res) => {
    try {
        const studentId = req.params.id;
        const student = await Student.findById(studentId);
        if (!student) return res.status(404).json({ success: false, message: 'Student not found.' });

        // The update logic is similar to the admin version
        const { firstName, lastName, email, username, ...otherData } = req.body;
        student.firstName = firstName ?? student.firstName;
        student.lastName = lastName ?? student.lastName;
        student.email = email ?? student.email;
        student.username = username ?? student.username;
        // Update other fields as needed
        Object.assign(student, otherData);

        await student.save();
        res.json({ success: true, message: 'Student updated successfully.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error updating student.' });
    }
});


// @desc    Faculty: Delete a student they manage
// @route   DELETE /api/faculty/students/:id
router.delete('/students/:id', authenticateFaculty, async (req, res) => {
    try {
        const studentId = req.params.id;
        const student = await Student.findById(studentId);
        if (!student) return res.status(404).json({ success: false, message: 'Student not found.' });

        // --- Security Check: Verify this faculty can manage this student ---
        const studentBatchId = student.batch;
        if (!studentBatchId) return res.status(403).json({ success: false, message: 'This student is not in a batch.' });

        const isMyBatch = await Course.findOne({ faculty: req.user._id, batches: studentBatchId });
        if (!isMyBatch) {
            return res.status(403).json({ success: false, message: "You don't have permission to delete students from this batch." });
        }

        // Perform the cascading delete
        await Promise.all([
            Batch.updateOne({ _id: studentBatchId }, { $pull: { students: studentId } }),
            Course.updateMany({ batches: studentBatchId }, { $pull: { students: studentId } }),
            Submission.deleteMany({ student: studentId }),
            Grade.deleteMany({ student: studentId }),
            Student.findByIdAndDelete(studentId)
        ]);

        res.json({ success: true, message: 'Student and all associated data deleted.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error deleting student.' });
    }
});

router.get('/batches/all', authenticateFaculty, async (req, res) => {
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
  // @route   POST /api/faculty/batches/add
  router.post('/batches/add', authenticateFaculty, async (req, res) => {
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
            creatorModel: 'Faculty'
        });
  
        // --- CRUCIAL: Update the 'batches' field for all assigned students ---
        if (students && students.length > 0) {
            await Student.updateMany(
                { _id: { $in: students } },
                { $addToSet: { batch: newBatch._id } }  // Changed to $addToSet and correct field name 'batches'
            );
        }
  
        res.status(201).json({ success: true, data: newBatch, message: 'Batch created successfully' });
    } catch (error) {
        console.error('Error creating batch:', error);
        res.status(500).json({ success: false, message: 'Server error creating batch.' });
    }
  });
  
  router.put('/batches/update/:id', authenticateFaculty, async (req, res) => {
    try {
        const { name, academicYear, students, department } = req.body;
        const batchId = req.params.id;

        const batch = await Batch.findById(batchId);
        if (!batch) return res.status(404).json({ success: false, message: 'Batch not found.' });
        
        // Compare original and new student lists
        const originalStudentIds = batch.students.map(id => id.toString());
        const newStudentIds = students.map(id => id.toString());
        
        // Find removed and added students
        const removedStudentIds = originalStudentIds.filter(id => !newStudentIds.includes(id));
        const addedStudentIds = newStudentIds.filter(id => !originalStudentIds.includes(id));

        // Handle removed students
        if (removedStudentIds.length > 0) {
            // Remove batch reference from students
            await Student.updateMany(
                { _id: { $in: removedStudentIds } },
                { $pull: { batch: batchId } }
            );

            // Get all courses and tasks for this batch
            const coursesWithThisBatch = await Course.find({ batches: batchId }).select('_id');
            const courseIds = coursesWithThisBatch.map(c => c._id);
            const tasksInTheseCourses = await Task.find({ course: { $in: courseIds } }).select('_id');
            const taskIds = tasksInTheseCourses.map(t => t._id);

            // Delete grades for removed students
            if (taskIds.length > 0) {
                await Grade.deleteMany({
                    task: { $in: taskIds },
                    student: { $in: removedStudentIds }
                });
            }
        }

        // Handle added students
        if (addedStudentIds.length > 0) {
            // Add batch reference to students
            await Student.updateMany(
                { _id: { $in: addedStudentIds } },
                { $addToSet: { batch: batchId } }
            );

            // Get all courses and tasks for this batch
            const coursesWithThisBatch = await Course.find({ batches: batchId }).select('_id');
            const courseIds = coursesWithThisBatch.map(c => c._id);
            const tasksInTheseCourses = await Task.find({ course: { $in: courseIds } }).select('_id');
            const taskIds = tasksInTheseCourses.map(t => t._id);

            // Create grade placeholders for new students
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
    
        // Update batch document
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
        console.error('Error updating batch:', error);
        res.status(500).json({ success: false, message: 'Server error updating batch.' });
    }
  });
  
  
  // @desc    Delete a batch and update its former students
  // @route   DELETE /api/faculty/batches/delete/:id
  // @desc    Delete a batch and synchronize all related data
  // @route   DELETE /api/faculty/batches/delete/:id
  router.delete('/batches/delete/:id', authenticateFaculty, async (req, res) => {
    try {
        const batchId = req.params.id;
        const batch = await Batch.findById(batchId);
        if (!batch) return res.status(404).json({ success: false, message: 'Batch not found.' });
  
        const studentIdsInBatch = batch.students;
  
        // Get all courses that had this batch
        const coursesWithBatch = await Course.find({ batches: batchId });
        const courseIds = coursesWithBatch.map(course => course._id);
  
        // Get all tasks from these courses
        const tasks = await Task.find({ course: { $in: courseIds } });
        const taskIds = tasks.map(task => task._id);
  
        // Un-assign students from this batch and remove all associated data
        await Promise.all([
            // Remove batch from students
            Student.updateMany(
                { _id: { $in: studentIdsInBatch } }, 
                { $pull: { batch: batchId } }
            ),
            // Remove students and batch from courses
            Course.updateMany(
                { batches: batchId }, 
                { $pull: { students: { $in: studentIdsInBatch }, batches: batchId } }
            ),
            // Delete all submissions for these tasks from these students
            Submission.deleteMany({
                student: { $in: studentIdsInBatch },
                task: { $in: taskIds }
            }),
            // Delete all grades for these tasks from these students
            Grade.deleteMany({
                student: { $in: studentIdsInBatch },
                task: { $in: taskIds }
            }),
            // Finally delete the batch
            Batch.findByIdAndDelete(batchId)
        ]);
  
        res.json({ success: true, message: 'Batch deleted and all associated data removed.' });
    } catch (error) {
        console.error('Error deleting batch:', error);
        res.status(500).json({ success: false, message: 'Server error deleting batch.' });
    }
  });
  
  
  // @desc    Search for students to add to a batch
  // @route   GET /api/faculty/students/search?q=...
  router.get('/students/search', authenticateFaculty, async (req, res) => {
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



  // ... (all necessary model imports and authenticateFaculty middleware)

// ===========================================
// === FACULTY-SCOPED COURSE MANAGEMENT ====
// ===========================================

// @desc    Faculty: Fetch only courses they teach
// @route   GET /api/faculty/courses
router.get('/courses/all', authenticateFaculty, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 6;
        const search = req.query.search || '';

        // The crucial filter: only courses where the logged-in faculty is in the 'faculty' array
        const query = { 
            faculty: req.user._id,
            ...(search && { $or: [{ title: { $regex: search, $options: 'i' } }, { courseCode: { $regex: search, $options: 'i' } }] })
        };

        const totalCourses = await Course.countDocuments(query);
        const courses = await Course.find(query)
            .populate('faculty', 'firstName lastName photo')
            .populate('batches', 'name')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        // Add faculty metadata to each course
        const coursesWithMetadata = courses.map(course => {
            const facultyCount = course.faculty.length;
            const facultyNames = course.faculty.map(f => `${f.firstName} ${f.lastName}`).join(', ');
            return {
                ...course.toObject(),
                facultyMetadata: facultyCount === 1 ? 'none' : 
                               facultyCount > 1 ? `(${facultyNames})` : 
                               facultyCount
            };
        });

        res.json({ 
            success: true, 
            data: coursesWithMetadata, 
            pagination: { 
                total: totalCourses, 
                page, 
                totalPages: Math.ceil(totalCourses / limit) 
            } 
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error fetching courses.' });
    }
});

// @desc    Faculty: Get deep details for a single course (tasks and students)
// @route   GET /api/faculty/courses/details/:id
router.get('/courses/details/:id', authenticateFaculty, async (req, res) => {
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
        
        // Security check: ensure they are an instructor for this course
        if (!course.faculty.some(f => f._id.toString() === req.user._id.toString())) {
            return res.status(403).json({ success: false, message: 'You do not have permission to access this course.' });
        }
        
        const tasks = await Task.find({ course: course._id }).select('title dueDate');

        res.json({ success: true, data: { course, tasks } });
    } catch (error) {
        console.error('Error in course details:', error);
        res.status(500).json({ success: false, message: 'Server error fetching course details.' });
    }
});


// @desc    Faculty: Create a new course, auto-assigning themselves as instructor
// @route   POST /api/faculty/courses
router.post('/courses/add', authenticateFaculty, async (req, res) => {
    try {
        const { title, courseCode, ...restOfBody } = req.body;
        
        const courseExists = await Course.findOne({ courseCode });
        if (courseExists) return res.status(409).json({ success: false, message: 'Course code already exists.' });

        const newCourse = await Course.create({
            title, courseCode, ...restOfBody,
            faculty: [req.user._id], // Automatically assign the logged-in faculty
            createdBy: req.user._id, // Set creator
            creatorModel: 'Faculty'
        });
        res.status(201).json({ success: true, data: newCourse });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error creating course.' });
    }
});

// @desc    Faculty: Update THEIR OWN course
// @route   PUT /api/faculty/courses/:id
router.put('/courses/:id', authenticateFaculty, async (req, res) => {
    try {
        const courseId = req.params.id;
        // Faculty cannot change the instructor list, so we omit it from the update data
        const { faculty, ...updateData } = req.body;

        const course = await Course.findById(courseId);
        if (!course) return res.status(404).json({ success: false, message: 'Course not found.' });
        
        // Security check: ensure they are an instructor for this course
        if (!course.faculty.includes(req.user._id)) {
            return res.status(403).json({ success: false, message: 'You are not authorized to edit this course.' });
        }

        // Get all tasks for this course
        const tasks = await Task.find({ course: courseId });
        const taskIds = tasks.map(task => task._id);

        // Handle batch changes
        const oldBatchIds = course.batches.map(id => id.toString());
        const newBatchIds = (updateData.batches || []).map(id => id.toString());

        // Handle added batches - add tasks and grades to students in new batches
        const addedBatchIds = newBatchIds.filter(id => !oldBatchIds.includes(id));
        if (addedBatchIds.length > 0) {
            // Get all students in the added batches
            const studentsInNewBatches = await Student.find({ batch: { $in: addedBatchIds } });
            
            // For each student, add all course tasks and create grade entries
            for (const student of studentsInNewBatches) {
                // Add tasks to student
                await Student.findByIdAndUpdate(
                    student._id,
                    { $addToSet: { tasks: { $each: taskIds } } }
                );

                // Create grade entries for each task
                const gradePlaceholders = taskIds.map(taskId => ({
                    task: taskId,
                    student: student._id,
                    course: courseId,
                }));
                await Grade.insertMany(gradePlaceholders, { ordered: false });
            }
        }

        // Handle removed batches - remove tasks and grades from students in removed batches
        const removedBatchIds = oldBatchIds.filter(id => !newBatchIds.includes(id));
        if (removedBatchIds.length > 0) {
            // Get all students in the removed batches
            const studentsInRemovedBatches = await Student.find({ batch: { $in: removedBatchIds } });
            
            // For each student, remove all course tasks and grades
            for (const student of studentsInRemovedBatches) {
                // Remove tasks from student
                await Student.findByIdAndUpdate(
                    student._id,
                    { $pullAll: { tasks: taskIds } }
                );

                // Remove grades for this student's tasks
                await Grade.deleteMany({
                    student: student._id,
                    task: { $in: taskIds }
                });
            }
        }

        // Update the course with new data
        const updatedCourse = await Course.findByIdAndUpdate(
            courseId,
            updateData,
            { new: true, runValidators: true }
        ).populate('batches', 'name');

        res.json({ 
            success: true, 
            data: updatedCourse,
            message: 'Course updated successfully. Student enrollments synchronized.'
        });
    } catch (error) {
        console.error('Error updating course:', error);
        res.status(500).json({ success: false, message: 'Server error updating course.' });
    }
});

// @desc    Delete a course
// @route   DELETE /api/faculty/courses/delete/:id
router.delete('/courses/delete/:id', authenticateFaculty, async (req, res) => {
    try {
        const course = await Course.findById(req.params.id);
        if (!course) return res.status(404).json({ success: false, message: 'Course not found.' });

        // Check if the course belongs to this faculty
        if (!course.faculty.includes(req.user._id)) {
            return res.status(403).json({ success: false, message: 'Not authorized to delete this course.' });
        }

        // Get all tasks for this course
        const tasks = await Task.find({ course: course._id });
        const taskIds = tasks.map(task => task._id);

        // Delete all grades and tasks in parallel
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


// @desc    Faculty: Search for batches to assign to a course
// @route   GET /api/faculty/search-batches
router.get('/search-batches', authenticateFaculty, async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || q.length < 1) return res.json({ success: true, data: [] });
        
        // Faculty can search any batch to add to their course
        const results = await Batch.find({
            name: { $regex: q, $options: 'i' }
        }).select('name academicYear').limit(10);
        
        res.json({ success: true, data: results });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Search failed.' });
    }
});
export default router;