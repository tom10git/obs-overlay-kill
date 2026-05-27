import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import App from "./App.tsx";
import { DebugLog } from "./components/DebugLog.tsx";
import { queryClient } from "./lib/queryClient.ts";
import { loadAndApplyCustomTechniqueNames } from "./utils/customTechniqueNamesLoader.ts";
import "./index.css";

const rootEl = document.getElementById("root")!;

async function boot() {
  const loaded = await loadAndApplyCustomTechniqueNames();
  if (loaded.success && loaded.path) {
    console.info(
      `[customTechniqueNames] ${loaded.source ?? "unknown"}: slash=${loaded.names?.slash.length ?? 0}, magic=${loaded.names?.magic.length ?? 0}, shooting=${loaded.names?.shooting.length ?? 0} (${loaded.path})`,
    );
  }

  ReactDOM.createRoot(rootEl).render(
    <QueryClientProvider client={queryClient}>
      <App />
      <DebugLog />
    </QueryClientProvider>,
  );
}

void boot();
