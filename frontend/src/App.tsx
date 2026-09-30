import React, { useState } from "react";

export function App() {
  const [activeTab, setActiveTab] = useState<"tenants" | "streaming" | "vault">("tenants");

  return (
    <div style={{ fontFamily: "Inter, sans-serif", padding: "24px", maxWidth: "1200px", margin: "0 auto" }}>
      <header style={{ borderBottom: "1px solid #e3e7df", paddingBottom: "16px", marginBottom: "24px" }}>
        <h1 style={{ fontFamily: "Georgia, serif", color: "#145e4d", margin: "0 0 6px" }}>${ctx.title}</h1>
        <p style={{ color: "#5e6b63", margin: 0 }}>Console Administrativo Enterprise • Local-First</p>
      </header>
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
        <button onClick={() => setActiveTab("tenants")} style={{ padding: "8px 16px", background: activeTab === "tenants" ? "#145e4d" : "#f0f2ed", color: activeTab === "tenants" ? "#fff" : "#162019", border: "none", borderRadius: "4px", cursor: "pointer" }}>Inquilinos & Quotas</button>
        <button onClick={() => setActiveTab("streaming")} style={{ padding: "8px 16px", background: activeTab === "streaming" ? "#145e4d" : "#f0f2ed", color: activeTab === "streaming" ? "#fff" : "#162019", border: "none", borderRadius: "4px", cursor: "pointer" }}>Streaming & Percentis</button>
        <button onClick={() => setActiveTab("vault")} style={{ padding: "8px 16px", background: activeTab === "vault" ? "#145e4d" : "#f0f2ed", color: activeTab === "vault" ? "#fff" : "#162019", border: "none", borderRadius: "4px", cursor: "pointer" }}>Cofre Zero-Trust</button>
      </div>
      <div style={{ background: "#ffffff", padding: "24px", border: "1px solid #e3e7df", borderRadius: "6px" }}>
        <h3>Visão Geral do Painel</h3>
        <p>Acesse <a href="/docs" target="_blank" style={{ color: "#145e4d", fontWeight: "bold" }}>/docs</a> para a documentação interativa OpenAPI.</p>
      </div>
    </div>
  );
}

export default App;
