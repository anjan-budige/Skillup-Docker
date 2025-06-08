import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './LoginPage';
import StudentDashboard from './student/StudentDashboard';
import FacultyDashboard from './faculty/FacultyDashboard';
import AdminDashboard from './admin/AdminDashboard';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/student/*" element={<StudentDashboard />} />
        <Route path="/faculty/*" element={<FacultyDashboard />} />
        <Route path="/admin/*" element={<AdminDashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
