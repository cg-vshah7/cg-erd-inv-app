import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/services/api'

export type LocationLevel = 'SITE' | 'BUILDING' | 'FLOOR' | 'ROOM'

export interface Location {
  id: string
  name: string
  level: LocationLevel
  parent_id: string | null
  customer_account_id: string
  is_active: boolean
  children?: Location[] | null
}

export interface LocationCreate {
  name: string
  level: LocationLevel
  parent_id?: string | null
  customer_account_id: string
  is_active?: boolean
}

export interface LocationUpdate {
  name?: string
  is_active?: boolean
}

export function useLocations(accountId: string | null) {
  return useQuery<Location[]>({
    queryKey: ['locations', accountId],
    queryFn: () =>
      api.get<Location[]>('/locations', { params: { account_id: accountId } }).then((r) => r.data),
    enabled: !!accountId,
  })
}

export function useLocationChildren(parentId: string | null, accountId: string | null) {
  return useQuery<Location[]>({
    queryKey: ['locations', 'children', parentId, accountId],
    queryFn: () =>
      api
        .get<Location[]>(`/locations/${parentId}/children`, { params: { account_id: accountId } })
        .then((r) => r.data),
    enabled: !!parentId && !!accountId,
  })
}

export function useCreateLocation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: LocationCreate) =>
      api.post<Location>('/locations', payload).then((r) => r.data),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['locations', variables.customer_account_id] })
      qc.invalidateQueries({ queryKey: ['locations', 'children'] })
    },
  })
}

export function useDeleteLocation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (locationId: string) =>
      api.delete(`/locations/${locationId}`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['locations'] })
    },
  })
}
