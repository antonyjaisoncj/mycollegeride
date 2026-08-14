import { createFileRoute, Link } from "@tanstack/react-router";
import { Bus, ClipboardList, IndianRupee, Receipt, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "College Bus Management System — Registration, Fees & Expenses" },
      {
        name: "description",
        content:
          "Manage college bus registrations, monthly fee collection with fine and superfine rules, expenses and monthly statements in one place.",
      },
      { property: "og:title", content: "College Bus Management System" },
      {
        property: "og:description",
        content:
          "Registrations, monthly fee collection with automatic fine rules, expense tracking and monthly statements.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  {
    icon: ClipboardList,
    title: "Registration",
    body: "Students apply online. The admin approves and assigns a serial roll number.",
  },
  {
    icon: IndianRupee,
    title: "Fee Payment",
    body: "Two slabs a month, with fine and superfine applied automatically after the due date.",
  },
  {
    icon: Receipt,
    title: "Expense Tracker",
    body: "Log fuel, salary, maintenance and permit bills with vendor and bill numbers.",
  },
  {
    icon: BarChart3,
    title: "Monthly Statement",
    body: "Collection versus expenses, defaulters and blacklist status for any month.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <Bus className="h-6 w-6 text-accent" />
            Bus Management
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
            <p className="mt-5 max-w-xl text-base text-primary-foreground/75">
              Approve student applications, collect the monthly fee with fine and superfine
              rules applied automatically, track running expenses, and close every month with
              a clean statement.
            </p>
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

        <section className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            Four tabs, one workflow
          </h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-xl border border-border bg-card p-5 shadow-sm"
              >
                <f.icon className="h-6 w-6 text-accent-foreground" />
                <h3 className="mt-4 font-semibold text-card-foreground">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-border bg-muted/40">
          <div className="mx-auto max-w-6xl px-6 py-14">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              How the fine works
            </h2>
            <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Window</th>
                    <th className="px-4 py-3 font-medium">Closes</th>
                    <th className="px-4 py-3 font-medium">₹600 slab</th>
                    <th className="px-4 py-3 font-medium">₹1200 slab</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr>
                    <td className="px-4 py-3">On time</td>
                    <td className="px-4 py-3">Last day of the month</td>
                    <td className="px-4 py-3">600</td>
                    <td className="px-4 py-3">1200</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3">Fine</td>
                    <td className="px-4 py-3">Next Friday</td>
                    <td className="px-4 py-3">650</td>
                    <td className="px-4 py-3">1300</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3">Superfine</td>
                    <td className="px-4 py-3">The Friday after</td>
                    <td className="px-4 py-3">750</td>
                    <td className="px-4 py-3">1500</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium text-destructive">Blacklisted</td>
                    <td className="px-4 py-3" colSpan={3}>
                      Bus pass withdrawn until the admin clears it
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        College Bus Management System
      </footer>
    </div>
  );
}
