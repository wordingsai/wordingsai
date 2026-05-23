import Link from "next/link";
import Image from "next/image";

export const Footer = () => {
  return (
    <footer className="pt-16 pb-8 border-t border-border bg-zinc-100 dark:bg-black">
      <div className="max-w-6xl mx-auto px-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 mb-16">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2 mb-6">
              <Image
                alt="Logo"
                height={32}
                priority
                src={"/logo.png"}
                width={32}
                style={{ width: "auto", height: "auto" }}
              />
              <span className="text-xl font-bold tracking-tight text-foreground">
                WordingsAI
              </span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mb-8">
              Empowering teams with AI-driven contract analysis.
            </p>
            <div className="flex gap-4">
              <Link
                className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:bg-primary hover:text-white transition-all"
                href="#"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </Link>
              <Link
                className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:bg-primary hover:text-white transition-all"
                href="#"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 4-8 4z" />
                </svg>
              </Link>
              <Link
                className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:bg-primary hover:text-white transition-all"
                href="#"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 1.366.062 2.633.332 3.608 1.308.975.975 1.245 2.242 1.308 3.608.058 1.266.07 1.646.07 4.85s-.012 3.584-.07 4.85c-.062 1.366-.332 2.633-1.308 3.608-.975.975-2.242 1.245-3.608 1.308-1.266.058-1.646.07-4.85.07s-3.584-.012-4.85-.07c-1.366-.062-2.633-.332-3.608-1.308-.975-.975-1.245-2.242-1.308-3.608-.058-1.266-.07-1.646-.07-4.85s.012-3.584.07-4.85c.062-1.366.332-2.633 1.308-3.608.975-.975 2.242-1.245 3.608-1.308 1.266-.058 1.646-.07 4.85-.07zm0-2.163c-3.259 0-3.667.014-4.947.072-1.428.066-2.404.293-3.259.623a6.45 6.45 0 0 0-2.333 1.519 6.45 6.45 0 0 0-1.519 2.333c-.33.855-.557 1.831-.623 3.259-.058 1.28-.072 1.688-.072 4.947s.014 3.667.072 4.947c.066 1.428.293 2.404.623 3.259a6.45 6.45 0 0 0 1.519 2.333 6.45 6.45 0 0 0 2.333 1.519c.855.33 1.831.557 3.259.623 1.28.058 1.688.072 4.947.072s3.667-.014 4.947-.072c1.428-.066 2.404-.293 3.259-.623a6.45 6.45 0 0 0 2.333-1.519 6.45 6.45 0 0 0 1.519-2.333c.33-.855.557-1.831.623-3.259.058-1.28.072-1.688.072-4.947s-.014-3.667-.072-4.947c-.066-1.428-.293-2.404-.623-3.259a6.45 6.45 0 0 0-1.519-2.333 6.45 6.45 0 0 0-2.333-1.519c-.855-.33-1.831-.557-3.259-.623-1.28-.058-1.688-.072-4.947-.072z" />
                  <path d="M12 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8z" />
                  <path d="M18.406 5.594a1.44 1.44 0 1 1-2.88 0 1.44 1.44 0 0 1 2.88 0z" />
                </svg>
              </Link>
              <Link
                className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:bg-primary hover:text-white transition-all"
                href="#"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M9 8h-3v4h3v12h5v-12h3.642l.358-4h-4v-2.221c0-.822.112-1.117.73-1.117h3.27v-4.662h-4.041c-3.635 0-5.959 1.642-5.959 4.756v3.244z" />
                </svg>
              </Link>
            </div>
          </div>

          <div>
            <h5 className="font-bold text-sm mb-6 text-foreground">Company</h5>
            <ul className="space-y-4">
              <li>
                <Link
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  href="/"
                >
                  Home
                </Link>
              </li>
              <li>
                <Link
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  href="/#features"
                >
                  Features
                </Link>
              </li>
              <li>
                <Link
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  href="/#how-it-works"
                >
                  How It Works
                </Link>
              </li>
              <li>
                <Link
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  href="/#pricing"
                >
                  Pricing
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h5 className="font-bold text-sm mb-6 text-foreground">Product</h5>
            <ul className="space-y-4">
              <li>
                <Link
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  href="/clause-library"
                >
                  Clause Library
                </Link>
              </li>
              <li>
                <Link
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  href="/risk-insights"
                >
                  Risk Insights
                </Link>
              </li>
              <li>
                <Link
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  href="/dashboard"
                >
                  Dashboard
                </Link>
              </li>
              <li>
                <Link
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  href="/security"
                >
                  Security
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h5 className="font-bold text-sm mb-6 text-foreground">Policies</h5>
            <ul className="space-y-4">
              <li>
                <Link
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  href="/terms-of-service"
                >
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  href="/privacy-policy"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  href="/cookie-policy"
                >
                  Cookie Policy
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center">
          <p className="text-sm text-muted-foreground">
            © 2026 WordingsAI Inc. All rights reserved.
          </p>

          <div className="flex items-center gap-4 md:gap-6">
            <Link
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
              href="/privacy-policy"
            >
              Privacy Policy
            </Link>

            <span className="hidden md:block text-border">|</span>

            <Link
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
              href="/terms-of-service"
            >
              Terms &amp; Conditions
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};
