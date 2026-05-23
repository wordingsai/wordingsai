export const FeaturesSection = () => {
  return (
    <section className="py-24 bg-zinc-100 dark:bg-background">
      <div className="max-w-6xl mx-auto px-10">
        <div className="text-center mb-20">
          <h2 className="text-3xl font-bold tracking-tight mb-4 text-slate-900 dark:text-white">
            Powerful Features for Modern Teams
          </h2>
          <p className="text-slate-600 dark:text-slate-400">
            Streamline your contract workflow with AI-driven automation.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="group p-8 rounded-2xl border border-slate-200 dark:border-white/5 bg-white dark:bg-zinc-900/50 hover:border-primary/50 transition-all duration-300">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-6 group-hover:bg-primary group-hover:text-white transition-all">
              <span className="material-symbols-outlined">upload_file</span>
            </div>
            <h3 className="text-lg font-bold mb-3 text-slate-900 dark:text-white">
              Contract Upload
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Upload PDF contracts and process them instantly with high accuracy
              OCR technology.
            </p>
          </div>

          <div className="group p-8 rounded-2xl border border-slate-200 dark:border-white/5 bg-white dark:bg-zinc-900/50 hover:border-primary/50 transition-all duration-300">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-6 group-hover:bg-primary group-hover:text-white transition-all">
              <span className="material-symbols-outlined">segment</span>
            </div>
            <h3 className="text-lg font-bold mb-3 text-slate-900 dark:text-white">
              Clause Detection
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Automatically split complex contracts into structured, searchable,
              and manageable clauses.
            </p>
          </div>

          <div className="group p-8 rounded-2xl border border-slate-200 dark:border-white/5 bg-white dark:bg-zinc-900/50 hover:border-primary/50 transition-all duration-300">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-6 group-hover:bg-primary group-hover:text-white transition-all">
              <span className="material-symbols-outlined">library_books</span>
            </div>
            <h3 className="text-lg font-bold mb-3 text-slate-900 dark:text-white">
              Library Matching
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Compare extracted clauses against your internal gold-standard
              library for deviations.
            </p>
          </div>

          <div className="group p-8 rounded-2xl border border-slate-200 dark:border-white/5 bg-white dark:bg-zinc-900/50 hover:border-primary/50 transition-all duration-300">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-6 group-hover:bg-primary group-hover:text-white transition-all">
              <span className="material-symbols-outlined">crisis_alert</span>
            </div>
            <h3 className="text-lg font-bold mb-3 text-slate-900 dark:text-white">
              Risk Insights
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Identify risky contract language with simple, actionable analytics
              and heatmaps.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
