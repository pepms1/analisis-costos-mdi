import { useEffect, useState } from "react";
import { apiRequest } from "../api/client";
import DataTable from "../components/DataTable";
import PageHeader from "../components/PageHeader";

const initialForm = {
  name: "",
  legalName: "",
  contactName: "",
  phone: "",
  email: "",
  notes: "",
};

function SuppliersPage() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(initialForm);

  async function loadItems() {
    const data = await apiRequest("/suppliers");
    setItems(data.items);
  }

  useEffect(() => {
    loadItems().catch(() => setItems([]));
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    await apiRequest("/suppliers", {
      method: "POST",
      body: JSON.stringify(form),
    });
    setForm(initialForm);
    await loadItems();
  }

  return (
    <section>
      <PageHeader
        title="Proveedores"
        description="Catalogo independiente para relacionar multiples conceptos y filtros historicos."
      />

      <div className="content-grid">
        <form className="card form-grid" onSubmit={handleSubmit}>
          <h3>Nuevo proveedor</h3>
          <label className="field">
            <span>Nombre comercial</span>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </label>
          <label className="field">
            <span>Razon social</span>
            <input value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })} />
          </label>
          <label className="field">
            <span>Contacto</span>
            <input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
          </label>
          <label className="field">
            <span>Telefono</span>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </label>
          <label className="field">
            <span>Email</span>
            <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </label>
          <label className="field">
            <span>Notas</span>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows="3" />
          </label>
          <button type="submit" className="primary-button">
            Guardar proveedor
          </button>
        </form>

        <DataTable
          columns={[
            { key: "name", label: "Nombre" },
            { key: "contactName", label: "Contacto" },
            { key: "phone", label: "Telefono" },
            { key: "email", label: "Email" },
            { key: "isActive", label: "Activo" },
          ]}
          rows={items}
        />
      </div>
    </section>
  );
}

export default SuppliersPage;
