"use client";

import { CalendarIcon } from "lucide-react";
import { Card } from "../ui/card";
import { format } from "date-fns";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Calendar } from "../ui/calendar";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";

export type Contract = {
  id: string;
  contractName: string;
  reinsured: string;
  broker: string | null;
  contractType: string;
  periodFrom: string;
  periodTo: string;
  value: number;
  status: string;
  description: string;
  department: string;
  tags: string[];
  userId: string;
  createdAt: string;
  lastUpdated: string;
  fileSize: string;
};

export interface ContractsMetadataProps {
  contract: Contract;
  setContract: React.Dispatch<React.SetStateAction<Contract | null>>;
  periodFrom: Date | undefined;
  setPeriodFrom: React.Dispatch<React.SetStateAction<Date | undefined>>;
  periodTo: Date | undefined;
  setPeriodTo: React.Dispatch<React.SetStateAction<Date | undefined>>;
  tagInput: string;
  setTagInput: React.Dispatch<React.SetStateAction<string>>;
  addTag: () => void;
  removeTag: (tag: string) => void;
  isEditing: boolean;
}

const typeLabel = (v: string) =>
  ({
    nda: "NDA",
    msa: "MSA",
    sla: "SLA",
    vendor: "Vendor",
    employment: "Employment",
  })[v] ?? v;

const statusLabel = (v: string) =>
  ({
    pending: "Pending",
    active: "Active",
    expired: "Expired",
  })[v] ?? v;

const departmentLabel = (v: string) =>
  ({
    legal: "Legal",
    sales: "Sales",
    procurement: "Procurement",
    hr: "HR",
  })[v] ?? v;

