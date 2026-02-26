import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { AuthProvider } from "./auth/AuthProvider.jsx";
import { FavoritesProvider } from "./state/FavoritesProvider.jsx";
import "./index.css"; // pode ficar vazio, mas vamos usar pra qualquer ajuste seu
import { Analytics } from "@vercel/analytics/react";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <FavoritesProvider>
        <App />
      </FavoritesProvider>
      <Analytics />
    </AuthProvider>
  </React.StrictMode>
);
