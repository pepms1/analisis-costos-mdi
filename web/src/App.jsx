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
        <Route path="captura-rapida" element={<QuickCapturePage />} />
        <Route path="historicos" element={<PriceRecordsPage />} />
        <Route path="inflacion" element={<AdjustmentsPage />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route
          path="users"
          element={
            <ProtectedRoute roles={["superadmin", "admin"]}>
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
