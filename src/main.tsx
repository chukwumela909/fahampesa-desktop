import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AuthProvider } from "@/auth/AuthContext";
import { AppDataProvider } from "@/store/AppData";
import { ConfirmProvider } from "@/components/ui/ConfirmDialog";
import Toast from "@/components/ui/Toast";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AuthProvider>
      <AppDataProvider>
        <ConfirmProvider>
          <App />
          <Toast />
        </ConfirmProvider>
      </AppDataProvider>
    </AuthProvider>
  </React.StrictMode>,
);
