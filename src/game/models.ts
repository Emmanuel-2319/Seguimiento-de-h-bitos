import * as THREE from 'three';
import type { MaterialRegistry } from './materials';

export const ARENA_RADIUS = 16.2;

export function groundHeightAt(x: number, z: number): number {
  const r = Math.hypot(x, z);
  if (r <= 3.4) return 0.14;
  if (r <= 3.9) return THREE.MathUtils.lerp(0.14, 0, (r - 3.4) / 0.5);
  return 0;
}

export interface TargetSignTarget {
  group: THREE.Group;
  headPivot: THREE.Group;
  x: number;
  z: number;
  cooldown: number;
  wobble: number;
}

export type SwordStyle = 'volt' | 'celeste' | 'solar';

export interface HeroRig {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  scarfLeft: THREE.Mesh;
  scarfRight: THREE.Mesh;
  swordPivot: THREE.Group;
  slashArc: THREE.Mesh;
  shieldRings: THREE.Mesh[];
  auraRing: THREE.Mesh;
  visionOrb: THREE.Mesh;
  setSwordStyle: (style: SwordStyle) => void;
}

export type SeelieSkin = 'celeste' | 'dorado' | 'amatista';

export interface SeelieRig {
  root: THREE.Group;
  wingLeft: THREE.Mesh;
  wingRight: THREE.Mesh;
  halo: THREE.Mesh;
  setSkin: (skin: SeelieSkin) => void;
}

export interface SanctuaryWorldRefs {
  group: THREE.Group;
  lanterns: THREE.Mesh[];
  floatingClouds: THREE.Group[];
  grassMesh: THREE.InstancedMesh;
  targetSigns: TargetSignTarget[];
  shrineCrystal: THREE.Mesh;
  shrineRing: THREE.Mesh;
  shrinePos: { x: number; z: number };
  disposeGeometries: () => void;
}

export interface HabitShardRig {
  root: THREE.Group;
  crystal: THREE.Mesh;
  outerRing: THREE.Mesh;
  innerRing: THREE.Mesh;
  labelSprite: THREE.Sprite;
  dispose: () => void;
}

export interface BoostOrbRig {
  root: THREE.Group;
  core: THREE.Mesh;
  ring: THREE.Mesh;
  labelSprite: THREE.Sprite;
  dispose: () => void;
}

export interface DistractionSpecterRig {
  root: THREE.Group;
  body: THREE.Group;
  shards: THREE.Mesh[];
  telegraphRing: THREE.Mesh;
  labelSprite: THREE.Sprite;
  dispose: () => void;
}

export interface BossSpecterRig {
  root: THREE.Group;
  body: THREE.Group;
  haloRing: THREE.Mesh;
  shards: THREE.Mesh[];
  telegraphRing: THREE.Mesh;
  labelSprite: THREE.Sprite;
  dispose: () => void;
}

export interface DrainSpecterRig {
  root: THREE.Group;
  body: THREE.Group;
  orbitRing: THREE.Mesh;
  drainAura: THREE.Mesh;
  labelSprite: THREE.Sprite;
  update: (elapsed: number) => void;
  dispose: () => void;
}

const CATEGORY_COLORS: Record<string, { hex: string; three: number; emissive: number }> = {
  salud: { hex: '#d8f23a', three: 0xd8f23a, emissive: 0x7cb518 },
  estudio: { hex: '#0ea5e9', three: 0x38bdf8, emissive: 0x0284c7 },
  trabajo: { hex: '#f59e0b', three: 0xfbbf24, emissive: 0xd97706 },
  personal: { hex: '#a855f7', three: 0xc084fc, emissive: 0x9333ea },
  grace: { hex: '#facc15', three: 0xfacc15, emissive: 0xeab308 },
};

export function getCategoryColor(category: string, isGraceBonus: boolean) {
  if (isGraceBonus) return CATEGORY_COLORS.grace;
  return CATEGORY_COLORS[category] || CATEGORY_COLORS.salud;
}

/**
 * Composite 12+ part Hero Traveler ("El Viajero de Racha")
 * Grounded with bottom-center pivot at y = 0 + Slash Crescent Arc.
 */
