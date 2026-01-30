'use client';

/**
 * Main Navigation Component
 * Provides navigation between Dashboard, Editor, and Rules pages
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, Edit3, Settings } from 'lucide-react';

export function Navigation() {
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + '/');

  const navItems = [
    {
      href: '/dashboard',
      label: 'Dashboard',
      icon: LayoutGrid,
      description: 'View and manage line builds',
    },
    {
      href: '/editor',
      label: 'Editor',
      icon: Edit3,
      description: 'Edit a line build',
    },
    {
      href: '/rules',
      label: 'Rules',
      icon: Settings,
      description: 'Manage validation rules',
    },
  ];

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Line Build MVP</h1>
        </div>

        <div className="flex gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors ${
                  active
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
                title={item.description}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
