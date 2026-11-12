import React, { useEffect, useState, Suspense } from "react";
import { createRoot } from "react-dom/client";
import "./professional-base.css";
const ProfessionalApp = React.lazy(() => import("./ProfessionalApp.jsx"));
function Boot() {
  const [ready, setReady] = useState(false),
    [issue, setIssue] = useState("");
  useEffect(() => {
    fetch("/api/config")
      .then(async (r) => {
        if (!r.ok) throw Error("World configuration is unavailable");
        const c = await r.json();
        if (c.mode !== "professional" || c.network !== "testnet")
          throw Error("This release requires the Econia 2.0 testnet service");
        setReady(true);
      })
      .catch((e) => setIssue(e.message));
  }, []);
  if (issue)
    return (
      <main className="pro-boot" role="alert">
        {issue}. Reload to retry.
      </main>
    );
  if (!ready) return <main className="pro-boot">Opening Econia…</main>;
  return (
    <Suspense fallback={<main className="pro-boot">Opening Econia…</main>}>
      <ProfessionalApp />
    </Suspense>
  );
}
createRoot(document.getElementById("root")).render(<Boot />);
