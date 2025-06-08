import express from 'express';
import jwt from 'jsonwebtoken';
import moment from 'moment'; // For date calculations

// Import all necessary models
import Student from '../models/Student.js';
import Course from '../models/Course.js';
import Task from '../models/Task.js';
import Grade from '../models/Grade.js';
import Batch from '../models/Batch.js';
import Submission from '../models/Submission.js';

const router = express.Router();

// --- Reusable Middleware for Student Authentication & Authorization ---
const authenticateStudent = async (req, res, next) => {
    try {
        const token = req.headers['authorization']?.split(' ')[1];
        if (!token) return res.status(401).json({ success: false, message: 'Access denied.' });
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.role !== 'Student') return res.status(403).json({ success: false, message: 'Forbidden.' });
        
        req.user = await Student.findById(decoded.id).select('-password');
        if (!req.user) return res.status(404).json({ success: false, message: 'Student user not found.' });
        
        next();
    } catch (error) {
        return res.status(401).json({ success: false, message: 'Invalid token.' });
    }
};

// @desc    Fetch aggregated statistics for the logged-in student's dashboard
// @route   GET /api/student/dashboard-stats
router.get('/dashboard-stats', authenticateStudent, async (req, res) => {
    try {
        const studentId = req.user._id;

        // --- 1. Find all courses and tasks relevant to this student ---
        // First get student's batches
        const student = await Student.findById(studentId).populate('batch');
        if (!student) {
            return res.status(404).json({ success: false, message: 'Student not found.' });
        }

        const studentBatchIds = student.batch?.map(batch => batch._id) || [];
        
        // Find courses associated with student's batches
        const myCourses = await Course.find({ 
            batches: { $in: studentBatchIds }
        }).select('_id title courseCode');
        
        const myCourseIds = myCourses.map(c => c._id);
        
        const myTasks = await Task.find({ course: { $in: myCourseIds } }).select('_id maxPoints');
        const myTaskIds = myTasks.map(t => t._id);

        // --- 2. Run All Aggregations in Parallel ---
        const [
            kpiData,
            taskCompletionTrend,
            upcomingDeadlines
        ] = await Promise.all([
            // --- KPIs ---
            Promise.all([
                Grade.countDocuments({ student: studentId, status: 'Pending', submission: null }),
                Grade.countDocuments({ student: studentId, submission: { $ne: null } }),
                Grade.aggregate([
                    { 
                        $match: { 
                            student: studentId, 
                            submission: { $ne: null }, 
                            grade: { $ne: null } 
                        }
                    },
                    {
                        $lookup: {
                            from: 'tasks',
                            localField: 'task',
                            foreignField: '_id',
                            as: 'taskDetails'
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            totalMarks: { $sum: { $arrayElemAt: ['$taskDetails.maxPoints', 0] } },
                            obtainedMarks: { $sum: '$grade' }
                        }
                    }
                ])
            ]).then(([pendingCount, completedCount, marksResult]) => ({
                enrolledCourses: myCourses.length,
                pendingAssignments: pendingCount,
                completedTasks: completedCount,
                averageScore: marksResult[0]?.totalMarks ? 
                    ((marksResult[0]?.obtainedMarks || 0) / marksResult[0].totalMarks * 100).toFixed(2) : 0
            })),

            // --- Task Completion Trend (last 4 weeks) ---
            Grade.aggregate([
                { $match: { student: studentId, submission: { $ne: null }, createdAt: { $gte: moment().subtract(4, 'weeks').toDate() } } },
                {
                    $group: {
                        _id: { $week: "$createdAt" },
                        tasksCompleted: { $sum: 1 }
                    }
                },
                { $sort: { _id: 1 } },
                { $project: { _id: 0, week: { $concat: ["Week ", { $toString: "$_id" }] }, tasksCompleted: 1 } }
            ]),

            // --- Upcoming Deadlines ---
            Task.find({ 
                course: { $in: myCourseIds },
                dueDate: { $gte: new Date() },
                _id: { $nin: await Grade.find({ student: studentId, submission: { $ne: null } }).distinct('task') }
            })
            .sort({ dueDate: 1 })
            .limit(5)
            .populate('course', 'title courseCode')
            .lean()
        ]);
        
        res.json({
            success: true,
            data: { kpiData, taskCompletionTrend, upcomingDeadlines }
        });

    } catch (error) {
        console.error("Student Dashboard Stats Error:", error);
        res.status(500).json({ success: false, message: 'Server error fetching dashboard data.' });
    }
});


// @desc    Student: Fetch only courses they are enrolled in
// @route   GET /api/student/courses/all
router.get('/courses/all', authenticateStudent, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 6;
        const search = req.query.search || '';

        // Get student's batches
        const student = await Student.findById(req.user._id).populate('batch');
        const batchIds = student.batch.map(b => b._id);

        // Find courses that have any of the student's batches
        const query = { 
            batches: { $in: batchIds },
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
        console.error('Error fetching student courses:', error);
        res.status(500).json({ success: false, message: 'Server error fetching courses.' });
    }
});

