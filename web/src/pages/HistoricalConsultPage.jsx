import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../api/client";
import DataTable from "../components/DataTable";
import PageHeader from "../components/PageHeader";
import { formatCalendarDate, formatCurrency } from "../utils/formatters";

const PAGE_SIZE = 25;

function formatMeasurement(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  return Number(value).toFixed(2);
}

function getGeometryParts(row) {
  const largo =
    row?.derivedValues?.largoM ?? row?.dimensions?.largo ?? row?.dimensions?.length ?? row?.dimensions?.width ?? null;
  const ancho = row?.derivedValues?.anchoM ?? row?.dimensions?.ancho ?? row?.dimensions?.height ?? null;
  const measurementUnit = row?.derivedValues?.largoM || row?.derivedValues?.anchoM ? "m" : row?.dimensions?.measurementUnit || "m";
  const largoText = formatMeasurement(largo);
  const anchoText = formatMeasurement(ancho);

  if (!largoText || !anchoText) return null;

  const area = typeof row?.normalizedQuantity === "number" ? Number(row.normalizedQuantity).toFixed(2) : null;

  return {
    dimensionsLabel: `${largoText} × ${anchoText} ${measurementUnit}`,
    areaLabel: area ? `Área ${area} m²` : "Área —",
  };
}

function extractGeometry(row) {
  const geometry = getGeometryParts(row);
  if (!geometry) return "—";

  return (
    <div className="historical-geometry-cell">
      <strong>{geometry.dimensionsLabel}</strong>
      <span className="muted">{geometry.areaLabel}</span>
    </div>
  );
}

function formatAdjustedPrice(row) {
  const adjustedCandidate = row?.adjustedAmount ?? row?.adjustedPrice ?? null;
  return typeof adjustedCandidate === "number" ? formatCurrency(adjustedCandidate) : "—";
}

function renderCompactHistoricalRow(row) {
  const geometry = getGeometryParts(row);
  const unitPriceByM2 = typeof row?.normalizedPrice === "number" ? formatCurrency(row.normalizedPrice) : null;

  return (
    <div className="historical-mobile-row">
      <p>
        <strong>{formatCalendarDate(row.priceDate)}</strong> · {row.supplierName || "Sin proveedor"}
      </p>
      <p>
        <strong>{row.projectName || "Sin obra"}</strong> · {row.conceptName || "Sin concepto"}
      </p>
      <p className="muted">Categoría: {row.categoryName || "Sin categoría"}</p>
      <p>
        Hist: <strong>{formatCurrency(row.amount)}</strong> · Ajustado: <strong>{formatAdjustedPrice(row)}</strong>
      </p>
      {geometry ? (
        <p className="muted">
          {geometry.dimensionsLabel} · {geometry.areaLabel}
          {unitPriceByM2 ? ` · $/m² ${unitPriceByM2}` : ""}
        </p>
      ) : unitPriceByM2 ? (
        <p className="muted">$/m² {unitPriceByM2}</p>
      ) : null}
    </div>
  );
}

