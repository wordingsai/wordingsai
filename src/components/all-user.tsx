"use client";

import { Loader2, UserPlus, Mail, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import type { User } from "@/db/schema";
import { authClient } from "@/lib/auth-client";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { cn } from "@/lib/utils";

interface AllUsersProps {
  users: User[];
  organizationId: string;
}

export default function AllUsers({ users, organizationId }: AllUsersProps) {
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const router = useRouter();

  const handleInviteMember = async (user: User) => {
    try {
      setIsLoading(user.id);
      const { error } = await authClient.organization.inviteMember({
        email: user.email,
        role: "member",
        organizationId,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success(`Invitation dispatched to ${user.name}`);
      router.refresh();
    } catch (error) {
      toast.error("Failed to authorize member invitation");
      console.error(error);
    } finally {
      setIsLoading(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3">
        {users.length === 0 ? (
          <div className="py-10 text-center opacity-40">
            <p className="text-xs font-black uppercase tracking-widest text-on-surface-variant">
              No external identifies discovered.
            </p>
          </div>
        ) : (
          users.map((user) => (
            <div
              key={user.id}
              className="flex flex-col sm:flex-row items-center justify-between p-6 bg-surface-container-high/30 border border-outline-variant/30 rounded-3xl hover:border-primary/30 transition-all group"
            >
              <div className="flex items-center gap-5 mb-4 sm:mb-0">
                <Avatar className="size-14 rounded-2xl border-4 border-background shadow-lg transition-transform group-hover:scale-105">
                  <AvatarImage src={user.image ?? undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary font-black text-lg">
                    {user.name?.[0]?.toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-1">
                  <h4 className="font-black text-on-surface uppercase tracking-tight group-hover:text-primary transition-colors">
                    {user.name}
                  </h4>
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-on-surface-variant">
                    <Mail className="size-3" />
                    {user.email}
                  </div>
                </div>
              </div>

              <Button
                disabled={isLoading !== null}
                onClick={() => handleInviteMember(user)}
                className={cn(
                  "rounded-2xl text-xs font-medium uppercase tracking-wider h-12 px-6 transition-all",
                  isLoading === user.id
                    ? "bg-primary/20"
                    : "bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20",
                )}
              >
                {isLoading === user.id ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <>
                    <UserPlus className="size-4 mr-2" /> Invite Member
                  </>
                )}
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
