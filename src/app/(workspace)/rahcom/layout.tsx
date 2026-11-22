import type { ReactNode } from 'react';
import { RahcomProvinceGate } from './_shared/rahcom-province-gate';

export default function RahcomLayout({ children }: { children: ReactNode }) {
  return <RahcomProvinceGate>{children}</RahcomProvinceGate>;
}
