import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import {
  LoginPage,
  RegisterPage,
  DashboardPage,
  UsersPage,
  AnalyticsPage,
  SettingsPage,
  TeamPage,
  TeamMembersPage,
  TeamSettingsPage,
  TeamAuditPage,
  UserProfilePage,
  KnowledgeBasePage,
  CampaignsPage,
  CampaignDetailPage,
  LiveCalls,
  CallMonitor,
  AgentsPage,
  AgentDetailPage,
  OrdersPage,
  PaymentsPage,
  PaymentDetailPage,
  InvoicesPage,
  LeadsPage,
  CallbacksPage,
  InventoryPage,
  StoreSettingsPage,
} from '../pages';
import { ProtectedRoute } from '../components';

export const AppRouter = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/users"
          element={
            <ProtectedRoute>
              <UsersPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/knowledge-base"
          element={
            <ProtectedRoute>
              <KnowledgeBasePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/campaigns"
          element={
            <ProtectedRoute>
              <CampaignsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/campaigns/:id"
          element={
            <ProtectedRoute>
              <CampaignDetailPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/live-calls"
          element={
            <ProtectedRoute>
              <LiveCalls />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/agents"
          element={
            <ProtectedRoute>
              <AgentsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/agents/:id"
          element={
            <ProtectedRoute>
              <AgentDetailPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/orders"
          element={
            <ProtectedRoute>
              <OrdersPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/payments"
          element={
            <ProtectedRoute>
              <PaymentsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/payments/:id"
          element={
            <ProtectedRoute>
              <PaymentDetailPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/invoices"
          element={
            <ProtectedRoute>
              <InvoicesPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/invoices/:id"
          element={
            <ProtectedRoute>
              <PaymentDetailPage /> {/* Reusing PaymentDetail for Invoice detail as requested or appropriate */}
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/calls/:callId/monitor"
          element={
            <ProtectedRoute>
              <CallMonitor />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/analytics"
          element={
            <ProtectedRoute>
              <AnalyticsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/settings"
          element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/team"
          element={
            <ProtectedRoute>
              <TeamPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/team/members"
          element={
            <ProtectedRoute>
              <TeamMembersPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/team/settings"
          element={
            <ProtectedRoute>
              <TeamSettingsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/team/audit"
          element={
            <ProtectedRoute>
              <TeamAuditPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/profile"
          element={
            <ProtectedRoute>
              <UserProfilePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/leads"
          element={
            <ProtectedRoute>
              <LeadsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/callbacks"
          element={
            <ProtectedRoute>
              <CallbacksPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/inventory"
          element={
            <ProtectedRoute>
              <InventoryPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/store-settings"
          element={
            <ProtectedRoute>
              <StoreSettingsPage />
            </ProtectedRoute>
          }
        />

        <Route path="/" element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />} />
        <Route path="*" element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />} />
      </Routes>
    </Router>
  );
};
