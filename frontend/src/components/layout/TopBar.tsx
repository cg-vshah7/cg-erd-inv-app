import { AccountCircle, Menu } from '@mui/icons-material'
import { AppBar, Box, IconButton, Menu as MuiMenu, MenuItem, Toolbar, Typography } from '@mui/material'
import { useState } from 'react'
import { useAuth } from '@/auth/useAuth'

interface TopBarProps {
  onToggleSidebar: () => void
}

export function TopBar({ onToggleSidebar }: TopBarProps) {
  const { user, logout } = useAuth()
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)

  return (
    <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
      <Toolbar>
        <IconButton color="inherit" edge="start" onClick={onToggleSidebar} sx={{ mr: 2 }}>
          <Menu />
        </IconButton>
        <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
          CG ERD Inventory
        </Typography>
        <Box>
          <IconButton color="inherit" onClick={(e) => setAnchorEl(e.currentTarget)}>
            <AccountCircle />
          </IconButton>
          <MuiMenu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={() => setAnchorEl(null)}
          >
            <MenuItem disabled>
              <Typography variant="body2">{user?.fullName ?? user?.email}</Typography>
            </MenuItem>
            <MenuItem
              onClick={() => {
                setAnchorEl(null)
                logout()
              }}
            >
              Logout
            </MenuItem>
          </MuiMenu>
        </Box>
      </Toolbar>
    </AppBar>
  )
}
