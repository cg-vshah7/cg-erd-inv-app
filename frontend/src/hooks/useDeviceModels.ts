import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/services/api'

export interface DeviceModel {
  id: string
  customer_account_id: string
  model_number: string
  name: string
  description: string | null
  manufacturer: string | null
  device_category: string | null
  is_active: boolean
}

export interface DeviceModelCreate {
  customer_account_id: string
  model_number: string
  name: string
  description?: string | null
  manufacturer?: string | null
  device_category?: string | null
  is_active?: boolean
}

export interface DeviceModelUpdate {
  model_number?: string
  name?: string
  description?: string | null
  manufacturer?: string | null
  device_category?: string | null
  is_active?: boolean
}

export interface PaginatedDeviceModels {
  items: DeviceModel[]
  total: number
  skip: number
  limit: number
}

export function useDeviceModels(accountId: string | null, skip = 0, limit = 25) {
  return useQuery<PaginatedDeviceModels>({
    queryKey: ['device-models', accountId, skip, limit],
    queryFn: () =>
      api
        .get<PaginatedDeviceModels>('/device-models', {
          params: { account_id: accountId, skip, limit },
        })
        .then((r) => r.data),
    enabled: !!accountId,
  })
}

export function useCreateDeviceModel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: DeviceModelCreate) =>
      api.post<DeviceModel>('/device-models', payload).then((r) => r.data),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['device-models', variables.customer_account_id] })
    },
  })
}

export function useUpdateDeviceModel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...payload }: DeviceModelUpdate & { id: string }) =>
      api.patch<DeviceModel>(`/device-models/${id}`, payload).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['device-models'] })
    },
  })
}
