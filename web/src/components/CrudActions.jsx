function CrudActions({ onEdit, onDelete, disableDelete = false }) {
  return (
    <div className="table-actions">
      <button type="button" className="ghost-button" onClick={onEdit}>
        Editar
      </button>
      <button type="button" className="ghost-button danger-button" onClick={onDelete} disabled={disableDelete}>
        Eliminar
      </button>
    </div>
  );
}

export default CrudActions;