export function createHeroTraveler(mats: MaterialRegistry): {
  rig: HeroRig;
  dispose: () => void;
} {
  const geos: THREE.BufferGeometry[] = [];
  const localMats: THREE.Material[] = [];
  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geos.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    localMats.push(m);
    return m;
  };

  const cloakMat = trackMat(
    new THREE.MeshToonMaterial({
      color: 0x1e293b,
      gradientMap: mats.toonGradient,
    })
  );
  const tunicWhiteMat = trackMat(
    new THREE.MeshToonMaterial({
      color: 0xdce4ee,
      gradientMap: mats.toonGradient,
    })
  );
  const hairMat = trackMat(
    new THREE.MeshToonMaterial({
      color: 0xe8bd4c,
      gradientMap: mats.toonGradient,
    })
  );
  const skinMat = trackMat(
    new THREE.MeshToonMaterial({
      color: 0xfde2cc,
      gradientMap: mats.toonGradient,
    })
  );
  const scarfMat = trackMat(
    new THREE.MeshToonMaterial({
      color: 0xd8f23a,
      emissive: 0x45580a,
      emissiveIntensity: 0.35,
      gradientMap: mats.toonGradient,
      side: THREE.DoubleSide,
    })
  );
  const bladeGlowMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xd8f23a,
      emissive: 0x65a30d,
      emissiveIntensity: 0.5,
      roughness: 0.22,
      metalness: 0.35,
    })
  );

  const root = new THREE.Group();
  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  const makeLeg = (xOffset: number) => {
    const legGroup = new THREE.Group();
    legGroup.position.set(xOffset, 0.72, 0);

    const thigh = new THREE.Mesh(
      trackGeo(new THREE.CapsuleGeometry(0.11, 0.34, 4, 10)),
      cloakMat
    );
    thigh.position.y = -0.22;
    thigh.castShadow = true;
    legGroup.add(thigh);

    const boot = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.11, 0.13, 0.34, 10)),
      mats.woodMaterial
    );
    boot.position.y = -0.53;
    boot.castShadow = true;
    legGroup.add(boot);

    const bootCuff = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(0.115, 0.025, 8, 16)),
      mats.goldMaterial
    );
    bootCuff.rotation.x = Math.PI / 2;
    bootCuff.position.y = -0.37;
    legGroup.add(bootCuff);

    bodyPivot.add(legGroup);
    return legGroup;
  };

  const leftLeg = makeLeg(-0.16);
  const rightLeg = makeLeg(0.16);

  const torso = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.24, 0.28, 0.62, 12)),
    tunicWhiteMat
  );
  torso.position.y = 1.05;
  torso.castShadow = true;
  bodyPivot.add(torso);

  const chestVest = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.26, 0.22, 0.44, 12)),
    cloakMat
  );
  chestVest.position.y = 1.12;
  chestVest.castShadow = true;
  bodyPivot.add(chestVest);

  const belt = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(0.27, 0.035, 8, 20)),
    mats.goldMaterial
  );
  belt.rotation.x = Math.PI / 2;
  belt.position.y = 0.82;
  bodyPivot.add(belt);

  const skirt = new THREE.Mesh(
    trackGeo(
      new THREE.CylinderGeometry(0.26, 0.42, 0.46, 12, 1, true, 0.4, Math.PI * 1.55)
    ),
    cloakMat
  );
  skirt.position.y = 0.64;
  skirt.rotation.y = 0.7;
  skirt.castShadow = true;
  bodyPivot.add(skirt);

  for (const side of [-1, 1]) {
    const pauldron = new THREE.Mesh(
      trackGeo(
        new THREE.SphereGeometry(0.14, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.6)
      ),
      mats.goldMaterial
    );
    pauldron.position.set(side * 0.31, 1.33, 0);
    pauldron.rotation.z = side * -0.45;
    bodyPivot.add(pauldron);
  }

  const scarfCollar = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(0.22, 0.05, 8, 18)),
    scarfMat
  );
  scarfCollar.rotation.x = Math.PI / 2;
  scarfCollar.position.y = 1.38;
  bodyPivot.add(scarfCollar);

  const scarfGeo = trackGeo(new THREE.BoxGeometry(0.14, 0.76, 0.03));
  scarfGeo.translate(0, -0.36, 0);
  const scarfLeft = new THREE.Mesh(scarfGeo, scarfMat);
  scarfLeft.position.set(-0.14, 1.35, -0.22);
  scarfLeft.rotation.x = 0.35;
  scarfLeft.rotation.z = -0.15;
  bodyPivot.add(scarfLeft);

  const scarfRight = new THREE.Mesh(scarfGeo, scarfMat);
  scarfRight.position.set(0.14, 1.35, -0.22);
  scarfRight.rotation.x = 0.35;
  scarfRight.rotation.z = 0.15;
  bodyPivot.add(scarfRight);

  const visionFrame = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(0.12, 0.025, 8, 16)),
    mats.goldMaterial
  );
  visionFrame.position.set(0, 1.12, -0.27);
  bodyPivot.add(visionFrame);

  const visionOrb = new THREE.Mesh(
    trackGeo(new THREE.OctahedronGeometry(0.085, 0)),
    bladeGlowMat
  );
  visionOrb.position.set(0, 1.12, -0.27);
  bodyPivot.add(visionOrb);

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.62, 0);
  bodyPivot.add(headGroup);

  const head = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.22, 16, 14)),
    skinMat
  );
  head.castShadow = true;
  headGroup.add(head);

  const hairCap = new THREE.Mesh(
    trackGeo(
      new THREE.SphereGeometry(0.242, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62)
    ),
    hairMat
  );
  hairCap.rotation.x = -0.22;
  headGroup.add(hairCap);

  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const spike = new THREE.Mesh(
      trackGeo(new THREE.ConeGeometry(0.075, 0.28, 5)),
      hairMat
    );
    spike.position.set(Math.sin(a) * 0.19, 0.04, Math.cos(a) * 0.19);
    spike.rotation.z = -Math.sin(a) * 0.9;
    spike.rotation.x = Math.cos(a) * 0.9;
    headGroup.add(spike);
  }

  const ponytail = new THREE.Mesh(
    trackGeo(new THREE.ConeGeometry(0.09, 0.56, 7)),
    hairMat
  );
  ponytail.position.set(0, -0.14, -0.26);
  ponytail.rotation.x = 0.55;
  headGroup.add(ponytail);

  const crownCirclet = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(0.23, 0.018, 6, 20)),
    mats.goldMaterial
  );
  crownCirclet.rotation.x = Math.PI / 2 - 0.15;
  crownCirclet.position.y = 0.09;
  headGroup.add(crownCirclet);

  const eyeMat = trackMat(new THREE.MeshBasicMaterial({ color: 0x0f172a }));
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.032, 8, 8)),
      eyeMat
    );
    eye.scale.set(0.85, 1.3, 0.5);
    eye.position.set(side * 0.085, -0.02, 0.2);
    headGroup.add(eye);
  }

  const makeArm = (side: -1 | 1) => {
    const arm = new THREE.Group();
    arm.position.set(side * 0.31, 1.28, 0);
    const sleeve = new THREE.Mesh(
      trackGeo(new THREE.CapsuleGeometry(0.075, 0.34, 4, 8)),
      tunicWhiteMat
    );
    sleeve.position.y = -0.2;
    sleeve.castShadow = true;
    arm.add(sleeve);

    const gauntlet = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.072, 0.065, 0.18, 8)),
      mats.goldMaterial
    );
    gauntlet.position.y = -0.38;
    arm.add(gauntlet);

    bodyPivot.add(arm);
    return arm;
  };

  const leftArm = makeArm(-1);
  const rightArm = makeArm(1);

  const swordPivot = new THREE.Group();
  swordPivot.position.set(0, -0.45, 0.08);
  swordPivot.rotation.x = Math.PI * 0.42;
  rightArm.add(swordPivot);

  const hilt = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.025, 0.025, 0.24, 8)),
    cloakMat
  );
  swordPivot.add(hilt);

  const crossguard = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.24, 0.04, 0.06)),
    mats.goldMaterial
  );
  crossguard.position.y = 0.12;
  swordPivot.add(crossguard);

  const blade = new THREE.Mesh(
    trackGeo(new THREE.ConeGeometry(0.055, 1.0, 4)),
    bladeGlowMat
  );
  blade.scale.set(1.0, 1.0, 0.3);
  blade.position.y = 0.64;
  swordPivot.add(blade);

  // Crescent Sword Slash Arc VFX (attached to hero root)
  const slashMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0xd8f23a,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  const slashArc = new THREE.Mesh(
    trackGeo(new THREE.RingGeometry(1.05, 2.35, 28, 1, -Math.PI * 0.45, Math.PI * 0.9)),
    slashMat
  );
  slashArc.rotation.x = -Math.PI / 2;
  slashArc.position.set(0, 1.02, 0.35);
  slashArc.visible = false;
  root.add(slashArc);

  const shieldRings: THREE.Mesh[] = [];
  const shieldRingMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xeab308,
      emissiveIntensity: 0.75,
      roughness: 0.2,
      metalness: 0.7,
      transparent: true,
      opacity: 0.85,
    })
  );
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(0.88 + i * 0.11, 0.024, 6, 32)),
      shieldRingMat
    );
    ring.position.y = 0.95;
    ring.rotation.x = Math.PI / 2 + (i - 1) * 0.22;
    ring.rotation.y = i * 0.7;
    root.add(ring);
    shieldRings.push(ring);
  }

  const contactShadowMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0x091018,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    })
  );
  const heroShadow = new THREE.Mesh(
    trackGeo(new THREE.CircleGeometry(0.58, 20)),
    contactShadowMat
  );
  heroShadow.rotation.x = -Math.PI / 2;
  heroShadow.position.y = 0.025;
  root.add(heroShadow);

  const auraMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0xd8f23a,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    })
  );
  const auraRing = new THREE.Mesh(
    trackGeo(new THREE.RingGeometry(0.68, 0.82, 32)),
    auraMat
  );
  auraRing.rotation.x = -Math.PI / 2;
  auraRing.position.y = 0.035;
  root.add(auraRing);

  const setSwordStyle = (style: SwordStyle) => {
    if (style === 'celeste') {
      scarfMat.color.setHex(0x38bdf8);
      scarfMat.emissive.setHex(0x0369a1);
      bladeGlowMat.color.setHex(0x38bdf8);
      bladeGlowMat.emissive.setHex(0x0284c7);
      slashMat.color.setHex(0x7dd3fc);
      auraMat.color.setHex(0x38bdf8);
    } else if (style === 'solar') {
      scarfMat.color.setHex(0xfacc15);
      scarfMat.emissive.setHex(0xa16207);
      bladeGlowMat.color.setHex(0xfbbf24);
      bladeGlowMat.emissive.setHex(0xd97706);
      slashMat.color.setHex(0xfde047);
      auraMat.color.setHex(0xfacc15);
    } else {
      scarfMat.color.setHex(0xd8f23a);
      scarfMat.emissive.setHex(0x45580a);
      bladeGlowMat.color.setHex(0xd8f23a);
      bladeGlowMat.emissive.setHex(0x65a30d);
      slashMat.color.setHex(0xd8f23a);
      auraMat.color.setHex(0xd8f23a);
    }
  };

  return {
    rig: {
      root,
      bodyPivot,
      leftLeg,
      rightLeg,
      leftArm,
      rightArm,
      scarfLeft,
      scarfRight,
      swordPivot,
      slashArc,
      shieldRings,
      auraRing,
      visionOrb,
      setSwordStyle,
    },
    dispose: () => {
      geos.forEach((g) => g.dispose());
      localMats.forEach((m) => m.dispose());
    },
  };
}

