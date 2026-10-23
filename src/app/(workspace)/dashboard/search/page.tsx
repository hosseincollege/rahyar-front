import { Suspense } from 'react';
import { SystemSearchPage } from './system-search';

export default function SearchPage() {
  return <Suspense fallback={<div className="min-h-40" aria-hidden="true" />}><SystemSearchPage /></Suspense>;
}
