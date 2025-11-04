'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Phone, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from '@/components/ui/navigation-menu';
import { cn } from '@/lib/utils';

export function Navigation() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const pathname = usePathname();

  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;

          // Add background when scrolled past 20px
          setIsScrolled(currentScrollY > 20);

          // Hide on scroll down, show on scroll up
          if (currentScrollY > lastScrollY && currentScrollY > 100) {
            setIsVisible(false);
          } else {
            setIsVisible(true);
          }

          setLastScrollY(currentScrollY);
          ticking = false;
        });

        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  const services = [
    { name: 'Residential Carpet Cleaning', href: '/services/carpet-cleaning' },
    { name: 'Commercial Carpet Cleaning', href: '/services/commercial' },
    { name: 'Tile & Grout Cleaning', href: '/services/tile-grout' },
    { name: 'Upholstery Cleaning', href: '/services/upholstery' },
    { name: 'Pet Stain & Odor Removal', href: '/services/pet-stain-removal' },
    { name: 'Water Damage Restoration', href: '/services/water-damage' },
    { name: 'Air Duct Cleaning', href: '/services/air-duct' },
    { name: 'Area Rug Cleaning', href: '/services/area-rug' },
  ];

  const serviceAreas = [
    { name: 'Houston', href: '/service-areas/houston' },
    { name: 'Katy', href: '/service-areas/katy' },
    { name: 'Sugar Land', href: '/service-areas/sugar-land' },
    { name: 'Cypress', href: '/service-areas/cypress' },
    { name: 'The Woodlands', href: '/service-areas/the-woodlands' },
    { name: 'Pearland', href: '/service-areas/pearland' },
    { name: 'Spring', href: '/service-areas/spring' },
    { name: 'Tomball', href: '/service-areas/tomball' },
  ];

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        isScrolled
          ? 'bg-white/95 backdrop-blur-md shadow-md'
          : 'bg-white',
        isVisible
          ? 'translate-y-0'
          : '-translate-y-full'
      )}
    >
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <Link
            href="/"
            className="text-2xl font-bold text-blue-600 hover:text-blue-700 transition-colors"
          >
            Dirt Free Carpet
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <NavigationMenu>
              <NavigationMenuList className="gap-2">

                {/* Home */}
                <NavigationMenuItem>
                  <Link href="/" legacyBehavior passHref>
                    <NavigationMenuLink
                      className={cn(
                        'text-gray-700 hover:text-blue-600 font-medium transition-colors px-3 py-2 text-sm',
                        pathname === '/' && 'text-blue-600'
                      )}
                    >
                      Home
                    </NavigationMenuLink>
                  </Link>
                </NavigationMenuItem>

                {/* Services Dropdown */}
                <NavigationMenuItem>
                  <NavigationMenuTrigger className="text-gray-700 hover:text-blue-600 font-medium">
                    Services
                  </NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <ul className="grid w-[400px] gap-1 p-4 md:w-[500px] md:grid-cols-2">
                      {services.map((service) => (
                        <li key={service.href}>
                          <NavigationMenuLink asChild>
                            <Link
                              href={service.href}
                              className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-blue-50 hover:text-blue-600 focus:bg-blue-50"
                            >
                              <div className="text-sm font-medium leading-none">
                                {service.name}
                              </div>
                            </Link>
                          </NavigationMenuLink>
                        </li>
                      ))}
                    </ul>
                  </NavigationMenuContent>
                </NavigationMenuItem>

                {/* Service Areas Dropdown */}
                <NavigationMenuItem>
                  <NavigationMenuTrigger className="text-gray-700 hover:text-blue-600 font-medium">
                    Service Areas
                  </NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <ul className="grid w-[400px] gap-1 p-4 md:w-[500px] md:grid-cols-2">
                      {serviceAreas.map((area) => (
                        <li key={area.href}>
                          <NavigationMenuLink asChild>
                            <Link
                              href={area.href}
                              className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-blue-50 hover:text-blue-600 focus:bg-blue-50"
                            >
                              <div className="text-sm font-medium leading-none">
                                {area.name}
                              </div>
                            </Link>
                          </NavigationMenuLink>
                        </li>
                      ))}
                      <li className="col-span-2">
                        <NavigationMenuLink asChild>
                          <Link
                            href="/service-areas"
                            className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors bg-blue-50 text-blue-600 hover:bg-blue-100 font-semibold text-center"
                          >
                            View All Service Areas →
                          </Link>
                        </NavigationMenuLink>
                      </li>
                    </ul>
                  </NavigationMenuContent>
                </NavigationMenuItem>

                {/* About */}
                <NavigationMenuItem>
                  <Link href="/about" legacyBehavior passHref>
                    <NavigationMenuLink
                      className={cn(
                        'text-gray-700 hover:text-blue-600 font-medium transition-colors px-3 py-2 text-sm',
                        pathname === '/about' && 'text-blue-600'
                      )}
                    >
                      About
                    </NavigationMenuLink>
                  </Link>
                </NavigationMenuItem>

                {/* Reviews */}
                <NavigationMenuItem>
                  <Link href="/reviews" legacyBehavior passHref>
                    <NavigationMenuLink
                      className={cn(
                        'text-gray-700 hover:text-blue-600 font-medium transition-colors px-3 py-2 text-sm',
                        pathname === '/reviews' && 'text-blue-600'
                      )}
                    >
                      Reviews
                    </NavigationMenuLink>
                  </Link>
                </NavigationMenuItem>

                {/* Contact */}
                <NavigationMenuItem>
                  <Link href="/contact" legacyBehavior passHref>
                    <NavigationMenuLink
                      className={cn(
                        'text-gray-700 hover:text-blue-600 font-medium transition-colors px-3 py-2 text-sm',
                        pathname === '/contact' && 'text-blue-600'
                      )}
                    >
                      Contact
                    </NavigationMenuLink>
                  </Link>
                </NavigationMenuItem>

              </NavigationMenuList>
            </NavigationMenu>
          </div>

          {/* Right Side: Phone + CTA */}
          <div className="hidden md:flex items-center gap-4">
            <a
              href="tel:7137302782"
              className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold transition-colors"
            >
              <Phone className="w-4 h-4" />
              <span className="text-sm">(713) 730-2782</span>
            </a>
            <Button
              asChild
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Link href="/quote">Get Free Quote</Link>
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button className="md:hidden p-2 text-gray-700">
            {/* Add mobile menu icon */}
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

        </div>
      </nav>
    </header>
  );
}
