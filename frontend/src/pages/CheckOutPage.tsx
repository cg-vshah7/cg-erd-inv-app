import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
} from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useAccounts } from '@/hooks/useAccounts'
import { useCheckOut, useDevices } from '@/hooks/useDevices'
import { useUiStore } from '@/store/uiStore'
import api from '@/services/api'

interface AccountMapping {
  id: string
  customer_account_id: string
  can_checkin_out: boolean
}

function useMyAccounts() {
  return useQuery<AccountMapping[]>({
    queryKey: ['my-accounts'],
    queryFn: () => api.get<AccountMapping[]>('/auth/me/accounts').then((r) => r.data),
  })
}

const today = () => new Date().toISOString().slice(0, 16)

export function CheckOutPage() {
  const navigate = useNavigate()
  const addNotification = useUiStore((s) => s.addNotification)
  const [searchParams] = useSearchParams()
  const preselectedDeviceId = searchParams.get('deviceId') ?? ''

  const [accountId, setAccountId] = useState('')
  const [deviceId, setDeviceId] = useState(preselectedDeviceId)
  const [checkedOutAt, setCheckedOutAt] = useState(today())
  const [comments, setComments] = useState('')

  const { data: myAccountMappings = [], isLoading: mappingsLoading } = useMyAccounts()
  const checkinAccounts = myAccountMappings.filter((m) => m.can_checkin_out)

  const { data: accountsData } = useAccounts(0, 1000)
  const accountNameById = new Map(accountsData?.items.map((a) => [a.id, a.name]))

  // Load checked-in devices for selected account
  const { data: devicesData, isLoading: devicesLoading } = useDevices(
    accountId ? { account_id: accountId, status: 'CHECKED_IN', limit: 100 } : {}
  )
  const checkedInDevices = accountId ? (devicesData?.items ?? []) : []

  const selectedDevice = checkedInDevices.find((d) => d.id === deviceId)

  const checkOut = useCheckOut()

  const handleAccountChange = (id: string) => {
    setAccountId(id)
    setDeviceId('')
  }

  const canSubmit = !!accountId && !!deviceId && !!checkedOutAt

  const handleSubmit = async () => {
    try {
      await checkOut.mutateAsync({
        deviceId,
        payload: {
          checked_out_at: new Date(checkedOutAt).toISOString(),
          comments: comments || null,
        },
      })
      addNotification({ message: 'Device checked out successfully', severity: 'success' })
      navigate('/devices')
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message ?? 'Check-out failed. Please try again.'
      addNotification({ message: msg, severity: 'error' })
    }
  }

  if (mappingsLoading) {
    return (
      <Box display="flex" justifyContent="center" mt={8}>
        <CircularProgress />
      </Box>
    )
  }

  if (checkinAccounts.length === 0) {
    return (
      <Box p={4}>
        <Alert severity="warning">
          You do not have check-in/out permission for any account. Contact your administrator.
        </Alert>
      </Box>
    )
  }

  return (
    <Box sx={{ maxWidth: 560, mx: 'auto', p: 3 }}>
      <Typography variant="h5" fontWeight={600} mb={3}>
        Check Out Device
      </Typography>

      <Paper variant="outlined" sx={{ p: 3 }}>
        <Box display="flex" flexDirection="column" gap={2.5}>
          {/* Account selector */}
          <FormControl fullWidth required>
            <InputLabel>Account</InputLabel>
            <Select
              label="Account"
              value={accountId}
              onChange={(e) => handleAccountChange(e.target.value as string)}
            >
              {checkinAccounts.map((mapping) => {
                const id = mapping.customer_account_id
                return (
                  <MenuItem key={id} value={id}>
                    {accountNameById.get(id) ?? id}
                  </MenuItem>
                )
              })}
            </Select>
          </FormControl>

          {/* Device selector — only checked-in devices */}
          <FormControl fullWidth required disabled={!accountId}>
            <InputLabel>Device (Serial Number)</InputLabel>
            <Select
              label="Device (Serial Number)"
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value as string)}
              startAdornment={
                devicesLoading && accountId ? <CircularProgress size={18} sx={{ mr: 1 }} /> : null
              }
            >
              {checkedInDevices.map((d) => (
                <MenuItem key={d.id} value={d.id}>
                  {d.serial_number}
                  {d.asset_tag ? ` (${d.asset_tag})` : ''}
                  {d.model_number ? ` — ${d.model_number}` : ''}
                </MenuItem>
              ))}
              {!devicesLoading && accountId && checkedInDevices.length === 0 && (
                <MenuItem disabled value="">
                  No checked-in devices for this account
                </MenuItem>
              )}
            </Select>
          </FormControl>

          {/* Selected device info */}
          {selectedDevice && (
            <Alert severity="info" sx={{ py: 0.5 }}>
              <Typography variant="body2">
                <strong>Model:</strong> {selectedDevice.model_name ?? '—'}
              </Typography>
              {selectedDevice.location_path && (
                <Typography variant="body2">
                  <strong>Location:</strong> {selectedDevice.location_path}
                </Typography>
              )}
            </Alert>
          )}

          {/* Check-out date */}
          <TextField
            fullWidth
            required
            label="Check-Out Date & Time"
            type="datetime-local"
            value={checkedOutAt}
            onChange={(e) => setCheckedOutAt(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />

          {/* Comments */}
          <TextField
            fullWidth
            label="Comments (optional)"
            multiline
            rows={3}
            value={comments}
            onChange={(e) => setComments(e.target.value)}
          />

          {checkOut.isError && (
            <Alert severity="error">
              {(checkOut.error as { response?: { data?: { error?: { message?: string } } } })
                ?.response?.data?.error?.message ?? 'An error occurred. Please try again.'}
            </Alert>
          )}

          <Box display="flex" justifyContent="flex-end" gap={1.5} mt={1}>
            <Button onClick={() => navigate('/devices')}>Cancel</Button>
            <Button
              variant="contained"
              color="warning"
              onClick={handleSubmit}
              disabled={!canSubmit || checkOut.isPending}
              startIcon={
                checkOut.isPending ? <CircularProgress size={16} color="inherit" /> : null
              }
            >
              {checkOut.isPending ? 'Checking Out…' : 'Confirm Check-Out'}
            </Button>
          </Box>
        </Box>
      </Paper>
    </Box>
  )
}
