import { useEffect, useState } from 'react';
import { useNavigate, useLocation, Routes, Route } from 'react-router-dom';
import Cookies from 'js-cookie';
import { AcademicCapIcon } from '@heroicons/react/24/outline';
import crypto from 'crypto-js';
import { motion } from 'framer-motion';
import { FaChalkboardTeacher } from 'react-icons/fa';
import { FaUserGraduate } from 'react-icons/fa';
import { Book } from 'lucide-react';
import AdminFaculty from './components/AdminFaculty';
import AdminTaskSubmissions from './components/AdminTaskSubmissions';

const FacultyIcon = FaChalkboardTeacher;
const StudentIcon = FaUserGraduate;




import {
  Bell,
  User,
  Menu,
  X,
  Home,
  Users,
  Folder,
  Settings,
  CheckSquare,
  ChartBar,
  LogOut,
  ChevronDown,
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import axios from 'axios';


const chartData = [
  { name: 'Jan', students: 400, faculty: 240, tasks: 240 },
  { name: 'Feb', students: 300, faculty: 139, tasks: 221 },
  { name: 'Mar', students: 200, faculty: 980, tasks: 229 },
  { name: 'Apr', students: 278, faculty: 390, tasks: 200 },
  { name: 'May', students: 189, faculty: 480, tasks: 218 },
  { name: 'Jun', students: 239, faculty: 380, tasks: 250 },
];

const topStudents = [
  { id: 1, name: 'John Doe', tasksCompleted: 25, score: 95 },
  { id: 2, name: 'Jane Smith', tasksCompleted: 22, score: 92 },
  { id: 3, name: 'Mike Johnson', tasksCompleted: 20, score: 88 },
];

const topFaculty = [
  { id: 1, name: 'Dr. Brown', tasksAssigned: 30, completionRate: '85%' },
  { id: 2, name: 'Prof. Wilson', tasksAssigned: 28, completionRate: '82%' },
  { id: 3, name: 'Dr. Taylor', tasksAssigned: 25, completionRate: '78%' },
];


import AdminHome from './components/AdminHome';
import AdminUsers from './components/AdminUsers';
import AdminDepartments from './components/AdminDepartments';
import AdminTasks from './components/AdminTasks';
import AdminAnalytics from './components/AdminAnalytics';
import AdminSettings from './components/AdminSettings';
import AdminProfile from './AdminProfile';
import AdminStudents from './components/AdminStudents';
import AdminBatches from './components/AdminBatches';
import AdminCourses from './components/AdminCourses';

function AdminDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false); 
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [userDetails, setUserDetails] = useState(null);

  useEffect(() => {
    const validateSession = async () => {
      const token = Cookies.get('token');
      const session = Cookies.get('session');

      if (!token || !session) {
        navigate('/', { replace: true });
        return;
      }

      try {
        const sessionData = JSON.parse(session);
        const { hash, timestamp, data } = sessionData;
        const calculatedHash = crypto.SHA256(
          JSON.stringify({
            ...data,
            timestamp,
          })
        ).toString();
        const isHashValid = calculatedHash === hash;
        const isExpired = Date.now() - timestamp > 3600000;

        if (!isHashValid || isExpired || data.role !== 'Admin') {
          Cookies.remove('token');
          Cookies.remove('session');
          navigate('/', { replace: true });
          return;
        }

        
        try {         const response = await axios.post(
            `${import.meta.env.VITE_API_URL}/api/auth/user-details`,
            {
              role: data.role,
              userId: data.id
            },
            {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              withCredentials: true
            }
          );
          
          
          if (response.data.success) {
            setUserDetails(response.data.data);
          } else {
            toast.error(response.data.message || 'Failed to load user details');
          }
        } catch (error) {
          toast.error(error.response?.data?.message || 'Failed to load user details');
        }

        setIsLoading(false);
      } catch (error) {
        console.error('Session validation error:', error);
        Cookies.remove('token');
        Cookies.remove('session');
        navigate('/', { replace: true });
      }
    };

    validateSession();
  }, [navigate]);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      
      if (mobile && sidebarOpen) {
        
      }
      
    };

    setIsMobile(window.innerWidth < 768); 
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [sidebarOpen]);


  const handleLogout = () => {
    Cookies.remove('token');
    Cookies.remove('session');
    
    navigate('/', { replace: true });
  };

  const handleNavigation = (path) => {
    navigate(path);
    if (isMobile) {
      setSidebarOpen(false); 
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-600 via-indigo-700 to-purple-700 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-300 mx-auto"></div>
          <p className="mt-4 text-sky-200 text-lg">Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  const menuItems = [
    { icon: <Home size={22} />, label: 'Dashboard', path: '/admin' },
    { icon: <FacultyIcon size={22} />, label: 'Faculty', path: '/admin/faculty' },
    { icon: <StudentIcon size={22} />, label: 'Students', path: '/admin/students' },
    { icon: <Users size={22} />, label: 'Batches', path: '/admin/batches' },
    { icon: <Book size={22} />, label: 'Courses', path: '/admin/courses' },
    { icon: <CheckSquare size={22} />, label: 'Tasks', path: '/admin/tasks' },
    { icon: <ChartBar size={22} />, label: 'Analytics', path: '/admin/analytics' },
    { icon: <Settings size={22} />, label: 'Settings', path: '/admin/settings' },
  ];

  const sidebarWidth = sidebarOpen ? 'w-64' : 'w-0 md:w-20';
  const mainContentMargin = isMobile ? 'ml-0' : (sidebarOpen ? 'md:ml-64' : 'md:ml-20');

  return (
    <div className="min-h-screen bg-gray-50">
      <ToastContainer theme="colored" position="bottom-right" />
      

      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 transition-opacity duration-300"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      {/* Sidebar */}
      <motion.aside
        className={`fixed inset-y-0 left-0 z-50 bg-gradient-to-b from-blue-600 to-blue-800 text-white shadow-lg transform transition-all duration-300 ease-in-out
          ${isMobile ? 'w-72' : (sidebarOpen ? 'w-64' : 'w-20')} 
        `}
        animate={isMobile ? { x: sidebarOpen ? 0 : '-100%' } : {}}
        transition={isMobile ? { type: 'tween', duration: 0.3 } : { type: 'spring', stiffness:300, damping:30 }}
      >
        <div className={`p-4 border-b border-blue-600/40 min-h-[64px] flex items-center ${(!sidebarOpen && !isMobile) ? 'justify-center py-[18px]' : ''}`}>
          <div className={`flex items-center transition-all duration-300`}>
            <AcademicCapIcon className={`h-9 w-9 text-sky-300 ${ (sidebarOpen || isMobile) ? 'mr-3' : '' }`} />
            {(sidebarOpen || isMobile) && (
              <div>
                <h2 className="text-2xl font-bold text-white tracking-tight">SkillUp</h2>
                <p className="text-xs text-blue-300 -mt-0.5">Admin Panel</p>
              </div>
            )}
          </div>
        </div>
        <nav className="p-2.5 space-y-1.5 mt-2">
          {menuItems.map((item) => (
            <button
              key={item.label}
              onClick={() => handleNavigation(item.path)}
              title={item.label}
              className={`flex items-center w-full p-3 rounded-lg text-left transition-all duration-200 group
                ${(!sidebarOpen && !isMobile) ? 'justify-center' : ''}
                ${ location.pathname === item.path
                    ? 'bg-sky-500 text-white shadow-md'
                    : 'text-blue-100 hover:bg-blue-600/60 hover:text-white'
                }`}
            >
              <span className={`transition-colors duration-200 ${location.pathname === item.path ? 'text-white' : 'text-blue-200 group-hover:text-white'}`}>{item.icon}</span>
              {(sidebarOpen || isMobile) && (
                <span className="ml-3.5 font-medium text-sm">{item.label}</span>
              )}
            </button>
          ))}
        </nav>
        <div className={`absolute bottom-0 left-0 w-full p-2.5 border-t border-blue-600/40`}>
          <button
            onClick={handleLogout}
            title="Logout"
            className={`flex items-center w-full p-3 rounded-lg text-left text-blue-100 hover:bg-red-500/80 hover:text-white transition-all duration-200 group
              ${(!sidebarOpen && !isMobile) ? 'justify-center' : ''}
            `}
          >
            <LogOut size={22} className="text-blue-200 group-hover:text-white transition-colors duration-200" />
            {(sidebarOpen || isMobile) && (
              <span className="ml-3.5 font-medium text-sm">Logout</span>
            )}
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <div className={`min-h-screen transition-all duration-300 ${mainContentMargin}`}>
        {/* Header */}
        <header className="bg-white border-b border-gray-200/70 sticky top-0 z-40">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <button
                  className="p-2 text-gray-600 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 rounded-md"
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
                >
                  {sidebarOpen && (isMobile || (!isMobile && sidebarOpen)) ? <X size={24} /> : <Menu size={24} />}
                </button>
                <h1 className="text-xl font-semibold text-slate-800 ml-2 tracking-tight hidden sm:block">
                  {menuItems.find(item => item.path === location.pathname)?.label || 'Dashboard'}
                </h1>
              </div>

              {/* User Menu */}
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <button
                    className="p-2 rounded-full text-gray-500 hover:text-blue-600 hover:bg-blue-100/70 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 relative"
                    onClick={() => setNotificationsOpen(!notificationsOpen)}
                    aria-label="View notifications"
                  >
                    <Bell size={22} />
                    <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-white"></span>
                  </button>
                  {notificationsOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute right-0 mt-2 w-80 bg-white/95 backdrop-blur-md rounded-xl shadow-xl border border-gray-200/70 z-30 p-4"
                    >
                      <h3 className="text-sm font-semibold text-blue-700">Notifications</h3>
                      <div className="mt-2 space-y-2">
                        {[
                          "New task assigned to Faculty Innovate.",
                          "Student Beta completed a critical task.",
                          "System maintenance scheduled for tonight."
                        ].map((notif, i) => (
                           <div key={i} className="p-2.5 bg-blue-50/70 rounded-lg text-sm text-slate-700 hover:bg-blue-100/70 transition-colors">
                            {notif}
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </div>
                <div className="relative">
                  <button
                    className="flex items-center p-1.5 rounded-full text-gray-500 hover:text-blue-600 hover:bg-blue-100/70 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    onClick={() => setProfileOpen(!profileOpen)}
                    aria-label="Open user menu"
                  >
                    <div className="flex items-center">
                      {userDetails?.photo ? (
                        <img
                          src={userDetails.photo}
                          alt={`${userDetails.firstName} ${userDetails.lastName}`}
                          className="w-8 h-8 rounded-full object-cover border-2 border-blue-100"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold border-2 border-blue-100">
                          {userDetails ? `${userDetails.firstName.charAt(0)}${userDetails.lastName.charAt(0)}` : 'A'}
                        </div>
                      )}
                      <div className="ml-2 hidden sm:block">
                        <p className="text-sm font-medium text-gray-700">
                          {userDetails ? `${userDetails.firstName} ${userDetails.lastName}` : 'Admin'}
                        </p>
                        <p className="text-xs text-gray-500">Administrator</p>
                      </div>
                    </div>
                    <ChevronDown size={18} className="ml-1 hidden sm:block" />
                  </button>
                  {profileOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute right-0 mt-2 w-48 bg-white/95 backdrop-blur-md rounded-xl shadow-xl border border-gray-200/70 z-30 p-2"
                    >
                      <div className="px-3 py-2 border-b border-gray-200/70">
                      {userDetails?.photo ? (
                          <img src={userDetails.photo} alt="Profile" className="w-12 h-12 rounded-full object-cover border-2 border-blue-100 mx-auto mb-2" />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold mx-auto mb-2 border-2 border-blue-100">
                            {userDetails ? `${userDetails.firstName.charAt(0)}${userDetails.lastName.charAt(0)}` : 'A'}
                          </div>
                        )}
                        <p className="text-sm font-medium text-slate-800 text-center">
                          {userDetails ? `${userDetails.firstName} ${userDetails.lastName}` : 'Admin'}
                        </p>
                        <p className="text-xs text-slate-500 text-center">{userDetails?.email || 'admin@example.com'}</p>
                      </div>
                      <button onClick={() => { navigate('/admin/profile'); setProfileOpen(!profileOpen); }} className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-blue-50/70 hover:text-blue-700 rounded-md transition-colors">
                        My Profile
                      </button>
                      <button
                        onClick={handleLogout}
                        className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50/70 hover:text-red-700 rounded-md transition-colors"
                      >
                        Logout
                      </button>
                    </motion.div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="w-full">
            {/* Welcome Message */}
            {location.pathname === '/admin' && (
              <div className="mb-6">
                <h2 className="text-3xl font-bold text-slate-800">
                  {userDetails ? `Welcome ${userDetails.firstName} ${userDetails.lastName}!` : 'Welcome, Admin!'}
                </h2>
                <p className="text-slate-600 text-sm mt-1">Oversee and manage your SkillUp platform.</p>
              </div>
            )}

            {/* Nested Routes */}
            <Routes>
              <Route path="/" element={<AdminHome />} />
              <Route path="/faculty" element={<AdminFaculty />} />
              <Route path="/students" element={<AdminStudents />} />
              <Route path="/batches" element={<AdminBatches />} />
              <Route path="/courses" element={<AdminCourses />} />
              <Route path="/tasks" element={<AdminTasks />} />
              <Route path="/tasks/:taskId" element={<AdminTaskSubmissions />} />
              <Route path="/analytics" element={<AdminAnalytics />} />
              <Route path="/settings" element={<AdminSettings />} />
              <Route path="/profile" element={<AdminProfile />} />
            </Routes>
          </div>
        </main>
      </div>

      {/* Mobile Sidebar Overlay */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-30"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}
    </div>
  );
}

export default AdminDashboard;