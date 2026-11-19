import type { CSSProperties } from 'react';

type CharcoalTone = 'soft' | 'balanced' | 'strong';
type CharcoalMode = 'light' | 'dark';
type CharcoalSurface =
  | 'background' | 'header' | 'sidebar-primary' | 'sidebar-secondary'
  | 'surface' | 'surface-elevated' | 'surface-muted' | 'surface-hover'
  | 'foreground' | 'muted-foreground' | 'border' | 'border-strong' | 'input';

const charcoalPalette: Record<CharcoalMode, Record<CharcoalTone, Record<CharcoalSurface, string>>> = {
  light: {
    soft: {
      background: '#e9e9e9', header: '#f3f3f3', 'sidebar-primary': '#e3e3e3', 'sidebar-secondary': '#ededed',
      surface: '#f0f0f0', 'surface-elevated': '#f5f5f5', 'surface-muted': '#e5e5e5', 'surface-hover': '#dddddd',
      foreground: '#454545', 'muted-foreground': '#707070', border: '#d4d4d4', 'border-strong': '#c5c5c5', input: '#d8d8d8',
    },
    balanced: {
      background: '#f1f1f1', header: '#fafafa', 'sidebar-primary': '#e9e9e9', 'sidebar-secondary': '#f5f5f5',
      surface: '#f7f7f7', 'surface-elevated': '#fcfcfc', 'surface-muted': '#ebebeb', 'surface-hover': '#e3e3e3',
      foreground: '#454545', 'muted-foreground': '#707070', border: '#dddddd', 'border-strong': '#cfcfcf', input: '#dddddd',
    },
    strong: {
      background: '#f7f7f7', header: '#ffffff', 'sidebar-primary': '#efefef', 'sidebar-secondary': '#fafafa',
      surface: '#ffffff', 'surface-elevated': '#ffffff', 'surface-muted': '#eeeeee', 'surface-hover': '#e5e5e5',
      foreground: '#404040', 'muted-foreground': '#686868', border: '#dedede', 'border-strong': '#c9c9c9', input: '#d9d9d9',
    },
  },
  dark: {
    soft: {
      background: '#222426', header: '#2b2d2f', 'sidebar-primary': '#27292b', 'sidebar-secondary': '#242628',
      surface: '#292b2d', 'surface-elevated': '#303234', 'surface-muted': '#2d2f31', 'surface-hover': '#383a3c',
      foreground: '#c4c6c8', 'muted-foreground': '#96999c', border: '#3b3e40', 'border-strong': '#505356', input: '#3a3d3f',
    },
    balanced: {
      background: '#171819', header: '#222426', 'sidebar-primary': '#1d1f21', 'sidebar-secondary': '#191b1d',
      surface: '#1c1e20', 'surface-elevated': '#252729', 'surface-muted': '#202224', 'surface-hover': '#303234',
      foreground: '#c4c6c8', 'muted-foreground': '#929598', border: '#303234', 'border-strong': '#45484a', input: '#343638',
    },
    strong: {
      background: '#111213', header: '#1d1f21', 'sidebar-primary': '#181a1c', 'sidebar-secondary': '#141516',
      surface: '#17191b', 'surface-elevated': '#202224', 'surface-muted': '#1b1d1f', 'surface-hover': '#2a2c2e',
      foreground: '#c8cacc', 'muted-foreground': '#96999b', border: '#2b2d2f', 'border-strong': '#404345', input: '#303234',
    },
  },
};

/** Shared charcoal palette. CSS selects the active light/dark and brightness values. */
export function getCharcoalShellStyle(): CSSProperties {
  const variables: Record<string, string> = {};

  for (const mode of Object.keys(charcoalPalette) as CharcoalMode[]) {
    for (const tone of Object.keys(charcoalPalette[mode]) as CharcoalTone[]) {
      const palette = charcoalPalette[mode][tone];
      for (const surface of Object.keys(palette) as CharcoalSurface[]) {
        variables[`--charcoal-${mode}-${tone}-${surface}`] = palette[surface];
      }
    }
  }

  return variables as CSSProperties;
}
