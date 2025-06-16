import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, User, CheckSquare, BarChart, Trophy, Star } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import axios from 'axios';
import Cookies from 'js-cookie';



const chartData = [
  { name: 'Jan', students: 40, faculty: 24, tasks: 32 },
  { name: 'Feb', students: 30, faculty: 13, tasks: 28 },
  { name: 'Mar', students: 20, faculty: 98, tasks: 20 },
  { name: 'Apr', students: 27, faculty: 39, tasks: 38 },
  { name: 'May', students: 18, faculty: 48, tasks: 24 },
  { name: 'Jun', students: 23, faculty: 38, tasks: 43 },
];


const SkeletonCard = ({ className }) => (
  <div className={`p-5 bg-white/50 rounded-xl shadow-lg ${className}`}>
    <div className="flex items-center">
      <div className="p-3 bg-gray-200 rounded-full mr-4 w-14 h-14 animate-pulse"></div>
      <div className="w-full">
        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2 animate-pulse"></div>
        <div className="h-8 bg-gray-300 rounded w-1/2 animate-pulse"></div>
      </div>
    </div>
  </div>
);

function AdminHome() {
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    document.title = "Admin | Dashboard";

    const fetchAdminStats = async () => {
      try {
        const token = Cookies.get('token');
        if (!token) {
          throw new Error('Authentication token not found.');
        }

        const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/admin/fetch`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        
        if (response.data.success) {
          setStats(response.data.data);
        } else {
          throw new Error(response.data.message || 'Failed to fetch data.');
        }
      } catch (err) {
        setError(err.message);
        console.error("Failed to fetch admin stats:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAdminStats();
  }, []);

  if (isLoading) {
    return (
      <>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white/50 p-6 rounded-2xl shadow-lg h-64 animate-pulse"></div>
            <div className="bg-white/50 p-6 rounded-2xl shadow-lg h-64 animate-pulse"></div>
        </div>
      </>
    );
  }

  if (error) {
    return <div className="text-center p-10 bg-red-100 text-red-700 rounded-lg">Error: {error}</div>;
  }
  
  
  const kpiCards = [
    { title: 'Total Students', value: stats.kpis.totalStudents, icon: <Users size={28} className="text-blue-600" /> },
    { title: 'Total Faculty', value: stats.kpis.totalFaculty, icon: <User size={28} className="text-sky-600" /> },
    { title: 'Active Tasks', value: stats.kpis.activeTasks, icon: <CheckSquare size={28} className="text-indigo-600" /> },
    { title: 'Completion Rate', value: stats.kpis.completionRate, icon: <BarChart size={28} className="text-purple-600" /> },
  ];

  return (
    <>
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {kpiCards.map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05, duration: 0.3 }}
            className="p-5 bg-white/70 backdrop-blur-md rounded-xl shadow-lg border border-gray-200/50 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
          >
            <div className="flex items-center">
              <div className="p-3 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full mr-4 shadow-inner">
                {stat.icon}
              </div>
              <div>
                <h3 className="text-sm font-medium text-slate-500">{stat.title}</h3>
                <p className="mt-0.5 text-3xl font-bold text-slate-800">{stat.value}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Charts */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="bg-white/70 backdrop-blur-md rounded-2xl shadow-xl p-6 mb-8 border border-gray-200/70"
      >
        <h3 className="text-xl font-semibold text-slate-800 mb-5">Platform Activity Overview (Monthly)</h3>
        <div className="h-80 sm:h-96">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={stats.monthlyStats} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" />
              <XAxis 
                dataKey="month" 
                stroke="#94a3b8" 
                fontSize={12}
                tickFormatter={(value) => {
                  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                  return months[value - 1];
                }}
              />
              <YAxis stroke="#94a3b8" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.9)',
                  backdropFilter: 'blur(5px)',
                  border: '1px solid rgba(200, 200, 250, 0.5)',
                  borderRadius: '10px',
                }}
                formatter={(value, name) => [value, name]}
                labelFormatter={(value) => {
                  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                  return months[value - 1];
                }}
              />
              <Line type="monotone" dataKey="students" stroke="#3B82F6" strokeWidth={2.5} name="New Students" />
              <Line type="monotone" dataKey="faculty" stroke="#14B8A6" strokeWidth={2.5} name="New Faculty" />
              <Line type="monotone" dataKey="tasks" stroke="#8B5CF6" strokeWidth={2.5} name="Tasks Created" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Top Performers Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Students Table */}
        <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="bg-white/70 backdrop-blur-md rounded-2xl shadow-xl p-6 border border-gray-200/70"
          >
            <h3 className="text-xl font-semibold text-slate-800 mb-4">Top Students</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[400px]">
                <thead>
                  <tr className="text-left text-xs sm:text-sm text-slate-500 uppercase">
                    <th className="pb-3 pr-4 font-semibold">Name</th>
                    <th className="pb-3 pr-4 font-semibold">Tasks Completed</th>
                    <th className="pb-3 pr-4 font-semibold">Total Score</th>
                  </tr>
                </thead>
                <tbody className="text-slate-700">
                  {stats.topStudents.length > 0 ? stats.topStudents.map((item) => (
                    <tr key={item.studentId} className="border-t border-gray-200/80 hover:bg-blue-50/50">
                      <td className="py-3.5 pr-4 text-sm flex items-center font-medium text-slate-800">
                        <Trophy size={18} className="text-amber-500 mr-2.5" /> {item.name}
                      </td>
                      <td className="py-3.5 pr-4 text-sm">{item.tasksCompleted}</td>
                      <td className="py-3.5 pr-4 text-sm font-bold">{item.totalScore}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan="3" className="text-center py-5">No student data available.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
        </motion.div>

        {/* Top Faculty Table */}
        <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="bg-white/70 backdrop-blur-md rounded-2xl shadow-xl p-6 border border-gray-200/70"
          >
            <h3 className="text-xl font-semibold text-slate-800 mb-4">Top Faculty</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[400px]">
                <thead>
                  <tr className="text-left text-xs sm:text-sm text-slate-500 uppercase">
                    <th className="pb-3 pr-4 font-semibold">Name</th>
                    <th className="pb-3 pr-4 font-semibold">Department</th>
                    <th className="pb-3 pr-4 font-semibold">Tasks Created</th>
                  </tr>
                </thead>
                <tbody className="text-slate-700">
                  {stats.topFaculty.length > 0 ? stats.topFaculty.map((item) => (
                    <tr key={item.facultyId} className="border-t border-gray-200/80 hover:bg-blue-50/50">
                      <td className="py-3.5 pr-4 text-sm flex items-center font-medium text-slate-800">
                        <Star size={18} className="text-sky-500 mr-2.5" /> {item.name}
                      </td>
                      <td className="py-3.5 pr-4 text-sm">{item.department}</td>
                      <td className="py-3.5 pr-4 text-sm font-bold">{item.tasksCreated}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan="3" className="text-center py-5">No faculty data available.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
        </motion.div>
      </div>
    </>
  );
}

export default AdminHome;