import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './LoginPage';
import StudentDashboard from './student/StudentDashboard';
import FacultyDashboard from './faculty/FacultyDashboard';
import AdminDashboard from './admin/AdminDashboard';
import Cookies from 'js-cookie';

function App() {
  // Helper function to check if user is authenticated and has correct role
  const checkAuth = (requiredRole) => {
    const session = Cookies.get('session');
    if (!session) return false;
    
    try {
      const sessionData = JSON.parse(session);
      return sessionData.data.role === requiredRole;
    } catch {
      return false;
    }
  };

  return (
    <Router>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        
        {/* Protected Student Routes */}
        <Route 
          path="/student/*" 
          element={
            checkAuth('Student') ? (
              <StudentDashboard />
            ) : (
              <Navigate to="/" replace />
            )
          } 
        />

        {/* Protected Faculty Routes */}
        <Route 
          path="/faculty/*" 
          element={
            checkAuth('Faculty') ? (
              <FacultyDashboard />
            ) : (
              <Navigate to="/" replace />
            )
          } 
        />

        {/* Protected Admin Routes */}
        <Route 
          path="/admin/*" 
          element={
            checkAuth('Admin') ? (
              <AdminDashboard />
            ) : (
              <Navigate to="/" replace />
            )
          } 
        />

        {/* Catch all route */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
