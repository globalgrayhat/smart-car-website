// src/main.tsx
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./auth/AuthContext";
import { MediaProvider } from "./media/MediaContext";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <AuthProvider>
      <MediaProvider>
        <App />
      </MediaProvider>
    </AuthProvider>
  </BrowserRouter>,
);
