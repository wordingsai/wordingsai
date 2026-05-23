import AllUsers from "@/components/all-user";
import MembersTable from "@/components/members-table";
import { getOrganizationBySlug } from "@/server/organizations";
import { getUsers } from "@/server/users";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbLink,
} from "@/components/ui/breadcrumb";
import { Building2, Users2, ShieldCheck, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

type Params = Promise<{ slug: string }>;

export default async function OrganizationPage({ params }: { params: Params }) {
  const { slug } = await params;

  const organization = await getOrganizationBySlug(slug);
  const users = await getUsers(organization?.id || "");

  return (
    <main className="flex-1 p-6 lg:p-10 bg-background transition-colors duration-300">
      {/* Page Header */}
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-6">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink
                  href="/dashboard"
                  className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant hover:text-primary transition-colors"
                >
                  Operational Overview
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="text-on-surface-variant" />
              <BreadcrumbItem>
                <BreadcrumbPage className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface">
                  Organization Profile
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="space-y-2">
            <h1 className="text-4xl lg:text-5xl font-black tracking-tighter uppercase text-on-surface">
              {organization?.name || "Corporate Unit"}
            </h1>
            <p className="text-on-surface-variant text-lg font-medium max-w-2xl flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" /> Managed Enterprise
              Workspace
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              size="lg"
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-black px-8 py-7 rounded-2xl shadow-xl shadow-primary/20 flex items-center gap-2 transition-all hover:scale-[1.02]"
            >
              <Settings className="w-5 h-5" /> UNIT CONFIGURATION
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-10 mt-12">
        {/* Members Section */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 px-2">
            <Users2 className="w-6 h-6 text-primary" />
            <h2 className="text-2xl font-black text-on-surface uppercase tracking-tight">
              Active Directory
            </h2>
          </div>

          <div className="bg-surface-container-low border border-outline-variant rounded-[3rem] p-8 lg:p-12 shadow-sm">
            <div className="overflow-hidden">
              <MembersTable members={organization?.members || []} />
            </div>
          </div>
        </section>

        {/* User Management Section */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 px-2">
            <ShieldCheck className="w-6 h-6 text-secondary" />
            <h2 className="text-2xl font-black text-on-surface uppercase tracking-tight">
              Access Governance
            </h2>
          </div>

          <div className="bg-surface-container-low border border-outline-variant rounded-[3rem] p-8 lg:p-12 shadow-sm">
            <div className="overflow-hidden">
              <AllUsers organizationId={organization?.id || ""} users={users} />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
