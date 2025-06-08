import { useEffect, useState } from 'react';
import { useNavigate, useLocation, Routes, Route } from 'react-router-dom';
import Cookies from 'js-cookie';
import crypto from 'crypto-js';
import { AcademicCapIcon } from '@heroicons/react/24/solid';
import { motion } from 'framer-motion';
import {
  Bell,
  Menu,
  X,
  LayoutDashboard,
  BookMarked,
  ClipboardList,
  Trophy,
  LogOut,
  ChevronDown,
  AlertCircle,
  CheckCircle2,
  Award,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import axios from 'axios';
import StudentProfile from './StudentProfile'; // Import the new StudentProfile component
import StudentHome from './components/StudentHome';
import StudentCourses from './components/StudentCourses';
import StudentGrades from './components/StudentGrades';
import StudentTasks from './components/StudentTasks';
import StudentTaskSubmission from './components/StudentTaskSubmission';

// --- Main Student Dashboard Component ---
function StudentDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
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
        const calculatedHash = crypto.SHA256(JSON.stringify({ ...data, timestamp })).toString();
        const isHashValid = calculatedHash === hash;
        const isExpired = Date.now() - timestamp > 3600000; // 1 hour

        if (!isHashValid || isExpired || data.role !== 'Student') {
          Cookies.remove('token');
          Cookies.remove('session');
          navigate('/', { replace: true });
          return;
        }

        try {
          const response = await axios.post(
            `${import.meta.env.VITE_API_URL}/api/auth/user-details`,
            { role: data.role, userId: data.id },
            { headers: { 'Authorization': `Bearer ${token}` }, withCredentials: true }
          );
          if (response.data.success) {
            setUserDetails(response.data.data);
          } else {
            toast.error(response.data.message || 'Failed to load user details');
          }
        } catch (error) {
          toast.error(error.response?.data?.message || 'API error fetching user details');
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
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleLogout = () => {
    Cookies.remove('token');
    Cookies.remove('session');
    navigate('/', { replace: true });
  };

  const handleNavigation = (path) => {
    navigate(path);
    if (isMobile) setSidebarOpen(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-violet-700 to-indigo-700 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-300 mx-auto"></div>
          <p className="mt-4 text-purple-200 text-lg">Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  const menuItems = [
    { icon: <LayoutDashboard size={22} />, label: 'Dashboard', path: '/student' },
    { icon: <BookMarked size={22} />, label: 'My Courses', path: '/student/courses' },
    { icon: <ClipboardList size={22} />, label: 'My Assignments', path: '/student/tasks' },
    { icon: <Trophy size={22} />, label: 'My Grades', path: '/student/grades' },
  ];

  const mainContentMargin = isMobile ? 'ml-0' : (sidebarOpen ? 'md:ml-64' : 'md:ml-20');

  return (
    <div className="min-h-screen bg-gray-50">
      <ToastContainer theme="colored" position="bottom-right" />
      
      {isMobile && sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <motion.aside
        className={`fixed inset-y-0 left-0 z-50 bg-gradient-to-b from-purple-600 to-violet-800 text-white shadow-lg transform transition-all duration-300 ease-in-out
          ${isMobile ? 'w-72' : (sidebarOpen ? 'w-64' : 'w-20')}`}
        animate={isMobile ? { x: sidebarOpen ? 0 : '-100%' } : {}}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        <div className={`p-4 border-b border-purple-600/40 min-h-[64px] flex items-center ${!sidebarOpen && !isMobile ? 'justify-center py-[18px]' : ''}`}>
          <div className="flex items-center">
          <AcademicCapIcon className={`h-9 w-9 text-purple-300 ${ (sidebarOpen || isMobile) ? 'mr-3' : '' }`} />
            {(sidebarOpen || isMobile) && (
              <div>
                <h2 className="text-2xl font-bold text-white tracking-tight">SkillUp</h2>
                <p className="text-xs text-purple-300 -mt-0.5">Student Portal</p>
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
                ${!sidebarOpen && !isMobile ? 'justify-center' : ''}
                ${location.pathname === item.path ? 'bg-violet-500 text-white shadow-md' : 'text-purple-100 hover:bg-purple-700/60 hover:text-white'}`}
            >
              <span className={`transition-colors duration-200 ${location.pathname === item.path ? 'text-white' : 'text-purple-200 group-hover:text-white'}`}>{item.icon}</span>
              {(sidebarOpen || isMobile) && <span className="ml-3.5 font-medium text-sm">{item.label}</span>}
            </button>
          ))}
        </nav>
        <div className="absolute bottom-0 left-0 w-full p-2.5 border-t border-purple-600/40">
          <button
            onClick={handleLogout}
            title="Logout"
            className={`flex items-center w-full p-3 rounded-lg text-left text-purple-100 hover:bg-red-500/80 hover:text-white transition-all duration-200 group ${!sidebarOpen && !isMobile ? 'justify-center' : ''}`}
          >
            <LogOut size={22} className="text-purple-200 group-hover:text-white" />
            {(sidebarOpen || isMobile) && <span className="ml-3.5 font-medium text-sm">Logout</span>}
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <div className={`min-h-screen transition-all duration-300 ${mainContentMargin}`}>
        {/* Header */}
        <header className="bg-white border-b border-gray-200/70 sticky top-0 z-30">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <button
                  className="p-2 text-gray-600 hover:text-purple-600 rounded-md"
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                >
                  {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
                <h1 className="text-xl font-semibold text-slate-800 ml-2 tracking-tight hidden sm:block">
                  {menuItems.find(item => item.path === location.pathname)?.label || 'Dashboard'}
                </h1>
              </div>

              {/* User Menu */}
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <button className="p-2 rounded-full text-gray-500 hover:text-purple-600 hover:bg-purple-100/70 relative">
                    <Bell size={22} />
                    <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-white"></span>
                  </button>
                </div>
                <div className="relative">
                  <button
                    className="flex items-center p-1.5 rounded-full text-gray-500 hover:text-purple-600 hover:bg-purple-100/70"
                    onClick={() => setProfileOpen(!profileOpen)}
                  >
                    <div className="flex items-center">
                      {userDetails?.photo ? (
                        <img src={userDetails.photo} alt="Profile" className="w-8 h-8 rounded-full object-cover border-2 border-purple-100" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-semibold border-2 border-purple-100">
                          {userDetails ? `${userDetails.firstName.charAt(0)}${userDetails.lastName.charAt(0)}` : 'S'}
                        </div>
                      )}
                      <div className="ml-2 hidden sm:block">
                        <p className="text-sm font-medium text-gray-700">{userDetails ? `${userDetails.firstName} ${userDetails.lastName}` : 'Student'}</p>
                        <p className="text-xs text-gray-500">Student</p>
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
                          <img src={userDetails.photo} alt="Profile" className="w-12 h-12 rounded-full object-cover border-2 border-purple-100 mx-auto mb-2" />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-purple-600 font-semibold mx-auto mb-2 border-2 border-blue-100">
                            {userDetails ? `${userDetails.firstName.charAt(0)}${userDetails.lastName.charAt(0)}` : 'A'}
                          </div>
                        )}
                        <p className="text-sm font-medium text-slate-800 text-center">
                          {userDetails ? `${userDetails.firstName} ${userDetails.lastName}` : 'Student'}
                        </p>
                        <p className="text-xs text-slate-500 text-center">{userDetails?.email || 'student@example.com'}</p>
                      </div>
                      <button onClick={() => { navigate('/student/profile'); setProfileOpen(!profileOpen); }} className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-blue-50/70 hover:text-blue-700 rounded-md transition-colors">
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
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="w-full">
            {location.pathname === '/student' && (
              <div className="mb-6">
                <h2 className="text-3xl font-bold text-slate-800">
                  {userDetails ? `Welcome, ${userDetails.firstName}!` : 'Welcome, Student!'}
                </h2>
                <p className="text-slate-600 text-sm mt-1">Let's continue your learning journey. Here is your progress.</p>
              </div>
            )}
           <Routes>
              <Route path="/" element={<StudentHome />} />
              <Route path="/courses" element={<StudentCourses />} />
              <Route path="/tasks" element={<StudentTasks />} />
              <Route path="/grades" element={<StudentGrades />} />
              <Route path="/tasks/:taskId" element={<StudentTaskSubmission />} />
              <Route path="/profile" element={<StudentProfile />} />
            </Routes> 
          </div>
        </main>
      </div>
    </div>
  );
}

export default StudentDashboard;