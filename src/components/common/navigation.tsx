"use client";

import { useState } from "react";
import {
  Navbar,
  NavBody,
  NavItems,
  MobileNav,
  MobileNavHeader,
  MobileNavMenu,
  MobileNavToggle,
  NavbarLogo,
} from "@/components/common/navbar";
import Link from "next/link";
import { HoverBorderGradient } from "../ui/hover-border-gradient";
import { ThemeButton } from "../theme-button";

const Navigation = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = [
    { name: "Home", link: "/" },
    { name: "Sandbox Demo", link: "/demo" },
    { name: "Features", link: "/#feature" },
    { name: "Pricing", link: "/#pricing" },
  ];

  const handleNavClick = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="relative overflow-hidden bg-background mb-8">
      <Navbar>
        <NavBody>
          <NavbarLogo />
          <NavItems items={navItems} onItemClick={handleNavClick} />

          <div className="relative z-20 flex items-center gap-3">
            <ThemeButton />

            <HoverBorderGradient
              containerClassName="rounded-full"
              as="button"
              className="bg-primary text-primary-foreground px-8 py-3 flex items-center space-x-2"
            >
              <Link href="/login">
                <span>Login</span>
              </Link>
            </HoverBorderGradient>
          </div>
        </NavBody>

        <MobileNav>
          <MobileNavHeader>
            <NavbarLogo />
            <div className="flex items-center gap-3">
              <ThemeButton />
              <MobileNavToggle
                isOpen={isMobileMenuOpen}
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              />
            </div>
          </MobileNavHeader>

          <MobileNavMenu
            isOpen={isMobileMenuOpen}
            onClose={() => setIsMobileMenuOpen(false)}
            className="bg-background border-t border-border"
          >
            {navItems.map((item, idx) => (
              <Link
                key={idx}
                href={item.link}
                onClick={handleNavClick}
                className="text-foreground hover:text-primary transition-colors text-lg font-medium"
              >
                {item.name}
              </Link>
            ))}

            <div className="flex flex-col gap-3 w-full mt-4">
              <HoverBorderGradient
                containerClassName="rounded-full"
                as="button"
                className="bg-primary text-primary-foreground hover:bg-primary/90 transition-all flex items-center space-x-2 px-8 py-4"
              >
                <Link href="/login">
                  <span>Login</span>
                </Link>
              </HoverBorderGradient>
            </div>
          </MobileNavMenu>
        </MobileNav>
      </Navbar>
    </div>
  );
};

export default Navigation;
