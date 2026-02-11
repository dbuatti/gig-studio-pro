import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./globals.css";
import React from 'react'; // Import React
import { BrowserRouter } from 'react-router-dom'; // Import BrowserRouter

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);