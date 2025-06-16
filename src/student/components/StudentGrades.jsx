import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Cookies from 'js-cookie';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { 
  BookOpen, 
  Award, 
  TrendingUp, 
  Clock, 
  CheckCircle, 
  AlertTriangle 
} from 'lucide-react';

function StudentGrades() {
  const [grades, setGrades] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState(null);

  useEffect(() => {
    fetchGrades();
  }, []);

  const fetchGrades = async () => {
    try {
      const token = Cookies.get('token');
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/student/grades`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setGrades(response.data.grades);
      }
    } catch (error) {
      toast.error("Failed to fetch grades");
    } finally {
      setIsLoading(false);
    }
  };

  const calculateCourseAverage = (courseGrades) => {
    if (!courseGrades.length) return 0;
    const sum = courseGrades.reduce((acc, grade) => acc + (parseFloat(grade.percentage) || 0), 0);
    return (sum / courseGrades.length).toFixed(2);
  };

  const getGradeColor = (grade, maxPoints) => {
    const percentage = (grade / maxPoints) * 100;
    if (percentage >= 90) return 'text-green-600';
    if (percentage >= 80) return 'text-blue-600';
    if (percentage >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-slate-800 mb-8">My Grades</h1>
      
      {/* Course Selection */}
      <div className="mb-8">
        <select 
          className="w-full md:w-64 p-2 rounded-lg shadow-md focus:ring-2 focus:ring-blue-500 bg-white"
          onChange={(e) => setSelectedCourse(e.target.value)}
          value={selectedCourse || ''}
        >
          <option value="">All Courses</option>
          {Array.from(new Set(grades.map(g => g.course._id))).map(courseId => {
            const course = grades.find(g => g.course._id === courseId).course;
            return (
              <option key={courseId} value={courseId}>
                {course.title}
              </option>
            );
          })}
        </select>
      </div>

      {/* Grades Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <BookOpen className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-slate-600">Total Courses</h3>
              <p className="text-2xl font-bold text-slate-800">
                {Array.from(new Set(grades.map(g => g.course._id))).length}
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <Award className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-slate-600">Average Grade</h3>
              <p className="text-2xl font-bold text-slate-800">
                {calculateCourseAverage(grades)}%
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-slate-600">Tasks Completed</h3>
              <p className="text-2xl font-bold text-slate-800">
                {grades.filter(g => g.status === 'Graded').length}
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Detailed Grades Table */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-purple-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Course</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Task</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Grade</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Feedback</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {grades
                .filter(grade => !selectedCourse || grade.course._id === selectedCourse)
                .map((grade, index) => (
                  <motion.tr
                    key={grade._id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="hover:bg-slate-50 transition-colors duration-200"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-slate-900">{grade.course.title}</div>
                      <div className="text-sm text-slate-500">{grade.course.courseCode}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-slate-900">{grade.task.title}</div>
                      <div className="text-sm text-slate-500">Max Points: {grade.task.maxPoints}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-sm font-medium ${getGradeColor(grade.grade, grade.task.maxPoints)}`}>
                        {grade.grade || 'N/A'} / {grade.task.maxPoints}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {grade.status === 'Graded' ? (
                        <span className="flex items-center gap-1.5 text-xs font-medium text-green-600">
                          <CheckCircle size={14} /> Graded
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-xs font-medium text-amber-600">
                          <Clock size={14} /> Pending
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-slate-600">
                        {grade.feedback || 'No feedback provided'}
                      </div>
                    </td>
                  </motion.tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default StudentGrades;
