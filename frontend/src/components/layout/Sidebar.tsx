import {
  Assignment,
  Assessment,
  Business,
  CheckCircle,
  Dashboard,
  DevicesOther,
  ExitToApp,
  ExpandLess,
  ExpandMore,
  LocationOn,
  People,
} from '@mui/icons-material'
import {
  Box,
  Collapse,
  Divider,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Select,
  Toolbar,
  Typography,
} from '@mui/material'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { useUiStore } from '@/store/uiStore'

const DRAWER_WIDTH = 240

interface SidebarProps {
  open: boolean
}

export function Sidebar({ open }: SidebarProps) {
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  const { activeAccountId, setActiveAccount } = useUiStore()
  const [adminOpen, setAdminOpen] = useState(false)

  const navItems = [
    { label: 'Dashboard', icon: <Dashboard />, path: '/dashboard' },
    { label: 'Devices', icon: <DevicesOther />, path: '/devices' },
    { label: 'Check In', icon: <CheckCircle />, path: '/checkin' },
    { label: 'Check Out', icon: <ExitToApp />, path: '/checkout' },
    { label: 'Audit Log', icon: <Assignment />, path: '/audit' },
    { label: 'Device Models', icon: <Assessment />, path: '/device-models' },
  ]

  const adminItems = [
    { label: 'Accounts', icon: <Business />, path: '/admin/accounts' },
    { label: 'Engineers', icon: <People />, path: '/admin/engineers' },
    { label: 'Locations', icon: <LocationOn />, path: '/admin/locations' },
  ]

  return (
    <Drawer
      variant="persistent"
      open={open}
      sx={{
        width: DRAWER_WIDTH,
        flexShrink: 0,
        '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' },
      }}
    >
      <Toolbar />
      <Box sx={{ overflow: 'auto', flex: 1 }}>
        <Box sx={{ px: 2, py: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Active Account
          </Typography>
          <Select
            size="small"
            fullWidth
            value={activeAccountId ?? ''}
            onChange={(e) => setActiveAccount(e.target.value || null)}
            displayEmpty
          >
            <MenuItem value="">All Accounts</MenuItem>
          </Select>
        </Box>
        <Divider />
        <List dense>
          {navItems.map((item) => (
            <ListItemButton key={item.path} onClick={() => navigate(item.path)}>
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          ))}
        </List>
        {hasPermission('super_admin') && (
          <>
            <Divider />
            <List dense>
              <ListItemButton onClick={() => setAdminOpen(!adminOpen)}>
                <ListItemIcon>
                  <People />
                </ListItemIcon>
                <ListItemText primary="Admin" />
                {adminOpen ? <ExpandLess /> : <ExpandMore />}
              </ListItemButton>
              <Collapse in={adminOpen} timeout="auto" unmountOnExit>
                <List component="div" disablePadding dense>
                  {adminItems.map((item) => (
                    <ListItemButton
                      key={item.path}
                      sx={{ pl: 4 }}
                      onClick={() => navigate(item.path)}
                    >
                      <ListItemIcon>{item.icon}</ListItemIcon>
                      <ListItemText primary={item.label} />
                    </ListItemButton>
                  ))}
                </List>
              </Collapse>
            </List>
          </>
        )}
      </Box>
    </Drawer>
  )
}
