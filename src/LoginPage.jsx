import { useState, useEffect } from 'react';
import { AcademicCapIcon, DocumentTextIcon, ChartBarIcon, ArrowUpTrayIcon as UploadIcon } from '@heroicons/react/24/solid';
import { motion } from 'framer-motion';
import { ToastContainer, toast } from 'react-toastify';
import Cookies from 'js-cookie';
import { useNavigate, useLocation } from 'react-router-dom';
import 'react-toastify/dist/ReactToastify.css';
import crypto from 'crypto-js';

// Cookie configuration constants
const COOKIE_CONFIG = {
  // 1 hour expiration for token
  token: {
    expires: 1/24, // 1 hour
    secure: false,
    sameSite: 'strict',
    path: '/',
  },
  // 1 hour expiration for session
  session: {
    expires: 1/24, // 1 hour
    secure: false,
    sameSite: 'strict',
    path: '/',
  }
};

// Helper function to create hashed session
const createHashedSession = (sessionData) => {
  const timestamp = Date.now();
  const dataToHash = {
    ...sessionData,
    timestamp
  };
  
  // Create a hash of the session data using SHA-256
  const hash = crypto.SHA256(JSON.stringify(dataToHash)).toString();
  
  return {
    hash,
    timestamp,
    data: sessionData
  };
};

// Helper function to verify session hash
const verifySessionHash = (sessionData, hash) => {
  const calculatedHash = crypto.SHA256(JSON.stringify(sessionData)).toString();
  return calculatedHash === hash;
};

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation(); // Use useLocation to get current path
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [selectedRole, setSelectedRole] = useState('Student');
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    firstName: '',
    lastName: '',
    email: '',
    department: '',
    rollNumber: ''
  });

  useEffect(() => {
    document.title = 'SkillUp | Login';
  }, []);

  // Clear messages when modal is opened or mode is switched
  useEffect(() => {
    setErrorMessage('');
    setSuccessMessage('');
  }, [showModal, isLoginMode]);

  // Navigation guard function
  const redirectToDashboard = (role) => {
    console.log(`Redirecting to dashboard for role: ${role}`);
    const path = `/${role.toLowerCase()}`;
    
    // Use a more reliable navigation approach
    try {
        navigate(path, { 
            replace: true,
            state: { from: 'login' }
        });
        console.log(`Successfully navigated to: ${path}`);
    } catch (error) {
        console.error('Navigation error:', error);
    }
};

