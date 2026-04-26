import { useState } from 'react'
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import LockIcon from '@mui/icons-material/Lock'
import type { GridColDef, GridPaginationModel } from '@mui/x-data-grid'
import { useQuery } from '@tanstack/react-query'
import { DataTable } from '@/components/common/DataTable'
import {
  useDeviceModels,
  useCreateDeviceModel,
  useUpdateDeviceModel,
  type DeviceModel,
} from '@/hooks/useDeviceModels'
import { useAccounts } from '@/hooks/useAccounts'
import { useEngineerAccounts } from '@/hooks/useEngineers'
import { useUiStore } from '@/store/uiStore'
import api from '@/services/api'

interface EngineerProfile {
  id: string
  is_super_admin: boolean
}

function useMe() {
  return useQuery<EngineerProfile>({
    queryKey: ['me'],
    queryFn: () => api.get<EngineerProfile>('/auth/me').then((r) => r.data),
  })
}

interface ModelFormValues {
  model_number: string
  name: string
  description: string
  manufacturer: string
  device_category: string
  is_active: boolean
}

const EMPTY_FORM: ModelFormValues = {
  model_number: '',
  name: '',
  description: '',
  manufacturer: '',
  device_category: '',
  is_active: true,
}

interface ModelDialogProps {
  open: boolean
  editing: DeviceModel | null
  accountId: string
  onClose: () => void
}

function ModelDialog({ open, editing, accountId, onClose }: ModelDialogProps) {
  const addNotification = useUiStore((s) => s.addNotification)
  const [form, setForm] = useState<ModelFormValues>(
    editing
      ? {
          model_number: editing.model_number,
          name: editing.name,
          description: editing.description ?? '',
          manufacturer: editing.manufacturer ?? '',
          device_category: editing.device_category ?? '',
          is_active: editing.is_active,
        }
      : EMPTY_FORM
  )

  const createMutation = useCreateDeviceModel()
  const updateMutation = useUpdateDeviceModel()
  const isPending = createMutation.isPending || updateMutation.isPending

  const nullIfEmpty = (v: string) => v.trim() || null

  const handleSubmit = async () => {
    try {
      if (editing) {
        await updateMutation.mutateAsync({
          id: editing.id,
          model_number: form.model_number,
          name: form.name,
          description: nullIfEmpty(form.description),
          manufacturer: nullIfEmpty(form.manufacturer),
          device_category: nullIfEmpty(form.device_category),
          is_active: form.is_active,
        })
        addNotification({ message: 'Device model updated', severity: 'success' })
      } else {
        await createMutation.mutateAsync({
          customer_account_id: accountId,
          model_number: form.model_number,
          name: form.name,
          description: nullIfEmpty(form.description),
          manufacturer: nullIfEmpty(form.manufacturer),
          device_category: nullIfEmpty(form.device_category),
          is_active: form.is_active,
        })
        addNotification({ message: 'Device model created', severity: 'success' })
      }
      onClose()
    } catch (err: unknown) {
      addNotification({
        message: err instanceof Error ? err.message : 'An error occurred',
        severity: 'error',
      })
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{editing ? 'Edit Device Model' : 'New Device Model'}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
        <TextField
          label="Model Number"
          required
          value={form.model_number}
          onChange={(e) => setForm((f) => ({ ...f, model_number: e.target.value }))}
        />
        <TextField
          label="Name"
          required
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
        <TextField
          label="Description"
          multiline
          rows={2}
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        />
        <TextField
          label="Manufacturer"
          value={form.manufacturer}
          onChange={(e) => setForm((f) => ({ ...f, manufacturer: e.target.value }))}
        />
        <TextField
          label="Device Category"
          value={form.device_category}
          onChange={(e) => setForm((f) => ({ ...f, device_category: e.target.value }))}
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={form.is_active}
              onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
            />
          }
          label="Active"
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!form.model_number || !form.name || isPending}
        >
          {editing ? 'Save' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export function DeviceModelsPage() {
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [pagination, setPagination] = useState<GridPaginationModel>({ page: 0, pageSize: 25 })
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<DeviceModel | null>(null)

  const { data: accounts } = useAccounts(0, 100)
  const { data: me } = useMe()
  const { data: myMappings } = useEngineerAccounts(me?.id ?? null)

  const skip = pagination.page * pagination.pageSize
  const { data, isLoading } = useDeviceModels(selectedAccountId, skip, pagination.pageSize)

  const canManageModels =
    me?.is_super_admin ||
    myMappings?.some(
      (m) => m.customer_account_id === selectedAccountId && m.can_manage_models
    ) === true

  const openCreate = () => {
    setEditing(null)
    setDialogOpen(true)
  }

  const openEdit = (model: DeviceModel) => {
    setEditing(model)
    setDialogOpen(true)
  }

  const columns: GridColDef[] = [
    { field: 'model_number', headerName: 'Model Number', width: 160 },
    { field: 'name', headerName: 'Name', flex: 1 },
    { field: 'manufacturer', headerName: 'Manufacturer', flex: 1, valueGetter: (v) => v ?? '—' },
    {
      field: 'device_category',
      headerName: 'Category',
      width: 140,
      valueGetter: (v) => v ?? '—',
    },
    {
      field: 'is_active',
      headerName: 'Status',
      width: 100,
      renderCell: ({ value }) => (
        <Typography
          variant="body2"
          color={value ? 'success.main' : 'text.disabled'}
          fontWeight={500}
        >
          {value ? 'Active' : 'Inactive'}
        </Typography>
      ),
    },
  ]

  if (canManageModels) {
    columns.push({
      field: 'actions',
      headerName: '',
      width: 80,
      sortable: false,
      renderCell: ({ row }) => (
        <Button size="small" onClick={() => openEdit(row as DeviceModel)}>
          Edit
        </Button>
      ),
    })
  }

  const rows = (data?.items ?? []).map((m) => ({ ...m, id: m.id }))

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight={600}>
          Device Models
        </Typography>
        {canManageModels ? (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={openCreate}
            disabled={!selectedAccountId}
          >
            Add Model
          </Button>
        ) : (
          <Tooltip title="Device Model Master permission required to create models">
            <span>
              <Button variant="contained" startIcon={<LockIcon />} disabled>
                Add Model
              </Button>
            </span>
          </Tooltip>
        )}
      </Box>

      <FormControl sx={{ mb: 3, minWidth: 280 }}>
        <InputLabel>Customer Account</InputLabel>
        <Select
          label="Customer Account"
          value={selectedAccountId ?? ''}
          onChange={(e) => {
            setSelectedAccountId(e.target.value || null)
            setPagination({ page: 0, pageSize: 25 })
          }}
        >
          {(accounts?.items ?? []).map((a) => (
            <MenuItem key={a.id} value={a.id}>
              {a.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {!canManageModels && selectedAccountId && (
        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <LockIcon fontSize="small" color="action" />
          <Typography variant="body2" color="text.secondary">
            Read-only view — contact your administrator for Device Model Master permission.
          </Typography>
        </Box>
      )}

      <DataTable
        rows={rows}
        columns={columns}
        total={data?.total ?? 0}
        paginationModel={pagination}
        onPaginationModelChange={setPagination}
        loading={isLoading}
        emptyMessage={
          selectedAccountId
            ? 'No device models yet — add your first model.'
            : 'Select an account to view its device models.'
        }
      />

      {dialogOpen && selectedAccountId && (
        <ModelDialog
          open={dialogOpen}
          editing={editing}
          accountId={selectedAccountId}
          onClose={() => {
            setDialogOpen(false)
            setEditing(null)
          }}
        />
      )}
    </Box>
  )
}
