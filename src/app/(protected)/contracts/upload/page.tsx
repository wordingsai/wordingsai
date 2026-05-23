"use client";

import { createClient } from "@supabase/supabase-js";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { format, parse, isValid } from "date-fns";
import {
  CalendarIcon,
  Upload,
  ShieldCheck,
  FileText,
  Users,
  Building2,
  LayoutGrid,
  Zap,
  ArrowRight,
  CheckCircle2,
  Loader2,
  X,
  FileSearch,
  ChevronRight,
  ArrowLeft,
  Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { PDFDocument } from "pdf-lib";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Checkbox } from "@/components/ui/checkbox";

export default function UploadPage() {
  const router = useRouter();
  const [step, setStep] = useState(1); // 1: Upload, 2: Review Metadata
  const [files, setFiles] = useState<File[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [workspaceType, setWorkspaceType] = useState<string>("reinsurance");

  useEffect(() => {
    fetch("/api/workspaces/active")
      .then((res) => res.json())
      .then((data) => {
        if (data.type) setWorkspaceType(data.type);
      })
      .catch((err) => console.error("Failed to fetch active workspace:", err));
  }, []);

  // Metadata fields
  const [contractName, setContractName] = useState("");
  const [reinsured, setReinsured] = useState("");
  const [broker, setBroker] = useState("");
  const [contractType, setContractType] = useState<string>("");
  const [periodFrom, setPeriodFrom] = useState<Date>();
  const [periodTo, setPeriodTo] = useState<Date>();

  // Input fields for date (Task 1)
  const [periodFromInput, setPeriodFromInput] = useState("");
  const [periodToInput, setPeriodToInput] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedRuleIds, setSelectedRuleIds] = useState<Set<string>>(
    new Set(),
  );

  // Task 3: Configuration for visible fields
  const [visibleFields, setVisibleFields] = useState<Set<string>>(
    new Set(["name", "reinsured", "broker", "type", "periodFrom", "periodTo"]),
  );
  const [showConfig, setShowConfig] = useState(false);

  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [uploadedFilePath, setUploadedFilePath] = useState<string | null>(null);
  const [uploadedFileSize, setUploadedFileSize] = useState<number | null>(null);
  const [uploadedFileHash, setUploadedFileHash] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFiles(acceptedFiles);
      handleExtraction(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        [".docx"],
    },
    maxFiles: 1,
  });

  const handleExtraction = async (file: File) => {
    setIsExtracting(true);
    setStep(2);
    try {
      // 1. Calculate Hash
      const arrayBuffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const fileHash = hashArray
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      setUploadedFileHash(fileHash);
      setUploadedFileSize(file.size);

      // 2. Get Upload URL
      const getUrlRes = await fetch("/api/contracts/get-upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type,
          fileHash,
        }),
      });

      if (!getUrlRes.ok) throw new Error("Failed to get upload URL");
      const { signedUrl, publicUrl, filePath, duplicateContractId } =
        await getUrlRes.json();

      if (duplicateContractId) {
        toast.info("Duplicate contract detected. Redirecting...");
        router.push(`/contracts/${duplicateContractId}`);
        return;
      }

      // 3. Upload to Supabase
      const uploadRes = await fetch(signedUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });

      if (!uploadRes.ok) throw new Error("File upload failed");

      setUploadedUrl(publicUrl);
      setUploadedFilePath(filePath);

      // 4. Call Metadata API with URL (Proxy to Python)
      const res = await fetch("/api/contracts/extract-metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileUrl: publicUrl, workspaceType }),
      });

      if (!res.ok) throw new Error("Metadata extraction failed");

      const metadata = await res.json();
      console.log("[Extraction] Received Metadata:", metadata);

      // Robust mapping for fields
      if (metadata.contractName && metadata.contractName !== "null") {
        setContractName(metadata.contractName);
      }

      if (metadata.reinsured && metadata.reinsured !== "null") {
        setReinsured(metadata.reinsured);
      }

      if (metadata.broker && metadata.broker !== "null") {
        setBroker(metadata.broker);
      }

      if (metadata.contractType && metadata.contractType !== "null") {
        setContractType(String(metadata.contractType).trim());
      }

      if (metadata.periodFrom && metadata.periodFrom !== "null") {
        const d = new Date(metadata.periodFrom);
        if (isValid(d)) {
          setPeriodFrom(d);
          setPeriodFromInput(format(d, "dd MMM yyyy"));
        }
      }

      if (metadata.periodTo && metadata.periodTo !== "null") {
        const d = new Date(metadata.periodTo);
        if (isValid(d)) {
          setPeriodTo(d);
          setPeriodToInput(format(d, "dd MMM yyyy"));
        }
      }

      toast.success("Intelligence successfully extracted from document brief!");
    } catch (error) {
      console.error(error);
      toast.error("AI failed to extract metadata. Please fill manually.");
    } finally {
      setIsExtracting(false);
    }
  };

  const handlePeriodFromChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setPeriodFromInput(val);
    const parsed = parse(val, "dd MMM yyyy", new Date());
    if (isValid(parsed)) setPeriodFrom(parsed);
  };

  const handlePeriodToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setPeriodToInput(val);
    const parsed = parse(val, "dd MMM yyyy", new Date());
    if (isValid(parsed)) setPeriodTo(parsed);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !contractName ||
      !reinsured ||
      !contractType ||
      !periodFrom ||
      !periodTo ||
      !files[0]
    ) {
      toast.error("All mandatory fields are required!");
      return;
    }

    setSubmitting(true);
    setUploadProgress(0);

    try {
      const file = files[0];
      let fileURL = uploadedUrl;
      let fileSize = uploadedFileSize;
      let fileHash = uploadedFileHash;

      if (!fileURL) {
        // Fallback upload if handleExtraction skipped or failed upload
        const arrayBuffer = await file.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        fileHash = hashArray
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
        fileSize = file.size;

        const getUrlRes = await fetch("/api/contracts/get-upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            fileType: file.type,
            fileHash,
          }),
        });

        if (!getUrlRes.ok) throw new Error("Failed to get upload URL");
        const { signedUrl, publicUrl, duplicateContractId } =
          await getUrlRes.json();

        if (duplicateContractId) {
          toast.success(
            "Document previously analyzed! Loading existing intelligence...",
          );
          router.push(`/contracts/${duplicateContractId}`);
          return;
        }

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable)
              setUploadProgress(Math.round((event.loaded / event.total) * 100));
          };
          xhr.onload = () =>
            xhr.status >= 200 && xhr.status < 300
              ? resolve()
              : reject(new Error("Upload failed"));
          xhr.onerror = () => reject(new Error("Network Error"));
          xhr.open("PUT", signedUrl, true);
          xhr.setRequestHeader(
            "Content-Type",
            file.type || "application/octet-stream",
          );
          xhr.send(file);
        });
        fileURL = publicUrl;
      } else {
        // If already uploaded during extraction, we just set progress to 100
        setUploadProgress(100);
      }

      const saveRes = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractName,
          reinsured,
          broker,
          contractType,
          periodFrom,
          periodTo,
          fileURL: fileURL,
          fileContent: "READY_FOR_ANALYSIS",
          fileSize: file.size,
          fileHash,
          selectedRuleIds: Array.from(selectedRuleIds),
        }),
      });

      if (!saveRes.ok) throw new Error("Failed to save contract metadata");
      const saveResData = await saveRes.json();

      toast.success("Digital intake complete!");
      router.push(`/contracts/${saveResData.id}`);
    } catch (err: any) {
      toast.error(err?.message || "Error uploading contract");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex-1 p-4 md:p-6 lg:p-10 bg-background transition-colors duration-300">
      <div className="mb-10">
        <Breadcrumb className="mb-6">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink
                href="/contracts"
                className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant"
              >
                Portfolio Archive
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="text-[10px] font-black uppercase tracking-widest text-on-surface">
                Digital Intake
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <h1 className="text-3xl md:text-5xl font-black tracking-tighter uppercase text-on-surface">
          {step === 1 ? "Upload Wording" : "Review Intelligence"}
        </h1>
        <p className="text-on-surface-variant text-base md:text-lg font-medium max-w-2xl mt-2">
          {step === 1
            ? "Step 1: Upload the document to initiate neural extraction."
            : "Step 2: Verify the extracted metadata before initializing full vetting."}
        </p>
      </div>

      <div className="w-full">
        {step === 1 ? (
          <div
            {...getRootProps()}
            className={cn(
              "relative group cursor-pointer p-20 border-2 border-dashed rounded-[3rem] transition-all duration-500",
              isDragActive
                ? "bg-primary/5 border-primary shadow-2xl scale-[1.02]"
                : "bg-surface-container-low border-outline-variant hover:border-primary/50 hover:bg-surface-container",
            )}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center text-center gap-6">
              <div className="size-24 bg-primary/10 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                <Upload className="size-10 text-primary" />
              </div>
              <div>
                <h3 className="text-2xl font-black uppercase tracking-tight text-on-surface">
                  Drop Document Here
                </h3>
                <p className="text-on-surface-variant font-medium mt-2">
                  PDF or DOCX (Max 50MB)
                </p>
              </div>
              <Button
                size="lg"
                className="h-14 px-10 rounded-2xl font-black uppercase tracking-widest text-xs"
              >
                Select File
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                className="rounded-xl gap-2 font-black uppercase tracking-widest text-[10px]"
                onClick={() => setStep(1)}
              >
                <ArrowLeft className="size-4" /> Back to Upload
              </Button>
              <Button
                variant="outline"
                className="rounded-xl gap-2 font-black uppercase tracking-widest text-[10px]"
                onClick={() => setShowConfig(!showConfig)}
              >
                <Settings2 className="size-4" /> Configure Fields
              </Button>
            </div>

            {showConfig && (
              <div className="bg-surface-container p-6 rounded-[2rem] border border-outline-variant space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                  Configure Metadata View
                </h4>
                <div className="flex flex-wrap gap-4">
                  {[
                    {
                      id: "name",
                      label:
                        workspaceType === "property"
                          ? "Policy Number"
                          : "Unique Market Reference",
                    },
                    {
                      id: "reinsured",
                      label:
                        workspaceType === "property"
                          ? "Policyholder"
                          : "Reinsured",
                    },
                    { id: "broker", label: "Broker" },
                    {
                      id: "type",
                      label:
                        workspaceType === "property" ? "Type" : "Contract Type",
                    },
                    { id: "periodFrom", label: "Period From" },
                    { id: "periodTo", label: "Period To" },
                  ].map((f) => (
                    <label
                      key={f.id}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <Checkbox
                        checked={visibleFields.has(f.id)}
                        onCheckedChange={() => {
                          const next = new Set(visibleFields);
                          if (next.has(f.id)) next.delete(f.id);
                          else next.add(f.id);
                          setVisibleFields(next);
                        }}
                      />
                      <span className="text-xs font-bold text-on-surface">
                        {f.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <form
              onSubmit={handleSubmit}
              className="bg-surface-container-low border border-outline-variant rounded-[3rem] p-10 shadow-xl space-y-8 relative overflow-hidden"
            >
              {isExtracting && (
                <div className="absolute inset-0 bg-background/60 backdrop-blur-sm z-20 flex flex-col items-center justify-center gap-4">
                  <div className="relative">
                    <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full scale-150 animate-pulse" />
                    <Loader2 className="size-12 text-primary animate-spin relative" />
                  </div>
                  <h3 className="text-xl font-black uppercase tracking-tight text-primary">
                    Neural Extraction...
                  </h3>
                  <p className="text-on-surface-variant text-sm font-medium">
                    Scanning document for metadata brief
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {visibleFields.has("name") && (
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1 flex items-center gap-2">
                      <FileText className="size-3 text-primary" />{" "}
                      {workspaceType === "property"
                        ? "Policy Number"
                        : "Unique Market Reference"}
                    </Label>
                    <Input
                      value={contractName}
                      onChange={(e) => setContractName(e.target.value)}
                      maxLength={100}
                      className="h-14 bg-background border-outline-variant rounded-2xl font-bold"
                    />
                  </div>
                )}
                {visibleFields.has("reinsured") && (
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1 flex items-center gap-2">
                      <Building2 className="size-3 text-secondary" />{" "}
                      {workspaceType === "property"
                        ? "Policyholder"
                        : "Reinsured"}
                    </Label>
                    <Input
                      value={reinsured}
                      onChange={(e) => setReinsured(e.target.value)}
                      maxLength={255}
                      className="h-14 bg-background border-outline-variant rounded-2xl font-bold"
                    />
                  </div>
                )}
                {visibleFields.has("broker") && (
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1 flex items-center gap-2">
                      <Users className="size-3 text-indigo-500" /> Broker
                    </Label>
                    <Input
                      value={broker}
                      onChange={(e) => setBroker(e.target.value)}
                      maxLength={255}
                      className="h-14 bg-background border-outline-variant rounded-2xl font-bold"
                    />
                  </div>
                )}
                {visibleFields.has("type") && (
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1 flex items-center gap-2">
                      <LayoutGrid className="size-3 text-amber-500" />{" "}
                      {workspaceType === "property" ? "Type" : "Contract Type"}
                    </Label>
                    <Input
                      value={contractType}
                      onChange={(e) => setContractType(e.target.value)}
                      placeholder="e.g. Excess Aviation of Loss"
                      maxLength={255}
                      className="h-14 bg-background border-outline-variant rounded-2xl font-bold"
                    />
                  </div>
                )}
                {visibleFields.has("periodFrom") && (
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1 flex items-center gap-2">
                      <CalendarIcon className="size-3 text-violet-500" /> Period
                      From
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        value={periodFromInput}
                        onChange={handlePeriodFromChange}
                        placeholder="DD MMM YYYY"
                        maxLength={20}
                        className="h-14 bg-background border-outline-variant rounded-2xl font-bold flex-1"
                      />
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="h-14 w-14 rounded-2xl border-outline-variant p-0"
                          >
                            <CalendarIcon className="size-5" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-auto p-0 rounded-2xl"
                          align="end"
                        >
                          <Calendar
                            key={periodFrom?.toISOString()}
                            mode="single"
                            selected={periodFrom}
                            defaultMonth={periodFrom}
                            onSelect={(d) => {
                              if (d) {
                                setPeriodFrom(d);
                                setPeriodFromInput(format(d, "dd MMM yyyy"));
                              }
                            }}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                )}
                {visibleFields.has("periodTo") && (
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1 flex items-center gap-2">
                      <CalendarIcon className="size-3 text-rose-500" /> Period
                      To
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        value={periodToInput}
                        onChange={handlePeriodToChange}
                        placeholder="DD MMM YYYY"
                        maxLength={20}
                        className="h-14 bg-background border-outline-variant rounded-2xl font-bold flex-1"
                      />
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="h-14 w-14 rounded-2xl border-outline-variant p-0"
                          >
                            <CalendarIcon className="size-5" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-auto p-0 rounded-2xl"
                          align="end"
                        >
                          <Calendar
                            key={periodTo?.toISOString()}
                            mode="single"
                            selected={periodTo}
                            defaultMonth={periodTo}
                            onSelect={(d) => {
                              if (d) {
                                setPeriodTo(d);
                                setPeriodToInput(format(d, "dd MMM yyyy"));
                              }
                            }}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-8 border-t border-outline-variant flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="size-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center">
                    <CheckCircle2 className="size-6 text-emerald-500" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black uppercase tracking-tight text-on-surface">
                      {files[0]?.name}
                    </h4>
                    <p className="text-[10px] font-bold text-on-surface-variant/60 uppercase">
                      Ready for neural analysis
                    </p>
                  </div>
                </div>

                <Button
                  type="submit"
                  size="lg"
                  disabled={submitting || isExtracting}
                  className="h-16 px-10 rounded-2xl font-black uppercase tracking-widest text-xs shadow-2xl flex items-center gap-3 w-full md:w-auto"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="size-5 animate-spin" /> UPLOADING{" "}
                      {uploadProgress}%
                    </>
                  ) : (
                    <>
                      <Zap className="size-5" /> INITIALIZE VETTING
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}
