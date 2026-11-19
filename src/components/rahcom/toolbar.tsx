import { createElement, type ComponentPropsWithoutRef } from 'react';

type RahcomToolbarProps = ComponentPropsWithoutRef<'div'> & {
  as?: 'div' | 'header';
};

/** Shared toolbar entry point; sizing and label rules live in the global theme styles. */
export function RahcomToolbar({ as = 'div', className = '', ...props }: RahcomToolbarProps) {
  return createElement(as, {
    ...props,
    className: ['rahcom-toolbar', 'rahcom-page-toolbar', className.trim()].filter(Boolean).join(' '),
  });
}
