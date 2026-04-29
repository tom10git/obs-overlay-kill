import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import App from "./App.tsx";
import { DebugLog } from "./components/DebugLog.tsx";
import { queryClient } from "./lib/queryClient.ts";
import "./index.css";

// #region agent log (debug-0aa2e9)
fetch('http://127.0.0.1:7481/ingest/b7518fcf-b6ac-4bec-8052-ae2fa3ead10d', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '0aa2e9' },
  body: JSON.stringify({
    sessionId: '0aa2e9',
    runId: 'pre-fix',
    hypothesisId: 'E',
    location: 'main.tsx:startup',
    message: 'app startup log (proves instrumentation build is running)',
    data: {
      href: typeof window !== 'undefined' ? window.location.href : null,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    },
    timestamp: Date.now(),
  }),
}).catch(() => {})
// #endregion

ReactDOM.createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <App />
    <DebugLog />
  </QueryClientProvider>
);
