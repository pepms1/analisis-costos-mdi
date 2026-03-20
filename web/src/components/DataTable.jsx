function formatValue(value) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Si" : "No";
  return String(value);
}

function DataTable({ columns, rows, emptyLabel = "Sin datos disponibles" }) {
  const getCellContent = (column, row) =>
    column.render ? column.render(row[column.key], row) : formatValue(row[column.key]);

  return (
    <div className="card table-card">
      <table className="desktop-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="empty-state">
                {emptyLabel}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id || JSON.stringify(row)}>
                {columns.map((column) => (
                  <td key={column.key}>{getCellContent(column, row)}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div className="mobile-table-cards">
        {rows.length === 0 ? (
          <div className="mobile-table-card empty-state">{emptyLabel}</div>
        ) : (
          rows.map((row) => (
            <article className="mobile-table-card" key={row.id || JSON.stringify(row)}>
              {columns.map((column) => (
                <div className="mobile-table-row" key={column.key}>
                  <p className="mobile-table-label">{column.label}</p>
                  <div className="mobile-table-value">{getCellContent(column, row)}</div>
                </div>
              ))}
            </article>
          ))
        )}
      </div>
    </div>
  );
}

export default DataTable;
