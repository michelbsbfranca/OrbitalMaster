
import { BodyType } from './types';

export const G = 1.0; 
export const MAX_HISTORY = 1500; 
export const SUBSTEPS = 12;

export const BODY_CONFIGS = {
  [BodyType.BLACK_HOLE]: {
    mass: 1000000,
    radius: 15,
    color: '#7c3aed', 
    label: 'Buraco Negro'
  },
  [BodyType.STAR]: {
    mass: 200000,
    radius: 60,
    color: '#fcd34d', 
    label: 'Sol'
  },
  [BodyType.GAS_GIANT]: {
    mass: 15000,
    radius: 35,
    color: '#fb923c', 
    label: 'Júpiter'
  },
  [BodyType.ROCKY_PLANET]: {
    mass: 1200,
    radius: 14,
    color: '#60a5fa', 
    label: 'Terra'
  },
  [BodyType.MOON]: {
    mass: 15,
    radius: 6,
    color: '#94a3b8', 
    label: 'Lua'
  },
  [BodyType.SATELLITE]: {
    mass: 0.1,
    radius: 4,
    color: '#4ade80', 
    label: 'Satélite'
  },
  [BodyType.ROCKET]: {
    mass: 0.05,
    radius: 3,
    color: '#ef4444', 
    label: 'Foguete'
  }
};

// Extensão com dados específicos para o seletor rápido
export const SOLAR_SYSTEM = [
  { name: 'Mercúrio', type: BodyType.ROCKY_PLANET, mass: 200, radius: 7, color: '#9ca3af' },
  { name: 'Vênus', type: BodyType.ROCKY_PLANET, mass: 1000, radius: 13, color: '#fbbf24' },
  { name: 'Terra', type: BodyType.ROCKY_PLANET, mass: 1200, radius: 14, color: '#3b82f6' },
  { name: 'Marte', type: BodyType.ROCKY_PLANET, mass: 350, radius: 10, color: '#ef4444' },
  { name: 'Júpiter', type: BodyType.GAS_GIANT, mass: 18000, radius: 40, color: '#f59e0b' },
  { name: 'Saturno', type: BodyType.GAS_GIANT, mass: 15000, radius: 35, color: '#eab308' },
  { name: 'Urano', type: BodyType.GAS_GIANT, mass: 6000, radius: 25, color: '#7dd3fc' },
  { name: 'Netuno', type: BodyType.GAS_GIANT, mass: 6500, radius: 24, color: '#3b82f6' }
];
