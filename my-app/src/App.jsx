import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LoginPage from './LoginPage';
import Dashboard from './Dashboard';
import ProtectedRoute from './ProtectedRoute';
import AdminRoute from './AdminRoute';
import AdminDashboard from './AdminDashboard';
import UpdatePassword from './UpdatePassword';
import AuthCallback from './AuthCallback';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LoginPage />} /> 
        
        {/* Auth callback route for OAuth */}
        <Route path="/auth/callback" element={<AuthCallback />} />
        
        {/* 2. ADD THE UPDATE PASSWORD ROUTE */}
        <Route path="/update-password" element={<UpdatePassword />} />

        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } 
        />

        <Route 
          path="/admin" 
          element={
            <ProtectedRoute>
              <AdminRoute>
                <AdminDashboard />
              </AdminRoute>
            </ProtectedRoute>
          } 
        />
      </Routes>
    </Router>
  );
}

export default App;