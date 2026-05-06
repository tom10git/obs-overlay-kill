import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import App from "./App.tsx";
import { DebugLog } from "./components/DebugLog.tsx";
import { queryClient } from "./lib/queryClient.ts";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <App />
    <DebugLog />
  </QueryClientProvider>
);
