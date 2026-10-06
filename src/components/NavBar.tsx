import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import type { WithChildrenProps } from '@/types';

export const NavBar = ({ children }: WithChildrenProps) => (
  <nav
    className={cn(
      'relative w-full border-b border-slate-200 bg-linear-to-b from-[#edf3f9] to-[#dfe9f4]',
      'px-4 pt-1.5 pb-2 shadow-sm pointer-fine:pt-2.5 pointer-fine:pb-3',
    )}
  >
    {/* Relative to the title, so header buttons can center on it at any font size. */}
    <div className="relative">
      <h1
        className={cn(
          'm-0 text-center text-2xl font-medium leading-none tracking-tight text-emerald-800',
          'sm:text-3xl',
        )}
      >
        <Link className="no-underline" to="/">
          <span className="text-emerald-800">B</span>
          <span className="text-emerald-600">i</span>
          <span className="text-emerald-800">p</span>
          <span className="text-emerald-600">iu</span>
          <span className="text-emerald-800">m</span>
        </Link>
      </h1>
      {children}
    </div>
  </nav>
);
