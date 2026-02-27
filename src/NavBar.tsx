import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from './lib/utils';
import type { WithChildrenProps } from './types';

export const NavBar = ({ children }: WithChildrenProps) => (
  <nav
    className={cn(
      'relative w-full border-b border-slate-200 bg-gradient-to-b from-[#edf3f9] to-[#dfe9f4]',
      'px-4 pt-1.5 pb-2 shadow-sm',
    )}
  >
    <h1
      className={cn(
        'm-0 text-center text-[1.55rem] font-medium leading-none tracking-tight text-emerald-700',
        'sm:text-[1.65rem]',
      )}
    >
      <Link className="no-underline" to="/">
        <span className="text-emerald-800">B</span>
        <span className="text-emerald-700">i</span>
        <span className="text-emerald-800">p</span>
        <span className="text-emerald-700">iu</span>
        <span className="text-emerald-800">m</span>
      </Link>
    </h1>
    {children}
  </nav>
);
