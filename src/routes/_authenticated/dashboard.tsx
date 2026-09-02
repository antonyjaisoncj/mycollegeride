import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bus, ClipboardList, IndianRupee, PiggyBank, Receipt, Wallet } from "lucide-react";
import { getAppSettings, getMe } from "@/lib/bus.functions";
import { AppHeader } from "@/components/bus/AppHeader";
import { RegistrationTab } from "@/components/bus/RegistrationTab";
import { FeeTab } from "@/components/bus/FeeTab";
import { ExpenseTab } from "@/components/bus/ExpenseTab";
import { DriverTab } from "@/components/bus/DriverTab";
import { AdvanceTab } from "@/components/bus/AdvanceTab";

import { StatementTab } from "@/components/bus/StatementTab";
import { StudentPortal } from "@/components/bus/StudentPortal";
import { TabVisibilityToggles } from "@/components/bus/TabVisibilityToggles";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — College Bus Management System" },
      {
        name: "description",
        content:
          "Manage bus registrations, monthly fee collection with fines, expenses and the monthly balance statement.",
      },
      { property: "og:title", content: "Dashboard — College Bus Management System" },
      {
        property: "og:description",
        content: "Registrations, fee payments, expenses and monthly statements in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const fetchMe = useServerFn(getMe);

  const me = useQuery({ queryKey: ["me"], queryFn: () => fetchMe() });
  const fetchSettings = useServerFn(getAppSettings);
  const settings = useQuery({ queryKey: ["app-settings"], queryFn: () => fetchSettings() });

  const isAdmin = me.data?.isAdmin ?? false;
  const isDriverOnly = (me.data?.isDriver ?? false) && !isAdmin;
  const approved = me.data?.student?.status === "approved";
  const canView = isAdmin || approved;
  // Admin switches decide which tabs students and the driver may open.
  const showExpenses = isAdmin || (canView && (settings.data?.expenses_visible ?? false));
  const showStatement = isAdmin || (canView && (settings.data?.statement_visible ?? false));
  const driverAllowed = isAdmin || (settings.data?.driver_visible ?? false);
  const showAdvance = isAdmin || (canView && (settings.data?.advance_visible ?? false));


  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        email={me.data?.email ?? null}
        subtitle={isAdmin ? "Transport office" : isDriverOnly ? "Bus driver" : "Student portal"}
      />

      <main className="mx-auto max-w-6xl px-4 py-8">
        {me.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="space-y-6">
            {!isAdmin && !isDriverOnly ? (
              <p className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
                {approved
                  ? "View-only access. Only the transport office can edit these records."
                  : "Your bus registration must be approved before the fee, expense and statement tabs open up."}
              </p>
            ) : null}

            {isAdmin ? <TabVisibilityToggles /> : null}

            {isDriverOnly ? (
              driverAllowed ? (
                <DriverTab />
              ) : (
                <p className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
                  The driver tab is currently closed by the transport office.
                </p>
              )
            ) : (
              <Tabs defaultValue="registration">
                <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
                  <TabsTrigger value="registration">
                    <ClipboardList className="mr-2 h-4 w-4" /> Registration
                  </TabsTrigger>
                  {canView ? (
                    <>
                      <TabsTrigger value="fees">
                        <IndianRupee className="mr-2 h-4 w-4" /> Fee payment
                      </TabsTrigger>
                      <TabsTrigger value="expenses" disabled={!showExpenses}>
                        <Wallet className="mr-2 h-4 w-4" /> Expense tracker
                      </TabsTrigger>
                      <TabsTrigger value="statement" disabled={!showStatement}>
                        <Receipt className="mr-2 h-4 w-4" /> Monthly statement
                      </TabsTrigger>
                    </>
                  ) : null}
                  {isAdmin ? (
                    <TabsTrigger value="driver">
                      <Bus className="mr-2 h-4 w-4" /> Driver
                    </TabsTrigger>
                  ) : null}
                  {canView ? (
                    <TabsTrigger value="advance" disabled={!showAdvance}>
                      <PiggyBank className="mr-2 h-4 w-4" /> Advance
                    </TabsTrigger>
                  ) : null}
                </TabsList>

                <TabsContent value="registration" className="mt-6">
                  {isAdmin ? <RegistrationTab /> : <StudentPortal section="registration" />}
                </TabsContent>
                {canView ? (
                  <>
                    <TabsContent value="fees" className="mt-6">
                      {isAdmin ? <FeeTab /> : <StudentPortal section="fees" />}
                    </TabsContent>
                    <TabsContent value="expenses" className="mt-6">
                      {showExpenses ? <ExpenseTab readOnly={!isAdmin} /> : null}
                    </TabsContent>
                    <TabsContent value="statement" className="mt-6">
                      {showStatement ? <StatementTab readOnly={!isAdmin} /> : null}
                    </TabsContent>
                  </>
                ) : null}
                {isAdmin ? (
                  <TabsContent value="driver" className="mt-6">
                    <DriverTab />
                  </TabsContent>
                ) : null}
                {canView ? (
                  <TabsContent value="advance" className="mt-6">
                    {showAdvance ? <AdvanceTab readOnly={!isAdmin} /> : null}
                  </TabsContent>
                ) : null}
              </Tabs>
            )}
          </div>

        )}
      </main>
    </div>
  );
}
