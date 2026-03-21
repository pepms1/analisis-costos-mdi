import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./layouts/AppLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import UsersPage from "./pages/UsersPage";
import CategoriesPage from "./pages/CategoriesPage";
import ConceptsPage from "./pages/ConceptsPage";
import SuppliersPage from "./pages/SuppliersPage";
import ProjectsPage from "./pages/ProjectsPage";
import PriceRecordsPage from "./pages/PriceRecordsPage";
import AdjustmentsPage from "./pages/AdjustmentsPage";
import ConsultaPage from "./pages/ConsultaPage";
import QuickCapturePage from "./pages/QuickCapturePage";
import HistoricalConsultPage from "./pages/HistoricalConsultPage";
import ExcelImportPage from "./pages/ExcelImportPage";
import ImportSessionsPage from "./pages/ImportSessionsPage";
import { PERMISSIONS } from "./utils/permissions";

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<ConsultaPage />} />
        <Route path="consulta" element={<ConsultaPage />} />
        <Route
          path="consulta-historicos"
          element={
            <ProtectedRoute permissionsAll={[PERMISSIONS.PRICES_VIEW]}>
              <HistoricalConsultPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="captura-rapida"
          element={
            <ProtectedRoute permissionsAll={[PERMISSIONS.PRICES_QUICK_CAPTURE]}>
              <QuickCapturePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="importacion-excel/sesiones"
          element={
            <ProtectedRoute permissionsAll={[PERMISSIONS.PRICES_VIEW]}>
              <ImportSessionsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="importacion-excel"
          element={
            <ProtectedRoute permissionsAll={[PERMISSIONS.PRICES_CREATE]}>
              <ExcelImportPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="historicos"
          element={
            <ProtectedRoute permissionsAll={[PERMISSIONS.PRICES_VIEW]}>
              <PriceRecordsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="inflacion"
          element={
            <ProtectedRoute permissionsAll={[PERMISSIONS.INFLATION_VIEW]}>
              <AdjustmentsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="dashboard"
          element={
            <ProtectedRoute permissionsAll={[PERMISSIONS.AUDIT_VIEW]}>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="users"
          element={
            <ProtectedRoute permissionsAll={[PERMISSIONS.USERS_VIEW]}>
              <UsersPage />
            </ProtectedRoute>
          }
        />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="concepts" element={<ConceptsPage />} />
        <Route path="suppliers" element={<SuppliersPage />} />
        <Route path="projects" element={<ProjectsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
