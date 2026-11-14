import * as THREE from 'three';

export interface MaterialRegistry {
  toonGradient: THREE.DataTexture;
  floorMaterial: THREE.MeshStandardMaterial;
  cliffMaterial: THREE.MeshToonMaterial;
  stoneWallMaterial: THREE.MeshStandardMaterial;
  woodMaterial: THREE.MeshToonMaterial;
  roofRedMaterial: THREE.MeshToonMaterial;
  foliageDarkMaterial: THREE.MeshToonMaterial;
  foliageBrightMaterial: THREE.MeshToonMaterial;
  goldMaterial: THREE.MeshPhysicalMaterial;
  lanternGlowMaterial: THREE.MeshStandardMaterial;
  targetSignMaterial: THREE.MeshStandardMaterial;
  waterMaterial: THREE.ShaderMaterial;
  skyMaterial: THREE.ShaderMaterial;
  getLabelSpriteMaterial: (
    label: string,
    accentHex: string,
    isDanger?: boolean
  ) => THREE.SpriteMaterial;
  track: <T extends THREE.Material | THREE.Texture>(item: T) => T;
  dispose: () => void;
}

export function createMaterialRegistry(renderer: THREE.WebGLRenderer): MaterialRegistry {
  const disposables = new Set<{ dispose: () => void }>();
  const spriteCache = new Map<string, THREE.SpriteMaterial>();
  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy() || 1);

  const track = <T extends THREE.Material | THREE.Texture>(item: T): T => {
    disposables.add(item);
    return item;
  };

  // 1. High-contrast 4-band Stylized Cel-Shading Gradient Map (distinct shadow depth)
  const gradientBytes = new Uint8Array([55, 118, 190, 255]);
  const toonGradient = track(
    new THREE.DataTexture(gradientBytes, 4, 1, THREE.RedFormat)
  );
  toonGradient.minFilter = THREE.NearestFilter;
  toonGradient.magFilter = THREE.NearestFilter;
  toonGradient.generateMipmaps = false;
  toonGradient.needsUpdate = true;

  // 2. Rich Saturated Meadow & Stone Courtyard Terrace Floor (1024x1024)
  const floorCanvas = document.createElement('canvas');
  floorCanvas.width = 1024;
  floorCanvas.height = 1024;
  const fCtx = floorCanvas.getContext('2d')!;
  const cx = 512;
  const cy = 512;

  // Deep, rich emerald-meadow grass (prevents neon washout & makes crystals pop!)
  const grassGrad = fCtx.createRadialGradient(cx, cy, 40, cx, cy, 512);
  grassGrad.addColorStop(0, '#4c9e30');
  grassGrad.addColorStop(0.55, '#3c8526');
  grassGrad.addColorStop(0.88, '#2d6b1e');
  grassGrad.addColorStop(1, '#235418');
  fCtx.fillStyle = grassGrad;
  fCtx.fillRect(0, 0, 1024, 1024);

  // Subtle painterly grass patches
  for (let i = 0; i < 650; i++) {
    const rx = Math.random() * 1024;
    const ry = Math.random() * 1024;
    const rad = 8 + Math.random() * 26;
    fCtx.fillStyle =
      i % 3 === 0
        ? 'rgba(130, 200, 65, 0.14)'
        : i % 3 === 1
        ? 'rgba(20, 65, 16, 0.22)'
        : 'rgba(220, 215, 140, 0.08)';
    fCtx.beginPath();
    fCtx.arc(rx, ry, rad, 0, Math.PI * 2);
    fCtx.fill();
  }

  // Warm grounded sandstone courtyard plaza in center
  const plazaGrad = fCtx.createRadialGradient(cx, cy, 10, cx, cy, 190);
  plazaGrad.addColorStop(0, '#a89674');
  plazaGrad.addColorStop(0.75, '#8c7a5b');
  plazaGrad.addColorStop(1, 'rgba(118, 100, 72, 0)');
  fCtx.fillStyle = plazaGrad;
  fCtx.beginPath();
  fCtx.arc(cx, cy, 190, 0, Math.PI * 2);
  fCtx.fill();

  // Crisp cobblestone rings inside central courtyard
  fCtx.strokeStyle = 'rgba(54, 42, 28, 0.58)';
  fCtx.lineWidth = 4;
  for (const r of [64, 112, 158]) {
    fCtx.beginPath();
    fCtx.arc(cx, cy, r, 0, Math.PI * 2);
    fCtx.stroke();
  }

  // Sun-gold Racha compass markings in plaza
  fCtx.strokeStyle = 'rgba(216, 242, 58, 0.55)';
  fCtx.lineWidth = 3;
  fCtx.beginPath();
  fCtx.arc(cx, cy, 86, 0, Math.PI * 2);
  fCtx.stroke();

  // Stepping stone paths toward tower, giant tree, and dock
  const pathAngles = [0.65, 2.35, -0.78, -2.35];
  for (const angle of pathAngles) {
    for (let step = 175; step < 420; step += 36) {
      const px = cx + Math.cos(angle) * step + Math.sin(step * 0.1) * 10;
      const py = cy + Math.sin(angle) * step + Math.cos(step * 0.1) * 10;
      fCtx.fillStyle = '#9e8c6c';
      fCtx.strokeStyle = '#524430';
      fCtx.lineWidth = 2.5;
      fCtx.beginPath();
      fCtx.ellipse(px, py, 14, 11, angle, 0, Math.PI * 2);
      fCtx.fill();
      fCtx.stroke();
    }
  }

  // Tiny painted white & yellow meadow blossoms
  for (let i = 0; i < 85; i++) {
    const a = Math.random() * Math.PI * 2;
    const dist = 200 + Math.random() * 280;
    const fx = cx + Math.cos(a) * dist;
    const fy = cy + Math.sin(a) * dist;
    fCtx.fillStyle = i % 2 === 0 ? '#e2e8f0' : '#facc15';
    fCtx.beginPath();
    fCtx.arc(fx, fy, 3.0, 0, Math.PI * 2);
    fCtx.fill();
  }

  const floorTexture = track(new THREE.CanvasTexture(floorCanvas));
  floorTexture.colorSpace = THREE.SRGBColorSpace;
  floorTexture.anisotropy = maxAniso;

  const floorMaterial = track(
    new THREE.MeshStandardMaterial({
      map: floorTexture,
      roughness: 0.9,
      metalness: 0.04,
    })
  );

  // 3. Stone Tower Masonry Texture (stylized gray-cream cobblestones)
  const stoneCanvas = document.createElement('canvas');
  stoneCanvas.width = 512;
  stoneCanvas.height = 512;
  const sCtx = stoneCanvas.getContext('2d')!;
  sCtx.fillStyle = '#737c8a';
  sCtx.fillRect(0, 0, 512, 512);
  const rows = 8;
  const rowH = 512 / rows;
  for (let r = 0; r < rows; r++) {
    const cols = 6;
    const colW = 512 / cols;
    const shift = (r % 2) * (colW * 0.5);
    for (let c = -1; c <= cols; c++) {
      const shade = 112 + Math.floor(Math.random() * 32);
      sCtx.fillStyle = `rgb(${shade}, ${shade + 4}, ${shade + 10})`;
      sCtx.strokeStyle = '#3b424d';
      sCtx.lineWidth = 4;
      sCtx.beginPath();
      sCtx.roundRect(c * colW + shift + 3, r * rowH + 3, colW - 6, rowH - 6, 8);
      sCtx.fill();
      sCtx.stroke();
    }
  }
  const stoneTex = track(new THREE.CanvasTexture(stoneCanvas));
  stoneTex.colorSpace = THREE.SRGBColorSpace;
  stoneTex.wrapS = THREE.RepeatWrapping;
  stoneTex.wrapT = THREE.RepeatWrapping;
  stoneTex.repeat.set(2, 2);
  stoneTex.anisotropy = maxAniso;

  const stoneWallMaterial = track(
    new THREE.MeshStandardMaterial({
      map: stoneTex,
      roughness: 0.85,
      metalness: 0.05,
    })
  );

  // 4. Target Bullseye Texture (Red & White concentric rings)
  const targetCanvas = document.createElement('canvas');
  targetCanvas.width = 256;
  targetCanvas.height = 256;
  const tCtx = targetCanvas.getContext('2d')!;
  const radii = [124, 98, 72, 46, 22];
  radii.forEach((rad, idx) => {
    tCtx.fillStyle = idx % 2 === 0 ? '#dc2626' : '#f1f5f9';
    tCtx.beginPath();
    tCtx.arc(128, 128, rad, 0, Math.PI * 2);
    tCtx.fill();
  });
  tCtx.strokeStyle = '#451a03';
  tCtx.lineWidth = 8;
  tCtx.beginPath();
  tCtx.arc(128, 128, 124, 0, Math.PI * 2);
  tCtx.stroke();

  const targetTex = track(new THREE.CanvasTexture(targetCanvas));
  targetTex.colorSpace = THREE.SRGBColorSpace;
  targetTex.anisotropy = maxAniso;
  const targetSignMaterial = track(
    new THREE.MeshStandardMaterial({
      map: targetTex,
      roughness: 0.65,
      metalness: 0.05,
    })
  );

  // 5. Stylized Toon Materials matching Reference Palette (richer contrast, no white glare)
  const cliffMaterial = track(
    new THREE.MeshToonMaterial({
      color: 0xa67443,
      gradientMap: toonGradient,
    })
  );

  const woodMaterial = track(
    new THREE.MeshToonMaterial({
      color: 0x734728,
      gradientMap: toonGradient,
    })
  );

  const roofRedMaterial = track(
    new THREE.MeshToonMaterial({
      color: 0xc92a22,
      gradientMap: toonGradient,
    })
  );

  const foliageDarkMaterial = track(
    new THREE.MeshToonMaterial({
      color: 0x246b29,
      gradientMap: toonGradient,
    })
  );

  const foliageBrightMaterial = track(
    new THREE.MeshToonMaterial({
      color: 0x3e9630,
      gradientMap: toonGradient,
    })
  );

  const goldMaterial = track(
    new THREE.MeshPhysicalMaterial({
      color: 0xd9a83e,
      metalness: 0.8,
      roughness: 0.28,
      clearcoat: 0.25,
    })
  );

  const lanternGlowMaterial = track(
    new THREE.MeshStandardMaterial({
      color: 0xfde047,
      emissive: 0xeab308,
      emissiveIntensity: 0.85,
      roughness: 0.25,
    })
  );

  // 6. Balanced Turquoise Lagoon Water Shader (no over-bright bloom glare)
  const waterMaterial = track(
    new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
      },
      vertexShader: `
        varying vec3 vWorldPos;
        uniform float uTime;
        void main() {
          vec3 pos = position;
          vec4 wp = modelMatrix * vec4(pos, 1.0);
          wp.y += sin(wp.x * 0.45 + uTime * 2.0) * 0.05 + cos(wp.z * 0.45 + uTime * 1.7) * 0.05;
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        varying vec3 vWorldPos;

        void main() {
          float dist = length(vWorldPos.xz);
          vec3 deepWater = vec3(0.02, 0.36, 0.58);
          vec3 shallowWater = vec3(0.08, 0.64, 0.74);

          float shallowFactor = smoothstep(28.0, 16.5, dist);
          vec3 col = mix(deepWater, shallowWater, shallowFactor);

          float wave = sin(vWorldPos.x * 0.8 + uTime * 1.8) * cos(vWorldPos.z * 0.8 - uTime * 1.4);
          col += vec3(0.08, 0.14, 0.14) * smoothstep(0.60, 0.96, wave);

          float shoreWave = sin(dist * 2.6 - uTime * 2.8);
          float shoreFoam = smoothstep(18.5, 17.2, dist) * smoothstep(0.45, 0.90, shoreWave);
          col = mix(col, vec3(0.78, 0.92, 0.96), shoreFoam * 0.65);

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    })
  );

  // 7. Rich Azure Daytime Sky Dome (controlled luminance so foreground pops)
  const skyMaterial = track(
    new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uSunDir: { value: new THREE.Vector3(0.52, 0.55, -0.65).normalize() },
      },
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: `
        varying vec3 vWorldDir;
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldDir = normalize(worldPos.xyz);
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uSunDir;
        varying vec3 vWorldDir;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }

        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
            mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
            u.y
          );
        }

        void main() {
          vec3 dir = normalize(vWorldDir);
          float h = clamp(dir.y, -0.2, 1.0);

          vec3 horizonCol = vec3(0.46, 0.75, 0.92);
          vec3 midSkyCol = vec3(0.20, 0.52, 0.84);
          vec3 zenithCol = vec3(0.10, 0.32, 0.68);

          vec3 col = mix(horizonCol, midSkyCol, smoothstep(0.0, 0.35, h));
          col = mix(col, zenithCol, smoothstep(0.35, 0.92, h));

          float sunAmt = max(dot(dir, normalize(uSunDir)), 0.0);
          col += vec3(0.85, 0.78, 0.60) * pow(sunAmt, 16.0) * 0.22;
          col += vec3(0.95, 0.92, 0.78) * pow(sunAmt, 200.0) * 0.65;

          if (dir.y > 0.02) {
            vec2 uv = dir.xz / (dir.y + 0.28) * 1.45 + vec2(uTime * 0.012, uTime * 0.005);
            float n = noise(uv * 2.0) * 0.55 + noise(uv * 4.2) * 0.3 + noise(uv * 8.0) * 0.15;
            float cloud = smoothstep(0.54, 0.74, n) * smoothstep(0.02, 0.16, dir.y) * smoothstep(0.70, 0.22, dir.y);
            col = mix(col, vec3(0.86, 0.91, 0.96), cloud * 0.68);
          }

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    })
  );

  // 8. High-Contrast Label Sprite Cache (legible over bright grass & sky!)
  const getLabelSpriteMaterial = (
    label: string,
    accentHex: string,
    isDanger = false
  ): THREE.SpriteMaterial => {
    const key = `${label}|${accentHex}|${isDanger ? '1' : '0'}`;
    const cached = spriteCache.get(key);
    if (cached) return cached;

    const canvas = document.createElement('canvas');
    canvas.width = 280;
    canvas.height = 68;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, 280, 68);

    ctx.fillStyle = isDanger ? 'rgba(62, 10, 14, 0.92)' : 'rgba(13, 20, 30, 0.90)';
    ctx.strokeStyle = accentHex;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.roundRect(14, 12, 252, 44, 22);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = accentHex;
    ctx.beginPath();
    ctx.arc(38, 34, 6.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = isDanger ? '#fecaca' : '#ffffff';
    ctx.font = '700 22px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const trimmed = label.length > 14 ? label.slice(0, 13) + '…' : label;
    ctx.fillText(trimmed, 148, 35);

    const tex = track(new THREE.CanvasTexture(canvas));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAniso;

    const mat = track(
      new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        depthTest: true,
      })
    );
    spriteCache.set(key, mat);
    return mat;
  };

  return {
    toonGradient,
    floorMaterial,
    cliffMaterial,
    stoneWallMaterial,
    woodMaterial,
    roofRedMaterial,
    foliageDarkMaterial,
    foliageBrightMaterial,
    goldMaterial,
    lanternGlowMaterial,
    targetSignMaterial,
    waterMaterial,
    skyMaterial,
    getLabelSpriteMaterial,
    track,
    dispose: () => {
      disposables.forEach((d) => d.dispose());
      disposables.clear();
      spriteCache.clear();
    },
  };
}
