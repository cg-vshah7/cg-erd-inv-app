import { useState } from 'react'
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  TextField,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import type { GridColDef, GridPaginationModel } from '@mui/x-data-grid'
import { DataTable } from '@/components/common/DataTable'
import {
  useAccounts,
  useCreateAccount,
  useUpdateAccount,
  type CustomerAccount,
  type CustomerAccountCreate,
} from '@/hooks/useAccounts'
import { useUiStore } from '@/store/uiStore'

const COLUMNS: GridColDef[] = [
  { field: 'name', headerName: 'Account Name', flex: 1 },
  { field: 'contact_name', headerName: 'Contact', flex: 1, valueGetter: (v) => v ?? '—' },
  { field: 'contact_email', headerName: 'Email', flex: 1, valueGetter: (v) => v ?? '—' },
  { field: 'contact_phone', headerName: 'Phone', width: 140, valueGetter: (v) => v ?? '—' },
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

const EMPTY_FORM: CustomerAccountCreate = {
  name: '',
  is_active: true,
  contact_name: '',
  contact_email: '',
  contact_phone: '',
}

export function AccountsPage() {
  const addNotification = useUiStore((s) => s.addNotification)
  const [pagination, setPagination] = useState<GridPaginationModel>({ page: 0, pageSize: 25 })
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<CustomerAccount | null>(null)
  const [form, setForm] = useState<CustomerAccountCreate>(EMPTY_FORM)

  const skip = pagination.page * pagination.pageSize
  const { data, isLoading } = useAccounts(skip, pagination.pageSize)
  const createMutation = useCreateAccount()
  const updateMutation = useUpdateAccount()

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  const openEdit = (account: CustomerAccount) => {
    setEditing(account)
    setForm({
      name: account.name,
      is_active: account.is_active,
      contact_name: account.contact_name ?? '',
      contact_email: account.contact_email ?? '',
      contact_phone: account.contact_phone ?? '',
    })
    setDialogOpen(true)
  }

  const handleSubmit = async () => {
    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, ...form })
        addNotification({ message: 'Account updated', severity: 'success' })
      } else {
        await createMutation.mutateAsync(form)
        addNotification({ message: 'Account created', severity: 'success' })
      }
      setDialogOpen(false)
    } catch (err: unknown) {
      addNotification({
        message: err instanceof Error ? err.message : 'An error occurred',
        severity: 'error',
      })
    }
  }

  const rows = (data?.items ?? []).map((a) => ({ ...a, id: a.id }))

  const columnsWithActions: GridColDef[] = [
    ...COLUMNS,
    {
      field: 'actions',
      headerName: '',
      width: 80,
      sortable: false,
      renderCell: ({ row }) => (
        <Button size="small" onClick={() => openEdit(row as CustomerAccount)}>
          Edit
        </Button>
      ),
    },
  ]

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" fontWeight={600}>
          Customer Accounts
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          Add Account
        </Button>
      </Box>

      <DataTable
        rows={rows}
        columns={columnsWithActions}
        total={data?.total ?? 0}
        paginationModel={pagination}
        onPaginationModelChange={setPagination}
        loading={isLoading}
        emptyMessage="No accounts yet — create your first customer account."
      />

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Edit Account' : 'New Customer Account'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField
            label="Account Name"
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <TextField
            label="Contact Name"
            value={form.contact_name ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value || null }))}
          />
          <TextField
            label="Contact Email"
            type="email"
            value={form.contact_email ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, contact_email: e.target.value || null }))}
          />
          <TextField
            label="Contact Phone"
            value={form.contact_phone ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, contact_phone: e.target.value || null }))}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={form.is_active ?? true}
                onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
              />
            }
            label="Active"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={!form.name || createMutation.isPending || updateMutation.isPending}
          >
            {editing ? 'Save' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