/**
 * Floating Seelie Companion ("Chispa")
 */
export function createCompanionSeelie(): { rig: SeelieRig; dispose: () => void } {
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];

  const coreGeo = new THREE.OctahedronGeometry(0.22, 1);
  const haloGeo = new THREE.TorusGeometry(0.32, 0.025, 8, 24);
  const wingGeo = new THREE.ConeGeometry(0.11, 0.36, 4);
  geos.push(coreGeo, haloGeo, wingGeo);

  const coreMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 1.05,
    roughness: 0.15,
  });
  const haloMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    emissive: 0xeab308,
    emissiveIntensity: 0.65,
    metalness: 0.8,
    roughness: 0.2,
  });
  mats.push(coreMat, haloMat);

  const root = new THREE.Group();
  const core = new THREE.Mesh(coreGeo, coreMat);
  root.add(core);

  const halo = new THREE.Mesh(haloGeo, haloMat);
  halo.rotation.x = Math.PI / 2.3;
  root.add(halo);

  const wingLeft = new THREE.Mesh(wingGeo, coreMat);
  wingLeft.position.set(-0.28, 0.04, 0);
  wingLeft.rotation.z = Math.PI * 0.62;
  root.add(wingLeft);

  const wingRight = new THREE.Mesh(wingGeo, coreMat);
  wingRight.position.set(0.28, 0.04, 0);
  wingRight.rotation.z = -Math.PI * 0.62;
  root.add(wingRight);

  const setSkin = (skin: SeelieSkin) => {
    if (skin === 'dorado') {
      coreMat.color.setHex(0xfacc15);
      coreMat.emissive.setHex(0xd97706);
      haloMat.color.setHex(0xfef08a);
      haloMat.emissive.setHex(0xeab308);
    } else if (skin === 'amatista') {
      coreMat.color.setHex(0xc084fc);
      coreMat.emissive.setHex(0x7e22ce);
      haloMat.color.setHex(0xf0abfc);
      haloMat.emissive.setHex(0xa855f7);
    } else {
      coreMat.color.setHex(0x38bdf8);
      coreMat.emissive.setHex(0x0284c7);
      haloMat.color.setHex(0xfacc15);
      haloMat.emissive.setHex(0xeab308);
    }
  };

  return {
    rig: { root, wingLeft, wingRight, halo, setSkin },
    dispose: () => {
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
    },
  };
}

/**
 * Sunny Stylized Fantasy Adventure Island inspired by reference image:
 * - Turquoise animated lagoon water + stepped lime-grass terrace over golden-tan cliffs
 * - Giant Ancient Canopy Tree with hanging warm glowing lanterns
 * - Tapered Stone Watchtower with crimson conical shingled roof & crane pulley
 * - Wooden bridge to a palm islet + 3 interactive red/white Target Signs
 */
