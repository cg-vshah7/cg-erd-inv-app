import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from '@mui/material'
import type { GridColDef, GridPaginationModel } from '@mui/x-data-grid'
import { DataTable } from '@/components/common/DataTable'
import { StatusChip } from '@/components/common/StatusChip'
import { useAccounts } from '@/hooks/useAccounts'
import { type Device, useDevices, type DeviceStatus } from '@/hooks/useDevices'

export function DevicesPage() {
  const navigate = useNavigate()

  const [accountId, setAccountId] = useState<string>('')
  const [status, setStatus] = useState<DeviceStatus | ''>('')
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 25,
  })

  const { data: accountsData } = useAccounts(0, 1000)
  const accounts = accountsData?.items ?? []

  const { data, isLoading } = useDevices({
    account_id: accountId || undefined,
    status: (status as DeviceStatus) || undefined,
    skip: paginationModel.page * paginationModel.pageSize,
    limit: paginationModel.pageSize,
  })

  const rows = (data?.items ?? []).map((d) => ({ ...d, id: d.id }))
  const total = data?.total ?? 0

  const columns: GridColDef<Device>[] = [
    {
      field: 'serial_number',
      headerName: 'Serial Number',
      flex: 1.2,
      minWidth: 140,
    },
    {
      field: 'model_number',
      headerName: 'Model',
      flex: 1,
      minWidth: 120,
      valueGetter: (_value, row) => row.model_name ? `${row.model_number} — ${row.model_name}` : (row.model_number ?? '—'),
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 140,
      renderCell: (params) => <StatusChip status={params.value as string} />,
    },
    {
      field: 'location_path',
      headerName: 'Location',
      flex: 1.5,
      minWidth: 160,
      valueGetter: (_value, row) => row.location_path ?? '—',
    },
    {
      field: 'checked_in_by_name',
      headerName: 'Checked In By',
      flex: 1,
      minWidth: 130,
      valueGetter: (_value, row) => row.checked_in_by_name ?? '—',
    },
    {
      field: 'checked_in_at',
      headerName: 'Checked In At',
      flex: 1,
      minWidth: 150,
      valueGetter: (_value, row) =>
        row.checked_in_at ? new Date(row.checked_in_at).toLocaleString() : '—',
    },
    {
      field: 'customer_account_id',
      headerName: 'Account',
      flex: 1,
      minWidth: 120,
      valueGetter: (_value, row) => {
        const account = accounts.find((a) => a.id === row.customer_account_id)
        return account?.name ?? row.customer_account_id
      },
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 160,
      sortable: false,
      renderCell: (params) => (
        <Box display="flex" gap={0.5} alignItems="center" height="100%">
          {params.row.status === 'CHECKED_IN' && (
            <Button
              size="small"
              variant="outlined"
              color="warning"
              onClick={() => navigate(`/checkout?deviceId=${params.row.id}`)}
            >
              Check Out
            </Button>
          )}
        </Box>
      ),
    },
  ]

  return (
    <Box p={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5" fontWeight={600}>
          Devices
        </Typography>
        <Button variant="contained" onClick={() => navigate('/checkin')}>
          Check In Device
        </Button>
      </Box>

      {/* Filters */}
      <Box display="flex" gap={2} mb={2} flexWrap="wrap">
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Account</InputLabel>
          <Select
            label="Account"
            value={accountId}
            onChange={(e) => {
              setAccountId(e.target.value as string)
              setPaginationModel((p) => ({ ...p, page: 0 }))
            }}
          >
            <MenuItem value="">All Accounts</MenuItem>
            {accounts.map((a) => (
              <MenuItem key={a.id} value={a.id}>
                {a.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Status</InputLabel>
          <Select
            label="Status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as DeviceStatus | '')
              setPaginationModel((p) => ({ ...p, page: 0 }))
            }}
          >
            <MenuItem value="">All Statuses</MenuItem>
            <MenuItem value="CHECKED_IN">Checked In</MenuItem>
            <MenuItem value="CHECKED_OUT">Checked Out</MenuItem>
          </Select>
        </FormControl>
      </Box>

      <DataTable
        rows={rows}
        columns={columns}
        total={total}
        paginationModel={paginationModel}
        onPaginationModelChange={setPaginationModel}
        loading={isLoading}
        emptyMessage="No devices found — check in your first device."
      />
    </Box>
  )
}
