import { Box, Skeleton, Typography } from '@mui/material'
import { DataGrid } from '@mui/x-data-grid'
import type { GridColDef, GridPaginationModel } from '@mui/x-data-grid'

interface DataTableProps<T extends { id: string }> {
  rows: T[]
  columns: GridColDef[]
  total: number
  paginationModel: GridPaginationModel
  onPaginationModelChange: (model: GridPaginationModel) => void
  loading?: boolean
  emptyMessage?: string
}

export function DataTable<T extends { id: string }>({
  rows,
  columns,
  total,
  paginationModel,
  onPaginationModelChange,
  loading = false,
  emptyMessage = 'No records found.',
}: DataTableProps<T>) {
  if (loading) {
    return (
      <Box>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} height={52} sx={{ mb: 0.5 }} />
        ))}
      </Box>
    )
  }

  if (!loading && rows.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Typography color="text.secondary">{emptyMessage}</Typography>
      </Box>
    )
  }

  return (
    <DataGrid
      rows={rows}
      columns={columns}
      rowCount={total}
      paginationMode="server"
      paginationModel={paginationModel}
      onPaginationModelChange={onPaginationModelChange}
      pageSizeOptions={[10, 25, 50]}
      disableRowSelectionOnClick
      autoHeight
    />
  )
}
