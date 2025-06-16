import express from 'express';
import jwt from 'jsonwebtoken';
import moment from 'moment'; 


import Faculty from '../models/Faculty.js';
import Course from '../models/Course.js';
import Task from '../models/Task.js';
import Grade from '../models/Grade.js';
import Submission from '../models/Submission.js';
import Student from '../models/Student.js';
import Batch from '../models/Batch.js';

const router = express.Router();


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








router.get('/dashboard-stats', authenticateFaculty, async (req, res) => {
    try {
        const facultyId = req.user._id;

        
        const myCourses = await Course.find({ faculty: facultyId })
            .populate({
                path: 'batches',
                select: '_id',
                populate: {
                    path: 'students',
                    select: '_id'
                }
            });

        
        const myStudentIds = [...new Set(
            myCourses.flatMap(course => 
                course.batches.flatMap(batch => 
                    batch.students.map(student => student._id)
                )
            )
        )];

        
        const myTaskIds = (await Task.find({ createdBy: facultyId }).select('_id')).map(t => t._id);

        
        const [kpiData, submissionTrend, topStudents, recentActivity] = await Promise.all([
            
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
            
            Submission.aggregate([
                { $match: { task: { $in: myTaskIds }, createdAt: { $gte: moment().subtract(7, 'days').toDate() } } },
                { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
                { $sort: { _id: 1 } }
            ]),
            
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








router.get('/my-courses', authenticateFaculty, async (req, res) => {
    try {
        const courses = await Course.find({ faculty: req.user._id }).select('title courseCode');
        res.json({ success: true, data: courses });
    } catch (error) { res.status(500).json({ success: false, message: 'Server error.' }); }
});



router.get('/tasks/all', authenticateFaculty, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 9;
        const search = req.query.search || '';
        const courseId = req.query.courseId || '';

        
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
            const newCourse = await Course.findOne({ _id: course, faculty: req.user._id });
            
            if (!newCourse) {
                return res.status(400).json({ success: false, message: 'New course is invalid or you are not authorized.' });
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



router.get('/search/task-assignables', authenticateFaculty, async (req, res) => {
  try {
      const { type, q } = req.query;
      if (type !== 'course' || !q || q.length < 1) return res.json({ success: true, data: [] });

      
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



router.get('/tasks/:id/grades', authenticateFaculty, async (req, res) => {
  try {
      const taskId = req.params.id;
      
      
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

      
      const grades = await Grade.find({ task: taskId })
          .populate('student', 'firstName lastName email rollNumber photo')
          .populate({
              path: 'submission',
              select: 'submittedAt status attachments content createdAt updatedAt'
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



router.post('/tasks/:id/grade', authenticateFaculty, async (req, res) => {
  try {
      const taskId = req.params.id;
      const task = await Task.findById(taskId);
      
      if (!task) {
          return res.status(404).json({ success: false, message: 'Task not found' });
      }

      
      const course = await Course.findById(task.course);
      if (!course || !course.faculty.some(facultyId => facultyId.equals(req.user._id))) {
          return res.status(403).json({ success: false, message: 'Not authorized to grade this task' });
      }

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



router.get('/tasks/:id/submissions', authenticateFaculty, async (req, res) => {
  try {
      const taskId = req.params.id;
      const task = await Task.findById(taskId).populate('course', 'title students');
      if (!task) return res.status(404).json({ success: false, message: 'Task not found' });

      
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


router.get('/analytics', authenticateFaculty, async (req, res) => {
    try {
        const facultyId = req.user._id;
        const { startDate, endDate } = req.query;

        let dateFilter = {};
        if (startDate && endDate) {
            dateFilter.createdAt = {
                $gte: new Date(new Date(startDate).toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })),
                $lte: new Date(new Date(endDate).toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
            };
        }

        const myCourses = await Course.find({ faculty: facultyId })
            .populate('batches', 'name')
            .select('_id title batches');

        const batchIds = myCourses.flatMap(course => course.batches.map(batch => batch._id));

        const [
            kpiData,
            submissionTrend,
            coursePerformance,
            batchPerformance,
            facultyPerformance
        ] = await Promise.all([
            Grade.aggregate([
                { $match: { ...dateFilter, course: { $in: myCourses.map(c => c._id) } } },
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
                { $match: { ...dateFilter, course: { $in: myCourses.map(c => c._id) } } },
                {
                    $group: {
                        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { _id: 1 } }
            ]),
            
            Grade.aggregate([
                { $match: { ...dateFilter, course: { $in: myCourses.map(c => c._id) } } },
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

            Grade.aggregate([
                { $match: { ...dateFilter, course: { $in: myCourses.map(c => c._id) } } },
                {
                    $lookup: {
                        from: 'courses',
                        localField: 'course',
                        foreignField: '_id',
                        as: 'courseInfo'
                    }
                },
                { $unwind: '$courseInfo' },
                {
                    $lookup: {
                        from: 'batches',
                        localField: 'courseInfo.batches',
                        foreignField: '_id',
                        as: 'batchInfo'
                    }
                },
                { $unwind: '$batchInfo' },
                {
                    $group: {
                        _id: '$batchInfo._id',
                        batchName: { $first: '$batchInfo.name' },
                        averageGrade: { $avg: '$grade' },
                        submissionCount: { $sum: { $cond: [{ $ne: ['$submission', null] }, 1, 0] } },
                        totalStudents: { $addToSet: '$student' }
                    }
                },
                {
                    $project: {
                        _id: 0,
                        batchName: 1,
                        averageGrade: 1,
                        submissionCount: 1,
                        studentCount: { $size: '$totalStudents' }
                    }
                },
                { $sort: { averageGrade: -1 } }
            ]),
            
            Task.aggregate([
                { $match: { ...dateFilter, createdBy: facultyId } },
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
                batchPerformance,
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





router.get('/students', authenticateFaculty, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || '';
        const sortBy = req.query.sortBy || 'createdAt';
        const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
        const facultyId = req.user._id;

        
        const myCourses = await Course.find({ faculty: facultyId }).select('_id title');

        
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

        
        const finalStudentList = await Promise.all(studentList.map(async student => {
            const studentBatchIds = student.batch || [];
            const coursesForThisStudent = new Set();

            
            
            
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




router.get('/my-batches', authenticateFaculty, async (req, res) => {
    try {
        
        const myCourses = await Course.find({ faculty: req.user._id }).select('batches');

        if (!myCourses || myCourses.length === 0) {
            
            return res.json({ success: true, data: [] });
        }

        
        const batchIds = myCourses.flatMap(course => course.batches);

        
        const uniqueBatchIds = [...new Set(batchIds.map(id => id.toString()))];

        
        const batches = await Batch.find({ _id: { $in: uniqueBatchIds } })
            .select('name academicYear')
            .sort({ academicYear: -1, name: 1 }); 

        res.json({ success: true, data: batches });
    } catch (error) {
        console.error("Error fetching faculty's batches:", error);
        res.status(500).json({ success: false, message: 'Could not fetch batches.' });
    }
});




router.put('/students/:id', authenticateFaculty, async (req, res) => {
    try {
        const studentId = req.params.id;
        const student = await Student.findById(studentId);
        if (!student) return res.status(404).json({ success: false, message: 'Student not found.' });

        
        const { firstName, lastName, email, username, ...otherData } = req.body;
        student.firstName = firstName ?? student.firstName;
        student.lastName = lastName ?? student.lastName;
        student.email = email ?? student.email;
        student.username = username ?? student.username;
        
        Object.assign(student, otherData);

        await student.save();
        res.json({ success: true, message: 'Student updated successfully.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error updating student.' });
    }
});




router.delete('/students/:id', authenticateFaculty, async (req, res) => {
    try {
        const studentId = req.params.id;
        const student = await Student.findById(studentId);
        if (!student) return res.status(404).json({ success: false, message: 'Student not found.' });

        
        const studentBatchId = student.batch;
        if (!studentBatchId) return res.status(403).json({ success: false, message: 'This student is not in a batch.' });

        const isMyBatch = await Course.findOne({ faculty: req.user._id, batches: studentBatchId });
        if (!isMyBatch) {
            return res.status(403).json({ success: false, message: "You don't have permission to delete students from this batch." });
        }

        
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
  
  
  
  
  router.post('/batches/add', authenticateFaculty, async (req, res) => {
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
            creatorModel: 'Faculty'
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
  
  router.put('/batches/update/:id', authenticateFaculty, async (req, res) => {
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
        console.error('Error updating batch:', error);
        res.status(500).json({ success: false, message: 'Server error updating batch.' });
    }
  });
  
  
  
  
  
  
  router.delete('/batches/delete/:id', authenticateFaculty, async (req, res) => {
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



  







router.get('/courses/all', authenticateFaculty, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 6;
        const search = req.query.search || '';

        
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




router.post('/courses/add', authenticateFaculty, async (req, res) => {
    try {
        const { title, courseCode, ...restOfBody } = req.body;
        
        const courseExists = await Course.findOne({ courseCode });
        if (courseExists) return res.status(409).json({ success: false, message: 'Course code already exists.' });

        const newCourse = await Course.create({
            title, courseCode, ...restOfBody,
            faculty: [req.user._id], 
            createdBy: req.user._id, 
            creatorModel: 'Faculty'
        });
        res.status(201).json({ success: true, data: newCourse });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error creating course.' });
    }
});



router.put('/courses/:id', authenticateFaculty, async (req, res) => {
    try {
        const courseId = req.params.id;
        
        const { faculty, ...updateData } = req.body;

        const course = await Course.findById(courseId);
        if (!course) return res.status(404).json({ success: false, message: 'Course not found.' });
        
        
        if (!course.faculty.includes(req.user._id)) {
            return res.status(403).json({ success: false, message: 'You are not authorized to edit this course.' });
        }

        
        const tasks = await Task.find({ course: courseId });
        const taskIds = tasks.map(task => task._id);

        
        const oldBatchIds = course.batches.map(id => id.toString());
        const newBatchIds = (updateData.batches || []).map(id => id.toString());

        
        const addedBatchIds = newBatchIds.filter(id => !oldBatchIds.includes(id));
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

        
        const removedBatchIds = oldBatchIds.filter(id => !newBatchIds.includes(id));
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



router.delete('/courses/delete/:id', authenticateFaculty, async (req, res) => {
    try {
        const course = await Course.findById(req.params.id);
        if (!course) return res.status(404).json({ success: false, message: 'Course not found.' });

        
        if (!course.faculty.includes(req.user._id)) {
            return res.status(403).json({ success: false, message: 'Not authorized to delete this course.' });
        }

        
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




router.get('/search-batches', authenticateFaculty, async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || q.length < 1) return res.json({ success: true, data: [] });
        
        
        const results = await Batch.find({
            name: { $regex: q, $options: 'i' }
        }).select('name academicYear').limit(10);
        
        res.json({ success: true, data: results });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Search failed.' });
    }
});
export default router;