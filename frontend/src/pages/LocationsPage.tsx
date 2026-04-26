import { useState } from 'react'
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import { SimpleTreeView, TreeItem } from '@mui/x-tree-view'
import {
  useLocations,
  useCreateLocation,
  useDeleteLocation,
  type Location,
  type LocationLevel,
} from '@/hooks/useLocations'
import { useAccounts } from '@/hooks/useAccounts'
import { useUiStore } from '@/store/uiStore'

const LEVEL_LABELS: Record<LocationLevel, string> = {
  SITE: 'Site',
  BUILDING: 'Building',
  FLOOR: 'Floor',
  ROOM: 'Room',
}

const CHILD_LEVEL: Record<LocationLevel, LocationLevel | null> = {
  SITE: 'BUILDING',
  BUILDING: 'FLOOR',
  FLOOR: 'ROOM',
  ROOM: null,
}

interface AddDialogProps {
  open: boolean
  parentLocation: Location | null
  accountId: string
  onClose: () => void
  onCreated: () => void
}

function AddLocationDialog({ open, parentLocation, accountId, onClose, onCreated }: AddDialogProps) {
  const [name, setName] = useState('')
  const createMutation = useCreateLocation()
  const addNotification = useUiStore((s) => s.addNotification)

  const childLevel = parentLocation ? CHILD_LEVEL[parentLocation.level] : 'SITE'
  const levelLabel = childLevel ? LEVEL_LABELS[childLevel] : ''

  const handleSubmit = async () => {
    if (!childLevel) return
    try {
      await createMutation.mutateAsync({
        name,
        level: childLevel,
        parent_id: parentLocation?.id ?? null,
        customer_account_id: accountId,
      })
      addNotification({ message: `${levelLabel} "${name}" created`, severity: 'success' })
      setName('')
      onCreated()
      onClose()
    } catch (err: unknown) {
      addNotification({
        message: err instanceof Error ? err.message : 'Failed to create location',
        severity: 'error',
      })
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Add {levelLabel}</DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <TextField
          label={`${levelLabel} Name`}
          required
          fullWidth
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!name || createMutation.isPending}
        >
          Create
        </Button>
      </DialogActions>
    </Dialog>
  )
}

interface LocationNodeProps {
  location: Location
  allLocations: Location[]
  onAddChild: (parent: Location) => void
  onDelete: (location: Location) => void
}

function LocationNode({ location, allLocations, onAddChild, onDelete }: LocationNodeProps) {
  const childLevel = CHILD_LEVEL[location.level]
  const children = allLocations.filter((l) => l.parent_id === location.id)

  return (
    <TreeItem
      itemId={location.id}
      label={
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 0.5 }}>
          <Box>
            <Typography variant="body2" fontWeight={500}>
              {location.name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {LEVEL_LABELS[location.level]}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {childLevel && (
              <Tooltip title={`Add ${LEVEL_LABELS[childLevel]}`}>
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation()
                    onAddChild(location)
                  }}
                >
                  <AddIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title="Delete location">
              <span>
                <IconButton
                  size="small"
                  color="error"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(location)
                  }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        </Box>
      }
    >
      {children.map((child) => (
        <LocationNode
          key={child.id}
          location={child}
          allLocations={allLocations}
          onAddChild={onAddChild}
          onDelete={onDelete}
        />
      ))}
    </TreeItem>
  )
}

export function LocationsPage() {
  const addNotification = useUiStore((s) => s.addNotification)
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [addDialogParent, setAddDialogParent] = useState<Location | null | 'root'>('root')
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Location | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const { data: accounts } = useAccounts(0, 100)
  const { data: locations = [], isLoading, refetch } = useLocations(selectedAccountId)
  const deleteMutation = useDeleteLocation()

  const sites = locations.filter((l) => l.level === 'SITE')

  const openAddSite = () => {
    setAddDialogParent(null)
    setAddDialogOpen(true)
  }

  const openAddChild = (parent: Location) => {
    setAddDialogParent(parent)
    setAddDialogOpen(true)
  }

  const openDeleteDialog = (location: Location) => {
    setDeleteTarget(location)
    setDeleteDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteMutation.mutateAsync(deleteTarget.id)
      addNotification({ message: `"${deleteTarget.name}" deleted`, severity: 'success' })
      setDeleteDialogOpen(false)
      setDeleteTarget(null)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete'
      addNotification({ message: msg, severity: 'error' })
      setDeleteDialogOpen(false)
    }
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight={600}>
          Location Hierarchy
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={openAddSite}
          disabled={!selectedAccountId}
        >
          Add Site
        </Button>
      </Box>

      <FormControl sx={{ mb: 3, minWidth: 280 }}>
        <InputLabel>Customer Account</InputLabel>
        <Select
          label="Customer Account"
          value={selectedAccountId ?? ''}
          onChange={(e) => setSelectedAccountId(e.target.value || null)}
        >
          {(accounts?.items ?? []).map((a) => (
            <MenuItem key={a.id} value={a.id}>
              {a.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {!selectedAccountId && (
        <Typography color="text.secondary">Select an account to view its location hierarchy.</Typography>
      )}

      {selectedAccountId && isLoading && <CircularProgress />}

      {selectedAccountId && !isLoading && sites.length === 0 && (
        <Typography color="text.secondary">
          No locations yet — click "Add Site" to create the first level.
        </Typography>
      )}

      {selectedAccountId && !isLoading && sites.length > 0 && (
        <SimpleTreeView>
          {sites.map((site) => (
            <LocationNode
              key={site.id}
              location={site}
              allLocations={locations}
              onAddChild={openAddChild}
              onDelete={openDeleteDialog}
            />
          ))}
        </SimpleTreeView>
      )}

      {addDialogOpen && selectedAccountId && (
        <AddLocationDialog
          open={addDialogOpen}
          parentLocation={addDialogParent === 'root' ? null : addDialogParent}
          accountId={selectedAccountId}
          onClose={() => setAddDialogOpen(false)}
          onCreated={() => refetch()}
        />
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete Location</DialogTitle>
        <DialogContent>
          <Typography>
            Delete <strong>{deleteTarget?.name}</strong>? This cannot be undone.
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Locations with active devices cannot be deleted.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
