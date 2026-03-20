import { useEffect, useState } from "react";
import { apiRequest } from "../api/client";
import PageHeader from "../components/PageHeader";
import StatCard from "../components/StatCard";

function DashboardPage() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    apiRequest("/dashboard/summary")
      .then((data) => setStats(data))
      .catch(() => setStats(null));
  }, []);

  return (
    <section>
      <PageHeader
        title="Dashboard"
        description="Vista ejecutiva inicial del sistema para captura, consulta y comparativos."
      />

      <div className="stats-grid">
        <StatCard label="Usuarios activos" value={stats?.users ?? "—"} helper="Controlados por rol" />
        <StatCard
          label="Conceptos"
          value={stats?.concepts ?? "—"}
          helper="Configurables por categoria y tipo de calculo"
        />
        <StatCard label="Historicos" value={stats?.priceRecords ?? "—"} helper="Registros capturados" />
        <StatCard label="Proveedores" value={stats?.suppliers ?? "—"} helper="Catalogo independiente" />
        <StatCard label="Obras activas" value={stats?.projects ?? "—"} helper="Catalogo formal de proyectos" />
        <StatCard
          label="Historicos con obra"
          value={stats?.priceRecordsWithProject ?? "—"}
          helper="Asignados a un proyecto"
        />
      </div>

      <div className="card">
        <h3>Base del MVP</h3>
        <p className="muted">
          Esta version ya deja montados autenticacion, roles, catalogos base, captura de historicos,
          ajustes manuales y comparativo inicial de cotizaciones contra un historico ajustado.
        </p>
      </div>
    </section>
  );
}

export default DashboardPage;
