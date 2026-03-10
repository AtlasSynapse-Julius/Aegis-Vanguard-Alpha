import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { isLoggedIn } from "./api";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import NewScan from "./pages/NewScan";
import ScanDetail from "./pages/ScanDetail";
import ScanHistory from "./pages/ScanHistory";
import LeadCRM from "./pages/LeadCRM";

function RequireAuth({ children }: { children: React.ReactNode }) {
  if (!isLoggedIn()) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="scan" element={<NewScan />} />
          <Route path="scans/:id" element={<ScanDetail />} />
          <Route path="history" element={<ScanHistory />} />
          <Route path="leads" element={<LeadCRM />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
