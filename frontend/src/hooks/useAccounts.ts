import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/services/api'

export interface CustomerAccount {
  id: string
  name: string
  is_active: boolean
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  created_at: string
}

export interface CustomerAccountCreate {
  name: string
  is_active?: boolean
  contact_name?: string | null
  contact_email?: string | null
  contact_phone?: string | null
}

export interface CustomerAccountUpdate {
  name?: string
  is_active?: boolean
  contact_name?: string | null
  contact_email?: string | null
  contact_phone?: string | null
}

export interface PaginatedAccounts {
  items: CustomerAccount[]
  total: number
  skip: number
  limit: number
}

export function useAccounts(skip = 0, limit = 25) {
  return useQuery<PaginatedAccounts>({
    queryKey: ['accounts', skip, limit],
    queryFn: () =>
      api.get<PaginatedAccounts>('/accounts', { params: { skip, limit } }).then((r) => r.data),
  })
}

export function useAccount(id: string | null) {
  return useQuery<CustomerAccount>({
    queryKey: ['accounts', id],
    queryFn: () => api.get<CustomerAccount>(`/accounts/${id}`).then((r) => r.data),
    enabled: !!id,
  })
}

export function useCreateAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CustomerAccountCreate) =>
      api.post<CustomerAccount>('/accounts', payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }),
  })
}

export function useUpdateAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...payload }: CustomerAccountUpdate & { id: string }) =>
      api.patch<CustomerAccount>(`/accounts/${id}`, payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }),
  })
}