export function createSanctuaryWorld(mats: MaterialRegistry): SanctuaryWorldRefs {
  const geos: THREE.BufferGeometry[] = [];
  const localMats: THREE.Material[] = [];
  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geos.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    localMats.push(m);
    return m;
  };

  const group = new THREE.Group();
  const lanterns: THREE.Mesh[] = [];
  const floatingClouds: THREE.Group[] = [];
  const targetSigns: TargetSignTarget[] = [];

  // 1. Expansive Turquoise Lagoon Water Plane
  const waterGeo = trackGeo(new THREE.CircleGeometry(115, 72));
  waterGeo.rotateX(-Math.PI / 2);
  const waterMesh = new THREE.Mesh(waterGeo, mats.waterMaterial);
  waterMesh.position.y = -1.65;
  group.add(waterMesh);

  // 2. Main Grassy Terrace Island + Tan Cliff Skirt
  const turfTopGeo = trackGeo(new THREE.CylinderGeometry(16.8, 17.2, 0.55, 64));
  const turfTop = new THREE.Mesh(turfTopGeo, [
    mats.foliageBrightMaterial,
    mats.floorMaterial,
    mats.foliageBrightMaterial,
  ]);
  turfTop.position.y = -0.275;
  turfTop.receiveShadow = true;
  group.add(turfTop);

  const cliffBaseGeo = trackGeo(new THREE.CylinderGeometry(16.9, 18.2, 2.2, 32));
  const cliffBase = new THREE.Mesh(cliffBaseGeo, mats.cliffMaterial);
  cliffBase.position.y = -1.6;
  cliffBase.receiveShadow = true;
  group.add(cliffBase);

  // Central Raised Cobblestone Dais
  const dais = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(3.4, 3.85, 0.14, 40)),
    mats.stoneWallMaterial
  );
  dais.position.y = 0.07;
  dais.receiveShadow = true;
  group.add(dais);

  const daisTrim = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(3.45, 0.06, 8, 40)),
    mats.goldMaterial
  );
  daisTrim.rotation.x = Math.PI / 2;
  daisTrim.position.y = 0.15;
  group.add(daisTrim);

  // 3. Giant Ancient Canopy Tree with Hanging Lanterns (North-West side)
  const treeGroup = new THREE.Group();
  treeGroup.position.set(-12.2, 0, -10.8);
  group.add(treeGroup);

  const trunkGeo = trackGeo(new THREE.CylinderGeometry(1.35, 2.1, 7.6, 12));
  const trunk = new THREE.Mesh(trunkGeo, mats.woodMaterial);
  trunk.position.y = 3.6;
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  treeGroup.add(trunk);

  // Sculpted branches
  const branchGeo = trackGeo(new THREE.CylinderGeometry(0.45, 0.85, 4.4, 8));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    const br = new THREE.Mesh(branchGeo, mats.woodMaterial);
    br.position.set(Math.cos(a) * 1.4, 6.2, Math.sin(a) * 1.4);
    br.rotation.z = -Math.cos(a) * 0.72;
    br.rotation.x = Math.sin(a) * 0.72;
    br.castShadow = true;
    treeGroup.add(br);
  }

  // Layered lush giant canopy domes
  const canopyOffsets: Array<[number, number, number, number, boolean]> = [
    [0, 8.6, 0, 4.9, true],
    [-2.8, 7.8, 1.8, 3.4, false],
    [2.9, 8.0, -1.6, 3.6, false],
    [1.6, 9.8, 2.1, 3.2, true],
  ];
  const canopyGeo = trackGeo(new THREE.DodecahedronGeometry(1, 1));
  for (const [ox, oy, oz, rad, bright] of canopyOffsets) {
    const dome = new THREE.Mesh(
      canopyGeo,
      bright ? mats.foliageBrightMaterial : mats.foliageDarkMaterial
    );
    dome.position.set(ox, oy, oz);
    dome.scale.set(rad, rad * 0.65, rad);
    dome.castShadow = true;
    treeGroup.add(dome);
  }

  // Warm Hanging Fairy Lanterns under giant tree canopy
  const lanternGeo = trackGeo(new THREE.CylinderGeometry(0.18, 0.14, 0.36, 8));
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const lantern = new THREE.Mesh(lanternGeo, mats.lanternGlowMaterial);
    lantern.position.set(Math.cos(a) * 3.8, 6.1 + (i % 2) * 0.35, Math.sin(a) * 3.8);
    treeGroup.add(lantern);
    lanterns.push(lantern);
  }

  // 4. Red-Roofed Stone Watchtower (North-East side, iconic reference silhouette!)
  const towerGroup = new THREE.Group();
  towerGroup.position.set(12.2, 0, -10.5);
  towerGroup.lookAt(0, 0, 0);
  group.add(towerGroup);

  const towerBase = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(2.6, 2.9, 1.4, 14)),
    mats.cliffMaterial
  );
  towerBase.position.y = 0.7;
  towerBase.receiveShadow = true;
  towerGroup.add(towerBase);

  const towerShaft = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(1.95, 2.35, 8.2, 16)),
    mats.stoneWallMaterial
  );
  towerShaft.position.y = 5.4;
  towerShaft.castShadow = true;
  towerShaft.receiveShadow = true;
  towerGroup.add(towerShaft);

  // Wooden structural rings around tower
  for (const ry of [3.2, 6.0, 9.2]) {
    const ring = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(2.26 - (ry - 3) * 0.05, 0.16, 8, 20)),
      mats.woodMaterial
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = ry;
    towerGroup.add(ring);
  }

  // Glowing cyan-blue arched window & door
  const windowGlowMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x7dd3fc,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.9,
      roughness: 0.2,
    })
  );
  const windowBox = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.9, 1.35, 0.35)),
    windowGlowMat
  );
  windowBox.position.set(0, 6.8, 2.05);
  towerGroup.add(windowBox);

  const windowGable = new THREE.Mesh(
    trackGeo(new THREE.ConeGeometry(0.85, 0.75, 4)),
    mats.roofRedMaterial
  );
  windowGable.position.set(0, 7.8, 2.05);
  windowGable.rotation.y = Math.PI / 4;
  towerGroup.add(windowGable);

  const doorArch = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(1.15, 1.75, 0.35)),
    mats.woodMaterial
  );
  doorArch.position.set(0, 1.9, 2.28);
  towerGroup.add(doorArch);

  // Wide overhanging timber gallery & Crimson Shingled Conical Roof
  const roofEave = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(3.25, 2.8, 0.55, 16)),
    mats.woodMaterial
  );
  roofEave.position.y = 9.75;
  roofEave.castShadow = true;
  towerGroup.add(roofEave);

  const roofCone = new THREE.Mesh(
    trackGeo(new THREE.ConeGeometry(3.15, 4.4, 14)),
    mats.roofRedMaterial
  );
  roofCone.position.y = 12.1;
  roofCone.castShadow = true;
  towerGroup.add(roofCone);

  const finial = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.06, 0.14, 1.2, 8)),
    mats.goldMaterial
  );
  finial.position.y = 14.6;
  towerGroup.add(finial);

  // Hanging lanterns around watchtower eaves
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const lan = new THREE.Mesh(lanternGeo, mats.lanternGlowMaterial);
    lan.position.set(Math.cos(a) * 2.85, 9.25, Math.sin(a) * 2.85);
    towerGroup.add(lan);
    lanterns.push(lan);
  }

  // 5. Three Interactive Red-White Bullseye Target Signs (like reference!)
  const poleGeo = trackGeo(new THREE.CylinderGeometry(0.11, 0.14, 4.5, 8));
  const discGeo = trackGeo(new THREE.CylinderGeometry(1.12, 1.12, 0.22, 24));
  discGeo.rotateX(Math.PI / 2);

  const targetCoords: Array<[number, number]> = [
    [13.4, 4.2],
    [11.0, 9.8],
    [-13.8, 4.6],
  ];
  for (const [tx, tz] of targetCoords) {
    const signGroup = new THREE.Group();
    signGroup.position.set(tx, 0, tz);
    signGroup.lookAt(0, 0, 0);

    const pole = new THREE.Mesh(poleGeo, mats.woodMaterial);
    pole.position.y = 2.25;
    pole.castShadow = true;
    signGroup.add(pole);

    const headPivot = new THREE.Group();
    headPivot.position.y = 4.45;
    signGroup.add(headPivot);

    const disc = new THREE.Mesh(discGeo, [
      mats.woodMaterial,
      mats.targetSignMaterial,
      mats.targetSignMaterial,
    ]);
    disc.castShadow = true;
    headPivot.add(disc);

    group.add(signGroup);
    targetSigns.push({
      group: signGroup,
      headPivot,
      x: tx,
      z: tz,
      cooldown: 0,
      wobble: 0,
    });
  }

  // 6. Stylized Palm Trees & Wooden Bridge + Palm Side Islet
  const makePalmTree = (px: number, py: number, pz: number, scale = 1) => {
    const palm = new THREE.Group();
    palm.position.set(px, py, pz);
    palm.scale.setScalar(scale);

    for (let seg = 0; seg < 4; seg++) {
      const segMesh = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.18 - seg * 0.02, 0.22 - seg * 0.02, 1.25, 7)),
        mats.woodMaterial
      );
      segMesh.position.set(seg * 0.18, 0.6 + seg * 1.15, 0);
      segMesh.rotation.z = -0.15;
      segMesh.castShadow = true;
      palm.add(segMesh);
    }

    const crownPos = new THREE.Vector3(0.65, 4.75, 0);
    const frondGeo = trackGeo(new THREE.ConeGeometry(0.45, 2.3, 5));
    for (let f = 0; f < 6; f++) {
      const a = (f / 6) * Math.PI * 2;
      const frond = new THREE.Mesh(frondGeo, mats.foliageBrightMaterial);
      frond.position.copy(crownPos);
      frond.position.x += Math.cos(a) * 0.85;
      frond.position.z += Math.sin(a) * 0.85;
      frond.rotation.z = -Math.cos(a) * 1.25;
      frond.rotation.x = Math.sin(a) * 1.25;
      palm.add(frond);
    }
    return palm;
  };

  group.add(makePalmTree(14.8, 0, 1.0, 0.92));
  group.add(makePalmTree(13.2, 0, -5.8, 0.85));
  group.add(makePalmTree(-14.5, 0, -2.5, 0.9));

  // Neighboring Mini Palm Islet & Wooden Plank Bridge (South-East Lagoon)
  const miniIslet = new THREE.Group();
  miniIslet.position.set(6.5, -0.45, 22.8);
  const miniTurf = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(4.8, 5.2, 0.6, 24)),
    mats.foliageBrightMaterial
  );
  miniIslet.add(miniTurf);
  const miniCliff = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(5.0, 5.8, 1.8, 18)),
    mats.cliffMaterial
  );
  miniCliff.position.y = -1.1;
  miniIslet.add(miniCliff);
  miniIslet.add(makePalmTree(-0.8, 0.25, 0.5, 1.05));
  miniIslet.add(makePalmTree(1.5, 0.25, -0.6, 0.78));
  group.add(miniIslet);

  // Wooden Plank Bridge connecting main island to palm islet
  const plankGeo = trackGeo(new THREE.BoxGeometry(2.1, 0.14, 0.55));
  for (let b = 0; b < 9; b++) {
    const t = b / 8;
    const bx = THREE.MathUtils.lerp(4.4, 5.8, t);
    const bz = THREE.MathUtils.lerp(16.2, 19.6, t);
    const by = -0.15 + Math.sin(t * Math.PI) * 0.35;
    const plank = new THREE.Mesh(plankGeo, mats.woodMaterial);
    plank.position.set(bx, by, bz);
    plank.rotation.y = -0.35;
    group.add(plank);
  }

  // Cozy Wooden Canopy Stall & Barrels (South-West edge)
  const stallGroup = new THREE.Group();
  stallGroup.position.set(-11.2, 0, 10.6);
  stallGroup.lookAt(0, 0, 0);
  const counter = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(2.6, 1.0, 1.1)),
    mats.woodMaterial
  );
  counter.position.y = 0.5;
  stallGroup.add(counter);
  const awning = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(2.9, 0.16, 1.6)),
    mats.roofRedMaterial
  );
  awning.position.set(0, 2.35, 0);
  awning.rotation.x = 0.2;
  stallGroup.add(awning);
  for (const sx of [-1.15, 1.15]) {
    const post = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.08, 0.08, 2.4, 6)),
      mats.woodMaterial
    );
    post.position.set(sx, 1.2, 0.45);
    stallGroup.add(post);
  }
  const barrelGeo = trackGeo(new THREE.CylinderGeometry(0.36, 0.38, 0.85, 10));
  for (const bx of [1.75, 2.45]) {
    const barrel = new THREE.Mesh(barrelGeo, mats.woodMaterial);
    barrel.position.set(bx, 0.425, 0.15);
    stallGroup.add(barrel);
  }
  group.add(stallGroup);

  // 7. Distant Stylized Archipelago Islands & Floating Clouds (Depth without void)
  const distIslandGeo = trackGeo(new THREE.CylinderGeometry(5.5, 6.2, 2.4, 14));
  const distTreeGeo = trackGeo(new THREE.DodecahedronGeometry(2.6, 1));
  const distantCoords: Array<[number, number, number]> = [
    [-34, -0.5, -24],
    [35, -0.5, -26],
    [-38, -0.6, 18],
    [36, -0.4, 24],
    [0, -0.6, -42],
  ];
  for (const [ix, iy, iz] of distantCoords) {
    const isl = new THREE.Group();
    isl.position.set(ix, iy, iz);
    const base = new THREE.Mesh(distIslandGeo, mats.cliffMaterial);
    isl.add(base);
    const top = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(5.6, 5.6, 0.45, 14)),
      mats.foliageBrightMaterial
    );
    top.position.y = 1.3;
    isl.add(top);
    const tree = new THREE.Mesh(distTreeGeo, mats.foliageDarkMaterial);
    tree.position.set(0, 4.0, 0);
    isl.add(tree);
    group.add(isl);
  }

  // Softly shaded 3D Clouds (avoid pure white glare)
  const cloudMat = trackMat(
    new THREE.MeshToonMaterial({
      color: 0xe6effa,
      gradientMap: mats.toonGradient,
    })
  );
  const cloudPuffGeo = trackGeo(new THREE.SphereGeometry(2.2, 12, 10));
  for (let c = 0; c < 6; c++) {
    const cloud = new THREE.Group();
    const angle = (c / 6) * Math.PI * 2;
    cloud.position.set(
      Math.cos(angle) * 44,
      18 + (c % 3) * 4,
      Math.sin(angle) * 44
    );
    cloud.userData.orbitAngle = angle;
    cloud.userData.orbitRadius = 42 + (c % 2) * 8;
    cloud.userData.baseY = cloud.position.y;
    for (let p = 0; p < 3; p++) {
      const puff = new THREE.Mesh(cloudPuffGeo, cloudMat);
      puff.position.set((p - 1) * 1.9, p === 1 ? 0.6 : 0, 0);
      puff.scale.setScalar(p === 1 ? 1.25 : 0.9);
      cloud.add(puff);
    }
    group.add(cloud);
    floatingClouds.push(cloud);
  }

  // 8. Stylized Grass Tufts around Island Perimeter (InstancedMesh)
  const grassBladeGeo = trackGeo(new THREE.ConeGeometry(0.11, 0.55, 4));
  grassBladeGeo.translate(0, 0.275, 0);
  const grassMat = trackMat(
    new THREE.MeshToonMaterial({
      color: 0xffffff,
      gradientMap: mats.toonGradient,
    })
  );
  const grassCount = 240;
  const grassMesh = new THREE.InstancedMesh(grassBladeGeo, grassMat, grassCount);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  for (let i = 0; i < grassCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 11.4 + Math.random() * 5.0;
    dummy.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
    dummy.rotation.set(
      (Math.random() - 0.5) * 0.2,
      Math.random() * Math.PI * 2,
      (Math.random() - 0.5) * 0.2
    );
    const s = 0.75 + Math.random() * 0.7;
    dummy.scale.set(s, s, s);
    dummy.updateMatrix();
    grassMesh.setMatrixAt(i, dummy.matrix);
    color.setHSL(0.26 + (Math.random() - 0.5) * 0.04, 0.75, 0.48 + Math.random() * 0.14);
    grassMesh.setColorAt(i, color);
  }
  grassMesh.instanceMatrix.needsUpdate = true;
  if (grassMesh.instanceColor) grassMesh.instanceColor.needsUpdate = true;
  grassMesh.computeBoundingSphere();
  group.add(grassMesh);

  // 9. Interactive Altar de Enfoque (North plaza shrine for healing + fervor)
  const shrinePos = { x: 0, z: -8.2 };
  const shrineGroup = new THREE.Group();
  shrineGroup.position.set(shrinePos.x, 0, shrinePos.z);

  const shrinePedestal = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(1.15, 1.45, 0.72, 8)),
    mats.stoneWallMaterial
  );
  shrinePedestal.position.y = 0.36;
  shrinePedestal.castShadow = true;
  shrinePedestal.receiveShadow = true;
  shrineGroup.add(shrinePedestal);

  const shrineTrim = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(1.12, 0.055, 8, 24)),
    mats.goldMaterial
  );
  shrineTrim.rotation.x = Math.PI / 2;
  shrineTrim.position.y = 0.74;
  shrineGroup.add(shrineTrim);

  const shrineCrystalMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.75,
      roughness: 0.16,
      metalness: 0.25,
    })
  );
  const shrineCrystal = new THREE.Mesh(
    trackGeo(new THREE.OctahedronGeometry(0.55, 0)),
    shrineCrystalMat
  );
  shrineCrystal.position.y = 1.65;
  shrineCrystal.scale.set(0.85, 1.45, 0.85);
  shrineCrystal.castShadow = true;
  shrineGroup.add(shrineCrystal);

  const shrineRingMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );
  const shrineRing = new THREE.Mesh(
    trackGeo(new THREE.RingGeometry(1.55, 1.82, 32)),
    shrineRingMat
  );
  shrineRing.rotation.x = -Math.PI / 2;
  shrineRing.position.y = 0.04;
  shrineGroup.add(shrineRing);

  const shrineSprite = new THREE.Sprite(
    mats.getLabelSpriteMaterial('Altar Enfoque', '#38bdf8', false)
  );
  shrineSprite.position.set(0, 2.95, 0);
  shrineSprite.scale.set(2.55, 0.6, 1);
  shrineGroup.add(shrineSprite);

  group.add(shrineGroup);

  return {
    group,
    lanterns,
    floatingClouds,
    grassMesh,
    targetSigns,
    shrineCrystal,
    shrineRing,
    shrinePos,
    disposeGeometries: () => {
      geos.forEach((g) => g.dispose());
      localMats.forEach((m) => m.dispose());
    },
  };
}

