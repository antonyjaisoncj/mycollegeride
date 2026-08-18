import { createFileRoute, Link } from "@tanstack/react-router"; 
import { Bus, ClipboardList, IndianRupee, Receipt, BarChart3 } from "lucide-react"; 
import { Button } from "@/components/ui/button"; 

export const Route = createFileRoute('/')({
  component: Landing, // Change HomeComponent to Landing
})

const FEATURES = [
  { icon: ClipboardList, title: "Registration", body: "Students apply online. The admin approves and assigns a serial roll number." },
  { icon: IndianRupee, title: "Fee Payment", body: "Two slabs a month, with fine and superfine applied automatically after the due date." },
  { icon: Receipt, title: "Expense Tracker", body: "Log fuel, salary, maintenance and permit bills with vendor and bill numbers." },
  { icon: BarChart3, title: "Monthly Statement", body: "Collection versus expenses, defaulters and blacklist status for any month." },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <Bus className="h-6 w-6 text-accent" /> Bus Management
          </span>
          <Button asChild variant="secondary" size="sm">
            <Link to="/auth">Sign in</Link>
          </Button>
        </div>
      </header>
      <main>
        <section className="border-b border-border bg-primary text-primary-foreground">
          <div className="mx-auto max-w-6xl px-6 pb-20 pt-14">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-accent">
              College Transport Office
            </p>
            <h1 className="mt-4 max-w-2xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
              Every bus registration, rupee and receipt in one register.
            </h1>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/auth">Student registration</Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link to="/auth">Admin sign in</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
