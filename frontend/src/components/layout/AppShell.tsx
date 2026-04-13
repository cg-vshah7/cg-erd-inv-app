import { Box, Toolbar } from '@mui/material'
import { Outlet } from 'react-router-dom'
import { useUiStore } from '@/store/uiStore'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

const DRAWER_WIDTH = 240

export function AppShell() {
  const { sidebarOpen, setSidebarOpen } = useUiStore()

  return (
    <Box sx={{ display: 'flex' }}>
      <TopBar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      <Sidebar open={sidebarOpen} />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          transition: (theme) =>
            theme.transitions.create('margin', {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.leavingScreen,
            }),
          marginLeft: sidebarOpen ? 0 : `-${DRAWER_WIDTH}px`,
        }}
      >
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  )
}
