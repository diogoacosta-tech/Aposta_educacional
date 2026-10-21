/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { AppShell, type NavTab } from "@/components/balabet/shell";
import { HomeView } from "@/components/balabet/HomeView";
import { ApostarView } from "@/components/balabet/ApostarView";
import { TopView } from "@/components/balabet/TopView";
import { RulesView } from "@/components/balabet/RulesView";

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>(() => {
    if (typeof window !== "undefined") {
      const hash = window.location.hash.replace("#", "") as NavTab;
      if (["inicio", "apostar", "top", "como-jogar"].includes(hash)) {
        return hash;
      }
    }
    return "apostar"; // Default to Apostar as requested in prompt "Deve ser a área principal"
  });

  // Keep hash synced with tab
  const handleSelectTab = (tab: NavTab) => {
    setActiveTab(tab);
    if (typeof window !== "undefined") {
      window.location.hash = tab;
    }
  };

  useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash.replace("#", "") as NavTab;
      if (["inicio", "apostar", "top", "como-jogar"].includes(hash)) {
        setActiveTab(hash);
      }
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  return (
    <AppShell activeTab={activeTab} onSelectTab={handleSelectTab}>
      {activeTab === "inicio" && <HomeView onSelectTab={handleSelectTab} />}
      {activeTab === "apostar" && <ApostarView />}
      {activeTab === "top" && <TopView onSelectTab={handleSelectTab} />}
      {activeTab === "como-jogar" && <RulesView />}
    </AppShell>
  );
}
