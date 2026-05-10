'use client';

import { useState } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Footer } from '@/components/layout/Footer';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex min-h-screen">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
      <div
        className={`flex-1 min-w-0 flex flex-col min-h-screen transition-all duration-300 ${
          collapsed ? 'ml-14' : 'ml-60'
        }`}
      >
        <main className="flex-1 w-full px-6 py-6 max-w-[1600px]">
          {children}
        </main>
        <Footer />
      </div>
    </div>
  );
}
