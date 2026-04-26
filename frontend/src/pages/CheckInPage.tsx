import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { LocationSelector } from '@/components/common/LocationSelector'
import { useDeviceModels } from '@/hooks/useDeviceModels'
import { useCheckIn } from '@/hooks/useDevices'
import { useUiStore } from '@/store/uiStore'
import api from '@/services/api'

interface AccountMapping {
  id: string
  customer_account_id: string
  can_checkin_out: boolean
  can_manage_models: boolean
  can_view_only: boolean
}

interface AccountInfo {
  id: string
  name: string
}

function useMyAccounts() {
  return useQuery<AccountMapping[]>({
    queryKey: ['my-accounts'],
    queryFn: () => api.get<AccountMapping[]>('/auth/me/accounts').then((r) => r.data),
  })
}

function useAccountDetails(accountId: string | null) {
  return useQuery<AccountInfo>({
    queryKey: ['accounts', accountId],
    queryFn: () => api.get<AccountInfo>(`/accounts/${accountId}`).then((r) => r.data),
    enabled: !!accountId,
  })
}

interface PaginatedDevices {
  items: { id: string; serial_number: string }[]
  total: number
}

type DeviceCondition = 'GOOD' | 'FAIR' | 'POOR' | 'DAMAGED'
const CONDITIONS: { value: DeviceCondition; label: string }[] = [
  { value: 'GOOD', label: 'Good' },
  { value: 'FAIR', label: 'Fair' },
  { value: 'POOR', label: 'Poor' },
  { value: 'DAMAGED', label: 'Damaged' },
]

const STEPS = ['Identify Device', 'Location & Condition', 'Confirm']

interface FormState {
  accountId: string
  serialNumber: string
  assetTag: string
  deviceModelId: string
  locationId: string
  condition: DeviceCondition
  checkedInAt: string
  comments: string
}

const today = () => new Date().toISOString().slice(0, 16)

const EMPTY: FormState = {
  accountId: '',
  serialNumber: '',
  assetTag: '',
  deviceModelId: '',
  locationId: '',
  condition: 'GOOD',
  checkedInAt: today(),
  comments: '',
}

