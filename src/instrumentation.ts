import "dotenv/config";

if (process.env.NEXT_RUNTIME === "nodejs") {
  const polyfill = (name: string, impl: any) => {
    if (!(global as any)[name]) (global as any)[name] = impl;
    if (!(globalThis as any)[name]) (globalThis as any)[name] = impl;
  };

  polyfill(
    "DOMMatrix",
    class DOMMatrix {
      m11 = 1;
      m12 = 0;
      m13 = 0;
      m14 = 0;
      m21 = 0;
      m22 = 1;
      m23 = 0;
      m24 = 0;
      m31 = 0;
      m32 = 0;
      m33 = 1;
      m34 = 0;
      m41 = 0;
      m42 = 0;
      m43 = 0;
      m44 = 1;
      constructor() {}
    },
  );

  polyfill(
    "DOMPoint",
    class DOMPoint {
      constructor(
        public x = 0,
        public y = 0,
        public z = 0,
        public w = 1,
      ) {}
    },
  );

  polyfill(
    "DOMRect",
    class DOMRect {
      constructor(
        public x = 0,
        public y = 0,
        public width = 0,
        public height = 0,
      ) {}
    },
  );
}

export function register() {
  // Initialization logic if needed
}
