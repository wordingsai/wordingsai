import type { MDXComponents } from "mdx/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h1: ({ className, ...props }) => (
      <h1
        className={cn(
          "mt-8 scroll-m-20 text-4xl font-black uppercase tracking-tighter text-on-surface",
          className,
        )}
        {...props}
      />
    ),
    h2: ({ className, ...props }) => (
      <h2
        className={cn(
          "mt-10 scroll-m-20 pb-1 text-3xl font-black uppercase tracking-tight text-on-surface/90",
          className,
        )}
        {...props}
      />
    ),
    h3: ({ className, ...props }) => (
      <h3
        className={cn(
          "mt-8 scroll-m-20 text-2xl font-black uppercase tracking-tight text-on-surface/80",
          className,
        )}
        {...props}
      />
    ),
    p: ({ className, ...props }) => (
      <p
        className={cn(
          "leading-7 font-medium text-on-surface-variant/80 [&:not(:first-child)]:mt-6",
          className,
        )}
        {...props}
      />
    ),
    ul: ({ className, ...props }) => (
      <ul
        className={cn("my-6 ml-6 list-disc [&>li]:mt-2", className)}
        {...props}
      />
    ),
    ol: ({ className, ...props }) => (
      <ol
        className={cn("my-6 ml-6 list-decimal [&>li]:mt-2", className)}
        {...props}
      />
    ),
    li: ({ className, ...props }) => (
      <li
        className={cn("mt-2 text-on-surface-variant/80 font-medium", className)}
        {...props}
      />
    ),
    blockquote: ({ className, ...props }) => (
      <blockquote
        className={cn(
          "mt-6 border-l-4 border-primary/40 bg-surface-container-low px-6 py-4 italic rounded-r-xl",
          className,
        )}
        {...props}
      />
    ),
    hr: ({ ...props }) => (
      <hr className="my-10 border-outline-variant/30" {...props} />
    ),
    code: ({ className, ...props }) => (
      <code
        className={cn(
          "relative rounded bg-surface-container-highest/50 px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold",
          className,
        )}
        {...props}
      />
    ),
    Badge: ({ className, ...props }: any) => (
      <Badge
        className={cn("rounded-lg uppercase font-black text-[10px]", className)}
        {...props}
      />
    ),
    ...components,
  };
}
