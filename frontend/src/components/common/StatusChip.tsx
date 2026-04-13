import { Chip } from '@mui/material'

interface StatusChipProps {
  status: 'CHECKED_IN' | 'CHECKED_OUT' | string
}

export function StatusChip({ status }: StatusChipProps) {
  if (status === 'CHECKED_IN') {
    return <Chip label="Checked In" color="success" size="small" />
  }
  return <Chip label="Checked Out" color="warning" size="small" />
}