function HistoricalConsultPage() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [concepts, setConcepts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: PAGE_SIZE, totalItems: 0, totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({
    supplierId: "",
    categoryId: "",
    conceptId: "",
    search: "",
    sort: "desc",
    page: 1,
  });

  useEffect(() => {
    Promise.all([apiRequest("/categories"), apiRequest("/concepts"), apiRequest("/suppliers")])
      .then(([categoriesData, conceptsData, suppliersData]) => {
        setCategories(categoriesData.items || []);
        setConcepts(conceptsData.items || []);
        setSuppliers(suppliersData.items || []);
      })
      .catch(() => {
        setCategories([]);
        setConcepts([]);
        setSuppliers([]);
      });
  }, []);

  useEffect(() => {
    fetchHistoricalRecords(filters);
  }, [filters]);

  const filteredConcepts = useMemo(() => {
    if (!filters.categoryId) return concepts;
    return concepts.filter((concept) => concept.categoryId === filters.categoryId);
  }, [concepts, filters.categoryId]);

  useEffect(() => {
    if (!filters.categoryId) return;
    const conceptStillVisible = filteredConcepts.some((concept) => concept.id === filters.conceptId);
    if (!conceptStillVisible && filters.conceptId) {
      setFilters((prev) => ({ ...prev, conceptId: "", page: 1 }));
    }
  }, [filteredConcepts, filters.categoryId, filters.conceptId]);

  function updateFilter(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  }

  function goToPage(nextPage) {
    setFilters((prev) => ({ ...prev, page: nextPage }));
  }


  async function fetchHistoricalRecords(activeFilters) {
    const query = new URLSearchParams();
    if (activeFilters.supplierId) query.set("supplierId", activeFilters.supplierId);
    if (activeFilters.categoryId) query.set("categoryId", activeFilters.categoryId);
    if (activeFilters.conceptId) query.set("conceptId", activeFilters.conceptId);
    if (activeFilters.search.trim()) query.set("search", activeFilters.search.trim());
    query.set("sort", activeFilters.sort);
    query.set("page", String(activeFilters.page));
    query.set("limit", String(PAGE_SIZE));

    setLoading(true);
    setError("");

    try {
      const data = await apiRequest(`/price-records?${query.toString()}`);
      setItems(data.items || []);
      setPagination(data.pagination || { page: 1, limit: PAGE_SIZE, totalItems: data.items?.length || 0, totalPages: 1 });
    } catch (requestError) {
      setItems([]);
      setPagination({ page: 1, limit: PAGE_SIZE, totalItems: 0, totalPages: 1 });
      setError(requestError.message || "No se pudieron consultar los históricos.");
    } finally {
      setLoading(false);
    }
  }


  return (
    <section className="page-shell">
      <PageHeader
        title="Consulta de Históricos"
        description="Bitácora operativa para revisar precios reales capturados, ordenados por fecha y con filtros combinables."
      />

      <div className="card form-grid compact-form historical-filters">
        <label className="field">
          <span>Proveedor</span>
          <select value={filters.supplierId} onChange={(event) => updateFilter("supplierId", event.target.value)}>
            <option value="">Todos los proveedores</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id || supplier._id} value={supplier.id || supplier._id}>
                {supplier.name}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Categoría</span>
          <select value={filters.categoryId} onChange={(event) => updateFilter("categoryId", event.target.value)}>
            <option value="">Todas las categorías</option>
            {categories.map((category) => (
              <option key={category.id || category._id} value={category.id || category._id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Concepto</span>
          <select value={filters.conceptId} onChange={(event) => updateFilter("conceptId", event.target.value)}>
            <option value="">Todos los conceptos</option>
            {filteredConcepts.map((concept) => (
              <option key={concept.id} value={concept.id}>
                {concept.name}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Orden por fecha</span>
          <select value={filters.sort} onChange={(event) => updateFilter("sort", event.target.value)}>
            <option value="desc">Más recientes primero</option>
            <option value="asc">Más antiguos primero</option>
          </select>
        </label>

        <label className="field historical-search">
          <span>Búsqueda de texto (opcional)</span>
          <input
            value={filters.search}
            onChange={(event) => updateFilter("search", event.target.value)}
            placeholder="Concepto, proveedor, categoría u observaciones"
          />
        </label>
      </div>

      {error ? (
        <div className="alert error">
          <strong>Error:</strong> {error}
        </div>
      ) : null}

      <DataTable
        className="historical-consult-table"
        mobileVariant="compact-list"
        mobileRowRenderer={renderCompactHistoricalRow}
        columns={[
          { key: "priceDate", label: "Fecha", render: (value) => formatCalendarDate(value) },
          { key: "projectName", label: "Obra", render: (value) => value || "Sin obra" },
          { key: "amount", label: "Precio registrado", render: (value) => <strong>{formatCurrency(value)}</strong> },
          { key: "conceptName", label: "Concepto" },
          { key: "categoryName", label: "Categoría" },
          { key: "supplierName", label: "Proveedor" },
          { key: "geometry", label: "Geometría", render: (_value, row) => extractGeometry(row) },
          { key: "normalizedUnit", label: "Unidad análisis", render: (value) => value || "—" },
          { key: "normalizedPrice", label: "P.U. análisis", render: (value) => (typeof value === "number" ? formatCurrency(value) : "—") },
          { key: "unit", label: "Unidad" },
          { key: "analysisUnit", label: "Unidad analítica", render: (value) => value || "—" },
          { key: "analysisUnitPrice", label: "Precio analítico", render: (value) => (value ? formatCurrency(value) : "—") },
          { key: "observations", label: "Observaciones" },
          { key: "createdByName", label: "Capturado por" },
        ]}
        rows={items}
        emptyLabel={loading ? "Cargando históricos..." : "No hay históricos para estos filtros"}
      />

      <div className="card historical-pagination">
        <p className="muted">
          Mostrando página <strong>{pagination.page}</strong> de <strong>{pagination.totalPages}</strong> · Registros totales: {pagination.totalItems}
        </p>
        <div className="button-row">
          <button
            type="button"
            className="ghost-button"
            onClick={() => goToPage(Math.max(1, pagination.page - 1))}
            disabled={pagination.page <= 1 || loading}
          >
            Anterior
          </button>
          <button
            type="button"
            className="ghost-button"
            onClick={() => goToPage(Math.min(pagination.totalPages, pagination.page + 1))}
            disabled={pagination.page >= pagination.totalPages || loading}
          >
            Siguiente
          </button>
        </div>
      </div>
    </section>
  );
}

export default HistoricalConsultPage;
