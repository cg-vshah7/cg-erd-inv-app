import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/services/api'

export interface Engineer {
  id: string
  keycloak_user_id: string
  email: string
  full_name: string
  is_active: boolean
  is_super_admin: boolean
  created_at: string
}

export interface EngineerCreate {
  email: string
  full_name: string
  password: string
  is_super_admin?: boolean
}

export interface EngineerUpdate {
  full_name?: string
  is_active?: boolean
  is_super_admin?: boolean
}

export interface AccountMapping {
  id: string
  engineer_id: string
  customer_account_id: string
  can_manage_models: boolean
  can_checkin_out: boolean
  can_view_only: boolean
}

export interface MappingCreate {
  customer_account_id: string
  can_manage_models?: boolean
  can_checkin_out?: boolean
  can_view_only?: boolean
}

export interface MappingUpdate {
  can_manage_models?: boolean
  can_checkin_out?: boolean
  can_view_only?: boolean
}

export interface PaginatedEngineers {
  items: Engineer[]
  total: number
  skip: number
  limit: number
}

export function useEngineers(skip = 0, limit = 25) {
  return useQuery<PaginatedEngineers>({
    queryKey: ['engineers', skip, limit],
    queryFn: () =>
      api.get<PaginatedEngineers>('/engineers', { params: { skip, limit } }).then((r) => r.data),
  })
}

export function useEngineer(id: string | null) {
  return useQuery<Engineer>({
    queryKey: ['engineers', id],
    queryFn: () => api.get<Engineer>(`/engineers/${id}`).then((r) => r.data),
    enabled: !!id,
  })
}

export function useCreateEngineer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: EngineerCreate) =>
      api.post<Engineer>('/engineers', payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['engineers'] }),
  })
}

export function useUpdateEngineer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...payload }: EngineerUpdate & { id: string }) =>
      api.patch<Engineer>(`/engineers/${id}`, payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['engineers'] }),
  })
}

export function useEngineerAccounts(engineerId: string | null) {
  return useQuery<AccountMapping[]>({
    queryKey: ['engineers', engineerId, 'accounts'],
    queryFn: () =>
      api.get<AccountMapping[]>(`/engineers/${engineerId}/accounts`).then((r) => r.data),
    enabled: !!engineerId,
  })
}

export function useAssignAccount(engineerId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: MappingCreate) =>
      api.post<AccountMapping>(`/engineers/${engineerId}/accounts`, payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['engineers', engineerId, 'accounts'] }),
  })
}

export function useUpdateMapping(engineerId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ accountId, ...payload }: MappingUpdate & { accountId: string }) =>
      api
        .patch<AccountMapping>(`/engineers/${engineerId}/accounts/${accountId}`, payload)
        .then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['engineers', engineerId, 'accounts'] }),
  })
}

export function useRemoveMapping(engineerId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (accountId: string) =>
      api.delete(`/engineers/${engineerId}/accounts/${accountId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['engineers', engineerId, 'accounts'] }),
  })
}
