function CrudActions({ onEdit, onDelete, onToggleActive, isActive = true, disableToggle = false }) {
  return (
    <div className="table-actions">
      <button type="button" className="ghost-button" onClick={onEdit}>
        Editar
      </button>
      {onToggleActive ? (
        <button
          type="button"
          className={`ghost-button ${isActive ? "danger-button" : ""}`}
          onClick={onToggleActive}
          disabled={disableToggle}
        >
          {isActive ? "Desactivar" : "Reactivar"}
        </button>
      ) : (
        <button type="button" className="ghost-button danger-button" onClick={onDelete}>
          Eliminar
        </button>
      )}
    </div>
  );
}

export default CrudActions;