export const ContractsMetadata = ({
  contract,
  setContract,
  periodFrom,
  setPeriodFrom,
  periodTo,
  setPeriodTo,
  tagInput,
  setTagInput,
  addTag,
  removeTag,
  isEditing,
}: ContractsMetadataProps) => {
  if (!contract) return null;

  return (
    <div className="grid lg:grid-cols-12 gap-8">
      <div className="lg:col-span-8 space-y-8">
        <Card className="bg-card/40 rounded-3xl border border-border p-10 backdrop-blur-sm shadow-none">
          <h2 className="text-2xl font-bold mb-10 flex items-center gap-3 text-foreground">
            <div className="size-8 bg-primary/10 rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-xl">
                edit_note
              </span>
            </div>
            General Information
          </h2>

          <div className="grid md:grid-cols-2 gap-x-8 gap-y-8">
            <div className="md:col-span-2 flex flex-col gap-2.5">
              <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground ml-1">
                Contract Name
              </Label>

              {isEditing ? (
                <input
                  className="bg-background/60 border border-border rounded-xl focus:ring-1 focus:ring-primary focus:border-primary text-foreground text-sm py-3.5 px-4 transition-all placeholder:text-muted-foreground/50"
                  placeholder="e.g. Q3 Software License Agreement"
                  value={contract.contractName}
                  onChange={(e) =>
                    setContract({
                      ...contract,
                      contractName: e.target.value,
                    })
                  }
                />
              ) : (
                <div className="py-3.5 px-4 rounded-xl bg-background/30 text-foreground text-sm">
                  {contract.contractName || "—"}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2.5">
              <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground ml-1">
                Reinsured
              </Label>

              {isEditing ? (
                <input
                  className="bg-background/60 border border-border rounded-xl focus:ring-1 focus:ring-primary focus:border-primary text-foreground text-sm py-3.5 px-4 transition-all placeholder:text-muted-foreground/50"
                  placeholder="e.g. Global Re Corp"
                  value={contract.reinsured}
                  onChange={(e) =>
                    setContract({
                      ...contract,
                      reinsured: e.target.value,
                    })
                  }
                />
              ) : (
                <div className="py-3.5 px-4 rounded-xl bg-background/30 text-foreground text-sm">
                  {contract.reinsured || "—"}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2.5">
              <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground ml-1">
                Broker
              </Label>

              {isEditing ? (
                <input
                  className="bg-background/60 border border-border rounded-xl focus:ring-1 focus:ring-primary focus:border-primary text-foreground text-sm py-3.5 px-4 transition-all placeholder:text-muted-foreground/50"
                  placeholder="e.g. Aon, Willis Towers Watson"
                  value={contract.broker || ""}
                  onChange={(e) =>
                    setContract({
                      ...contract,
                      broker: e.target.value,
                    })
                  }
                />
              ) : (
                <div className="py-3.5 px-4 rounded-xl bg-background/30 text-foreground text-sm">
                  {contract.broker || "—"}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2.5">
              <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground ml-1">
                Contract Type
              </Label>

              {isEditing ? (
                <Select
                  value={contract.contractType}
                  onValueChange={(v) =>
                    v && setContract({ ...contract, contractType: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="nda">NDA</SelectItem>
                    <SelectItem value="msa">MSA</SelectItem>
                    <SelectItem value="sla">SLA</SelectItem>
                    <SelectItem value="vendor">Vendor</SelectItem>
                    <SelectItem value="employment">Employment</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="py-3.5 px-4 rounded-xl bg-background/30 text-foreground text-sm">
                  {typeLabel(contract.contractType) || "—"}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2.5">
              <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground ml-1">
                Period From
              </Label>

              {isEditing ? (
                <Popover>
                  <PopoverTrigger className="flex items-center justify-between w-full bg-background/60 border border-border rounded-xl focus:ring-1 focus:ring-primary focus:border-primary text-foreground text-sm py-3.5 pl-4 pr-4 transition-all placeholder:text-muted-foreground/50">
                    {periodFrom ? format(periodFrom, "PPP") : "Pick date"}
                    <CalendarIcon className="ml-2 h-4 w-4 opacity-70" />
                  </PopoverTrigger>

                  <PopoverContent className="w-auto p-0 bg-popover border border-border rounded-xl">
                    <Calendar
                      key={periodFrom?.toISOString()}
                      mode="single"
                      selected={periodFrom}
                      defaultMonth={periodFrom}
                      onSelect={setPeriodFrom}
                    />
                  </PopoverContent>
                </Popover>
              ) : (
                <div className="py-3.5 px-4 rounded-xl bg-background/30 text-foreground text-sm">
                  {periodFrom ? format(new Date(periodFrom), "PPP") : "—"}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2.5">
              <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground ml-1">
                Period To
              </Label>

              {isEditing ? (
                <Popover>
                  <PopoverTrigger className="flex items-center justify-between w-full bg-background/60 border border-border rounded-xl focus:ring-1 focus:ring-primary focus:border-primary text-foreground text-sm py-3.5 pl-4 pr-4 transition-all placeholder:text-muted-foreground/50">
                    {periodTo ? format(periodTo, "PPP") : "Pick date"}
                    <CalendarIcon className="ml-2 h-4 w-4 opacity-70" />
                  </PopoverTrigger>

                  <PopoverContent className="w-auto p-0 bg-popover border border-border rounded-xl">
                    <Calendar
                      key={periodTo?.toISOString()}
                      mode="single"
                      selected={periodTo}
                      defaultMonth={periodTo}
                      onSelect={setPeriodTo}
                    />
                  </PopoverContent>
                </Popover>
              ) : (
                <div className="py-3.5 px-4 rounded-xl bg-background/30 text-foreground text-sm">
                  {periodTo ? format(new Date(periodTo), "PPP") : "—"}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2.5">
              <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground ml-1">
                Status
              </Label>

              {isEditing ? (
                <Select
                  value={contract.status}
                  onValueChange={(v) =>
                    v && setContract({ ...contract, status: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="py-3.5 px-4 rounded-xl bg-background/30 text-foreground text-sm">
                  {statusLabel(contract.status) || "—"}
                </div>
              )}
            </div>
          </div>
        </Card>

        <Card className="bg-card/40 rounded-3xl border border-border p-10 backdrop-blur-sm shadow-none">
          <h2 className="text-2xl font-bold mb-10 flex items-center gap-3 text-foreground">
            <div className="size-8 bg-primary/10 rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-xl">
                notes
              </span>
            </div>
            Description & Notes
          </h2>

          <div className="flex flex-col gap-2.5">
            {isEditing ? (
              <Textarea
                className="bg-background/60 border border-border rounded-xl focus:ring-1 focus:ring-primary focus:border-primary text-foreground text-sm p-4 transition-all placeholder:text-muted-foreground/50 min-h-[160px]"
                value={contract.description}
                onChange={(e) =>
                  setContract({
                    ...contract,
                    description: e.target.value,
                  })
                }
              />
            ) : (
              <div className="min-h-[160px] p-4 rounded-xl bg-background/30 text-foreground text-sm whitespace-pre-wrap">
                {contract.description || "—"}
              </div>
            )}
          </div>
        </Card>
      </div>

      <div className="lg:col-span-4 space-y-8">
        <Card className="bg-card/40 rounded-3xl border border-border p-10 backdrop-blur-sm shadow-none">
          <h2 className="text-2xl font-bold mb-10 flex items-center gap-3 text-foreground">
            <div className="size-8 bg-primary/10 rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-xl">
                category
              </span>
            </div>
            Categorization
          </h2>

          <div className="space-y-6">
            <div className="flex flex-wrap gap-2 mb-2">
              {contract.tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="flex items-center gap-1 bg-primary/10 text-primary border-none py-1.5 px-3 rounded-lg"
                >
                  {tag}
                  {isEditing && (
                    <button
                      onClick={() => removeTag(tag)}
                      className="hover:text-foreground transition-colors ml-2"
                    >
                      ×
                    </button>
                  )}
                </Badge>
              ))}
            </div>

            <div className="flex gap-2">
              {isEditing ? (
                <>
                  <input
                    className="flex-1 bg-background/60 border border-border rounded-xl focus:ring-1 focus:ring-primary focus:border-primary text-foreground text-sm py-3 px-4 transition-all placeholder:text-muted-foreground/50"
                    placeholder="Add tag"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addTag();
                      }
                    }}
                  />
                  <Button
                    onClick={addTag}
                    className="bg-primary hover:bg-primary/90 rounded-xl px-4"
                  >
                    Add
                  </Button>
                </>
              ) : (
                <div className="flex-1 py-3 px-4 rounded-xl bg-background/30 text-foreground text-sm">
                  {contract.tags.length ? contract.tags.join(", ") : "—"}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2.5">
              <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground ml-1">
                Department
              </Label>

              {isEditing ? (
                <Select
                  value={contract.department}
                  onValueChange={(v) =>
                    v && setContract({ ...contract, department: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="legal">Legal</SelectItem>
                    <SelectItem value="sales">Sales</SelectItem>
                    <SelectItem value="procurement">Procurement</SelectItem>
                    <SelectItem value="hr">HR</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="py-3.5 px-4 rounded-xl bg-background/30 text-foreground text-sm">
                  {departmentLabel(contract.department) || "—"}
                </div>
              )}
            </div>
          </div>
        </Card>

        <Card className="bg-card/40 rounded-3xl border border-border p-10 backdrop-blur-sm shadow-none">
          <h2 className="text-2xl font-bold mb-10 flex items-center gap-3 text-foreground">
            <div className="size-8 bg-primary/10 rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-xl">
                info
              </span>
            </div>
            Audit Information
          </h2>

          <div className="text-sm space-y-4">
            <div className="flex justify-between items-center py-1 border-b border-border/50 pb-3">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Created By
              </span>
              <span className="font-medium">{contract.userId}</span>
            </div>

            <div className="flex justify-between items-center py-1 border-b border-border/50 pb-3">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Uploaded
              </span>
              <span className="font-medium">
                {new Date(contract.createdAt).toLocaleDateString()}
              </span>
            </div>

            <div className="flex justify-between items-center py-1 border-b border-border/50 pb-3">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Last Modified
              </span>
              <span className="font-medium">
                {new Date(contract.lastUpdated).toLocaleDateString()}
              </span>
            </div>

            <div className="flex justify-between items-center py-1">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                File Size
              </span>
              <span className="font-medium">{contract.fileSize}</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
