import AdminProvider from '@/components/admin/AdminProvider';
import AdminShell from '@/components/admin/AdminShell';
import { DialogProvider } from '@/components/admin/Dialog';

export const metadata = { title: 'Hadya CMS' };

/* The session provider lives in the root layout, so there is no nested one
   here — two providers meant two independent session fetches. */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminProvider>
      <DialogProvider>
        <AdminShell>{children}</AdminShell>
      </DialogProvider>
    </AdminProvider>
  );
}