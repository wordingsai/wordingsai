import type { Metadata } from "next";
import { HeroSection } from "@/components/home/hero-section";

export const metadata: Metadata = {
  title: "Home",
};
import { FeaturesSection } from "@/components/home/features-section";
import { HowItWorksSection } from "@/components/home/how-it-works-section";
import { DashboardSection } from "@/components/home/dashboard-section";
import { PricingSection } from "@/components/home/pricing-section";

export default function Home() {
  return (
    <>
      <HeroSection />
      <FeaturesSection />
      <HowItWorksSection />
      <DashboardSection />
      <PricingSection />
    </>
  );
}
