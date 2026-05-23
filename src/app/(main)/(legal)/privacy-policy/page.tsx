const PrivacyPolicy = () => {
  return (
    <main className="max-w-6xl mx-auto px-6 pt-4">
      <div className="py-16 md:py-24">
        <header className="mb-16 border-b border-slate-200 dark:border-primary/10 pb-12">
          <h1 className="mb-4 text-4xl font-black tracking-tight text-slate-900 dark:text-white md:text-5xl">
            Privacy Policy
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

        <div className="space-y-10 text-slate-700 dark:text-slate-300 leading-relaxed">
          <section>
            <h2 className="mb-4 text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
              <span className="text-primary font-mono text-xl">01.</span>
              Information We Collect
            </h2>

            <div className="space-y-4 text-slate-600 dark:text-slate-300">
              <p>
                We collect information you provide directly to us when you
                create an account, use our AI writing tools, or communicate with
                us. This includes your name, email address, and the content you
                input into our services.
              </p>

              <p>
                When you use WordingsAI, we automatically collect certain
                information about your device, including information about your
                web browser, IP address, time zone, and some of the cookies that
                are installed on your device.
              </p>
            </div>
          </section>

          <section>
            <h2 className="mb-4 text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
              <span className="text-primary font-mono text-xl">02.</span>
              How We Use Data
            </h2>

            <div className="space-y-4 text-slate-600 dark:text-slate-300">
              <p>
                We use the information we collect to provide, maintain, and
                improve our services. Specifically, we use your data to:
              </p>

              <ul className="list-none space-y-3 pl-2">
                <li className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-primary text-sm mt-1">
                    check_circle
                  </span>
                  <span>
                    Personalize your experience and deliver the type of content
                    and product offerings in which you are most interested.
                  </span>
                </li>

                <li className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-primary text-sm mt-1">
                    check_circle
                  </span>
                  <span>
                    Improve our website and AI models in order to better serve
                    you.
                  </span>
                </li>

                <li className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-primary text-sm mt-1">
                    check_circle
                  </span>
                  <span>
                    Allow us to better service you in responding to your
                    customer service requests.
                  </span>
                </li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="mb-4 text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
              <span className="text-primary font-mono text-xl">03.</span>
              AI Training &amp; Security
            </h2>

            <div className="space-y-4 text-slate-600 dark:text-slate-300">
              <p>
                Your privacy is our priority. We do not use your private
                personal data or confidential business inputs to train our
                global models without your explicit consent. All data processing
                occurs over encrypted channels.
              </p>
            </div>
          </section>

          <section className="rounded-2xl bg-primary/5 p-8 border border-primary/10">
            <h2 className="mb-4 text-xl font-bold text-slate-900 dark:text-white">
              Questions about our policy?
            </h2>

            <p className="mb-6 text-slate-600 dark:text-slate-400">
              If you have any questions regarding this privacy policy, you may
              contact our legal team directly.
            </p>

            <a
              className="inline-flex items-center gap-2 font-bold text-primary hover:underline"
              href="mailto:wordings.ai.uk@gmail.com"
            >
              wordings.ai.uk@gmail.com
              <span className="material-symbols-outlined text-sm">
                arrow_forward
              </span>
            </a>
          </section>
        </div>
      </div>
    </main>
  );
};

export default PrivacyPolicy;