/**
 * Multi-part Floating Elemental Habit Shard + Soft Ground Shadow Disc
 */
export function createHabitShardModel(
  label: string,
  category: string,
  isGraceBonus: boolean,
  mats: MaterialRegistry
): HabitShardRig {
  const col = getCategoryColor(category, isGraceBonus);

  const root = new THREE.Group();
  const crystalGeo = new THREE.OctahedronGeometry(0.52, 0);
  const outlineGeo = new THREE.OctahedronGeometry(0.57, 0);
  const outerGeo = new THREE.TorusGeometry(0.76, 0.05, 8, 28);
  const innerGeo = new THREE.TorusGeometry(0.58, 0.032, 6, 24);
  const auraGeo = new THREE.RingGeometry(0.58, 0.82, 24);
  const shadowGeo = new THREE.CircleGeometry(0.56, 16);

  const crystalMat = new THREE.MeshStandardMaterial({
    color: col.three,
    emissive: col.emissive,
    emissiveIntensity: 0.25,
    roughness: 0.18,
    metalness: 0.2,
  });
  const outlineMat = new THREE.MeshBasicMaterial({
    color: 0x0b121c,
    side: THREE.BackSide,
  });
  const auraMat = new THREE.MeshBasicMaterial({
    color: col.three,
    transparent: true,
    opacity: 0.82,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x080f18,
    transparent: true,
    opacity: 0.48,
    depthWrite: false,
  });

  const crystal = new THREE.Mesh(crystalGeo, crystalMat);
  crystal.position.y = 1.12;
  crystal.scale.set(0.88, 1.38, 0.88);
  crystal.castShadow = true;
  root.add(crystal);

  const crystalOutline = new THREE.Mesh(outlineGeo, outlineMat);
  crystal.add(crystalOutline);

  const outerRing = new THREE.Mesh(outerGeo, mats.goldMaterial);
  outerRing.position.y = 1.12;
  root.add(outerRing);

  const innerRing = new THREE.Mesh(innerGeo, crystalMat);
  innerRing.position.y = 1.12;
  innerRing.rotation.x = Math.PI / 3;
  root.add(innerRing);

  const contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = 0.025;
  root.add(contactShadow);

  const groundAura = new THREE.Mesh(auraGeo, auraMat);
  groundAura.rotation.x = -Math.PI / 2;
  groundAura.position.y = 0.04;
  root.add(groundAura);

  const labelSprite = new THREE.Sprite(mats.getLabelSpriteMaterial(label, col.hex, false));
  labelSprite.position.set(0, 2.25, 0);
  labelSprite.scale.set(2.55, 0.62, 1);
  root.add(labelSprite);

  return {
    root,
    crystal,
    outerRing,
    innerRing,
    labelSprite,
    dispose: () => {
      crystalGeo.dispose();
      outlineGeo.dispose();
      outerGeo.dispose();
      innerGeo.dispose();
      auraGeo.dispose();
      shadowGeo.dispose();
      crystalMat.dispose();
      outlineMat.dispose();
      auraMat.dispose();
      shadowMat.dispose();
    },
  };
}

