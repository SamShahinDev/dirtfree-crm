import { ThemeToggle } from "@/components/theme-toggle";

export default function Home() {
  return (
    <div className="min-h-screen p-8">
      <header className="flex justify-between items-center max-w-7xl mx-auto mb-16">
        <h1 className="text-3xl font-bold">Dirt Free CRM</h1>
        <ThemeToggle />
      </header>

      <main className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-5xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Modern CRM for Carpet Cleaning
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Streamline your carpet cleaning business with our comprehensive CRM solution.
            Manage customers, schedule appointments, track jobs, and grow your business.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16">
          <div className="p-6 border rounded-lg">
            <h3 className="text-xl font-semibold mb-3">Customer Management</h3>
            <p className="text-muted-foreground">
              Keep track of all your customers, their contact information, service history, and preferences.
            </p>
          </div>

          <div className="p-6 border rounded-lg">
            <h3 className="text-xl font-semibold mb-3">Job Scheduling</h3>
            <p className="text-muted-foreground">
              Schedule and manage carpet cleaning appointments with an intuitive calendar interface.
            </p>
          </div>

          <div className="p-6 border rounded-lg">
            <h3 className="text-xl font-semibold mb-3">Invoice & Billing</h3>
            <p className="text-muted-foreground">
              Generate professional invoices and track payments to keep your business running smoothly.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}