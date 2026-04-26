import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/services/api'

export type DeviceCondition = 'GOOD' | 'FAIR' | 'POOR' | 'DAMAGED'
export type DeviceStatus = 'CHECKED_IN' | 'CHECKED_OUT'

export interface Device {
  id: string
  customer_account_id: string
  device_model_id: string
  serial_number: string
  asset_tag: string | null
  condition: DeviceCondition
  status: DeviceStatus
  location_id: string | null
  checked_in_by_id: string
  checked_out_by_id: string | null
  checked_in_at: string
  checked_out_at: string | null
  comments: string | null
  model_name: string | null
  model_number: string | null
  location_path: string | null
  checked_in_by_name: string | null
  checked_out_by_name: string | null
}

export interface CheckInPayload {
  account_id: string
  serial_number: string
  device_model_id: string
  location_id: string
  asset_tag?: string | null
  condition?: DeviceCondition
  checked_in_at: string
  comments?: string | null
}

export interface DeviceListParams {
  account_id?: string | null
  status?: DeviceStatus | null
  skip?: number
  limit?: number
}

export interface PaginatedDevices {
  items: Device[]
  total: number
  skip: number
  limit: number
}

export function useDevices(params: DeviceListParams = {}) {
  return useQuery<PaginatedDevices>({
    queryKey: ['devices', params],
    queryFn: () => {
      const query: Record<string, string | number> = {
        skip: params.skip ?? 0,
        limit: params.limit ?? 25,
      }
      if (params.account_id) query.account_id = params.account_id
      if (params.status) query.status = params.status
      return api.get<PaginatedDevices>('/devices', { params: query }).then((r) => r.data)
    },
  })
}

export function useDevice(id: string | null) {
  return useQuery<Device>({
    queryKey: ['devices', id],
    queryFn: () => api.get<Device>(`/devices/${id}`).then((r) => r.data),
    enabled: !!id,
  })
}

export function useCheckIn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CheckInPayload) =>
      api.post<Device>('/devices/checkin', payload).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['devices'] })
    },
  })
}