// @desc    Student: Get deep details for a single course (tasks and progress)
// @route   GET /api/student/courses/details/:id
router.get('/courses/details/:id', authenticateStudent, async (req, res) => {
    try {
        console.log('Fetching course details for ID:', req.params.id);
        
        const course = await Course.findById(req.params.id)
            .populate('faculty', 'firstName lastName photo')
            .populate('batches', '_id name');

        if (!course) {
            console.log('Course not found for ID:', req.params.id);
            return res.status(404).json({ success: false, message: 'Course not found' });
        }
        
        // Security check: ensure student is in one of the course's batches
        const student = await Student.findById(req.user._id);
        console.log('Student batches:', student.batch);
        console.log('Course batches:', course.batches);
        
        // Extract batch IDs correctly from populated batches
        const studentBatchIds = student.batch.map(id => id.toString());
        const courseBatchIds = course.batches.map(batch => batch._id.toString());
        
        console.log('Student batch IDs:', studentBatchIds);
        console.log('Course batch IDs:', courseBatchIds);
        
        const isEnrolled = studentBatchIds.some(studentBatchId => 
            courseBatchIds.includes(studentBatchId)
        );
        
        console.log('Is student enrolled:', isEnrolled);
        
        if (!isEnrolled) {
            console.log('Access denied - Student not enrolled in course');
            return res.status(403).json({ success: false, message: 'You are not enrolled in this course.' });
        }

        // Add faculty metadata to course
        const facultyCount = course.faculty.length;
        const facultyNames = course.faculty.map(f => `${f.firstName} ${f.lastName}`).join(', ');
        const courseWithMetadata = {
            ...course.toObject(),
            facultyMetadata: facultyCount === 1 ? 'none' : 
                           facultyCount > 1 ? `(${facultyNames})` : 
                           facultyCount
        };
        
        // Get tasks and student's grades for this course
        const tasks = await Task.find({ course: course._id })
            .select('title dueDate publishDate')
            .sort({ publishDate: -1 });
            
        const grades = await Grade.find({ 
            student: req.user._id,
            task: { $in: tasks.map(t => t._id) }
        }).select('task grade status submission');

        console.log('Successfully fetched course details');
        res.json({ success: true, data: { course: courseWithMetadata, tasks, grades } });
    } catch (error) {
        console.error('Error in course details:', error);
        res.status(500).json({ success: false, message: 'Server error fetching course details.' });
    }
});

// @desc    Student: Fetch all tasks with pagination and filtering
// @route   GET /api/student/tasks/all
router.get('/tasks/all', authenticateStudent, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 9;
        const search = req.query.search || '';
        const courseId = req.query.courseId || '';

        // First get all courses where student is enrolled
        const student = await Student.findById(req.user._id).populate('batch');
        const studentBatchIds = student.batch.map(batch => batch._id);
        
        const enrolledCourses = await Course.find({ 
            batches: { $in: studentBatchIds }
        }).select('_id');
        
        const courseIds = enrolledCourses.map(course => course._id);

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

        // Get grades for these tasks
        const grades = await Grade.find({
            task: { $in: tasks.map(t => t._id) },
            student: req.user._id
        }).select('task grade status submission');

        // Map grades to tasks
        const tasksWithGrades = tasks.map(task => {
            const grade = grades.find(g => g.task.toString() === task._id.toString());
            return {
                ...task.toObject(),
                grade: grade || null,
                submissionStatus: grade?.submission ? 'Submitted' : 'Not Submitted'
            };
        });

        res.json({
            success: true,
            data: tasksWithGrades,
            pagination: { total: totalTasks, page, totalPages: Math.ceil(totalTasks / limit) }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error fetching tasks.' });
    }
});

