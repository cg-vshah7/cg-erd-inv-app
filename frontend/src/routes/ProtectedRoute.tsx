import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'

export function ProtectedRoute() {
  const { user, isLoading } = useAuth()

  if (isLoading) return null

  // AuthProvider uses login-required flow so user will always be set after load,
  // but guard here as a safety net for any edge cases.
  if (!user) return <Navigate to="/" replace />

  return <Outlet />
}
