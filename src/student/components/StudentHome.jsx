import { motion } from 'framer-motion';
import { BookMarked, AlertCircle, CheckCircle2, Award } from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import axios from 'axios';
import Cookies from 'js-cookie';
import moment from 'moment';

// Animation variants
const kpiCardVariant = {
    hidden: { opacity: 0, y: 20 },
    visible: (i) => ({
        opacity: 1,
        y: 0,
        transition: {
            delay: i * 0.1,
            duration: 0.5,
            ease: "easeOut"
        }
    }),
    hover: {
        y: -5,
        boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
        transition: {
            duration: 0.3,
            ease: "easeOut"
        }
    }
};

const chartVariant = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: {
        opacity: 1,
        scale: 1,
        transition: {
            duration: 0.5,
            ease: "easeOut"
        }
    },
    hover: {
        scale: 1.02,
        boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
        transition: {
            duration: 0.3,
            ease: "easeOut"
        }
    }
};

function StudentHome() {
    const [stats, setStats] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    const fetchStats = useCallback(async () => {
        setIsLoading(true);
        try {
            const token = Cookies.get('token');
            const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/student/dashboard-stats`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.data.success) {
                setStats(response.data.data);
            }
        } catch (error) {
            console.error('Failed to fetch dashboard stats:', error);
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
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
                <p className="mt-4 text-slate-500">Loading your dashboard...</p>
            </div>
        );
    }
    
    if (!stats) return <div className="text-center p-10 bg-red-50 text-red-600 rounded-lg">Could not load your dashboard data.</div>;

    const kpiCards = [
      { title: 'Enrolled Courses', value: stats.kpiData.enrolledCourses, icon: <BookMarked className="text-indigo-600" /> },
      { title: 'Pending Assignments', value: stats.kpiData.pendingAssignments, icon: <AlertCircle className="text-amber-600" /> },
      { title: 'Completed Tasks', value: stats.kpiData.completedTasks, icon: <CheckCircle2 className="text-emerald-600" /> },
      { title: 'My Average Score', value: `${stats.kpiData.averageScore}%`, icon: <Award className="text-violet-600" /> },
    ];

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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <motion.div 
                    variants={chartVariant} 
                    whileHover="hover"
                    className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm transition-all duration-200"
                >
                    <h3 className="text-xl font-bold text-slate-800 mb-4">Your Weekly Task Completion</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={stats.taskCompletionTrend}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="week" tick={{fontSize: 12}} stroke="#94a3b8" />
                            <YAxis allowDecimals={false} tick={{fontSize: 12}} stroke="#94a3b8" />
                            <Tooltip cursor={{fill: 'rgba(139, 92, 246, 0.05)'}} />
                            <Bar dataKey="tasksCompleted" name="Tasks Completed" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </motion.div>
                
                <motion.div 
                    variants={chartVariant} 
                    whileHover="hover"
                    className="bg-white p-6 rounded-xl shadow-sm transition-all duration-200"
                >
                    <h3 className="text-xl font-bold text-slate-800 mb-4">Upcoming Deadlines</h3>
                    <div className="space-y-4">
                        {stats.upcomingDeadlines.length > 0 ? stats.upcomingDeadlines.map((task) => (
                            <motion.div 
                                key={task._id} 
                                whileHover={{ scale: 1.02, backgroundColor: "#f8fafc" }}
                                className="flex items-center justify-between p-3 bg-slate-50 rounded-lg transition-colors duration-200"
                            >
                                <div>
                                    <p className="text-sm font-semibold text-slate-700">{task.title}</p>
                                    <p className="text-xs text-slate-500">{task.course.title}</p>
                                </div>
                                <div className="text-right">
                                    <span className="text-xs font-bold text-red-500">
                                        {moment(task.dueDate).fromNow()}
                                    </span>
                                    <p className="text-xs text-slate-400">{moment(task.dueDate).format('MMM D')}</p>
                                </div>
                            </motion.div>
                        )) : <p className="text-sm text-slate-500 text-center py-8">No upcoming deadlines. You're all caught up!</p>}
                    </div>
                </motion.div>
            </div>
        </motion.div>
    );
}

export default StudentHome;