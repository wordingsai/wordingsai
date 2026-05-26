const CookiePolicy = () => {
  return (
    <main className="max-w-6xl mx-auto px-6 pt-4">
      <div className="py-16 md:py-24">
        <header className="mb-16 border-b border-slate-200 dark:border-primary/10 pb-12">
          <h1 className="mb-4 text-2xl md:text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
            Cookie Policy
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
            <p className="text-lg">
              This Cookie Policy explains how{" "}
              <span className="text-primary font-semibold">WordingsAI</span>{" "}
              uses cookies and similar technologies to recognize you when you
              visit our website. It explains what these technologies are and why
              we use them, as well as your rights to control our use of them.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
              What are cookies?
            </h2>
            <p>
              Cookies are small data files that are placed on your computer or
              mobile device when you visit a website. Cookies are widely used by
              website owners in order to make their websites work, or to work
              more efficiently, as well as to provide reporting information.
            </p>
            <p className="mt-4">
              Cookies set by the website owner (in this case, WordingsAI) are
              called "first-party cookies". Cookies set by parties other than
              the website owner are called "third-party cookies".
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
              How we use cookies
            </h2>
            <p className="mb-6">
              We use first-party and third-party cookies for several reasons.
              Some cookies are required for technical reasons in order for our
              Website to operate, and we refer to these as "essential" or
              "strictly necessary" cookies.
            </p>
            <div className="grid gap-6">
              <div className="p-6 rounded-xl bg-slate-100 dark:bg-primary/5 border border-slate-200 dark:border-primary/10">
                <div className="flex items-center gap-3 mb-3">
                  <span className="material-symbols-outlined text-primary">
                    security
                  </span>
                  <h3 className="font-bold text-slate-900 dark:text-white">
                    Essential Cookies
                  </h3>
                </div>
                <p className="text-sm">
                  These cookies are strictly necessary to provide you with
                  services available through our Website and to use some of its
                  features, such as access to secure areas. Because these
                  cookies are strictly necessary to deliver the Website to you,
                  you cannot refuse them without affecting how our Website
                  functions.
                </p>
              </div>

              <div className="p-6 rounded-xl bg-slate-100 dark:bg-primary/5 border border-slate-200 dark:border-primary/10">
                <div className="flex items-center gap-3 mb-3">
                  <span className="material-symbols-outlined text-primary">
                    analytics
                  </span>
                  <h3 className="font-bold text-slate-900 dark:text-white">
                    Performance &amp; Analytics
                  </h3>
                </div>
                <p className="text-sm">
                  These cookies collect information that is used either in
                  aggregate form to help us understand how our Website is being
                  used or how effective our marketing campaigns are, or to help
                  us customize our Website for you.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
              Managing your preferences
            </h2>
            <p>
              You have the right to decide whether to accept or reject cookies.
              You can exercise your cookie rights by setting your preferences in
              the Cookie Consent Manager. The Cookie Consent Manager allows you
              to select which categories of cookies you accept or reject.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row gap-4">
              <button className="px-6 py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 transition-all">
                Manage Cookie Settings
              </button>
              <button className="px-6 py-3 border border-primary/20 text-primary font-bold rounded-xl hover:bg-primary/5 transition-all">
                Opt-out of all non-essential
              </button>
            </div>
          </section>

          <section className="border-t border-slate-200 dark:border-primary/10 pt-10">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
              Updates to this policy
            </h2>
            <p>
              We may update this Cookie Policy from time to time in order to
              reflect, for example, changes to the cookies we use or for other
              operational, legal or regulatory reasons. Please therefore
              re-visit this Cookie Policy regularly to stay informed about our
              use of cookies and related technologies.
            </p>
          </section>
        </article>
      </div>
    </main>
  );
};

export default CookiePolicy;