/**
 * Multi-part Abyss / Distraction Specter + Telegraph Ring
 */
export function createDistractionSpecterModel(
  label: string,
  mats: MaterialRegistry
): DistractionSpecterRig {
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = 1.05;
  root.add(body);

  const coreGeo = new THREE.IcosahedronGeometry(0.46, 0);
  const outlineGeo = new THREE.IcosahedronGeometry(0.51, 0);
  const hornGeo = new THREE.ConeGeometry(0.15, 0.58, 5);
  const shardGeo = new THREE.OctahedronGeometry(0.19, 0);
  const telegraphGeo = new THREE.RingGeometry(0.82, 0.98, 28);
  const shadowGeo = new THREE.CircleGeometry(0.55, 16);

  const coreMat = new THREE.MeshStandardMaterial({
    color: 0x5c0a1c,
    emissive: 0xdc2626,
    emissiveIntensity: 0.52,
    roughness: 0.34,
    metalness: 0.45,
  });
  const outlineMat = new THREE.MeshBasicMaterial({
    color: 0x0b0f17,
    side: THREE.BackSide,
  });
  const maskMat = new THREE.MeshToonMaterial({
    color: 0x11131a,
    gradientMap: mats.toonGradient,
  });
  const telegraphMat = new THREE.MeshBasicMaterial({
    color: 0xef4444,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x080f18,
    transparent: true,
    opacity: 0.48,
    depthWrite: false,
  });

  const core = new THREE.Mesh(coreGeo, coreMat);
  core.castShadow = true;
  body.add(core);

  const coreOutline = new THREE.Mesh(outlineGeo, outlineMat);
  core.add(coreOutline);

  for (const side of [-1, 1]) {
    const horn = new THREE.Mesh(hornGeo, maskMat);
    horn.position.set(side * 0.34, 0.36, 0);
    horn.rotation.z = side * -0.45;
    body.add(horn);
  }

  const shards: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const shard = new THREE.Mesh(shardGeo, coreMat);
    shard.position.set(Math.cos(a) * 0.72, 0, Math.sin(a) * 0.72);
    body.add(shard);
    shards.push(shard);
  }

  const contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = 0.025;
  root.add(contactShadow);

  const telegraphRing = new THREE.Mesh(telegraphGeo, telegraphMat);
  telegraphRing.rotation.x = -Math.PI / 2;
  telegraphRing.position.y = 0.045;
  root.add(telegraphRing);

  const labelSprite = new THREE.Sprite(
    mats.getLabelSpriteMaterial(label, '#ef4444', true)
  );
  labelSprite.position.set(0, 2.1, 0);
  labelSprite.scale.set(2.4, 0.58, 1);
  root.add(labelSprite);

  return {
    root,
    body,
    shards,
    telegraphRing,
    labelSprite,
    dispose: () => {
      coreGeo.dispose();
      outlineGeo.dispose();
      hornGeo.dispose();
      shardGeo.dispose();
      telegraphGeo.dispose();
      shadowGeo.dispose();
      coreMat.dispose();
      outlineMat.dispose();
      maskMat.dispose();
      telegraphMat.dispose();
      shadowMat.dispose();
    },
  };
}

