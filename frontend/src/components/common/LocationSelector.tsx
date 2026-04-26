import React, { useState } from 'react'
import { FormControl, InputLabel, MenuItem, Select, Stack, Typography } from '@mui/material'
import { useLocations, useLocationChildren } from '@/hooks/useLocations'

interface LocationSelectorProps {
  accountId: string | null
  value: string | null
  onChange: (locationId: string | null) => void
}

export function LocationSelector({ accountId, value, onChange }: LocationSelectorProps) {
  const [siteId, setSiteId] = useState<string | null>(null)
  const [buildingId, setBuildingId] = useState<string | null>(null)
  const [floorId, setFloorId] = useState<string | null>(null)
  const [roomId, setRoomId] = useState<string | null>(value)

  const { data: allLocations = [], isLoading: sitesLoading } = useLocations(accountId)
  const { data: buildings = [] } = useLocationChildren(siteId, accountId)
  const { data: floors = [] } = useLocationChildren(buildingId, accountId)
  const { data: rooms = [] } = useLocationChildren(floorId, accountId)

  const sites = allLocations.filter((l) => l.level === 'SITE')

  const handleSiteChange = (id: string) => {
    setSiteId(id)
    setBuildingId(null)
    setFloorId(null)
    setRoomId(null)
    onChange(null)
  }

  const handleBuildingChange = (id: string) => {
    setBuildingId(id)
    setFloorId(null)
    setRoomId(null)
    onChange(null)
  }

  const handleFloorChange = (id: string) => {
    setFloorId(id)
    setRoomId(null)
    onChange(null)
  }

  const handleRoomChange = (id: string) => {
    setRoomId(id)
    onChange(id)
  }

  return (
    <Stack spacing={2}>
      <FormControl fullWidth disabled={!accountId || sitesLoading}>
        <InputLabel>Site</InputLabel>
        <Select
          label="Site"
          value={siteId ?? ''}
          onChange={(e) => handleSiteChange(e.target.value)}
        >
          {sites.map((s) => (
            <MenuItem key={s.id} value={s.id}>
              {s.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl fullWidth disabled={!siteId}>
        <InputLabel>Building</InputLabel>
        <Select
          label="Building"
          value={buildingId ?? ''}
          onChange={(e) => handleBuildingChange(e.target.value)}
        >
          {buildings.map((b) => (
            <MenuItem key={b.id} value={b.id}>
              {b.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl fullWidth disabled={!buildingId}>
        <InputLabel>Floor</InputLabel>
        <Select
          label="Floor"
          value={floorId ?? ''}
          onChange={(e) => handleFloorChange(e.target.value)}
        >
          {floors.map((f) => (
            <MenuItem key={f.id} value={f.id}>
              {f.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl fullWidth disabled={!floorId}>
        <InputLabel>Room</InputLabel>
        <Select
          label="Room"
          value={roomId ?? ''}
          onChange={(e) => handleRoomChange(e.target.value)}
        >
          {rooms.length === 0 && floorId ? (
            <MenuItem disabled value="">
              No rooms available — contact admin
            </MenuItem>
          ) : (
            rooms.map((r) => (
              <MenuItem key={r.id} value={r.id}>
                {r.name}
              </MenuItem>
            ))
          )}
        </Select>
      </FormControl>

      {!accountId && (
        <Typography variant="caption" color="text.secondary">
          Select an account to load locations.
        </Typography>
      )}
    </Stack>
  )
}