export function CheckInPage() {
  const navigate = useNavigate()
  const addNotification = useUiStore((s) => s.addNotification)

  const [activeStep, setActiveStep] = useState(0)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null)
  const [checkingDuplicate, setCheckingDuplicate] = useState(false)

  const { data: myAccountMappings = [], isLoading: mappingsLoading } = useMyAccounts()
  const checkinAccounts = myAccountMappings.filter((m) => m.can_checkin_out)

  // Load account names for each mapping
  const { data: activeAccountInfo } = useAccountDetails(form.accountId || null)

  // Device models for selected account
  const { data: deviceModelsList } = useDeviceModels(form.accountId || null)
  const deviceModels = deviceModelsList?.items ?? []

  // Selected model details for summary
  const selectedModel = deviceModels.find((m) => m.id === form.deviceModelId)

  const checkIn = useCheckIn()

  const set = (field: keyof FormState, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }))

  const handleSerialBlur = async () => {
    if (!form.serialNumber || !form.accountId) return
    setCheckingDuplicate(true)
    setDuplicateWarning(null)
    try {
      const res = await api.get<PaginatedDevices>('/devices', {
        params: {
          serial_number: form.serialNumber,
          account_id: form.accountId,
          status: 'CHECKED_IN',
          limit: 1,
        },
      })
      if (res.data.total > 0) {
        setDuplicateWarning(
          `Serial number "${form.serialNumber}" is already checked in for this account.`
        )
      }
    } catch {
      // non-critical — ignore errors in duplicate check
    } finally {
      setCheckingDuplicate(false)
    }
  }

  const handleAccountChange = (accountId: string) => {
    setForm((prev) => ({
      ...prev,
      accountId,
      deviceModelId: '',
      locationId: '',
    }))
    setDuplicateWarning(null)
  }

  const canProceedStep1 =
    !!form.accountId && !!form.serialNumber && !!form.deviceModelId && !duplicateWarning

  const canProceedStep2 = !!form.locationId && !!form.checkedInAt

  const handleNext = () => setActiveStep((s) => s + 1)
  const handleBack = () => setActiveStep((s) => s - 1)

  const handleSubmit = async () => {
    try {
      await checkIn.mutateAsync({
        account_id: form.accountId,
        serial_number: form.serialNumber,
        device_model_id: form.deviceModelId,
        location_id: form.locationId,
        asset_tag: form.assetTag || null,
        condition: form.condition,
        checked_in_at: new Date(form.checkedInAt).toISOString(),
        comments: form.comments || null,
      })
      addNotification({ message: 'Device checked in successfully', severity: 'success' })
      navigate('/devices')
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message ?? 'Check-in failed. Please try again.'
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
    <Box sx={{ maxWidth: 720, mx: 'auto', p: 3 }}>
      <Typography variant="h5" fontWeight={600} mb={3}>
        Check In Device
      </Typography>

      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {STEPS.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      <Paper variant="outlined" sx={{ p: 3 }}>
        {/* ── Step 1: Identify Device ── */}
        {activeStep === 0 && (
          <Box display="flex" flexDirection="column" gap={2.5}>
            <Typography variant="subtitle1" fontWeight={500}>
              Identify Device
            </Typography>

            <FormControl fullWidth required>
              <InputLabel>Account</InputLabel>
              <Select
                label="Account"
                value={form.accountId}
                onChange={(e) => handleAccountChange(e.target.value)}
              >
                {checkinAccounts.map((mapping) => (
                  <AccountMenuItem key={mapping.customer_account_id} accountId={mapping.customer_account_id} />
                ))}
              </Select>
            </FormControl>

            <Box>
              <TextField
                fullWidth
                required
                label="Serial Number"
                value={form.serialNumber}
                onChange={(e) => {
                  set('serialNumber', e.target.value)
                  setDuplicateWarning(null)
                }}
                onBlur={handleSerialBlur}
                disabled={!form.accountId}
                InputProps={{
                  endAdornment: checkingDuplicate ? (
                    <CircularProgress size={18} />
                  ) : undefined,
                }}
              />
              {duplicateWarning && (
                <Alert severity="error" sx={{ mt: 1 }}>
                  {duplicateWarning}
                </Alert>
              )}
            </Box>

            <TextField
              fullWidth
              label="Asset Tag (optional)"
              value={form.assetTag}
              onChange={(e) => set('assetTag', e.target.value)}
              disabled={!form.accountId}
            />

            <FormControl fullWidth required disabled={!form.accountId}>
              <InputLabel>Device Model</InputLabel>
              <Select
                label="Device Model"
                value={form.deviceModelId}
                onChange={(e) => set('deviceModelId', e.target.value)}
              >
                {deviceModels.map((m) => (
                  <MenuItem key={m.id} value={m.id}>
                    {m.model_number} — {m.name}
                  </MenuItem>
                ))}
                {deviceModels.length === 0 && form.accountId && (
                  <MenuItem disabled value="">
                    No models available — contact admin
                  </MenuItem>
                )}
              </Select>
            </FormControl>
          </Box>
        )}

        {/* ── Step 2: Location & Condition ── */}
        {activeStep === 1 && (
          <Box display="flex" flexDirection="column" gap={2.5}>
            <Typography variant="subtitle1" fontWeight={500}>
              Location & Condition
            </Typography>

            <LocationSelector
              accountId={form.accountId}
              value={form.locationId || null}
              onChange={(id) => set('locationId', id ?? '')}
            />

            <FormControl fullWidth required>
              <InputLabel>Condition</InputLabel>
              <Select
                label="Condition"
                value={form.condition}
                onChange={(e) => set('condition', e.target.value as DeviceCondition)}
              >
                {CONDITIONS.map((c) => (
                  <MenuItem key={c.value} value={c.value}>
                    {c.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              fullWidth
              required
              label="Check-In Date & Time"
              type="datetime-local"
              value={form.checkedInAt}
              onChange={(e) => set('checkedInAt', e.target.value)}
              InputLabelProps={{ shrink: true }}
            />

            <TextField
              fullWidth
              label="Comments (optional)"
              multiline
              rows={3}
              value={form.comments}
              onChange={(e) => set('comments', e.target.value)}
            />
          </Box>
        )}

        {/* ── Step 3: Confirm ── */}
        {activeStep === 2 && (
          <Box display="flex" flexDirection="column" gap={1.5}>
            <Typography variant="subtitle1" fontWeight={500} mb={1}>
              Confirm Check-In
            </Typography>

            <SummaryRow label="Account" value={activeAccountInfo?.name ?? form.accountId} />
            <SummaryRow label="Serial Number" value={form.serialNumber} />
            {form.assetTag && <SummaryRow label="Asset Tag" value={form.assetTag} />}
            <SummaryRow
              label="Device Model"
              value={selectedModel ? `${selectedModel.model_number} — ${selectedModel.name}` : form.deviceModelId}
            />
            <Divider sx={{ my: 1 }} />
            <SummaryRow label="Condition" value={form.condition} />
            <SummaryRow
              label="Check-In Date"
              value={form.checkedInAt ? new Date(form.checkedInAt).toLocaleString() : ''}
            />
            {form.comments && <SummaryRow label="Comments" value={form.comments} />}

            {checkIn.isError && (
              <Alert severity="error" sx={{ mt: 1 }}>
                {(checkIn.error as { response?: { data?: { error?: { message?: string } } } })
                  ?.response?.data?.error?.message ?? 'An error occurred. Please try again.'}
              </Alert>
            )}
          </Box>
        )}

        {/* ── Navigation ── */}
        <Box display="flex" justifyContent="space-between" mt={4}>
          <Button disabled={activeStep === 0} onClick={handleBack}>
            Back
          </Button>

          {activeStep < STEPS.length - 1 ? (
            <Button
              variant="contained"
              onClick={handleNext}
              disabled={
                (activeStep === 0 && !canProceedStep1) ||
                (activeStep === 1 && !canProceedStep2)
              }
            >
              Next
            </Button>
          ) : (
            <Button
              variant="contained"
              color="success"
              onClick={handleSubmit}
              disabled={checkIn.isPending}
              startIcon={checkIn.isPending ? <CircularProgress size={16} color="inherit" /> : null}
            >
              {checkIn.isPending ? 'Checking In…' : 'Confirm Check-In'}
            </Button>
          )}
        </Box>
      </Paper>
    </Box>
  )
}

// ── Helpers ──

function AccountMenuItem({ accountId }: { accountId: string }) {
  const { data } = useAccountDetails(accountId)
  return <MenuItem value={accountId}>{data?.name ?? accountId}</MenuItem>
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <Box display="flex" gap={1}>
      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 140 }}>
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={500}>
        {value}
      </Typography>
    </Box>
  )
}
