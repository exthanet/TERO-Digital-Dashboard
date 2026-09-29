import { createRoot } from "react-dom/client";
import Dashboard from "../app/dashboard";
import "../app/globals.css";
import "../app/quick-filter.css";
import "../styles/desktop.css";
import "../styles/mobile.css";

createRoot(document.getElementById("root")!).render(<Dashboard />);
