import { useEffect, useState } from "react";
import { apiRequest } from "../api/client";
import CrudActions from "../components/CrudActions";
import DataTable from "../components/DataTable";
import PageHeader from "../components/PageHeader";
import { useAuth } from "../contexts/AuthContext";
import { ROLE_OPTIONS } from "../utils/constants";
import { formatDate } from "../utils/formatters";

const initialForm = {
  name: "",
  email: "",
  password: "",
  role: "viewer",
};

function UsersPage() {
  const { user } = useAuth();
  const canManage = user?.role === "superadmin";
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState("");
  const [error, setError] = useState("");

  async function loadUsers() {
    const data = await apiRequest("/users");
    setUsers(data.items);
  }

  useEffect(() => {
    loadUsers().catch(() => setUsers([]));
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    try {
      const payload = {
        name: form.name,
        email: form.email,
        role: form.role,
      };

      if (!editingId || form.password) {
        payload.password = form.password;
      }

      await apiRequest(editingId ? `/users/${editingId}` : "/users", {
        method: editingId ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });
      setForm(initialForm);
      setEditingId("");
      await loadUsers();
    } catch (submitError) {
      setError(submitError.message);
    }
  }

  async function handleDelete(item) {
    if (!window.confirm(`¿Seguro que deseas eliminar ${item.name}? Esta accion desactiva el registro.`)) return;

    try {
      setError("");
      await apiRequest(`/users/${item.id}`, { method: "DELETE" });
      if (editingId === item.id) {
        setEditingId("");
        setForm(initialForm);
      }
      await loadUsers();
    } catch (deleteError) {
      setError(deleteError.message);
    }
  }

  return (
    <section>
      <PageHeader title="Usuarios" description="Gestion inicial de acceso, roles y habilitacion de cuentas." />

      <div className="content-grid">
        {canManage ? (
          <form className="card form-grid" onSubmit={handleSubmit}>
            <h3>{editingId ? "Editar usuario" : "Crear usuario"}</h3>
            <label className="field">
              <span>Nombre</span>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </label>
            <label className="field">
              <span>Email</span>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </label>
            <label className="field">
              <span>Password {editingId ? "(opcional)" : ""}</span>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required={!editingId}
              />
            </label>
            <label className="field">
              <span>Rol</span>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            {error ? <div className="alert error">{error}</div> : null}
            <div className="button-row">
              <button type="submit" className="primary-button">
                {editingId ? "Actualizar" : "Guardar"}
              </button>
              {editingId ? (
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => {
                    setEditingId("");
                    setForm(initialForm);
                    setError("");
                  }}
                >
                  Cancelar
                </button>
              ) : null}
            </div>
          </form>
        ) : (
          <div className="card">
            <h3>Consulta de usuarios</h3>
            <p className="muted">Solo el superadmin puede crear, editar o desactivar usuarios.</p>
          </div>
        )}

        <DataTable
          columns={[
            { key: "name", label: "Nombre" },
            { key: "email", label: "Email" },
            { key: "role", label: "Rol" },
            { key: "isActive", label: "Activo" },
            { key: "createdAt", label: "Alta", render: (value) => formatDate(value) },
            ...(canManage
              ? [
                  {
                    key: "actions",
                    label: "Acciones",
                    render: (_value, row) => (
                      <CrudActions
                        onEdit={() => {
                          setEditingId(row.id);
                          setForm({
                            name: row.name || "",
                            email: row.email || "",
                            password: "",
                            role: row.role || "viewer",
                          });
                          setError("");
                        }}
                        onDelete={() => handleDelete(row)}
                        disableDelete={!row.isActive || row.id === user?.id}
                      />
                    ),
                  },
                ]
              : []),
          ]}
          rows={users}
        />
      </div>
    </section>
  );
}

export default UsersPage;
