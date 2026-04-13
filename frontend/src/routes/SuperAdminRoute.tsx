import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'

export function SuperAdminRoute() {
  const { user, isLoading, hasPermission } = useAuth()

  if (isLoading) return null

  if (!user || !hasPermission('super_admin')) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}