/**
 * Floating Boost Orb ("Imán" or "Viento")
 */
export function createBoostOrbModel(
  kind: 'magnet' | 'speed',
  mats: MaterialRegistry
): BoostOrbRig {
  const isMagnet = kind === 'magnet';
  const mainColor = isMagnet ? 0xc084fc : 0x38bdf8;
  const emissiveColor = isMagnet ? 0x7e22ce : 0x0284c7;
  const hex = isMagnet ? '#c084fc' : '#38bdf8';
  const label = isMagnet ? 'Imán 7s' : 'Viento 7s';

  const root = new THREE.Group();
  const coreGeo = new THREE.DodecahedronGeometry(0.42, 0);
  const outlineGeo = new THREE.DodecahedronGeometry(0.47, 0);
  const ringGeo = new THREE.TorusGeometry(0.68, 0.045, 8, 28);
  const shadowGeo = new THREE.CircleGeometry(0.48, 16);

  const coreMat = new THREE.MeshStandardMaterial({
    color: mainColor,
    emissive: emissiveColor,
    emissiveIntensity: 0.45,
    roughness: 0.16,
    metalness: 0.25,
  });
  const outlineMat = new THREE.MeshBasicMaterial({
    color: 0x0b121c,
    side: THREE.BackSide,
  });
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x080f18,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  });

  const core = new THREE.Mesh(coreGeo, coreMat);
  core.position.y = 1.15;
  core.castShadow = true;
  root.add(core);

  const outline = new THREE.Mesh(outlineGeo, outlineMat);
  core.add(outline);

  const ring = new THREE.Mesh(ringGeo, mats.goldMaterial);
  ring.position.y = 1.15;
  root.add(ring);

  const shadow = new THREE.Mesh(shadowGeo, shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.025;
  root.add(shadow);

  const labelSprite = new THREE.Sprite(mats.getLabelSpriteMaterial(label, hex, false));
  labelSprite.position.set(0, 2.2, 0);
  labelSprite.scale.set(2.3, 0.56, 1);
  root.add(labelSprite);

  return {
    root,
    core,
    ring,
    labelSprite,
    dispose: () => {
      coreGeo.dispose();
      outlineGeo.dispose();
      ringGeo.dispose();
      shadowGeo.dispose();
      coreMat.dispose();
      outlineMat.dispose();
      shadowMat.dispose();
    },
  };
}

/**
 * Multi-part Boss Titan Specter ("Titán de la Procrastinación")
 */
