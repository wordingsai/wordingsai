"use client";

import React, { useState, useEffect, useCallback } from "react";
import { format, parse, isValid } from "date-fns";
import {
  CalendarIcon,
  Upload,
  FileText,
  Users,
  Building2,
  LayoutGrid,
  Zap,
  CheckCircle2,
  Loader2,
  ArrowLeft,
  Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const [step, setStep] = useState(1);
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

  const [contractName, setContractName] = useState("");
  const [reinsured, setReinsured] = useState("");
  const [broker, setBroker] = useState("");
  const [contractType, setContractType] = useState<string>("");
  const [periodFrom, setPeriodFrom] = useState<Date>();
  const [periodTo, setPeriodTo] = useState<Date>();

  const [periodFromInput, setPeriodFromInput] = useState("");
  const [periodToInput, setPeriodToInput] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedRuleIds, setSelectedRuleIds] = useState<Set<string>>(
    new Set(),
  );

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
      const arrayBuffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const fileHash = hashArray
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      setUploadedFileHash(fileHash);
      setUploadedFileSize(file.size);

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

      const uploadRes = await fetch(signedUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });

      if (!uploadRes.ok) throw new Error("File upload failed");

      setUploadedUrl(publicUrl);
      setUploadedFilePath(filePath);

      const res = await fetch("/api/contracts/extract-metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileUrl: publicUrl, workspaceType }),
      });

      if (!res.ok) throw new Error("Metadata extraction failed");

      const metadata = await res.json();
      console.log("[Extraction] Received Metadata:", metadata);

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

      toast.success("Metadata extracted from document");
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
      toast.error("All mandatory fields are required.");
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
          toast.success("Document previously analyzed. Loading existing record.");
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

      toast.success("Upload complete");
      router.push(`/contracts/${saveResData.id}`);
    } catch (err: any) {
      toast.error(err?.message || "Error uploading contract");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex-1 p-6 lg:p-8 bg-background transition-colors duration-300">
      <div className="mb-6">
        <Breadcrumb className="mb-4">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink
                href="/contracts"
                className="text-xs text-on-surface-variant"
              >
                Portfolio
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="text-xs text-on-surface">
                Upload
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight text-on-surface">
          {step === 1 ? "Upload wording" : "Review extracted metadata"}
        </h1>
        <p className="text-sm text-on-surface-variant mt-1.5 max-w-2xl">
          {step === 1
            ? "Step 1 · Upload the document to begin extraction."
            : "Step 2 · Verify the extracted metadata before starting analysis."}
        </p>
      </div>

      <div className="w-full">
        {step === 1 ? (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
            <div
              {...getRootProps()}
              className={cn(
                "relative group cursor-pointer min-h-[420px] flex items-center justify-center p-10 border-2 border-dashed rounded-xl transition-all duration-300",
                isDragActive
                  ? "bg-primary/5 border-primary"
                  : "bg-surface-container-low border-outline-variant hover:border-primary/50 hover:bg-surface-container",
              )}
            >
              <input {...getInputProps()} />
              <div className="flex flex-col items-center text-center gap-4">
                <div className="size-14 bg-primary/10 rounded-full flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
                  <Upload className="size-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-on-surface">
                    Drop document here
                  </h3>
                  <p className="text-sm text-on-surface-variant mt-1">
                    PDF or DOCX, up to 50 MB
                  </p>
                </div>
                <Button size="default">Select file</Button>
              </div>
            </div>

            {/* Right-side helper panel */}
            <aside className="space-y-4">
              <div className="bg-surface-container-low border border-outline-variant rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Zap className="size-4 text-primary" />
                  <h4 className="text-sm font-semibold text-on-surface">
                    What happens next
                  </h4>
                </div>
                <ol className="space-y-3 text-sm text-on-surface-variant">
                  <li className="flex gap-3">
                    <span className="flex-none size-5 rounded-full bg-primary/10 text-primary text-[11px] font-medium flex items-center justify-center">
                      1
                    </span>
                    <span className="leading-snug">
                      Document uploads to secure storage.
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-none size-5 rounded-full bg-primary/10 text-primary text-[11px] font-medium flex items-center justify-center">
                      2
                    </span>
                    <span className="leading-snug">
                      AI extracts metadata (reinsured, type, period) for your
                      review.
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-none size-5 rounded-full bg-primary/10 text-primary text-[11px] font-medium flex items-center justify-center">
                      3
                    </span>
                    <span className="leading-snug">
                      Rules engine evaluates against your clause library.
                    </span>
                  </li>
                </ol>
              </div>

              <div className="bg-surface-container-low border border-outline-variant rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <FileText className="size-4 text-secondary" />
                  <h4 className="text-sm font-semibold text-on-surface">
                    Supported formats
                  </h4>
                </div>
                <ul className="text-sm text-on-surface-variant space-y-1.5">
                  <li className="flex items-center gap-2">
                    <span className="size-1 rounded-full bg-on-surface-variant/60" />
                    PDF (scanned or text-based)
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="size-1 rounded-full bg-on-surface-variant/60" />
                    DOCX (Word documents)
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="size-1 rounded-full bg-on-surface-variant/60" />
                    Max file size: 50 MB
                  </li>
                </ul>
              </div>
            </aside>
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                className="gap-2"
                onClick={() => setStep(1)}
              >
                <ArrowLeft className="size-4" /> Back to upload
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => setShowConfig(!showConfig)}
              >
                <Settings2 className="size-4" /> Configure fields
              </Button>
            </div>

            {showConfig && (
              <div className="bg-surface-container p-5 rounded-xl border border-outline-variant space-y-3">
                <h4 className="text-xs font-medium uppercase tracking-wider text-on-surface-variant">
                  Configure metadata view
                </h4>
                <div className="flex flex-wrap gap-x-5 gap-y-2.5">
                  {[
                    {
                      id: "name",
                      label:
                        workspaceType === "property"
                          ? "Policy number"
                          : "Unique market reference",
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
                        workspaceType === "property" ? "Type" : "Contract type",
                    },
                    { id: "periodFrom", label: "Period from" },
                    { id: "periodTo", label: "Period to" },
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
                      <span className="text-sm text-on-surface">{f.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <form
              onSubmit={handleSubmit}
              className="bg-surface-container-low border border-outline-variant rounded-xl p-6 space-y-6 relative overflow-hidden"
            >
              {isExtracting && (
                <div className="absolute inset-0 bg-background/70 backdrop-blur-sm z-20 flex flex-col items-center justify-center gap-3">
                  <div className="relative">
                    <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full scale-150 animate-pulse" />
                    <Loader2 className="size-8 text-primary animate-spin relative" />
                  </div>
                  <h3 className="text-base font-semibold text-primary">
                    Extracting metadata...
                  </h3>
                  <p className="text-sm text-on-surface-variant">
                    Scanning document brief
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {visibleFields.has("name") && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-on-surface-variant flex items-center gap-1.5">
                      <FileText className="size-3 text-primary" />
                      {workspaceType === "property"
                        ? "Policy number"
                        : "Unique market reference"}
                    </Label>
                    <Input
                      value={contractName}
                      onChange={(e) => setContractName(e.target.value)}
                      maxLength={100}
                      className="bg-background"
                    />
                  </div>
                )}
                {visibleFields.has("reinsured") && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-on-surface-variant flex items-center gap-1.5">
                      <Building2 className="size-3 text-secondary" />
                      {workspaceType === "property"
                        ? "Policyholder"
                        : "Reinsured"}
                    </Label>
                    <Input
                      value={reinsured}
                      onChange={(e) => setReinsured(e.target.value)}
                      maxLength={255}
                      className="bg-background"
                    />
                  </div>
                )}
                {visibleFields.has("broker") && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-on-surface-variant flex items-center gap-1.5">
                      <Users className="size-3 text-indigo-500" />
                      Broker
                    </Label>
                    <Input
                      value={broker}
                      onChange={(e) => setBroker(e.target.value)}
                      maxLength={255}
                      className="bg-background"
                    />
                  </div>
                )}
                {visibleFields.has("type") && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-on-surface-variant flex items-center gap-1.5">
                      <LayoutGrid className="size-3 text-amber-500" />
                      {workspaceType === "property" ? "Type" : "Contract type"}
                    </Label>
                    <Input
                      value={contractType}
                      onChange={(e) => setContractType(e.target.value)}
                      placeholder="e.g. Excess of Loss"
                      maxLength={255}
                      className="bg-background"
                    />
                  </div>
                )}
                {visibleFields.has("periodFrom") && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-on-surface-variant flex items-center gap-1.5">
                      <CalendarIcon className="size-3 text-violet-500" />
                      Period from
                    </Label>
                    <div className="flex gap-1.5">
                      <Input
                        value={periodFromInput}
                        onChange={handlePeriodFromChange}
                        placeholder="DD MMM YYYY"
                        maxLength={20}
                        className="bg-background flex-1"
                      />
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            className="border-outline-variant"
                          >
                            <CalendarIcon className="size-4" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end">
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
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-on-surface-variant flex items-center gap-1.5">
                      <CalendarIcon className="size-3 text-rose-500" />
                      Period to
                    </Label>
                    <div className="flex gap-1.5">
                      <Input
                        value={periodToInput}
                        onChange={handlePeriodToChange}
                        placeholder="DD MMM YYYY"
                        maxLength={20}
                        className="bg-background flex-1"
                      />
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            className="border-outline-variant"
                          >
                            <CalendarIcon className="size-4" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end">
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

              <div className="pt-5 border-t border-outline-variant flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="size-9 bg-emerald-500/10 rounded-md flex items-center justify-center shrink-0">
                    <CheckCircle2 className="size-4 text-emerald-500" />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-on-surface">
                      {files[0]?.name}
                    </h4>
                    <p className="text-xs text-on-surface-variant">
                      Ready for analysis
                    </p>
                  </div>
                </div>

                <Button
                  type="submit"
                  size="lg"
                  disabled={submitting || isExtracting}
                  className="gap-2 w-full md:w-auto"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Uploading {uploadProgress}%
                    </>
                  ) : (
                    <>
                      <Zap className="size-4" />
                      Start analysis
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
