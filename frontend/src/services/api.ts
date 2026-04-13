import axios from 'axios'
import keycloak from '@/auth/keycloak'

const api = axios.create({
  baseURL: '/api/v1',
})

// Inject Bearer token from Keycloak on every request
api.interceptors.request.use((config) => {
  if (keycloak.token) {
    config.headers.Authorization = `Bearer ${keycloak.token}`
  }
  return config
})

// Handle 401 — token expired or invalid, force re-login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      keycloak.logout()
    }
    const message: string =
      error.response?.data?.error?.message ??
      error.response?.data?.detail ??
      error.message ??
      'An unexpected error occurred'
    return Promise.reject(new Error(message))
  },
)

export default api
