"use client";

import { cn } from "@/lib/utils";
import React, { useRef, useState } from "react";
import { motion } from "motion/react";
import { IconUpload } from "@tabler/icons-react";
import { useDropzone } from "react-dropzone";

const mainVariant = {
  initial: {
    x: 0,
    y: 0,
  },
  animate: {
    x: 20,
    y: -20,
    opacity: 0.9,
  },
};

const secondaryVariant = {
  initial: {
    opacity: 0,
  },
  animate: {
    opacity: 1,
  },
};

export const FileUpload = ({
  onChange,
  files: propFiles = [],
}: {
  onChange?: (files: File[]) => void;
  files?: File[];
}) => {
  const [internalFiles, setInternalFiles] = useState<File[]>(propFiles);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync internal state with prop
  React.useEffect(() => {
    setInternalFiles(propFiles);
  }, [propFiles]);

  const files = internalFiles;

  // UPDATED: Restrict to only the latest single file.
  const handleFileChange = (newFiles: File[]) => {
    if (newFiles.length > 0) {
      const singleFile = [newFiles[0]];
      setInternalFiles(singleFile);
      if (onChange) onChange(singleFile);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const { getRootProps, isDragActive } = useDropzone({
    multiple: false, // Prevents multiple drops natively
    noClick: true,
    onDrop: handleFileChange,
    onDropRejected: (error) => {
      console.log(error);
    },
  });

  return (
    <div className="w-full" {...getRootProps()}>
      <motion.div
        onClick={handleClick}
        whileHover="animate"
        className="group/file relative block w-full cursor-pointer overflow-hidden rounded-lg p-10"
      >
        <input
          ref={fileInputRef}
          id="file-upload-handle"
          type="file"
          onChange={(e) => handleFileChange(Array.from(e.target.files || []))}
          className="hidden"
        />
        <div className="flex flex-col items-center justify-center w-full">
          <div className="relative mx-auto mt-10 w-full max-w-xl px-4">
            {files.length > 0 &&
              files.map((file, idx) => (
                <motion.div
                  key={"file" + idx}
                  layoutId={idx === 0 ? "file-upload" : "file-upload-" + idx}
                  className={cn(
                    "relative z-40 mx-auto mt-4 flex w-full flex-col items-start justify-start overflow-hidden rounded-2xl bg-white p-6 dark:bg-neutral-900",
                    "shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-neutral-200 dark:border-neutral-800",
                  )}
                >
                  <div className="flex w-full items-center gap-5">
                    <div className="shrink-0 size-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <span className="material-symbols-outlined text-primary text-3xl">
                        description
                      </span>
                    </div>

                    <div className="flex flex-col flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <motion.p
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          layout
                          className="truncate text-lg font-bold text-neutral-800 dark:text-neutral-100"
                        >
                          {file.name}
                        </motion.p>
                        <motion.p
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          layout
                          className="shrink-0 rounded-lg bg-neutral-100 px-2.5 py-1 text-[12px] font-black uppercase tracking-tight text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400 border border-neutral-200/50 dark:border-neutral-700/50"
                        >
                          {(file.size / (1024 * 1024)).toFixed(2)} MB
                        </motion.p>
                      </div>

                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                          <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            layout
                            className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest"
                          >
                            {file.type.split("/")[1] || "PDF"}
                          </motion.p>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}

            {!files.length && (
              <motion.div
                layoutId="file-upload"
                variants={mainVariant}
                transition={{
                  type: "spring",
                  stiffness: 300,
                  damping: 20,
                }}
                className={cn(
                  "relative z-40 mx-auto mt-4 flex h-32 w-full max-w-40 items-center justify-center rounded-2xl bg-white group-hover/file:shadow-2xl dark:bg-neutral-900",
                  "shadow-[0px_10px_50px_rgba(0,0,0,0.1)] border border-neutral-100 dark:border-neutral-800",
                )}
              >
                {isDragActive ? (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center text-primary font-bold"
                  >
                    Drop to upload
                    <IconUpload className="h-5 w-5 mt-2" />
                  </motion.p>
                ) : (
                  <IconUpload className="h-6 w-6 text-neutral-400 dark:text-neutral-500" />
                )}
              </motion.div>
            )}

            {!files.length && (
              <motion.div
                variants={secondaryVariant}
                className="absolute inset-0 z-30 mx-auto mt-4 flex h-32 w-full max-w-40 items-center justify-center rounded-2xl border border-dashed border-primary/40 bg-transparent opacity-0"
              ></motion.div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};
