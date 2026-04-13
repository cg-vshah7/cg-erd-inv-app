import { useContext } from 'react'
import { AuthContext } from './AuthProvider'

export function useAuth() {
  const ctx = useContext(AuthContext)

  const hasPermission = (perm: string): boolean => {
    return ctx.user?.realmRoles.includes(perm) ?? false
  }

  return { ...ctx, hasPermission }
}
