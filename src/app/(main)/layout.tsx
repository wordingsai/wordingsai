import { Inter } from "next/font/google";
import "@/app/global.css";
import Navigation from "@/components/common/navigation";
import { Footer } from "@/components/common/footer";

const inter = Inter({
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <Navigation />
      {children}
      <Footer />
    </>
  );
}
