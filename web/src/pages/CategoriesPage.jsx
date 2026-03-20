import { useEffect, useState } from "react";
import { apiRequest } from "../api/client";
import DataTable from "../components/DataTable";
import PageHeader from "../components/PageHeader";
import { MAIN_TYPE_OPTIONS } from "../utils/constants";

const initialForm = {
  name: "",
  mainType: "material",
  description: "",
};

function CategoriesPage() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(initialForm);

  async function loadItems() {
    const data = await apiRequest("/categories");
    setItems(data.items);
  }

  useEffect(() => {
    loadItems().catch(() => setItems([]));
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    await apiRequest("/categories", {
      method: "POST",
      body: JSON.stringify(form),
    });
    setForm(initialForm);
    await loadItems();
  }

  return (
    <section>
      <PageHeader
        title="Categorias"
        description="Separacion base entre mano de obra y materiales / conceptos."
      />

      <div className="content-grid">
        <form className="card form-grid" onSubmit={handleSubmit}>
          <h3>Nueva categoria</h3>
          <label className="field">
            <span>Nombre</span>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </label>
          <label className="field">
            <span>Tipo principal</span>
            <select value={form.mainType} onChange={(e) => setForm({ ...form, mainType: e.target.value })}>
              {MAIN_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Descripcion</span>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows="4"
            />
          </label>
          <button type="submit" className="primary-button">
            Guardar categoria
          </button>
        </form>

        <DataTable
          columns={[
            { key: "name", label: "Nombre" },
            { key: "mainType", label: "Tipo" },
            { key: "description", label: "Descripcion" },
            { key: "isActive", label: "Activo" },
          ]}
          rows={items}
        />
      </div>
    </section>
  );
}

export default CategoriesPage;
