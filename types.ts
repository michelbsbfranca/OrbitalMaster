
export enum BodyType {
  BLACK_HOLE = 'BLACK_HOLE',
  STAR = 'STAR',
  GAS_GIANT = 'GAS_GIANT',
  ROCKY_PLANET = 'ROCKY_PLANET',
  MOON = 'MOON',
  SATELLITE = 'SATELLITE',
  ROCKET = 'ROCKET'
}

export interface Vector2 {
  x: number;
  y: number;
}

export interface SpaceBody {
  id: string;
  name: string;
  type: BodyType;
  pos: Vector2;
  vel: Vector2;
  mass: number;
  radius: number;
  color: string;
  history: Vector2[];
  trackingTargetId?: string; 
  orbitTargetId?: string; // Alvo do piloto automático para órbita
  isAutoOrbiting?: boolean;
}

export interface GameState {
  bodies: SpaceBody[];
  zoom: number;
  offset: Vector2;
  paused: boolean;
  timeScale: number;
  selectedType: BodyType;
}
