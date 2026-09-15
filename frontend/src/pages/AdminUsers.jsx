/**
 * AdminUsers.jsx — Lista de usuarios
 * Muestra todos los usuarios del sistema (admins, repartidores, etc.).
 * Permite editar, eliminar y crear nuevos usuarios.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  deleteUser,
  listBranches,
  listRoles,
  listUsers
} from "../services/api.js";

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [branches, setBranches] = useState([]);
  const [error, setError] = useState("");
  const [deleteModal, setDeleteModal] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const navigate = useNavigate();

  const load = async () => {
    try {
      const [usersData, rolesData, branchesData] = await Promise.all([
        listUsers(),
        listRoles(),
        listBranches()
      ]);
      setUsers(usersData);
      setRoles(rolesData);
      setBranches(branchesData);
    } catch (err) {
      setError(err.message || "No se pudieron cargar los usuarios.");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleNew = () => {
    navigate("/admin/usuarios/nuevo");
  };

  const handleEdit = (id) => {
    navigate(`/admin/usuarios/${id}/editar`);
  };

  const confirmDelete = async () => {
    if (!deleteModal) return;
    setDeleteLoading(true);
    try {
      await deleteUser(deleteModal.id);
      setUsers((prev) => prev.filter((user) => user.id !== deleteModal.id));
      setDeleteModal(null);
    } catch (err) {
      setError(err.message || "No se pudo eliminar el usuario.");
      setDeleteModal(null);
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Usuarios</h1>
          <p className="text-slate-500">Gestión de cuentas y roles</p>
        </div>
        <button
          type="button"
          onClick={handleNew}
          className="rounded-full bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-sm"
        >
          + Nuevo usuario
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
        <h2 className="text-lg font-semibold text-slate-900">Listado</h2>
        <div className="mt-4 space-y-3">
          {users.map((user) => (
            <div
              key={user.id}
              className="flex flex-col gap-2 rounded-2xl border border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-semibold text-slate-900">{user.nombre}</p>
                <p className="text-sm text-slate-500">{user.email}</p>
                {user.telefono && (
                  <p className="text-sm text-slate-500">{user.telefono}</p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">
                  {roles.find((r) => r.id === user.rolId)?.nombre || user.rolId}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">
                  {branches.find((b) => b.id === user.sucursalId)?.nombre ||
                    user.sucursalId}
                </span>
                <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
                  {user.activo ? "Activo" : "Inactivo"}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleEdit(user.id)}
                    className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteModal(user)}
                    className="rounded-full border border-red-200 px-3 py-1 text-xs font-semibold text-red-600"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          ))}
          {users.length === 0 && (
            <p className="text-sm text-slate-500">Sin usuarios registrados.</p>
          )}
        </div>
      </div>

      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex flex-col items-center text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
                <svg viewBox="0 0 24 24" className="h-7 w-7 text-red-500" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v4M12 16h.01" />
                </svg>
              </span>
              <h3 className="mt-4 text-lg font-semibold text-slate-900">
                Eliminar usuario
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                ¿Estás seguro de eliminar a <strong className="text-slate-700">{deleteModal.nombre}</strong>?
                Esta acción no se puede deshacer.
              </p>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setDeleteModal(null)}
                disabled={deleteLoading}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleteLoading}
                className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {deleteLoading ? "Eliminando..." : "Sí, eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUsers;