export function createBossSpecterModel(
  label: string,
  mats: MaterialRegistry
): BossSpecterRig {
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = 1.6;
  root.add(body);

  const coreGeo = new THREE.IcosahedronGeometry(0.92, 0);
  const outlineGeo = new THREE.IcosahedronGeometry(0.99, 0);
  const hornGeo = new THREE.ConeGeometry(0.24, 0.95, 5);
  const shardGeo = new THREE.OctahedronGeometry(0.32, 0);
  const haloGeo = new THREE.TorusGeometry(1.38, 0.075, 8, 32);
  const telegraphGeo = new THREE.RingGeometry(1.45, 1.72, 32);
  const shadowGeo = new THREE.CircleGeometry(1.15, 20);

  const coreMat = new THREE.MeshStandardMaterial({
    color: 0x450a18,
    emissive: 0xe11d48,
    emissiveIntensity: 0.65,
    roughness: 0.3,
    metalness: 0.55,
  });
  const outlineMat = new THREE.MeshBasicMaterial({
    color: 0x080c12,
    side: THREE.BackSide,
  });
  const hornMat = new THREE.MeshToonMaterial({
    color: 0x11131a,
    gradientMap: mats.toonGradient,
  });
  const telegraphMat = new THREE.MeshBasicMaterial({
    color: 0xf43f5e,
    transparent: true,
    opacity: 0.88,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x080f18,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });

  const core = new THREE.Mesh(coreGeo, coreMat);
  core.castShadow = true;
  body.add(core);

  const coreOutline = new THREE.Mesh(outlineGeo, outlineMat);
  core.add(coreOutline);

  for (const side of [-1, 1]) {
    const horn = new THREE.Mesh(hornGeo, hornMat);
    horn.position.set(side * 0.62, 0.72, 0);
    horn.rotation.z = side * -0.45;
    body.add(horn);
  }

  const haloRing = new THREE.Mesh(haloGeo, mats.goldMaterial);
  haloRing.rotation.x = Math.PI / 3;
  body.add(haloRing);

  const shards: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const shard = new THREE.Mesh(shardGeo, coreMat);
    shard.position.set(Math.cos(a) * 1.45, 0, Math.sin(a) * 1.45);
    body.add(shard);
    shards.push(shard);
  }

  const contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = 0.03;
  root.add(contactShadow);

  const telegraphRing = new THREE.Mesh(telegraphGeo, telegraphMat);
  telegraphRing.rotation.x = -Math.PI / 2;
  telegraphRing.position.y = 0.05;
  root.add(telegraphRing);

  const labelSprite = new THREE.Sprite(
    mats.getLabelSpriteMaterial(label, '#f43f5e', true)
  );
  labelSprite.position.set(0, 3.45, 0);
  labelSprite.scale.set(3.2, 0.72, 1);
  root.add(labelSprite);

  return {
    root,
    body,
    haloRing,
    shards,
    telegraphRing,
    labelSprite,
    dispose: () => {
      coreGeo.dispose();
      outlineGeo.dispose();
      hornGeo.dispose();
      shardGeo.dispose();
      haloGeo.dispose();
      telegraphGeo.dispose();
      shadowGeo.dispose();
      coreMat.dispose();
      outlineMat.dispose();
      hornMat.dispose();
      telegraphMat.dispose();
      shadowMat.dispose();
    },
  };
}

/**
 * Purple/Indigo Drain Wraith ("Sombra Drenadora") that accelerates Habit Shard decay
 */
export function createDrainSpecterModel(
  label: string,
  mats: MaterialRegistry
): DrainSpecterRig {
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = 1.15;
  root.add(body);

  const coreGeo = new THREE.OctahedronGeometry(0.42, 0);
  const outlineGeo = new THREE.OctahedronGeometry(0.47, 0);
  const wispGeo = new THREE.ConeGeometry(0.13, 0.52, 5);
  const orbitRingGeo = new THREE.TorusGeometry(0.76, 0.042, 6, 24);
  const drainAuraGeo = new THREE.RingGeometry(0.78, 1.02, 28);
  const shadowGeo = new THREE.CircleGeometry(0.54, 16);

  const coreMat = new THREE.MeshStandardMaterial({
    color: 0x31105e,
    emissive: 0x9333ea,
    emissiveIntensity: 0.72,
    roughness: 0.26,
    metalness: 0.4,
  });
  const outlineMat = new THREE.MeshBasicMaterial({
    color: 0x0b0816,
    side: THREE.BackSide,
  });
  const ringMat = new THREE.MeshStandardMaterial({
    color: 0xc084fc,
    emissive: 0x7e22ce,
    emissiveIntensity: 0.65,
    roughness: 0.22,
    metalness: 0.55,
  });
  const auraMat = new THREE.MeshBasicMaterial({
    color: 0xa855f7,
    transparent: true,
    opacity: 0.78,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x090814,
    transparent: true,
    opacity: 0.48,
    depthWrite: false,
  });

  const core = new THREE.Mesh(coreGeo, coreMat);
  core.scale.set(0.85, 1.42, 0.85);
  core.castShadow = true;
  body.add(core);

  const coreOutline = new THREE.Mesh(outlineGeo, outlineMat);
  core.add(coreOutline);

  for (const side of [-1, 1]) {
    const wisp = new THREE.Mesh(wispGeo, ringMat);
    wisp.position.set(side * 0.44, 0.14, 0);
    wisp.rotation.z = side * -0.7;
    body.add(wisp);
  }

  const orbitRing = new THREE.Mesh(orbitRingGeo, ringMat);
  orbitRing.rotation.x = Math.PI / 3;
  body.add(orbitRing);

  const contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = 0.025;
  root.add(contactShadow);

  const drainAura = new THREE.Mesh(drainAuraGeo, auraMat);
  drainAura.rotation.x = -Math.PI / 2;
  drainAura.position.y = 0.045;
  root.add(drainAura);

  const labelSprite = new THREE.Sprite(
    mats.getLabelSpriteMaterial(label, '#c084fc', true)
  );
  labelSprite.position.set(0, 2.25, 0);
  labelSprite.scale.set(2.55, 0.58, 1);
  root.add(labelSprite);

  const update = (elapsed: number) => {
    body.position.y = 1.15 + Math.sin(elapsed * 3.8) * 0.14;
    body.rotation.y = elapsed * 2.2;
    orbitRing.rotation.z = -elapsed * 2.6;
    const pulse = 0.92 + Math.sin(elapsed * 5.2) * 0.16;
    drainAura.scale.setScalar(pulse);
  };

  return {
    root,
    body,
    orbitRing,
    drainAura,
    labelSprite,
    update,
    dispose: () => {
      coreGeo.dispose();
      outlineGeo.dispose();
      wispGeo.dispose();
      orbitRingGeo.dispose();
      drainAuraGeo.dispose();
      shadowGeo.dispose();
      coreMat.dispose();
      outlineMat.dispose();
      ringMat.dispose();
      auraMat.dispose();
      shadowMat.dispose();
    },
  };
}
