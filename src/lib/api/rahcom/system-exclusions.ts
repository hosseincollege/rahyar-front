const isfahanExcludedSystemCodes = new Set(['065P63087']);

export function isExcludedIsfahanSystemCode(systemCode: string, province?: string | null) {
  return province?.toLowerCase() === 'isfahan'
    && isfahanExcludedSystemCodes.has(systemCode.normalize('NFKC').trim().toUpperCase());
}

export function filterExcludedIsfahanSystems<T extends { systemCode: string; province: string }>(systems: T[]) {
  return systems.filter((system) => !isExcludedIsfahanSystemCode(system.systemCode, system.province));
}
