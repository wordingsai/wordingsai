import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Member } from "@/db/schema";
import MembersTableAction from "./members-table-action";
import { Badge } from "./ui/badge";

interface MembersTableProps {
  members: Member[];
}

export default function MembersTable({ members }: MembersTableProps) {
  return (
    <Table>
      <TableCaption>A list of organization members.</TableCaption>
      <TableHeader className="bg-surface-container-highest/30">
        <TableRow className="hover:bg-transparent border-outline-variant/50">
          <TableHead className="py-5 px-8 text-xs font-medium uppercase tracking-wider text-on-surface-variant">
            Username
          </TableHead>
          <TableHead className="text-xs font-medium uppercase tracking-wider text-on-surface-variant">
            Email
          </TableHead>
          <TableHead className="text-xs font-medium uppercase tracking-wider text-on-surface-variant">
            Role
          </TableHead>
          <TableHead className="text-right px-8 text-xs font-medium uppercase tracking-wider text-on-surface-variant">
            Actions
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {members.map((member) => (
          <TableRow
            key={member.id}
            className="border-outline-variant/30 group hover:bg-surface-container/50 transition-colors"
          >
            <TableCell className="px-8 py-6 font-bold text-on-surface tracking-tight group-hover:text-primary transition-colors">
              {member.user.name}
            </TableCell>
            <TableCell className="text-on-surface-variant font-medium">
              {member.user.email}
            </TableCell>
            <TableCell>
              <Badge
                variant="outline"
                className="rounded-full font-black text-[9px] uppercase tracking-widest px-3 py-1 bg-surface-container border-outline-variant text-on-surface-variant"
              >
                {member.role}
              </Badge>
            </TableCell>
            <TableCell className="text-right px-8">
              <MembersTableAction memberId={member.id} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