// @desc    Student: Get detailed statistics for a single task
// @route   GET /api/student/tasks/details/:id
router.get('/tasks/details/:id', authenticateStudent, async (req, res) => {
    try {
        const taskId = req.params.id;
        const task = await Task.findOne({ _id: taskId })
            .populate({
                path: 'course',
                select: 'title batches',
                populate: {
                    path: 'batches',
                    select: 'students'
                }
            })
            .populate('createdBy', 'firstName lastName');

        if (!task) {
            return res.status(404).json({ success: false, message: 'Task not found' });
        }

        // Check if student is enrolled in any of the course's batches
        const student = await Student.findById(req.user._id);
        const studentBatchIds = student.batch.map(id => id.toString());
        const courseBatchIds = task.course.batches.map(batch => batch._id.toString());
        
        const isEnrolled = studentBatchIds.some(studentBatchId => 
            courseBatchIds.includes(studentBatchId)
        );

        if (!isEnrolled) {
            return res.status(403).json({ success: false, message: 'You are not enrolled in this course.' });
        }

        // Get student's grade and submission for this task
        const grade = await Grade.findOne({ 
            task: taskId,
            student: req.user._id
        }).select('grade status submission feedback');

        // If there's a submission, get its details
        let submissionDetails = null;
        if (grade?.submission) {
            submissionDetails = await Submission.findOne({
                task: taskId,
                student: req.user._id
            }).select('content attachments status createdAt');
        }

        res.json({ 
            success: true, 
            data: { 
                task,
                grade: grade || null,
                submissionStatus: grade?.submission ? 'Submitted' : 'Not Submitted',
                submission: submissionDetails
            } 
        });
    } catch (error) {
        console.error("Error fetching task details:", error);
        res.status(500).json({ success: false, message: 'Server error fetching task details.' });
    }
});


router.post('/tasks/:id/submit', authenticateStudent, async (req, res) => {
    try {
        const taskId = req.params.id;
        const { content, attachments } = req.body;

        // Validate task exists and student is enrolled
        const task = await Task.findOne({ _id: taskId })
            .populate({
                path: 'course',
                select: 'batches',
                populate: {
                    path: 'batches',
                    select: 'students'
                }
            });

        if (!task) {
            return res.status(404).json({ success: false, message: 'Task not found' });
        }

        // Check if student is enrolled in any of the course's batches
        const student = await Student.findById(req.user._id);
        const studentBatchIds = student.batch.map(id => id.toString());
        const courseBatchIds = task.course.batches.map(batch => batch._id.toString());
        
        const isEnrolled = studentBatchIds.some(studentBatchId => 
            courseBatchIds.includes(studentBatchId)
        );

        if (!isEnrolled) {
            return res.status(403).json({ success: false, message: 'You are not enrolled in this course.' });
        }

        // Check if deadline has passed using Kolkata timezone
        const kolkataTime = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
        const taskDueDate = new Date(task.dueDate).toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
        
        if (new Date(taskDueDate) < new Date(kolkataTime)) {
            return res.status(400).json({ success: false, message: 'Task deadline has passed.' });
        }

        // Check if there's an existing submission and grade
        const existingGrade = await Grade.findOne({ 
            task: taskId,
            student: req.user._id
        }).populate('submission');

        if (existingGrade?.submission) {
            // If task is already graded, don't allow resubmission
            const kolkataTime = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
            const taskDueDate = new Date(task.dueDate).toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
            
            if (new Date(taskDueDate) < new Date(kolkataTime)) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Task deadline has passed.' 
                });
            }

            if (existingGrade.status === 'Graded') {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Cannot update submission as task has already been graded.' 
                });
            }

            // Update existing submission
            const updatedSubmission = await Submission.findByIdAndUpdate(
                existingGrade.submission._id,
                {
                    content,
                    attachments,
                    submittedAt: new Date(),
                    status: 'On-Time'
                },
                { new: true }
            );

            res.json({ 
                success: true, 
                message: 'Task submission updated successfully',
                data: updatedSubmission
            });
        } else {
            // Create new submission with all required fields
            const newSubmission = new Submission({
                content,
                attachments,
                submittedAt: new Date(),
                status: 'On-Time',
                course: task.course._id,
                student: req.user._id,
                task: taskId
            });
            await newSubmission.save();

            // Create grade with submission reference
            const submission = await Grade.findOneAndUpdate(
                { 
                    task: taskId,
                    student: req.user._id
                },
                {
                    $set: {
                        submission: newSubmission._id
                    }
                },
                { 
                    new: true,
                    upsert: true
                }
            );

            res.json({ 
                success: true, 
                message: 'Task submitted successfully',
                data: submission
            });
        }

    } catch (error) {
        console.error("Error submitting task:", error);
        res.status(500).json({ success: false, message: 'Server error submitting task.' });
    }
});

// @desc    Get all grades for the authenticated student
// @route   GET /api/student/grades
router.get('/grades', authenticateStudent, async (req, res) => {
    try {
        const grades = await Grade.find({ student: req.user._id })
            .populate('course', 'title courseCode')
            .populate('task', 'title maxPoints')
            .sort({ createdAt: -1 });

        // Calculate percentage for each grade
        const gradesWithPercentage = grades.map(grade => ({
            ...grade.toObject(),
            percentage: grade.grade ? (grade.grade / grade.task.maxPoints * 100).toFixed(2) : null
        }));

        res.json({
            success: true,
            grades: gradesWithPercentage
        });
    } catch (error) {
        console.error("Error fetching grades:", error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error while fetching grades.' 
        });
    }
});





export default router;