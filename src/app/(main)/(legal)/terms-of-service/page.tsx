const TermsAndConditions = () => {
  return (
    <main className="max-w-6xl mx-auto px-6 pt-4">
      <div className="py-16 md:py-24">
        <header className="mb-16 border-b border-slate-200 dark:border-primary/10 pb-12">
          <h1 className="mb-4 text-2xl md:text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
            Terms of Service
          </h1>
          <div className="flex items-center gap-2 text-slate-500 dark:text-primary/60">
            <span className="material-symbols-outlined text-sm">
              calendar_today
            </span>
            <p className="text-sm font-medium uppercase tracking-wider">
              Last updated: March 11, 2026
            </p>
          </div>
        </header>

        <article className="space-y-10 text-slate-700 dark:text-slate-300 leading-relaxed">
          <section>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <span className="text-primary">1.</span> Acceptance of Terms
            </h2>
            <div className="space-y-4 text-slate-600 dark:text-slate-300 leading-relaxed">
              <p>
                By accessing or using WordingsAI, you agree to be bound by these
                Terms of Service and all applicable laws and regulations. If you
                do not agree with any of these terms, you are prohibited from
                using or accessing this site.
              </p>
              <p>
                The materials contained in this website are protected by
                applicable copyright and trademark law. We reserve the right to
                update these terms at any time without prior notice.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <span className="text-primary">2.</span> User Responsibilities
            </h2>
            <div className="space-y-4 text-slate-600 dark:text-slate-300 leading-relaxed">
              <p>As a condition of your use of the Service, you agree to:</p>
              <ul className="list-disc pl-5 space-y-2 marker:text-primary">
                <li>
                  Provide accurate, current, and complete information during
                  registration.
                </li>
                <li>Maintain the security of your account credentials.</li>
                <li>
                  Not use the service for any illegal or unauthorized purpose.
                </li>
                <li>
                  Not attempt to reverse engineer or scrape the WordingsAI
                  algorithms.
                </li>
                <li>
                  Accept responsibility for all content generated and shared
                  through your account.
                </li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <span className="text-primary">3.</span> Intellectual Property
            </h2>
            <div className="space-y-4 text-slate-600 dark:text-slate-300 leading-relaxed">
              <p>
                The Service and its original content (excluding content provided
                by users), features, and functionality are and will remain the
                exclusive property of WordingsAI and its licensors.
              </p>
              <p>
                Regarding AI-generated content: WordingsAI grants you a
                non-exclusive, perpetual, worldwide license to use the text
                outputs generated through the service for your personal or
                commercial business needs.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <span className="text-primary">4.</span> Termination
            </h2>
            <div className="space-y-4 text-slate-600 dark:text-slate-300 leading-relaxed">
              <p>
                We may terminate or suspend your account and bar access to the
                Service immediately, without prior notice or liability, under
                our sole discretion, for any reason whatsoever and without
                limitation, including but not limited to a breach of the Terms.
              </p>
            </div>
          </section>

          <section className="bg-primary/5 rounded-xl p-8 border border-primary/20">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
              Questions?
            </h2>
            <p className="text-slate-600 dark:text-slate-300 mb-6">
              If you have any questions about our Terms of Service, please reach
              out to our legal team.
            </p>
            <a
              className="inline-flex items-center gap-2 text-primary font-bold hover:underline"
              href="mailto:legal@wordingsai.com"
            >
              legal@wordingsai.com
              <span className="material-symbols-outlined text-sm">
                arrow_forward
              </span>
            </a>
          </section>
        </article>
      </div>
    </main>
  );
};

export default TermsAndConditions;
