export const HowItWorksSection = () => {
  return (
    <section className="py-24 overflow-hidden bg-white dark:bg-background">
      <div className="max-w-6xl mx-auto px-10">
        <div className="text-center mb-20">
          <h2 className="text-3xl font-bold tracking-tight mb-4 text-slate-900 dark:text-white">
            How It Works
          </h2>
          <p className="text-slate-600 dark:text-slate-400">
            Three simple steps to contract mastery.
          </p>
        </div>

        <div className="relative flex flex-col md:flex-row items-center justify-between gap-12 lg:gap-24">
          <div className="flex flex-col items-center text-center max-w-[280px] relative z-10">
            <div className="w-20 h-20 rounded-full bg-zinc-100 dark:bg-zinc-900 border-4 border-primary/20 flex items-center justify-center text-primary font-black text-2xl mb-6 shadow-xl">
              1
            </div>
            <h4 className="font-bold mb-2 text-slate-900 dark:text-white">
              Upload Contract
            </h4>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Drag and drop your PDF or Word documents directly into our secure
              platform.
            </p>
          </div>

          <div className="hidden md:block absolute top-10 left-[25%] w-[15%] border-t-2 border-dashed border-slate-300 dark:border-zinc-800" />

          <div className="flex flex-col items-center text-center max-w-[280px] relative z-10">
            <div className="w-20 h-20 rounded-full bg-zinc-100 dark:bg-zinc-900 border-4 border-primary/20 flex items-center justify-center text-primary font-black text-2xl mb-6 shadow-xl">
              2
            </div>
            <h4 className="font-bold mb-2 text-slate-900 dark:text-white">
              AI Extracts Clauses
            </h4>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Our neural engine identifies and tags every clause, definition,
              and obligation instantly.
            </p>
          </div>

          <div className="hidden md:block absolute top-10 right-[25%] w-[15%] border-t-2 border-dashed border-slate-300 dark:border-zinc-800" />

          <div className="flex flex-col items-center text-center max-w-[280px] relative z-10">
            <div className="w-20 h-20 rounded-full bg-zinc-100 dark:bg-zinc-900 border-4 border-primary/20 flex items-center justify-center text-primary font-black text-2xl mb-6 shadow-xl">
              3
            </div>
            <h4 className="font-bold mb-2 text-slate-900 dark:text-white">
              Compare &amp; Analyze
            </h4>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Match against your library to spot deviations and generate
              high-level risk reports.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
