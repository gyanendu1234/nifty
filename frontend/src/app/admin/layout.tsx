import { AdminSidebar } from '@/components/layout/AdminSidebar';
import { AdminGate } from '@/components/admin/AdminGate';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminGate>
      <div className="flex min-h-screen">
        <AdminSidebar />
        <div className="ml-56 flex-1 px-6 py-6">{children}</div>
      </div>
    </AdminGate>
  );
}
