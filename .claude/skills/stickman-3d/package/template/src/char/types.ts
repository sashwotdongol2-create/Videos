export type Vec3 = [number, number, number];

export type Ease = 'inout' | 'in' | 'out' | 'linear' | 'hold';

export interface CameraKey {
  frame: number;
  pos: Vec3;
  look: Vec3;
  fov?: number;
  /** easing used to travel from the previous key to this one */
  ease?: Ease;
}

export type LightPreset =
  | 'day'
  | 'goldenHour'
  | 'sunset'
  | 'dusk'
  | 'night'
  | 'interiorWarm'
  | 'interiorCool';

export interface Shot {
  id: string;
  start: number; // frame, inclusive
  end: number; // frame, exclusive
  /** true = hard cut into this shot; false/undefined = camera travels from previous shot's last key */
  cut?: boolean;
  keys: CameraKey[];
  light: LightPreset;
  /** optional focus distance override (metres) for the DoF; default = distance to `look` */
  focus?: number;
}

export type Expression =
  | 'neutral' | 'happy' | 'grin' | 'laugh' | 'sad' | 'angry' | 'shocked' | 'worried'
  | 'smug' | 'sleepy' | 'confused' | 'scared' | 'evil' | 'whistle';

export type Pose =
  | 'stand' | 'walk' | 'run' | 'sit' | 'lie' | 'pointR' | 'pointL' | 'armsUp' | 'wave' | 'hold' | 'crouch' | 'dead' | 'rig';

export type Hat =
  | 'none' | 'bowler' | 'cap' | 'tophat' | 'helmet' | 'bonnet' | 'chef' | 'pirate' | 'crown' | 'headband' | 'beanie' | 'cowboy' | 'police' | 'nightcap' | 'officer' | 'veil' | 'fieldcap';

export interface OutfitSpec {
  /** CSS colour of the torso garment */
  torso: string;
  /** CSS colour of legs/trousers */
  legs: string;
  /** a hat, optionally with a hand-picked colour: "cap #c58a3a" */
  hat?: Hat | `${Hat} ${string}`;
  /** CSS colour for hair (drawn as a cap of hair on the head); omit for bald */
  hair?: string;
  /** 'glasses' | 'moustache' | 'beard' | 'tie' | 'bowtie' | 'apron' | 'badge' | 'scarf' */
  accessory?: string;
  /** a full role costume painted on the torso (drawCostume): 'banker' | 'clerk' | 'guard'; overrides the pattern.
   *  New roles get a new drawCostume branch (BUILD_LESSONS #28: >= 5 layered, ink-outlined pieces) */
  costume?: string;
  /** held prop id, e.g. 'shovel' | 'lantern' | 'mirror' | 'ticket' | 'bag' | 'sword' | 'phone' | 'cup' | 'book' | 'bell' */
  prop?: string;
}

export interface CharacterSpec {
  id: string;
  /** head colour, default near-white #f7f3ea */
  skin?: string;
  outfit: OutfitSpec;
  /** total height in metres, default 1.7 */
  height?: number;
  /** seed id for the seeded look (head wobble, defaults): a costume variant (hero_band) keeps the base id's head */
  seed?: string;
}

export interface CharacterState {
  at: Vec3;
  /** 1 faces +x (screen right when camera looks down -z), -1 faces -x */
  facing: 1 | -1;
  expr: Expression;
  pose: Pose;
  scale?: number;
  /** 0..1, drives mouth for talking; characters are silent most of the time */
  mouthOpen?: number;
  /** 0..1 blend of eye-blink (1 = closed). Use the helper `blinkAt(frame, seed)` */
  blink?: number;
}

export interface WordTiming {
  w: string;
  s: number; // seconds
  e: number;
}
