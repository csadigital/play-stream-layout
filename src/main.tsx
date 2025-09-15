import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Initialize invisible proxy service worker early
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js', { scope: '/' })
    .then(() => console.log('🔐 Invisible proxy service worker registered'))
    .catch(err => console.error('Service worker registration failed:', err));
}

createRoot(document.getElementById("root")!).render(<App />);
