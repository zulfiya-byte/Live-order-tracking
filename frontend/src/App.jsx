import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import AdminPage from './pages/AdminPage'
import MessagesInbox from './pages/MessagesInbox'
import SetPassword from './pages/SetPassword'
import ForgotPassword from './pages/ForgotPassword'
import { isLoggedIn, isAdmin, isSuperAdmin, isViewAllOrders } from './api'

function Protected({ children }) {
  return isLoggedIn() ? children : <Navigate to="/login" replace />
}

function AdminOnly({ children }) {
  if (!isLoggedIn()) return <Navigate to="/login" replace />
  if (!isAdmin()) return <Navigate to="/dashboard" replace />
  return children
}

function StaffOnly({ children }) {
  if (!isLoggedIn()) return <Navigate to="/login" replace />
  // PXP-side only (super admins + Internal PXP Staff). Company admins are customers.
  if (!isSuperAdmin() && !isViewAllOrders()) return <Navigate to="/dashboard" replace />
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
        <Route path="/admin" element={<AdminOnly><AdminPage /></AdminOnly>} />
        <Route path="/messages" element={<StaffOnly><MessagesInbox /></StaffOnly>} />
        <Route path="/set-password" element={<SetPassword />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="*" element={<Navigate to={isLoggedIn() ? '/dashboard' : '/login'} replace />} />
      </Routes>
    </BrowserRouter>
  )
}
