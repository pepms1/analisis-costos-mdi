import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

function ProtectedRoute({ children, permissionsAny = [], permissionsAll = [], deniedRoles = [] }) {
  const { user, isAuthenticated, isLoading, hasAnyPermission, hasAllPermissions } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div className="page-shell">Cargando...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (permissionsAny.length && !hasAnyPermission(permissionsAny)) {
    return <Navigate to="/" replace />;
  }

  if (permissionsAll.length && !hasAllPermissions(permissionsAll)) {
    return <Navigate to="/" replace />;
  }

  if (deniedRoles.length && deniedRoles.includes(user?.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default ProtectedRoute;
