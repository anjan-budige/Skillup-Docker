import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Users, BookOpen, ClipboardCheck, BarChart2, Star } from 'lucide-react';
import axios from 'axios';
import Cookies from 'js-cookie';
import moment from 'moment';

const kpiCardVariant = {
    hidden: { opacity: 0, y: 20 },
    visible: (i) => ({ 
        opacity: 1, 
        y: 0, 
        transition: { duration: 0.5, delay: i * 0.1 } 
    })
};

const chartVariant = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, delay: 0.2 } }
};

const UserAvatar = ({ user, size = 'w-10 h-10' }) => (
    user?.photo ?
        <img src={user.photo} alt={user.name || 'User'} className={`${size} rounded-full object-cover`} />
        :
        <div className={`${size} rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold`}>
            {user?.name?.charAt(0) || 'U'}
        </div>
);

function FacultyHome() {
    const [stats, setStats] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    const fetchStats = useCallback(async () => {
        setIsLoading(true);
        try {
            const token = Cookies.get('token');
            const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/faculty/dashboard-stats`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.data.success) {
                setStats(response.data.data);
            }
        } catch (error) {
            // Silently fail for the UI
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    if (isLoading) {
        return (
            <div className="text-center p-10">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto"></div>
                <p className="mt-4 text-slate-500">Loading dashboard data...</p>
            </div>
        );
    }
    
    if (!stats) return <div className="text-center p-10 bg-red-50 text-red-600 rounded-lg">Could not load dashboard data. Please try again later.</div>;

    const kpiCards = [
        { title: 'My Courses', value: stats.kpiData.myCourses, icon: <BookOpen className="text-sky-600" /> },
        { title: 'My Students', value: stats.kpiData.totalStudents, icon: <Users className="text-emerald-600" /> },
        { title: 'Active Tasks', value: stats.kpiData.activeAssignments, icon: <ClipboardCheck className="text-amber-600" /> },
        { title: 'My Avg. Grade', value: `${stats.kpiData.averageGrade.toFixed(1)}%`, icon: <BarChart2 className="text-rose-600" /> },
    ];

    const trendData = stats.submissionTrend.map(item => ({
        date: moment(item._id).format('MMM D'),
        Submissions: item.count
    }));

    return (
        <motion.div initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.1 } } }}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {kpiCards.map((card, index) => (
                    <motion.div custom={index} variants={kpiCardVariant} key={card.title} className="p-5 bg-white/70 backdrop-blur-md rounded-xl shadow-lg border border-gray-200/50 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                        <div className="flex items-center">
                            <div className="p-3 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full mr-4 shadow-inner">
                                {card.icon}
                            </div>
                            <div>
                                <h3 className="text-sm font-medium text-slate-500">{card.title}</h3>
                                <p className="mt-0.5 text-3xl font-bold text-slate-800">{card.value}</p>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                <motion.div variants={chartVariant} className="lg:col-span-2 bg-white/70 backdrop-blur-md rounded-2xl shadow-xl p-6 border border-gray-200/70">
                    <h3 className="text-xl font-semibold text-slate-800 mb-5">Submission Trend (Last 7 Days)</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={trendData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Line type="monotone" dataKey="Submissions" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </motion.div>

                <motion.div variants={chartVariant} className="bg-white/70 backdrop-blur-md rounded-2xl shadow-xl p-6 border border-gray-200/70">
                    <h3 className="text-xl font-semibold text-slate-800 mb-4">Top Students</h3>
                    <div className="space-y-4">
                        {stats.topStudents.length > 0 ? stats.topStudents.map((student, index) => (
                            <div key={index} className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Star size={18} className={`${index === 0 ? 'text-amber-400' : 'text-slate-300'}`} fill={`${index === 0 ? 'currentColor' : 'none'}`} />
                                    <UserAvatar user={student} size="w-9 h-9" />
                                    <div>
                                        <p className="font-semibold text-slate-700 text-sm">{student.name}</p>
                                        <p className="text-xs text-slate-500">{student.tasksCompleted || 0} tasks graded</p>
                                    </div>
                                </div>
                                <span className="font-bold text-slate-800 text-sm">{Number(student.totalScore).toFixed(2)} pts</span>
                            </div>
                        )) : <p className="text-sm text-slate-500 text-center py-8">No graded students yet.</p>}
                    </div>
                </motion.div>
            </div>

            <motion.div variants={chartVariant} className="lg:col-span-3 bg-white/70 backdrop-blur-md rounded-2xl shadow-xl p-6 mb-8 border border-gray-200/70">
                <h3 className="text-xl font-semibold text-slate-800 mb-4">Recent Activity</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="border-b-2 border-slate-100">
                            <tr className="text-xs text-slate-500 uppercase">
                                <th className="p-3">Student</th>
                                <th className="p-3">Task</th>
                                <th className="p-3">Course</th>
                                <th className="p-3">Time</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stats.recentActivity.length > 0 ? stats.recentActivity.map(activity => (
                                <tr key={activity._id} className="border-b border-slate-100 last:border-b-0">
                                    <td className="p-3 flex items-center gap-3">
                                        <UserAvatar user={activity.student} size="w-8 h-8" />
                                        <span className="text-sm font-medium">{activity.student.firstName} {activity.student.lastName}</span>
                                    </td>
                                    <td className="p-3 text-sm">{activity.task.title}</td>
                                    <td className="p-3 text-sm text-slate-600">{activity.task.course.title}</td>
                                    <td className="p-3 text-xs text-slate-500">{moment(activity.createdAt).fromNow()}</td>
                                </tr>
                            )) : <tr><td colSpan="4" className="text-center p-8 text-slate-500">No recent submissions found.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </motion.div>
        </motion.div>
    );
}

export default FacultyHome;