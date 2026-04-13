import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { AccountsPage } from '@/pages/AccountsPage'
import { AuditLogPage } from '@/pages/AuditLogPage'
import { CheckInPage } from '@/pages/CheckInPage'
import { CheckOutPage } from '@/pages/CheckOutPage'
import { CsvImportPage } from '@/pages/CsvImportPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { DeviceModelsPage } from '@/pages/DeviceModelsPage'
import { DevicesPage } from '@/pages/DevicesPage'
import { EngineersPage } from '@/pages/EngineersPage'
import { LocationsPage } from '@/pages/LocationsPage'
import { ProtectedRoute } from '@/routes/ProtectedRoute'
import { SuperAdminRoute } from '@/routes/SuperAdminRoute'

export default function App() {
  return (
    <Routes>
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          {/* Default redirect */}
          <Route index element={<Navigate to="/dashboard" replace />} />

          {/* All authenticated users */}
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/devices" element={<DevicesPage />} />
          <Route path="/checkin" element={<CheckInPage />} />
          <Route path="/checkout" element={<CheckOutPage />} />
          <Route path="/audit" element={<AuditLogPage />} />
          <Route path="/device-models" element={<DeviceModelsPage />} />

          {/* Super Admin only */}
          <Route element={<SuperAdminRoute />}>
            <Route path="/admin/accounts" element={<AccountsPage />} />
            <Route path="/admin/engineers" element={<EngineersPage />} />
            <Route path="/admin/locations" element={<LocationsPage />} />
            <Route path="/admin/import" element={<CsvImportPage />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  )
}
