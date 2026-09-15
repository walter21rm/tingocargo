/**
 * ============================================================
 * App.jsx — Componente raíz y configuración de rutas
 * ============================================================
 * Define todas las rutas de la aplicación usando React Router.
 * Implementa 3 guardias de acceso:
 *   - RequireAuth:   requiere token activo (cualquier rol interno)
 *   - RequireRole:   requiere uno de los roles especificados
 *   - RequireClient: requiere token activo con rol "Cliente"
 *
 * La aplicación tiene 3 zonas principales:
 *   1. Pública   (/, /seguimiento)       — con Navbar y Footer
 *   2. Cliente   (/cliente/*)             — con ClientLayout
 *   3. Admin     (/admin/*)               — con AdminLayout
 * ============================================================
 */

import { Routes, Route, useLocation, Navigate } from "react-router-dom";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import Navbar from "./components/Navbar.jsx";
import Footer from "./components/Footer.jsx";
import Home from "./pages/Home.jsx";
import Tracking from "./pages/Tracking.jsx";
import AdminLayout from "./pages/AdminLayout.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";
import AdminPackages from "./pages/AdminPackages.jsx";
import AdminPackageNew from "./pages/AdminPackageNew.jsx";
import AdminPackageDetail from "./pages/AdminPackageDetail.jsx";
import AdminLogin from "./pages/AdminLogin.jsx";
import AdminClients from "./pages/AdminClients.jsx";
import AdminClientNew from "./pages/AdminClientNew.jsx";
import AdminUsers from "./pages/AdminUsers.jsx";
import AdminUserNew from "./pages/AdminUserNew.jsx";
import AdminUserEdit from "./pages/AdminUserEdit.jsx";
import AdminDistributors from "./pages/AdminDistributors.jsx";
import AdminDistributorNew from "./pages/AdminDistributorNew.jsx";
import AdminBranches from "./pages/AdminBranches.jsx";
import AdminBranchNew from "./pages/AdminBranchNew.jsx";
import AdminActivityLog from "./pages/AdminActivityLog.jsx";
import ClientLayout from "./pages/ClientLayout.jsx";
import ClientDashboard from "./pages/ClientDashboard.jsx";
import ClientRegister from "./pages/ClientRegister.jsx";
import ClientLogin from "./pages/ClientLogin.jsx";
import ClientPackageNew from "./pages/ClientPackageNew.jsx";
import ClientPackages from "./pages/ClientPackages.jsx";
import ClientPackageDetail from "./pages/ClientPackageDetail.jsx";
import ClientTracking from "./pages/ClientTracking.jsx";
import { useEffect } from "react";
import { getToken, getUser, getPublicConfig } from "./services/api.js";
import { loadCountriesFromConfig } from "./utils/phone.js";

/* ── Guardias de ruta (protección de acceso) ─────────────── */

/** Redirige a /admin/login si no hay token de sesión */
const RequireAuth = ({ children }) => {
  const token = getToken();
  if (!token) {
    return <Navigate to="/admin/login" replace />;
  }
  return children;
};

/** Redirige a /admin si el rol del usuario no está en la lista permitida */
const RequireRole = ({ roles, children }) => {
  const user = getUser();
  const roleName = user?.roleName;
  if (!roleName || !roles.includes(roleName)) {
    return <Navigate to="/admin" replace />;
  }
  return children;
};

/** Redirige a /cliente/login si no hay token o el rol no es "Cliente" */
const RequireClient = ({ children }) => {
  const token = getToken();
  const user = getUser();
  if (!token || user?.roleName !== "Cliente") {
    return <Navigate to="/cliente/login" replace />;
  }
  return children;
};

