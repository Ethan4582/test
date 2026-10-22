import { createRoot } from "react-dom/client";
import { Dashboard } from "./pages/Dashboard.js";

const container = document.getElementById("root");
if (!container) {
  throw new Error("Missing #root container");
}

const baseUrl = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
const userId = import.meta.env.VITE_DEMO_USER_ID ?? "usr_demo";

createRoot(container).render(<Dashboard baseUrl={baseUrl} userId={userId} />);