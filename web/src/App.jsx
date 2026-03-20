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
import QuoteChecksPage from "./pages/QuoteChecksPage";

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
        <Route index element={<DashboardPage />} />
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
        <Route path="price-records" element={<PriceRecordsPage />} />
        <Route path="adjustments" element={<AdjustmentsPage />} />
        <Route path="quote-checks" element={<QuoteChecksPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
