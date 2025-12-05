
import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './store';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Students from './pages/Students';
import AttendanceDaily from './pages/AttendanceDaily';
import MonthlyReport from './pages/MonthlyReport';
import Teachers from './pages/Teachers';
import Holidays from './pages/Holidays';
import Headmaster from './pages/Headmaster';
import Users from './pages/Users';
import Alumni from './pages/Alumni';
import Settings from './pages/Settings';
import AcademicYears from './pages/AcademicYears';
import { UserRole } from './types';

const ParentDashboard = () => {
  const { currentUser, attendance } = useApp();
  if (currentUser?.role !== UserRole.ORANG_TUA) return <Navigate to="/login" />;
  
  const myAttendance = attendance.filter(a => a.studentId === currentUser.id);
  const h = myAttendance.filter(a => a.status === 'H').length;
  const s = myAttendance.filter(a => a.status === 'S').length;
  const i = myAttendance.filter(a => a.status === 'I').length;
  const a = myAttendance.filter(a => a.status === 'A').length;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Info Siswa: {currentUser.name}</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-green-100 p-4 rounded text-center"><h3 className="text-xl font-bold text-green-700">{h}</h3><span className="text-sm">Hadir</span></div>
        <div className="bg-yellow-100 p-4 rounded text-center"><h3 className="text-xl font-bold text-yellow-700">{s}</h3><span className="text-sm">Sakit</span></div>
        <div className="bg-blue-100 p-4 rounded text-center"><h3 className="text-xl font-bold text-blue-700">{i}</h3><span className="text-sm">Izin</span></div>
        <div className="bg-red-100 p-4 rounded text-center"><h3 className="text-xl font-bold text-red-700">{a}</h3><span className="text-sm">Alpa</span></div>
      </div>
      <h3 className="font-bold mb-2">Riwayat Absensi</h3>
      <div className="bg-white shadow rounded overflow-hidden">
        {myAttendance.map(rec => (
          <div key={rec.id} className="p-3 border-b flex justify-between">
            <span>{rec.date}</span>
            <span className="font-bold">{rec.status}</span>
          </div>
        ))}
        {myAttendance.length === 0 && <div className="p-4 text-gray-500">Belum ada data.</div>}
      </div>
    </div>
  );
};

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useApp();
  if (!currentUser) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/students" element={<ProtectedRoute><Students /></ProtectedRoute>} />
      <Route path="/attendance" element={<ProtectedRoute><AttendanceDaily /></ProtectedRoute>} />
      <Route path="/report" element={<ProtectedRoute><MonthlyReport /></ProtectedRoute>} />
      <Route path="/parent-dashboard" element={<ProtectedRoute><ParentDashboard /></ProtectedRoute>} />
      
      {/* Implemented Features */}
      <Route path="/teachers" element={<ProtectedRoute><Teachers /></ProtectedRoute>} />
      <Route path="/headmaster" element={<ProtectedRoute><Headmaster /></ProtectedRoute>} />
      <Route path="/holidays" element={<ProtectedRoute><Holidays /></ProtectedRoute>} />
      <Route path="/users" element={<ProtectedRoute><Users /></ProtectedRoute>} />
      <Route path="/alumni" element={<ProtectedRoute><Alumni /></ProtectedRoute>} />
      <Route path="/academic-years" element={<ProtectedRoute><AcademicYears /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <AppProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AppProvider>
  );
};

export default App;
