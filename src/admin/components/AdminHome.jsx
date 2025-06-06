import { motion } from 'framer-motion';
import { Users, User, CheckSquare, ChartBar } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// Mock data
const chartData = [
  { name: 'Jan', students: 400, faculty: 240, tasks: 320 },
  { name: 'Feb', students: 300, faculty: 139, tasks: 280 },
  { name: 'Mar', students: 200, faculty: 980, tasks: 200 },
  { name: 'Apr', students: 278, faculty: 390, tasks: 308 },
  { name: 'May', students: 189, faculty: 480, tasks: 240 },
  { name: 'Jun', students: 239, faculty: 380, tasks: 430 },
];

const topStudents = [
  { id: 1, name: 'John Smith', tasksCompleted: 45, score: '92%' },
  { id: 2, name: 'Emma Wilson', tasksCompleted: 42, score: '89%' },
  { id: 3, name: 'Michael Brown', tasksCompleted: 38, score: '85%' },
];

const topFaculty = [
  { id: 1, name: 'Dr. Johnson', tasksAssigned: 35, completionRate: '92%' },
  { id: 2, name: 'Prof. Davis', tasksAssigned: 30, completionRate: '85%' },
  { id: 3, name: 'Dr. Taylor', tasksAssigned: 25, completionRate: '78%' },
];

function AdminHome() {
  return (
    <>
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {[
          { title: 'Total Students', value: '1,250', icon: <Users size={28} className="text-blue-600" /> },
          { title: 'Total Faculty', value: '85', icon: <User size={28} className="text-sky-600" /> },
          { title: 'Active Tasks', value: '320', icon: <CheckSquare size={28} className="text-indigo-600" /> },
          { title: 'Completion Rate', value: '78%', icon: <ChartBar size={28} className="text-purple-600" /> },
        ].map((stat, index) => (
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
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-5">
          <h3 className="text-xl font-semibold text-slate-800 mb-2 sm:mb-0">Platform Activity Overview</h3>
          <button className="text-sm text-blue-600 hover:text-blue-800 font-medium py-1 px-3 rounded-md hover:bg-blue-100/70 transition-colors">
            View Detailed Report
          </button>
        </div>
        <div className="h-80 sm:h-96">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.9)',
                  backdropFilter: 'blur(5px)',
                  border: '1px solid rgba(200, 200, 250, 0.5)',
                  borderRadius: '10px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                }}
                labelStyle={{ color: '#1e3a8a', fontWeight: 'bold' }}
                itemStyle={{ color: '#475569' }}
              />
              <Line type="monotone" dataKey="students" stroke="#3B82F6" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} name="Students" />
              <Line type="monotone" dataKey="faculty" stroke="#14B8A6" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} name="Faculty" />
              <Line type="monotone" dataKey="tasks" stroke="#8B5CF6" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} name="Tasks" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Top Performers Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[
          { title: "Top Students", data: topStudents, headers: ["Name", "Tasks Completed", "Avg. Score"], keys: ["name", "tasksCompleted", "score"] },
          { title: "Top Faculty", data: topFaculty, headers: ["Name", "Tasks Assigned", "Completion Rate"], keys: ["name", "tasksAssigned", "completionRate"] }
        ].map((table, tableIndex) => (
          <motion.div
            key={table.title}
            initial={{ opacity: 0, x: tableIndex === 0 ? -30 : 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="bg-white/70 backdrop-blur-md rounded-2xl shadow-xl p-6 border border-gray-200/70"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-slate-800">{table.title}</h3>
              <button className="text-sm text-blue-600 hover:text-blue-800 font-medium py-1 px-3 rounded-md hover:bg-blue-100/70 transition-colors">
                View All
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[400px]">
                <thead>
                  <tr className="text-left text-xs sm:text-sm text-slate-500 uppercase tracking-wider">
                    {table.headers.map(header => <th key={header} className="pb-3 pr-4 font-semibold">{header}</th>)}
                  </tr>
                </thead>
                <tbody className="text-slate-700">
                  {table.data.map((item) => (
                    <tr
                      key={item.id}
                      className="border-t border-gray-200/80 hover:bg-blue-50/50 transition-colors duration-150"
                    >
                      {table.keys.map((key, idx) => (
                        <td key={key} className={`py-3.5 pr-4 text-sm ${idx === 0 ? 'flex items-center font-medium text-slate-800' : ''}`}>
                          {idx === 0 && <User size={18} className="text-blue-500 mr-2.5 min-w-[18px]" />}
                          {item[key]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        ))}
      </div>
    </>
  );
}

export default AdminHome; 