import { createContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import keycloak from './keycloak'

interface AuthUser {
  id: string
  email: string
  fullName: string
  realmRoles: string[]
}

interface AuthContextValue {
  user: AuthUser | null
  token: string | null
  isLoading: boolean
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  token: null,
  isLoading: true,
  logout: () => {},
})

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    keycloak
      .init({ onLoad: 'login-required', checkLoginIframe: false })
      .then((authenticated) => {
        if (authenticated) {
          setToken(keycloak.token ?? null)
          const parsed = keycloak.tokenParsed
          if (parsed) {
            setUser({
              id: parsed.sub ?? '',
              email: parsed.email ?? '',
              fullName: parsed.name ?? '',
              realmRoles: (parsed.realm_access?.roles as string[]) ?? [],
            })
          }

          // Silent token refresh — renew 5 minutes before expiry
          const refreshInterval = setInterval(() => {
            keycloak
              .updateToken(300)
              .then((refreshed) => {
                if (refreshed) {
                  setToken(keycloak.token ?? null)
                }
              })
              .catch(() => {
                keycloak.logout()
              })
          }, 60_000)

          return () => clearInterval(refreshInterval)
        }
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [])

  const logout = () => {
    keycloak.logout()
  }

  return (
    <AuthContext.Provider value={{ user, token, isLoading, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
