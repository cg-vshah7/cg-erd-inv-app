import { useState } from 'react'
import {
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  List,
  ListItem,
  ListItemText,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import type { GridColDef, GridPaginationModel } from '@mui/x-data-grid'
import { DataTable } from '@/components/common/DataTable'
import {
  useEngineers,
  useCreateEngineer,
  useUpdateEngineer,
  useEngineerAccounts,
  useAssignAccount,
  useUpdateMapping,
  useRemoveMapping,
  type Engineer,
  type EngineerCreate,
  type AccountMapping,
} from '@/hooks/useEngineers'
import { useAccounts } from '@/hooks/useAccounts'
import { useUiStore } from '@/store/uiStore'

const COLUMNS: GridColDef[] = [
  { field: 'full_name', headerName: 'Name', flex: 1 },
  { field: 'email', headerName: 'Email', flex: 1 },
  {
    field: 'is_super_admin',
    headerName: 'Role',
    width: 120,
    renderCell: ({ value }) =>
      value ? (
        <Chip label="Super Admin" color="primary" size="small" />
      ) : (
        <Chip label="Engineer" size="small" />
      ),
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

const EMPTY_CREATE: EngineerCreate = {
  email: '',
  full_name: '',
  password: '',
  is_super_admin: false,
}

export function EngineersPage() {
  const addNotification = useUiStore((s) => s.addNotification)
  const [pagination, setPagination] = useState<GridPaginationModel>({ page: 0, pageSize: 25 })
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState<EngineerCreate>(EMPTY_CREATE)
  const [selectedEngineer, setSelectedEngineer] = useState<Engineer | null>(null)
  const [mappingOpen, setMappingOpen] = useState(false)
  const [assignAccountId, setAssignAccountId] = useState('')
  const [assignPerms, setAssignPerms] = useState({
    can_checkin_out: false,
    can_manage_models: false,
    can_view_only: true,
  })

  const skip = pagination.page * pagination.pageSize
  const { data, isLoading } = useEngineers(skip, pagination.pageSize)
  const { data: accountsData } = useAccounts(0, 100)
  const { data: mappings, isLoading: mappingsLoading } = useEngineerAccounts(
    selectedEngineer?.id ?? null,
  )

  const createMutation = useCreateEngineer()
  const updateMutation = useUpdateEngineer()
  const assignMutation = useAssignAccount(selectedEngineer?.id ?? '')
  const updateMappingMutation = useUpdateMapping(selectedEngineer?.id ?? '')
  const removeMappingMutation = useRemoveMapping(selectedEngineer?.id ?? '')

  const handleCreate = async () => {
    try {
      await createMutation.mutateAsync(form)
      addNotification({ message: 'Engineer created', severity: 'success' })
      setCreateOpen(false)
      setForm(EMPTY_CREATE)
    } catch (err: unknown) {
      addNotification({
        message: err instanceof Error ? err.message : 'An error occurred',
        severity: 'error',
      })
    }
  }

  const openMappings = (engineer: Engineer) => {
    setSelectedEngineer(engineer)
    setMappingOpen(true)
  }

  const handleAssign = async () => {
    if (!assignAccountId) return
    try {
      await assignMutation.mutateAsync({
        customer_account_id: assignAccountId,
        ...assignPerms,
      })
      addNotification({ message: 'Account assigned', severity: 'success' })
      setAssignAccountId('')
      setAssignPerms({ can_checkin_out: false, can_manage_models: false, can_view_only: true })
    } catch (err: unknown) {
      addNotification({
        message: err instanceof Error ? err.message : 'An error occurred',
        severity: 'error',
      })
    }
  }

  const handleTogglePermission = async (
    mapping: AccountMapping,
    field: 'can_checkin_out' | 'can_manage_models' | 'can_view_only',
  ) => {
    try {
      await updateMappingMutation.mutateAsync({
        accountId: mapping.customer_account_id,
        [field]: !mapping[field],
      })
    } catch (err: unknown) {
      addNotification({
        message: err instanceof Error ? err.message : 'Failed to update permission',
        severity: 'error',
      })
    }
  }

  const handleRemoveMapping = async (mapping: AccountMapping) => {
    try {
      await removeMappingMutation.mutateAsync(mapping.customer_account_id)
      addNotification({ message: 'Account removed', severity: 'success' })
    } catch (err: unknown) {
      addNotification({
        message: err instanceof Error ? err.message : 'Failed to remove mapping',
        severity: 'error',
      })
    }
  }

  const getAccountName = (accountId: string) =>
    accountsData?.items.find((a) => a.id === accountId)?.name ?? accountId

  const rows = (data?.items ?? []).map((e) => ({ ...e, id: e.id }))

  const columnsWithActions: GridColDef[] = [
    ...COLUMNS,
    {
      field: 'actions',
      headerName: '',
      width: 160,
      sortable: false,
      renderCell: ({ row }) => (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Button size="small" onClick={() => openMappings(row as Engineer)}>
            Accounts
          </Button>
          <Button
            size="small"
            color={row.is_active ? 'warning' : 'success'}
            onClick={() =>
              updateMutation
                .mutateAsync({ id: row.id, is_active: !row.is_active })
                .catch(() => null)
            }
          >
            {row.is_active ? 'Disable' : 'Enable'}
          </Button>
        </Box>
      ),
    },
  ]

  const unassignedAccounts = (accountsData?.items ?? []).filter(
    (a) => !mappings?.some((m) => m.customer_account_id === a.id),
  )

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" fontWeight={600}>
          Engineers
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            setForm(EMPTY_CREATE)
            setCreateOpen(true)
          }}
        >
          Add Engineer
        </Button>
      </Box>

      <DataTable
        rows={rows}
        columns={columnsWithActions}
        total={data?.total ?? 0}
        paginationModel={pagination}
        onPaginationModelChange={setPagination}
        loading={isLoading}
        emptyMessage="No engineers yet — create your first engineer account."
      />

      {/* Create Engineer Dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>New Engineer</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField
            label="Full Name"
            required
            value={form.full_name}
            onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
          />
          <TextField
            label="Email"
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
          <TextField
            label="Initial Password"
            type="password"
            required
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={form.is_super_admin ?? false}
                onChange={(e) => setForm((f) => ({ ...f, is_super_admin: e.target.checked }))}
              />
            }
            label="Super Admin"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={!form.email || !form.full_name || !form.password || createMutation.isPending}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Account Mappings Dialog */}
      <Dialog open={mappingOpen} onClose={() => setMappingOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Account Access — {selectedEngineer?.full_name}
        </DialogTitle>
        <DialogContent>
          {mappingsLoading ? (
            <Typography color="text.secondary">Loading…</Typography>
          ) : mappings && mappings.length > 0 ? (
            <List dense>
              {mappings.map((m) => (
                <ListItem
                  key={m.id}
                  secondaryAction={
                    <Tooltip title="Remove access">
                      <IconButton edge="end" onClick={() => handleRemoveMapping(m)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  }
                >
                  <ListItemText
                    primary={getAccountName(m.customer_account_id)}
                    secondary={
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                        <Chip
                          label="Check-In/Out"
                          size="small"
                          color={m.can_checkin_out ? 'success' : 'default'}
                          onClick={() => handleTogglePermission(m, 'can_checkin_out')}
                        />
                        <Chip
                          label="Model Master"
                          size="small"
                          color={m.can_manage_models ? 'success' : 'default'}
                          onClick={() => handleTogglePermission(m, 'can_manage_models')}
                        />
                        <Chip
                          label="View Only"
                          size="small"
                          color={m.can_view_only ? 'info' : 'default'}
                          onClick={() => handleTogglePermission(m, 'can_view_only')}
                        />
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>
          ) : (
            <Typography color="text.secondary" sx={{ py: 2 }}>
              No accounts assigned yet.
            </Typography>
          )}

          {unassignedAccounts.length > 0 && (
            <>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2" gutterBottom>
                Assign Account
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <TextField
                  select
                  label="Account"
                  size="small"
                  value={assignAccountId}
                  onChange={(e) => setAssignAccountId(e.target.value)}
                  SelectProps={{ native: true }}
                >
                  <option value="">— select —</option>
                  {unassignedAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </TextField>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        size="small"
                        checked={assignPerms.can_checkin_out}
                        onChange={(e) =>
                          setAssignPerms((p) => ({ ...p, can_checkin_out: e.target.checked }))
                        }
                      />
                    }
                    label="Check-In/Out"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        size="small"
                        checked={assignPerms.can_manage_models}
                        onChange={(e) =>
                          setAssignPerms((p) => ({ ...p, can_manage_models: e.target.checked }))
                        }
                      />
                    }
                    label="Model Master"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        size="small"
                        checked={assignPerms.can_view_only}
                        onChange={(e) =>
                          setAssignPerms((p) => ({ ...p, can_view_only: e.target.checked }))
                        }
                      />
                    }
                    label="View Only"
                  />
                </Box>
                <Button
                  variant="outlined"
                  size="small"
                  disabled={!assignAccountId || assignMutation.isPending}
                  onClick={handleAssign}
                >
                  Assign
                </Button>
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMappingOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