const App = () => {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/admin");
  const isClient = location.pathname.startsWith("/cliente");

  useEffect(() => {
    getPublicConfig()
      .then((cfg) => loadCountriesFromConfig(cfg.telefonos))
      .catch(() => {});
  }, []);

  return (
    <ErrorBoundary>
    <div className="min-h-screen flex flex-col">
      {!isAdmin && !isClient && <Navbar />}
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/seguimiento" element={<Tracking />} />
          <Route path="/cliente/registro" element={<ClientRegister />} />
          <Route path="/cliente/login" element={<ClientLogin />} />
          <Route
            path="/cliente"
            element={
              <RequireClient>
                <ClientLayout />
              </RequireClient>
            }
          >
            <Route index element={<ClientDashboard />} />
            <Route path="enviar" element={<ClientPackageNew />} />
            <Route path="rastrear" element={<ClientTracking />} />
            <Route path="envios" element={<ClientPackages />} />
            <Route path="envios/:id" element={<ClientPackageDetail />} />
          </Route>
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route
            path="/admin/clientes/nuevo"
            element={
              <RequireAuth>
                <RequireRole roles={["Administrador", "Operador logístico"]}>
                  <AdminLayout>
                    <AdminClientNew />
                  </AdminLayout>
                </RequireRole>
              </RequireAuth>
            }
          />
          <Route
            path="/admin/usuarios/nuevo"
            element={
              <RequireAuth>
                <RequireRole roles={["Administrador"]}>
                  <AdminLayout>
                    <AdminUserNew />
                  </AdminLayout>
                </RequireRole>
              </RequireAuth>
            }
          />
          <Route
            path="/admin/usuarios/:id/editar"
            element={
              <RequireAuth>
                <RequireRole roles={["Administrador"]}>
                  <AdminLayout>
                    <AdminUserEdit />
                  </AdminLayout>
                </RequireRole>
              </RequireAuth>
            }
          />
          <Route
            path="/admin/distribuidoras/nuevo"
            element={
              <RequireAuth>
                <RequireRole roles={["Administrador"]}>
                  <AdminLayout>
                    <AdminDistributorNew />
                  </AdminLayout>
                </RequireRole>
              </RequireAuth>
            }
          />
          <Route
            path="/admin/sucursales/nuevo"
            element={
              <RequireAuth>
                <RequireRole roles={["Administrador"]}>
                  <AdminLayout>
                    <AdminBranchNew />
                  </AdminLayout>
                </RequireRole>
              </RequireAuth>
            }
          />
          <Route
            path="/admin"
            element={
              <RequireAuth>
                <AdminLayout />
              </RequireAuth>
            }
          >
            <Route
              index
              element={
                <RequireRole roles={["Administrador", "Operador logístico"]}>
                  <AdminDashboard />
                </RequireRole>
              }
            />
            <Route path="paquetes" element={<AdminPackages />} />
            <Route
              path="paquetes/nuevo"
              element={
                <RequireRole roles={["Administrador", "Operador logístico"]}>
                  <AdminPackageNew />
                </RequireRole>
              }
            />
            <Route path="paquetes/:id" element={<AdminPackageDetail />} />
            <Route
              path="clientes"
              element={
                <RequireRole roles={["Administrador", "Operador logístico"]}>
                  <AdminClients />
                </RequireRole>
              }
            />
            <Route
              path="usuarios"
              element={
                <RequireRole roles={["Administrador"]}>
                  <AdminUsers />
                </RequireRole>
              }
            />
            <Route
              path="distribuidoras"
              element={
                <RequireRole roles={["Administrador", "Operador logístico"]}>
                  <AdminDistributors />
                </RequireRole>
              }
            />
            <Route
              path="sucursales"
              element={
                <RequireRole roles={["Administrador"]}>
                  <AdminBranches />
                </RequireRole>
              }
            />
            <Route
              path="actividad"
              element={
                <RequireRole roles={["Administrador"]}>
                  <AdminActivityLog />
                </RequireRole>
              }
            />
          </Route>
        </Routes>
      </main>
      {!isAdmin && !isClient && <Footer />}
    </div>
    </ErrorBoundary>
  );
};

export default App;
