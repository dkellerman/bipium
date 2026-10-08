import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';
import type { WithChildrenProps } from '@/types';

export const NavBar = ({ children, edge }: WithChildrenProps & { edge?: ReactNode }) => (
  <nav
    data-navbar
    className={cn(
      'relative w-full border-b border-slate-200 bg-linear-to-b from-[#edf3f9] to-[#dfe9f4]',
      'dark:border-slate-800 dark:from-[#1b2638] dark:to-[#141e2e]',
      'px-4 pt-1.5 pb-1.5 shadow-sm pointer-fine:pt-2.5 pointer-fine:pb-3',
    )}
  >
    {/* Relative to the title, so header buttons can center on it at any font size. */}
    <div className="relative">
      <h1 className={cn('m-0 text-center text-2xl leading-none', 'sm:text-3xl')}>
        {/* The drawn logo (public/logo.svg), sized like the title text it replaces. */}
        <Link className="inline-block align-top no-underline" to="/">
          <img
            src="/logo.svg"
            alt="Bipium"
            className="-my-[0.06em] block h-[1.12em] w-auto dark:hidden"
          />
          <img
            src="/logo-dark.svg"
            alt="Bipium"
            className="-my-[0.06em] hidden h-[1.12em] w-auto dark:block"
          />
        </Link>
      </h1>
      {children}
    </div>
    {edge}
  </nav>
);