// Check for existing session on component mount - only once
useEffect(() => {
  let isMounted = true; // To prevent actions after component unmount
  const checkSession = () => {
    if (!isMounted) return; // Prevent actions if component is unmounted

    const token = Cookies.get('token');
    const session = Cookies.get('session');
    
    console.log('Checking session...');
    console.log('Token:', token);
    console.log('Session:', session);
    
    if (!token || !session) {
        console.log('No valid session, skipping session check.');
        return;
    }
    
    console.log('Checking session validity...');
    try {
        const sessionData = JSON.parse(session);
        
        // Verify session hash
        const { hash, timestamp, data } = sessionData;
        const calculatedHash = crypto.SHA256(JSON.stringify({
            ...data,
            timestamp
        })).toString();

        // Check if hash matches and session is not expired (1 hour)
        const isHashValid = calculatedHash === hash;
        const isExpired = Date.now() - timestamp > 3600000; // 1 hour in milliseconds

        if (!isHashValid || isExpired) {
            console.error('Invalid or expired session');
            handleLogout();
            return;
        }

        const currentPath = location.pathname; // Use React Router's location
        const targetPath = `/${data.role.toLowerCase()}`;
        
        // Only redirect if we're not already on the correct path and not redirecting
        if (currentPath !== targetPath) {
            console.log(`Current path: ${currentPath}, Target path: ${targetPath}`);
            redirectToDashboard(data.role);
        } else {
            console.log('Already on the correct path, no redirect needed.');
        }
    } catch (error) {
        console.error('Session validation error:', error);
        handleLogout();
    }
  };

  // Run session check only once on component mount
  checkSession();
  return () => {
    isMounted = false; // Clean up to prevent actions after unmount
  };
}, [location.pathname]); // Depend on location.pathname to re-check only on path change

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const loginEndpoint = `${import.meta.env.VITE_API_URL}/api/auth/${selectedRole.toLowerCase()}/login`;
      
      const response = await fetch(loginEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: formData.username,
          password: formData.password,
        }),
        credentials: 'include',
      });

      const data = await response.json();

      if (response.ok) {
        // Create minimal user data
        const userData = {
          id: data.user.id,
          role: data.user.role,
          firstName: data.user.firstName,
          lastName: data.user.lastName,
          ...(data.user.role === 'Student' && {
            rollNumber: data.user.rollNumber,
            department: data.user.department
          }),
          ...(data.user.role === 'Faculty' && {
            department: data.user.department,
            email: data.user.email
          }),
          ...(data.user.role === 'Admin' && {
            email: data.user.email
          })
        };

        // Create hashed session with timestamp
        const timestamp = Date.now();
        const sessionData = {
          ...userData,
          timestamp
        };
        const hash = crypto.SHA256(JSON.stringify(sessionData)).toString();

        // Store token and hashed session data
        Cookies.set('token', data.token, COOKIE_CONFIG.token);
        Cookies.set('session', JSON.stringify({
          hash,
          timestamp,
          data: userData
        }), COOKIE_CONFIG.session);
        
        // Clear sensitive form data
        setFormData(prev => ({
          ...prev,
          password: '',
        }));
        
        // Close modal and show success message
        setShowModal(false);
        toast.success('Login successful! Welcome back.', {
          position: "top-right",
          autoClose: 1000,
        });

        // Redirect to appropriate dashboard
        const targetPath = `/${data.user.role.toLowerCase()}`;
        navigate(targetPath, { replace: true });
      } else {
        toast.error(data.message || 'Login failed. Please check your credentials.', {
          position: "top-right",
          autoClose: 5000,
        });
      }
    } catch (error) {
      toast.error('An error occurred during login. Please try again later.', {
        position: "top-right",
        autoClose: 5000,
      });
    }
  };

  const handleLogout = () => {
    // Remove all cookies
    Object.keys(COOKIE_CONFIG).forEach(key => {
      Cookies.remove(key, { path: '/' });
    });
    
    // Clear any sensitive data from state
    setFormData({
      username: '',
      password: '',
      firstName: '',
      lastName: '',
      email: '',
      department: '',
      rollNumber: ''
    });
    
    toast.success('Logged out successfully', {
      position: "top-right",
      autoClose: 3000,
    });
    
    // Redirect to home page
    // Example: navigate('/');
  };


  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      const registerEndpoint = `${import.meta.env.VITE_API_URL}/api/auth/${selectedRole.toLowerCase()}/register`;
      // Prepare registration data based on role
      let registrationData = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        password: formData.password,
      };

      // Add role-specific fields
      if (selectedRole === 'Student') {
        registrationData = {
          ...registrationData,
          email: formData.email,
          rollNumber: formData.rollNumber,
          username: formData.rollNumber, // Use roll number as username for students
          department: formData.department
        };
      } else if (selectedRole === 'Faculty') {
        registrationData = {
          ...registrationData,
          email: formData.email,
          department: formData.department,
          username: formData.username
        };
      } else if (selectedRole === 'Admin') {
        registrationData = {
          ...registrationData,
          email: formData.email,
          username: formData.username
        };
      }

      const response = await fetch(registerEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(registrationData),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccessMessage('Registration successful! Please sign in to continue.');
        toast.success('Registration successful! Please sign in to continue.', {
          position: "top-right",
          autoClose: 3000,
        });
        
        // Clear form data
        setFormData({
          username: '',
          password: '',
          firstName: '',
          lastName: '',
          email: '',
          department: '',
          rollNumber: ''
        });
        
        // Switch to login mode
        setIsLoginMode(true);
      } else {
        console.error('Registration failed:', data.message);
        setErrorMessage(data.message || 'Registration failed. Please check your input.');
        toast.error(data.message || 'Registration failed. Please check your input.', {
          position: "top-right",
          autoClose: 5000,
        });
      }
    } catch (error) {
      console.error('Error during registration:', error);
      setErrorMessage('An error occurred during registration. Please try again later.');
      toast.error('An error occurred during registration. Please try again later.', {
        position: "top-right",
        autoClose: 5000,
      });
    }
  };

  // Animation Variants
  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6 } }
  };

  const fadeInLeft = {
    hidden: { opacity: 0, x: -30 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.6 } }
  };

  const fadeInRight = {
    hidden: { opacity: 0, x: 30 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.6 } }
  };

  const staggerChildren = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2
      }
    }
  };

  const modalVariants = {
    hidden: { opacity: 0, scale: 0.9 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.3 } }
  };

  return (
    <>
      {/* Toast Container for Notifications */}
      <ToastContainer />

      {/* Hero Section */}
      <div className="min-h-screen bg-gradient-to-br from-blue-800 to-indigo-900 relative overflow-hidden">
        {/* Subtle Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full filter blur-3xl"></div>
          <div className="absolute top-1/3 right-0 w-96 h-96 bg-white rounded-full filter blur-3xl"></div>
          <div className="absolute bottom-0 left-1/3 w-96 h-96 bg-white rounded-full filter blur-3xl"></div>
        </div>

        {/* Navigation Bar */}
        <nav className="relative z-10 flex justify-between items-center px-6 py-4 max-w-7xl mx-auto">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeInLeft}
            className="flex items-center"
          >
            <AcademicCapIcon className="h-8 w-8 text-white mr-2" />
            <h2 className="text-2xl font-bold text-white">SkillUp</h2>
          </motion.div>
          <motion.div
            initial="hidden"
            animate="visible"
            variants={staggerChildren}
            className="hidden md:flex space-x-6"
          >
            <motion.a href="#features" variants={fadeInUp} className="text-white hover:text-blue-200 transition">Features</motion.a>
            <motion.a href="#benefits" variants={fadeInUp} className="text-white hover:text-blue-200 transition">Benefits</motion.a>
            <motion.a href="#about" variants={fadeInUp} className="text-white hover:text-blue-200 transition">About</motion.a>
          </motion.div>
          <motion.button
            initial="hidden"
            animate="visible"
            variants={fadeInRight}
            onClick={() => {
              setIsLoginMode(false); // Open Register tab by default for "Get Started"
              setShowModal(true);
            }}
            className="bg-white text-blue-800 px-6 py-2 rounded-lg font-medium hover:bg-gray-100 transition shadow-lg"
          >
            Get Started
          </motion.button>
        </nav>

        {/* Hero Content */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={staggerChildren}
          className="relative z-10 flex flex-col md:flex-row items-center justify-center min-h-screen px-6 max-w-7xl mx-auto"
        >
          <motion.div
            variants={fadeInLeft}
            className="md:w-1/2 text-center md:text-left mb-10 md:mb-0"
          >
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight">
              Revolutionize Educational Task Management
            </h1>
            <p className="text-xl text-blue-100 mb-8 leading-relaxed">
              A comprehensive platform for schools, colleges, and universities to streamline assignments, track progress, and enhance learning outcomes through powerful analytics.
            </p>
            <motion.div
              initial="hidden"
              animate="visible"
              variants={staggerChildren}
              className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start"
            >
              <motion.button
                variants={fadeInUp}
                onClick={() => {
                  setIsLoginMode(true); // Open Login tab
                  setShowModal(true);
                }}
                className="bg-white text-blue-800 px-8 py-3 rounded-lg font-semibold text-lg hover:bg-gray-100 transition shadow-lg"
              >
                Sign In
              </motion.button>
              <motion.button
                variants={fadeInUp}
                onClick={() => {
                  setShowModal(true);
                  setIsLoginMode(false); // Open Register tab
                }}
                className="bg-transparent border-2 border-white text-white px-8 py-3 rounded-lg font-semibold text-lg hover:bg-green-500 hover:bg-opacity-10 transition"
              >
                Register
              </motion.button>
            </motion.div>
          </motion.div>
          <motion.div
            variants={fadeInRight}
            className="md:w-1/2 flex justify-center"
          >
            <img
              src="hero-skillup.jpeg"
              alt="Dashboard Preview"
              className="rounded-lg shadow-2xl border-4 border-white/20"
            />
          </motion.div>
        </motion.div>
      </div>

      {/* Features Section */}
      <section id="features" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <motion.h2
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="text-4xl font-bold text-gray-800 mb-12"
          >
            Key Features for Educational Excellence
          </motion.h2>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerChildren}
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
          >
            <motion.div
              variants={fadeInUp}
              className="bg-white p-8 rounded-xl shadow-md hover:shadow-lg transition"
            >
              <div className="flex justify-center mb-4">
                <DocumentTextIcon className="h-12 w-12 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-3">Assignment Management</h3>
              <p className="text-gray-600">
                Create, assign, and manage tasks seamlessly with deadlines, instructions, and automated reminders for students and faculty.
              </p>
            </motion.div>
            <motion.div
              variants={fadeInUp}
              className="bg-white p-8 rounded-xl shadow-md hover:shadow-lg transition"
            >
              <div className="flex justify-center mb-4">
                <UploadIcon className="h-12 w-12 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-3">Submission & Grading</h3>
              <p className="text-gray-600">
                Easy file uploads for students and streamlined grading tools for faculty with feedback capabilities.
              </p>
            </motion.div>
            <motion.div
              variants={fadeInUp}
              className="bg-white p-8 rounded-xl shadow-md hover:shadow-lg transition"
            >
              <div className="flex justify-center mb-4">
                <ChartBarIcon className="h-12 w-12 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-3">Analytics Dashboard</h3>
              <p className="text-gray-600">
                Track student performance, submission rates, and engagement metrics with detailed reports for data-driven decisions.
              </p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Benefits for Educational Institutions */}
      <section id="benefits" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <motion.h2
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="text-4xl font-bold text-gray-800 mb-12"
          >
            How SkillUp Benefits Educational Institutions
          </motion.h2>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerChildren}
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
          >
            <motion.div
              variants={fadeInUp}
              className="p-6 border-l-4 border-blue-600"
            >
              <h3 className="text-xl font-semibold text-gray-800 mb-3">For Schools</h3>
              <p className="text-gray-600">
                Simplify homework management, improve parent-teacher communication, and monitor student progress with intuitive tools tailored for K-12 environments.
              </p>
            </motion.div>
            <motion.div
              variants={fadeInUp}
              className="p-6 border-l-4 border-blue-600"
            >
              <h3 className="text-xl font-semibold text-gray-800 mb-3">For Colleges & Universities</h3>
              <p className="text-gray-600">
                Manage complex coursework across departments, facilitate research submissions, and provide detailed academic analytics for higher education success.
              </p>
            </motion.div>
            <motion.div
              variants={fadeInUp}
              className="p-6 border-l-4 border-blue-600"
            >
              <h3 className="text-xl font-semibold text-gray-800 mb-3">For Training Institutes</h3>
              <p className="text-gray-600">
                Streamline certification programs, track trainee progress, and deliver actionable feedback with a platform built for professional development.
              </p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <motion.h2
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="text-4xl font-bold text-gray-800 mb-6"
          >
            About SkillUp
          </motion.h2>
          <motion.p
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="text-gray-600 max-w-3xl mx-auto"
          >
            SkillUp is designed to empower educational institutions by digitizing task management and providing insightful analytics. 
            Our mission is to enhance learning outcomes through efficient workflows and data-driven insights for students, faculty, and administrators.
          </motion.p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-10">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={staggerChildren}
          className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-8"
        >
          <motion.div variants={fadeInUp}>
            <h3 className="font-bold text-lg mb-4">SkillUp</h3>
            <p className="text-gray-400">Transforming education through technology.</p>
          </motion.div>
          <motion.div variants={fadeInUp}>
            <h3 className="font-bold text-lg mb-4">Product</h3>
            <ul className="space-y-2 text-gray-400">
              <li><a href="#" className="hover:text-white">Features</a></li>
              <li><a href="#" className="hover:text-white">Pricing</a></li>
              <li><a href="#" className="hover:text-white">Case Studies</a></li>
            </ul>
          </motion.div>
          <motion.div variants={fadeInUp}>
            <h3 className="font-bold text-lg mb-4">Support</h3>
            <ul className="space-y-2 text-gray-400">
              <li><a href="#" className="hover:text-white">Help Center</a></li>
              <li><a href="#" className="hover:text-white">Contact Us</a></li>
              <li><a href="#" className="hover:text-white">FAQ</a></li>
            </ul>
          </motion.div>
          <motion.div variants={fadeInUp}>
            <h3 className="font-bold text-lg mb-4">Connect</h3>
            <ul className="space-y-2 text-gray-400">
              <li><a href="#" className="hover:text-white">Twitter</a></li>
              <li><a href="#" className="hover:text-white">LinkedIn</a></li>
              <li><a href="#" className="hover:text-white">Facebook</a></li>
            </ul>
          </motion.div>
        </motion.div>
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeInUp}
          className="border-t border-gray-700 mt-8 pt-6 max-w-7xl mx-auto px-6 text-center text-gray-500"
        >
          <p>&copy; {new Date().getFullYear()} SkillUp. All rights reserved.</p>
        </motion.div>
      </footer>

      {/* Authentication Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={modalVariants}
            className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-8"
          >
            {/* Close Button */}
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Tabbed Navigation for Login/Register */}
            <motion.div
              initial="hidden"
              animate="visible"
              variants={staggerChildren}
              className="flex justify-center mb-6 border-b border-gray-200"
            >
              <motion.button
                variants={fadeInUp}
                onClick={() => setIsLoginMode(true)}
                className={`px-6 py-3 font-medium ${
                  isLoginMode ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'
                }`}
              >
                Sign In
              </motion.button>
              <motion.button
                variants={fadeInUp}
                onClick={() => setIsLoginMode(false)}
                className={`px-6 py-3 font-medium ${
                  !isLoginMode ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'
                }`}
              >
                Register
              </motion.button>
            </motion.div>

            {/* Role Selection */}
            <motion.div
              initial="hidden"
              animate="visible"
              variants={staggerChildren}
              className="flex justify-center space-x-2 mb-6"
            >
              {['Student', 'Faculty', 'Admin'].map((role) => (
                <motion.button
                  key={role}
                  variants={fadeInUp}
                  onClick={() => setSelectedRole(role)}
                  className={`px-6 py-2 rounded-full font-medium transition-all duration-200 ${
                    selectedRole === role
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {role}
                </motion.button>
              ))}
            </motion.div>

            {/* Form Content */}
            {isLoginMode ? (
              <motion.form
                initial="hidden"
                animate="visible"
                variants={staggerChildren}
                onSubmit={handleLogin}
                className="space-y-4"
              >
                <motion.div variants={fadeInUp} className="relative">
                  <input
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition"
                    placeholder={selectedRole === 'Student' ? 'Roll Number' : 'Username'}
                    required
                  />
                </motion.div>
                <motion.div variants={fadeInUp} className="relative">
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition"
                    placeholder="Password"
                    required
                  />
                </motion.div>
                <motion.button
                  variants={fadeInUp}
                  type="submit"
                  className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition shadow-md"
                >
                  Sign In
                </motion.button>
              </motion.form>
            ) : (
              <motion.form
                initial="hidden"
                animate="visible"
                variants={staggerChildren}
                onSubmit={handleRegister}
                className="space-y-4"
              >
                {/* Common fields for all roles */}
                <motion.div variants={fadeInUp} className="grid grid-cols-2 gap-4">
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition"
                    placeholder="First Name"
                    required
                  />
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition"
                    placeholder="Last Name"
                    required
                  />
                </motion.div>

                {/* Role-specific fields */}
                {selectedRole === 'Student' && (
                  <>
                    <motion.div variants={fadeInUp} className="relative">
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition"
                        placeholder="Email Address"
                        required
                      />
                    </motion.div>
                    <motion.div variants={fadeInUp} className="relative">
                      <input
                        type="text"
                        name="rollNumber"
                        value={formData.rollNumber}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition"
                        placeholder="Roll Number"
                        required
                      />
                    </motion.div>
                    <motion.div variants={fadeInUp} className="relative">
                      <input
                        type="text"
                        name="department"
                        value={formData.department}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition"
                        placeholder="Department"
                        required
                      />
                    </motion.div>
                  </>
                )}

                {selectedRole === 'Faculty' && (
                  <>
                    <motion.div variants={fadeInUp} className="relative">
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition"
                        placeholder="Email Address"
                        required
                      />
                    </motion.div>
                    <motion.div variants={fadeInUp} className="relative">
                      <input
                        type="text"
                        name="department"
                        value={formData.department}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition"
                        placeholder="Department"
                        required
                      />
                    </motion.div>
                  </>
                )}

                {selectedRole === 'Admin' && (
                  <motion.div variants={fadeInUp} className="relative">
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition"
                      placeholder="Email Address"
                      required
                    />
                  </motion.div>
                )}

                {/* Username field for Faculty and Admin only */}
                {(selectedRole === 'Faculty' || selectedRole === 'Admin') && (
                  <motion.div variants={fadeInUp} className="relative">
                    <input
                      type="text"
                      name="username"
                      value={formData.username}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition"
                      placeholder="Username"
                      required
                    />
                  </motion.div>
                )}

                {/* Password field for all roles */}
                <motion.div variants={fadeInUp} className="relative">
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition"
                    placeholder="Create Password"
                    required
                  />
                </motion.div>

                <motion.button
                  variants={fadeInUp}
                  type="submit"
                  className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition shadow-md"
                >
                  Create Account
                </motion.button>
              </motion.form>
            )}
          </motion.div>
        </div>
      )}
    </>
  );
}

export default LoginPage;