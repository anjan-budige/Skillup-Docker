import express from 'express';
import jwt from 'jsonwebtoken';
import moment from 'moment'; 


import Student from '../models/Student.js';
import Course from '../models/Course.js';
import Task from '../models/Task.js';
import Grade from '../models/Grade.js';
import Batch from '../models/Batch.js';
import Submission from '../models/Submission.js';

const router = express.Router();


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




router.get('/dashboard-stats', authenticateStudent, async (req, res) => {
    try {
        const studentId = req.user._id;

        
        
        const student = await Student.findById(studentId).populate('batch');
        if (!student) {
            return res.status(404).json({ success: false, message: 'Student not found.' });
        }

        const studentBatchIds = student.batch?.map(batch => batch._id) || [];
        
        
        const myCourses = await Course.find({ 
            batches: { $in: studentBatchIds }
        }).select('_id title courseCode');
        
        const myCourseIds = myCourses.map(c => c._id);
        
        
        const myTasks = await Task.find({ course: { $in: myCourseIds } })
            .select('_id maxPoints dueDate publishDate');
        const myTaskIds = myTasks.map(t => t._id);

        
        const submittedTaskIds = await Submission.find({
            student: studentId,
            task: { $in: myTaskIds }
        }).distinct('task');

        
        const completedTaskIds = await Grade.find({
            student: studentId,
            task: { $in: myTaskIds },
            grade: { $ne: null }
        }).distinct('task');

        
        
        
        
        
        
        
        const now = new Date();
        const pendingTasksCount = await Task.countDocuments({
            _id: { $in: myTaskIds, $nin: submittedTaskIds }, 
            dueDate: { $gte: now }, 
            publishDate: { $lte: now } 
        });

        
        const [
            kpiData,
            taskCompletionTrend,
            upcomingDeadlines
        ] = await Promise.all([
            
            Promise.all([
                
                Grade.countDocuments({ 
                    student: studentId, 
                    task: { $in: myTaskIds },
                    grade: { $ne: null } 
                }),
                Grade.aggregate([
                    { 
                        $match: { 
                            student: studentId,
                            task: { $in: myTaskIds },
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
            ]).then(([completedCount, marksResult]) => ({
                enrolledCourses: myCourses.length,
                pendingAssignments: pendingTasksCount, 
                completedTasks: completedCount,
                averageScore: marksResult[0]?.totalMarks ? 
                    ((marksResult[0]?.obtainedMarks || 0) / marksResult[0].totalMarks * 100).toFixed(2) : 0
            })),

            
            Grade.aggregate([
                { 
                    $match: { 
                        student: studentId,
                        task: { $in: myTaskIds },
                        grade: { $ne: null }, 
                        createdAt: { $gte: moment().subtract(4, 'weeks').toDate() } 
                    } 
                },
                {
                    $group: {
                        _id: { $week: "$createdAt" },
                        tasksCompleted: { $sum: 1 }
                    }
                },
                { $sort: { _id: 1 } },
                { $project: { _id: 0, week: { $concat: ["Week ", { $toString: "$_id" }] }, tasksCompleted: 1 } }
            ]),

            
            
            Task.find({ 
                course: { $in: myCourseIds },
                dueDate: { $gte: now },
                _id: { $nin: submittedTaskIds }, 
                publishDate: { $lte: now } 
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




router.get('/courses/all', authenticateStudent, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 6;
        const search = req.query.search || '';

        
        const student = await Student.findById(req.user._id).populate('batch');
        const batchIds = student.batch.map(b => b._id);

        
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
        
        
        const student = await Student.findById(req.user._id);
        console.log('Student batches:', student.batch);
        console.log('Course batches:', course.batches);
        
        
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

        
        const facultyCount = course.faculty.length;
        const facultyNames = course.faculty.map(f => `${f.firstName} ${f.lastName}`).join(', ');
        const courseWithMetadata = {
            ...course.toObject(),
            facultyMetadata: facultyCount === 1 ? 'none' : 
                           facultyCount > 1 ? `(${facultyNames})` : 
                           facultyCount
        };
        
        
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



router.get('/tasks/all', authenticateStudent, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 9;
        const search = req.query.search || '';
        const courseId = req.query.courseId || '';

        
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

        
        const grades = await Grade.find({
            task: { $in: tasks.map(t => t._id) },
            student: req.user._id
        }).select('task grade status submission');

        
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

        
        const student = await Student.findById(req.user._id);
        const studentBatchIds = student.batch.map(id => id.toString());
        const courseBatchIds = task.course.batches.map(batch => batch._id.toString());
        
        const isEnrolled = studentBatchIds.some(studentBatchId => 
            courseBatchIds.includes(studentBatchId)
        );

        if (!isEnrolled) {
            return res.status(403).json({ success: false, message: 'You are not enrolled in this course.' });
        }

        
        const kolkataTime = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
        const taskDueDate = new Date(task.dueDate).toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
        const isDeadlinePassed = new Date(taskDueDate) < new Date(kolkataTime);

        
        const submissionDetails = await Submission.findOne({
            task: taskId,
            student: req.user._id
        }).select('content attachments status createdAt');

        
        const grade = await Grade.findOne({ 
            task: taskId,
            student: req.user._id
        }).select('grade status feedback');

        
        if (submissionDetails && !grade) {
            await Grade.create({
                task: taskId,
                student: req.user._id,
                submission: submissionDetails._id,
                status: 'Pending'
            });
        }

        res.json({ 
            success: true, 
            data: { 
                task,
                grade: grade || null,
                submissionStatus: submissionDetails ? 'Submitted' : 'Not Submitted',
                submission: submissionDetails,
                isDeadlinePassed
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

        
        const student = await Student.findById(req.user._id);
        const studentBatchIds = student.batch.map(id => id.toString());
        const courseBatchIds = task.course.batches.map(batch => batch._id.toString());
        
        const isEnrolled = studentBatchIds.some(studentBatchId => 
            courseBatchIds.includes(studentBatchId)
        );

        if (!isEnrolled) {
            return res.status(403).json({ success: false, message: 'You are not enrolled in this course.' });
        }

        
        const kolkataTime = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
        const taskDueDate = new Date(task.dueDate).toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
        
        if (new Date(taskDueDate) < new Date(kolkataTime)) {
            return res.status(400).json({ success: false, message: 'Task deadline has passed.' });
        }

        
        const existingSubmission = await Submission.findOne({
            task: taskId,
            student: req.user._id
        });

        if (existingSubmission) {
            
            const grade = await Grade.findOne({
                task: taskId,
                student: req.user._id,
                status: 'Graded'
            });

            if (grade) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Cannot update submission as task has already been graded.' 
                });
            }

            
            const updatedSubmission = await Submission.findByIdAndUpdate(
                existingSubmission._id,
                {
                    content,
                    attachments,
                    submittedAt: new Date(),
                    status: 'On-Time'
                },
                { new: true }
            );

            
            const updatedGrade = await Grade.findOneAndUpdate(
                { 
                    task: taskId,
                    student: req.user._id
                },
                {
                    $set: {
                        submission: updatedSubmission._id,
                        status: 'Pending'
                    }
                },
                { new: true }
            );

            res.json({ 
                success: true, 
                message: 'Task submission updated successfully',
                data: { submission: updatedSubmission, grade: updatedGrade }
            });
        } else {
            
            const newSubmission = await Submission.create({
                content,
                attachments,
                submittedAt: new Date(),
                status: 'On-Time',
                course: task.course._id,
                student: req.user._id,
                task: taskId
            });

            
            const grade = await Grade.findOneAndUpdate(
                { 
                    task: taskId,
                    student: req.user._id
                },
                {
                    $set: {
                        submission: newSubmission._id,
                        status: 'Pending'
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
                data: { submission: newSubmission, grade }
            });
        }

    } catch (error) {
        console.error("Error submitting task:", error);
        res.status(500).json({ success: false, message: 'Server error submitting task.' });
    }
});



router.get('/grades', authenticateStudent, async (req, res) => {
    try {
        const grades = await Grade.find({ 
            student: req.user._id,
            grade: { $ne: null }  
        })
            .populate('course', 'title courseCode')
            .populate('task', 'title maxPoints')
            .sort({ createdAt: -1 });

        
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