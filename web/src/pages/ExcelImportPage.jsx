import PageHeader from "../components/PageHeader";

function ExcelImportPage() {
  return (
    <section className="page-shell">
      <PageHeader
        title="Importación asistida desde Excel"
        description="Base inicial del módulo para cargar archivos, mapear columnas y revisar renglones staging antes de confirmar la importación."
      />

      <article className="card import-assistant-card">
        <p className="eyebrow">Flujo previsto</p>
        <ol className="import-steps">
          <li>1) Subir archivo Excel y seleccionar hoja.</li>
          <li>2) Mapear columnas origen a campos del sistema.</li>
          <li>3) Parsear renglones en staging y revisar sugerencias.</li>
          <li>4) Confirmar decisiones y aplicar importación final.</li>
        </ol>

        <div className="import-upload-placeholder" role="region" aria-label="Contenedor de carga de archivo">
          <h3>Cargador de archivo (próximamente)</h3>
          <p className="muted">
            Este contenedor queda preparado para integrar la carga real de Excel en la siguiente fase sin romper la navegación ni la
            estructura del módulo.
          </p>
          <button type="button" className="ghost-button" disabled>
            Seleccionar archivo .xlsx
          </button>
        </div>
      </article>
    </section>
  );
}

export default ExcelImportPage;
