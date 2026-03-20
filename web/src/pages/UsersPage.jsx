import { useEffect, useState } from "react";
import { apiRequest } from "../api/client";
import DataTable from "../components/DataTable";
import PageHeader from "../components/PageHeader";
import { ROLE_OPTIONS } from "../utils/constants";
import { formatDate } from "../utils/formatters";

const initialForm = {
  name: "",
  email: "",
  password: "",
  role: "viewer",
};

function UsersPage() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(initialForm);
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
      await apiRequest("/users", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setForm(initialForm);
      await loadUsers();
    } catch (submitError) {
      setError(submitError.message);
    }
  }

  return (
    <section>
      <PageHeader
        title="Usuarios"
        description="Gestion inicial de acceso, roles y habilitacion de cuentas."
      />

      <div className="content-grid">
        <form className="card form-grid" onSubmit={handleSubmit}>
          <h3>Crear usuario</h3>
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
            <span>Password</span>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
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
          <button type="submit" className="primary-button">
            Guardar usuario
          </button>
        </form>

        <DataTable
          columns={[
            { key: "name", label: "Nombre" },
            { key: "email", label: "Email" },
            { key: "role", label: "Rol" },
            { key: "isActive", label: "Activo" },
            { key: "createdAt", label: "Alta", render: (value) => formatDate(value) },
          ]}
          rows={users}
        />
      </div>
    </section>
  );
}

export default UsersPage;
