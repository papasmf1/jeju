import * as THREE from "three";

/* ------------------------------------------------------------------ */
/*  서울 드라이브: 여의도 — three.js 기반 오픈월드 주행 게임 엔진          */
/* ------------------------------------------------------------------ */

export type GameStatus = "playing" | "wrecked" | "busted";

export interface HudState {
  speed: number; // km/h
  health: number; // 0~100
  money: number; // 원
  deliveries: number;
  wanted: number; // 0~3
  missionTitle: string;
  missionDetail: string;
  timeLeft: number | null;
  distance: number; // 목표까지 거리(m)
  status: GameStatus;
  message: string;
}

interface Box {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

interface Body {
  x: number;
  z: number;
  vx: number;
  vz: number;
}

interface Npc {
  mesh: THREE.Group;
  axis: "x" | "z";
  line: number;
  t: number;
  dir: 1 | -1;
  speed: number;
  baseSpeed: number;
  x: number;
  z: number;
  stun: number;
  hitCd: number;
}

interface Police extends Body {
  mesh: THREE.Group;
  h: number;
  speed: number;
  hitCd: number;
  red: THREE.MeshStandardMaterial;
  blue: THREE.MeshStandardMaterial;
}

const GRID = 80; // 도로 간격
const ROAD_W = 14; // 도로 폭
const LANE = 3.5; // 차선 중심 오프셋
const EDGE = 320; // 가장 바깥 도로
const HALF = 350; // 섬(지면) 절반 크기
const LIMIT = 334; // 차량 이동 한계
const LINES = [-320, -240, -160, -80, 0, 80, 160, 240, 320];
const MAX_SPEED = 55;
const CAR_R = 2.1;

// 63빌딩 위치 (여의도 동북쪽 한강변 느낌)
const B63 = { x: 40, z: -280, halfX: 22, halfZ: 16, height: 220 };

const MISSIONS = [
  "치킨 배달",
  "퀵서비스 서류",
  "꽃다발 배송",
  "야식 족발 배달",
  "긴급 택배",
  "커피 20잔 배달",
  "생일 케이크 배송",
];

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvasTexture(
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
  repeat = true
) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

function wrapAngle(a: number) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export class GameEngine {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(60, 1, 0.8, 1600);
  private raf = 0;
  private last = 0;
  private time = 0;
  private hudTimer = 0;
  private disposed = false;

  private started = false;
  private paused = false;
  private status: GameStatus = "playing";

  private boxes: Box[] = [];
  private parks: Box[] = [];
  private keys = { up: false, down: false, left: false, right: false, brake: false };

  private player = { x: LANE, z: 250, vx: 0, vz: 0, h: Math.PI };
  private playerMesh: THREE.Group;
  private health = 100;
  private money = 0;
  private deliveries = 0;
  private heat = 0;
  private bustTimer = 0;
  private wallCd = 0;

  private npcs: Npc[] = [];
  private police: Police[] = [];

  private phase: "pickup" | "deliver" = "pickup";
  private missionName = MISSIONS[0];
  private target = { x: 0, z: 0 };
  private timeLeft = 0;
  private reward = 0;
  private marker: THREE.Group;
  private markerMat: THREE.MeshBasicMaterial;

  private message = "";
  private messageTimer = 0;

  private mapBg: HTMLCanvasElement;

  constructor(
    private canvas: HTMLCanvasElement,
    private minimap: HTMLCanvasElement,
    private onHud: (s: HudState) => void
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.buildSky();
    this.buildGround();
    this.buildCity();
    this.build63();

    this.playerMesh = makeCar(0xd62839);
    this.scene.add(this.playerMesh);

    this.markerMat = new THREE.MeshBasicMaterial({
      color: 0xffd60a,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.marker = new THREE.Group();
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(5, 5, 70, 28, 1, true),
      this.markerMat
    );
    beam.position.y = 35;
    const ring = new THREE.Mesh(new THREE.RingGeometry(4.2, 5.6, 32), this.markerMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.3;
    this.marker.add(beam, ring);
    this.scene.add(this.marker);

    this.spawnTraffic();
    this.mapBg = this.buildMinimapBg();
    this.newPickup();
    this.syncPlayerMesh();

    this.resize();
    window.addEventListener("resize", this.resize);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);

    this.raf = requestAnimationFrame(this.loop);
  }

  /* ----------------------------- 공개 API ----------------------------- */

  start() {
    this.started = true;
    this.paused = false;
    this.snapCamera();
  }

  setPaused(p: boolean) {
    this.paused = p;
  }

  reset() {
    Object.assign(this.player, { x: LANE, z: 250, vx: 0, vz: 0, h: Math.PI });
    this.health = 100;
    this.money = 0;
    this.deliveries = 0;
    this.heat = 0;
    this.bustTimer = 0;
    for (const p of this.police) this.scene.remove(p.mesh);
    this.police = [];
    this.status = "playing";
    this.paused = false;
    this.message = "";
    this.newPickup();
    this.syncPlayerMesh();
    this.snapCamera();
    this.emitHud();
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.resize);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
    });
    this.renderer.dispose();
  }

  /* ----------------------------- 입력 ----------------------------- */

  private setKey(code: string, down: boolean) {
    switch (code) {
      case "KeyW":
      case "ArrowUp":
        this.keys.up = down;
        return true;
      case "KeyS":
      case "ArrowDown":
        this.keys.down = down;
        return true;
      case "KeyA":
      case "ArrowLeft":
        this.keys.left = down;
        return true;
      case "KeyD":
      case "ArrowRight":
        this.keys.right = down;
        return true;
      case "Space":
        this.keys.brake = down;
        return true;
    }
    return false;
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (this.setKey(e.code, true)) e.preventDefault();
  };
  private onKeyUp = (e: KeyboardEvent) => {
    this.setKey(e.code, false);
  };
  private onBlur = () => {
    this.keys = { up: false, down: false, left: false, right: false, brake: false };
  };

  private resize = () => {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };

  /* ----------------------------- 월드 생성 ----------------------------- */

  private buildSky() {
    // 노을 지는 서울 하늘
    this.scene.background = canvasTexture(
      4,
      256,
      (ctx) => {
        const g = ctx.createLinearGradient(0, 0, 0, 256);
        g.addColorStop(0, "#232a5c");
        g.addColorStop(0.35, "#6a4c8c");
        g.addColorStop(0.55, "#e0796a");
        g.addColorStop(0.72, "#ffb877");
        g.addColorStop(1, "#ffd9a0");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 4, 256);
      },
      false
    );
    this.scene.fog = new THREE.Fog(0xf2ab7d, 260, 1300);

    this.scene.add(new THREE.HemisphereLight(0xd6d8ff, 0x8a6f58, 2.3));
    const sun = new THREE.DirectionalLight(0xffcf9a, 2.6);
    sun.position.set(-220, 180, 320);
    this.scene.add(sun);
  }

  private buildGround() {
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(6000, 6000),
      new THREE.MeshStandardMaterial({ color: 0x3b6f8f, roughness: 0.35, metalness: 0.3 })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.y = -1.2;
    this.scene.add(water);

    const ground = new THREE.Mesh(
      new THREE.BoxGeometry(HALF * 2, 2, HALF * 2),
      new THREE.MeshStandardMaterial({ color: 0x777c85, roughness: 0.95 })
    );
    ground.position.y = -1;
    this.scene.add(ground);

    const roadTex = canvasTexture(128, 128, (ctx) => {
      ctx.fillStyle = "#2a2c31";
      ctx.fillRect(0, 0, 128, 128);
      for (let i = 0; i < 500; i++) {
        ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`;
        ctx.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
      }
      ctx.fillStyle = "#e9e9e9";
      ctx.fillRect(5, 0, 3, 128);
      ctx.fillRect(120, 0, 3, 128);
      ctx.fillStyle = "#f2c230"; // 황색 중앙선
      ctx.fillRect(60, 0, 2, 128);
      ctx.fillRect(66, 0, 2, 128);
    });
    roadTex.repeat.set(1, (HALF * 2) / 16);
    const roadMat = new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.9 });
    const roadGeo = new THREE.PlaneGeometry(ROAD_W, HALF * 2).rotateX(-Math.PI / 2);

    for (const l of LINES) {
      const a = new THREE.Mesh(roadGeo, roadMat);
      a.position.set(l, 0.06, 0);
      this.scene.add(a);
      const b = new THREE.Mesh(roadGeo, roadMat);
      b.rotation.y = Math.PI / 2;
      b.position.set(0, 0.09, l);
      this.scene.add(b);
    }

    // 교차로 + 횡단보도
    const crossTex = canvasTexture(
      128,
      128,
      (ctx) => {
        ctx.fillStyle = "#2a2c31";
        ctx.fillRect(0, 0, 128, 128);
        ctx.fillStyle = "#e9e9e9";
        for (let i = 0; i < 8; i++) {
          const p = 10 + i * 14;
          ctx.fillRect(p, 2, 8, 14);
          ctx.fillRect(p, 112, 8, 14);
          ctx.fillRect(2, p, 14, 8);
          ctx.fillRect(112, p, 14, 8);
        }
      },
      false
    );
    const crossGeo = new THREE.PlaneGeometry(ROAD_W + 6, ROAD_W + 6).rotateX(-Math.PI / 2);
    const crossMat = new THREE.MeshStandardMaterial({ map: crossTex, roughness: 0.9 });
    const cross = new THREE.InstancedMesh(crossGeo, crossMat, LINES.length ** 2);
    const m = new THREE.Matrix4();
    let i = 0;
    for (const x of LINES)
      for (const z of LINES) {
        m.makeTranslation(x, 0.13, z);
        cross.setMatrixAt(i++, m);
      }
    this.scene.add(cross);
  }

  private buildCity() {
    const rand = mulberry32(6363);

    // 창문 텍스처 (불 켜진 창은 emissive 맵으로 발광)
    const W = 12;
    const lit: boolean[] = [];
    for (let i = 0; i < W * W; i++) lit.push(rand() < 0.32);
    const drawWin = (emissive: boolean) => (ctx: CanvasRenderingContext2D) => {
      ctx.fillStyle = emissive ? "#000" : "#d4d7dd";
      ctx.fillRect(0, 0, 256, 256);
      const cell = 256 / W;
      for (let y = 0; y < W; y++)
        for (let x = 0; x < W; x++) {
          const on = lit[y * W + x];
          ctx.fillStyle = emissive ? (on ? "#ffc56b" : "#000") : on ? "#ffe2a3" : "#5b7396";
          ctx.fillRect(x * cell + 5, y * cell + 6, cell - 10, cell - 12);
        }
    };
    const winTex = canvasTexture(256, 256, drawWin(false));
    const winEm = canvasTexture(256, 256, drawWin(true));
    const tints = [0x9aa5b8, 0xbcae9f, 0x8292aa, 0xc7bda9, 0x8f9bb0, 0x71829a, 0xa9b4c2];
    const sideMats = tints.map(
      (c) =>
        new THREE.MeshStandardMaterial({
          color: c,
          map: winTex,
          emissive: 0xffffff,
          emissiveMap: winEm,
          emissiveIntensity: 0.85,
          roughness: 0.6,
          metalness: 0.15,
        })
    );
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x4a4e57, roughness: 0.9 });
    const TILE = 48;

    const addBuilding = (cx: number, cz: number, w: number, d: number, h: number) => {
      const geo = new THREE.BoxGeometry(w, h, d);
      const uv = geo.attributes.uv as THREE.BufferAttribute;
      const ou = rand();
      const ov = rand();
      for (let k = 0; k < uv.count; k++) {
        const face = Math.floor(k / 4);
        if (face === 2 || face === 3) continue;
        const len = face < 2 ? d : w;
        uv.setXY(k, ou + (uv.getX(k) * len) / TILE, ov + (uv.getY(k) * h) / TILE);
      }
      const side = sideMats[Math.floor(rand() * sideMats.length)];
      const mesh = new THREE.Mesh(geo, [side, side, roofMat, roofMat, side, side]);
      mesh.position.set(cx, h / 2, cz);
      this.scene.add(mesh);
      this.boxes.push({
        minX: cx - w / 2,
        maxX: cx + w / 2,
        minZ: cz - d / 2,
        maxZ: cz + d / 2,
      });
    };

    const treeSpots: [number, number, number][] = [];
    const parkMat = new THREE.MeshStandardMaterial({ color: 0x4f8a4a, roughness: 1 });
    const blockHalf = (GRID - ROAD_W) / 2; // 33

    for (let bi = -4; bi < 4; bi++) {
      for (let bj = -4; bj < 4; bj++) {
        const cx = bi * GRID + GRID / 2;
        const cz = bj * GRID + GRID / 2;
        if (cx === B63.x && cz === B63.z) continue; // 63빌딩 부지

        // 여의도공원: 세로로 긴 녹지
        if (cx === -120 && Math.abs(cz) <= 200) {
          const park = new THREE.Mesh(
            new THREE.PlaneGeometry(blockHalf * 2 - 4, blockHalf * 2 - 4).rotateX(-Math.PI / 2),
            parkMat
          );
          park.position.set(cx, 0.1, cz);
          this.scene.add(park);
          this.parks.push({
            minX: cx - blockHalf,
            maxX: cx + blockHalf,
            minZ: cz - blockHalf,
            maxZ: cz + blockHalf,
          });
          for (let t = 0; t < 22; t++)
            treeSpots.push([
              cx + (rand() - 0.5) * 56,
              cz + (rand() - 0.5) * 56,
              0.9 + rand() * 0.9,
            ]);
          continue;
        }

        // 가로수
        for (let s = -1; s <= 1; s++) {
          const o = s * 20;
          const e = blockHalf - 2.2;
          treeSpots.push([cx + o, cz - e, 0.7], [cx + o, cz + e, 0.7]);
          treeSpots.push([cx - e, cz + o, 0.7], [cx + e, cz + o, 0.7]);
        }

        // 금융가(중앙)일수록 높은 빌딩
        const central = 1 - Math.min(1, Math.hypot(cx, cz) / 380);
        // 63빌딩 남쪽 블록은 저층으로 두어 도로에서 빌딩이 잘 보이게
        const lowRise = cx === B63.x;
        const tall = () =>
          lowRise
            ? 9 + rand() * 8
            : 14 + rand() * 26 + rand() * rand() * 70 * (0.4 + central);
        if (rand() < 0.22) {
          addBuilding(cx, cz, 40 + rand() * 12, 40 + rand() * 12, tall() * 1.15);
        } else {
          for (const sx of [-1, 1])
            for (const sz of [-1, 1]) {
              if (rand() < 0.08) continue;
              const w = 17 + rand() * 7;
              const d = 17 + rand() * 7;
              addBuilding(cx + sx * 14.5, cz + sz * 14.5, w, d, tall());
            }
        }
      }
    }

    // 나무 (인스턴싱)
    const trunkGeo = new THREE.CylinderGeometry(0.25, 0.35, 2.4, 6).translate(0, 1.2, 0);
    const leafGeo = new THREE.IcosahedronGeometry(2, 0).translate(0, 3.8, 0);
    const trunks = new THREE.InstancedMesh(
      trunkGeo,
      new THREE.MeshStandardMaterial({ color: 0x5b4030, roughness: 1 }),
      treeSpots.length
    );
    const leaves = new THREE.InstancedMesh(
      leafGeo,
      new THREE.MeshStandardMaterial({ color: 0x3f7a3d, roughness: 1, flatShading: true }),
      treeSpots.length
    );
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    treeSpots.forEach(([x, z, s], i) => {
      q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, rand() * 6.28);
      m.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(s, s, s));
      trunks.setMatrixAt(i, m);
      leaves.setMatrixAt(i, m);
    });
    this.scene.add(trunks, leaves);
  }

  private build63() {
    // 황금빛 유리 커튼월: 아래쪽이 넓게 퍼지는 63빌딩 특유의 곡선 실루엣
    const H = B63.height;
    const s = new THREE.Shape();
    s.moveTo(-B63.halfZ, 0);
    s.quadraticCurveTo(-9.5, 35, -9, 100);
    s.lineTo(-8, H);
    s.lineTo(8, H);
    s.lineTo(9, 100);
    s.quadraticCurveTo(9.5, 35, B63.halfZ, 0);
    s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, {
      depth: B63.halfX * 2,
      bevelEnabled: false,
      curveSegments: 20,
    });
    geo.translate(0, 0, -B63.halfX);
    geo.rotateY(Math.PI / 2);

    const drawGlass = (emissive: boolean) => (ctx: CanvasRenderingContext2D) => {
      const g = ctx.createLinearGradient(0, 0, 64, 64);
      if (emissive) {
        g.addColorStop(0, "#7a5210");
        g.addColorStop(1, "#4a3008");
      } else {
        g.addColorStop(0, "#ffd772");
        g.addColorStop(1, "#d99a2b");
      }
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 64, 64);
      ctx.strokeStyle = emissive ? "#1a1000" : "#8a5f14";
      ctx.lineWidth = 5;
      ctx.strokeRect(0, 0, 64, 64);
    };
    const tex = canvasTexture(64, 64, drawGlass(false));
    const em = canvasTexture(64, 64, drawGlass(true));
    tex.repeat.set(0.25, 0.25);
    em.repeat.set(0.25, 0.25);
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      emissive: 0xffffff,
      emissiveMap: em,
      emissiveIntensity: 0.9,
      metalness: 0.55,
      roughness: 0.22,
    });
    const tower = new THREE.Mesh(geo, mat);
    tower.position.set(B63.x, 0, B63.z);
    this.scene.add(tower);

    // 저층 포디움, 옥상 설비, 항공 장애등
    const dark = new THREE.MeshStandardMaterial({ color: 0x5a4a2c, roughness: 0.6 });
    const podium = new THREE.Mesh(new THREE.BoxGeometry(52, 7, 22), dark);
    podium.position.set(B63.x, 3.5, B63.z + 20);
    this.scene.add(podium);
    const crown = new THREE.Mesh(new THREE.BoxGeometry(30, 6, 10), dark);
    crown.position.set(B63.x, H + 3, B63.z);
    this.scene.add(crown);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 22, 6), dark);
    mast.position.set(B63.x, H + 17, B63.z);
    this.scene.add(mast);
    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(1.6, 12, 8),
      new THREE.MeshBasicMaterial({ color: 0xff3b30, fog: false })
    );
    beacon.position.set(B63.x, H + 29, B63.z);
    this.scene.add(beacon);

    // 이름표
    const label = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: canvasTexture(
          512,
          128,
          (ctx) => {
            ctx.font = "bold 84px sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.lineWidth = 10;
            ctx.strokeStyle = "rgba(40,20,0,0.85)";
            ctx.strokeText("63빌딩", 256, 66);
            ctx.fillStyle = "#ffe08a";
            ctx.fillText("63빌딩", 256, 66);
          },
          false
        ),
        transparent: true,
        depthWrite: false,
        fog: false,
      })
    );
    label.scale.set(80, 20, 1);
    label.position.set(B63.x, H + 48, B63.z);
    this.scene.add(label);

    this.boxes.push(
      {
        minX: B63.x - B63.halfX,
        maxX: B63.x + B63.halfX,
        minZ: B63.z - B63.halfZ,
        maxZ: B63.z + B63.halfZ,
      },
      { minX: B63.x - 26, maxX: B63.x + 26, minZ: B63.z + 9, maxZ: B63.z + 31 }
    );
  }

  private spawnTraffic() {
    const colors = [0xf5f5f5, 0x1d3557, 0x2a9d8f, 0xe9c46a, 0x6c757d, 0x111111, 0xf4a261, 0xffffff];
    for (let i = 0; i < 40; i++) {
      const isTaxi = i % 6 === 0;
      const mesh = makeCar(isTaxi ? 0xff8c1a : colors[i % colors.length]);
      this.scene.add(mesh);
      const baseSpeed = 13 + Math.random() * 8;
      const npc: Npc = {
        mesh,
        axis: Math.random() < 0.5 ? "x" : "z",
        line: LINES[Math.floor(Math.random() * LINES.length)],
        t: (Math.random() - 0.5) * 2 * (EDGE - 10),
        dir: Math.random() < 0.5 ? 1 : -1,
        speed: baseSpeed,
        baseSpeed,
        x: 0,
        z: 0,
        stun: 0,
        hitCd: 0,
      };
      this.placeNpc(npc);
      this.npcs.push(npc);
    }
  }

  private placeNpc(n: Npc) {
    // 우측통행
    if (n.axis === "z") {
      n.x = n.line - n.dir * LANE;
      n.z = n.t;
      n.mesh.rotation.y = n.dir > 0 ? 0 : Math.PI;
    } else {
      n.x = n.t;
      n.z = n.line + n.dir * LANE;
      n.mesh.rotation.y = n.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    n.mesh.position.set(n.x, 0, n.z);
  }

  /* ----------------------------- 미션 ----------------------------- */

  private randomRoadPoint(minDist: number, from = this.player) {
    for (let i = 0; i < 60; i++) {
      const line = LINES[Math.floor(Math.random() * LINES.length)];
      const t = (Math.random() - 0.5) * 2 * (EDGE - 20);
      const p = Math.random() < 0.5 ? { x: line, z: t } : { x: t, z: line };
      if (Math.hypot(p.x - from.x, p.z - from.z) >= minDist) return p;
    }
    return { x: -from.x, z: -from.z };
  }

  private newPickup() {
    this.phase = "pickup";
    this.missionName = MISSIONS[Math.floor(Math.random() * MISSIONS.length)];
    this.target = this.randomRoadPoint(90);
    this.markerMat.color.set(0xffd60a);
    this.marker.position.set(this.target.x, 0, this.target.z);
  }

  private startDelivery() {
    this.phase = "deliver";
    this.target = this.randomRoadPoint(200);
    const manhattan =
      Math.abs(this.target.x - this.player.x) + Math.abs(this.target.z - this.player.z);
    this.timeLeft = manhattan / 17 + 12;
    this.reward = Math.round((manhattan * 28) / 100) * 100 + 3000;
    this.markerMat.color.set(0x38e07b);
    this.marker.position.set(this.target.x, 0, this.target.z);
    this.say(`${this.missionName} 픽업 완료! 초록 지점으로 배달하세요`);
  }

  private say(msg: string) {
    this.message = msg;
    this.messageTimer = 3.2;
  }

  /* ----------------------------- 물리 ----------------------------- */

  /** 원형 몸체를 건물 AABB에서 밀어내고 충돌 속도를 반환 */
  private collide(o: Body, r: number) {
    let impact = 0;
    for (const b of this.boxes) {
      const cx = clamp(o.x, b.minX, b.maxX);
      const cz = clamp(o.z, b.minZ, b.maxZ);
      let dx = o.x - cx;
      let dz = o.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      let pen: number;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        dx /= d;
        dz /= d;
        pen = r - d;
      } else {
        // 완전히 내부: 가장 가까운 면으로
        const l = o.x - b.minX;
        const rr = b.maxX - o.x;
        const t = o.z - b.minZ;
        const bb = b.maxZ - o.z;
        const mn = Math.min(l, rr, t, bb);
        dx = mn === l ? -1 : mn === rr ? 1 : 0;
        dz = dx !== 0 ? 0 : mn === t ? -1 : 1;
        pen = mn + r;
      }
      o.x += dx * pen;
      o.z += dz * pen;
      const vn = o.vx * dx + o.vz * dz;
      if (vn < 0) {
        o.vx -= vn * dx * 1.25;
        o.vz -= vn * dz * 1.25;
        impact = Math.max(impact, -vn);
      }
    }
    if (Math.abs(o.x) > LIMIT) {
      o.x = clamp(o.x, -LIMIT, LIMIT);
      o.vx = 0;
    }
    if (Math.abs(o.z) > LIMIT) {
      o.z = clamp(o.z, -LIMIT, LIMIT);
      o.vz = 0;
    }
    return impact;
  }

  private damage(amount: number) {
    this.health = Math.max(0, this.health - amount);
    if (this.health <= 0 && this.status === "playing") {
      this.status = "wrecked";
      this.emitHud();
    }
  }

  private forwardSpeed() {
    const p = this.player;
    return p.vx * Math.sin(p.h) + p.vz * Math.cos(p.h);
  }

  private updatePlayer(dt: number) {
    const p = this.player;
    const k = this.keys;
    const throttle = (k.up ? 1 : 0) - (k.down ? 1 : 0);
    const steer = (k.left ? 1 : 0) - (k.right ? 1 : 0);

    let vF = this.forwardSpeed();
    const sr = Math.min(Math.abs(vF) / MAX_SPEED, 1);
    p.h += steer * (k.brake ? 3.1 : 2.4) * clamp(vF / 9, -1, 1) * (1 - 0.4 * sr) * dt;

    const fx = Math.sin(p.h);
    const fz = Math.cos(p.h);
    const rx = -fz;
    const rz = fx;
    vF = p.vx * fx + p.vz * fz;
    let vL = p.vx * rx + p.vz * rz;

    const power = 0.45 + 0.55 * (this.health / 100); // 파손될수록 출력 저하
    if (throttle > 0) vF += 30 * power * (1 - Math.max(vF, 0) / MAX_SPEED) * dt;
    else if (throttle < 0) {
      if (vF > 0.5) vF -= 55 * dt;
      else vF = Math.max(vF - 16 * dt, -16);
    } else vF -= Math.sign(vF) * Math.min(Math.abs(vF), 4 * dt);
    vF -= vF * 0.3 * dt;
    if (k.brake) vF -= Math.sign(vF) * Math.min(Math.abs(vF), 26 * dt);
    vL *= Math.exp(-(k.brake ? 1.6 : 8.5) * dt);

    p.vx = fx * vF + rx * vL;
    p.vz = fz * vF + rz * vL;
    p.x += p.vx * dt;
    p.z += p.vz * dt;

    const impact = this.collide(p, CAR_R);
    this.wallCd -= dt;
    if (impact > 11 && this.wallCd <= 0) {
      this.wallCd = 0.4;
      this.damage((impact - 11) * 0.55);
      this.say("쾅! 건물에 충돌했습니다");
    }
  }

  private updateNpcs(dt: number) {
    const p = this.player;
    for (const n of this.npcs) {
      n.hitCd -= dt;
      n.stun -= dt;

      // 진행 방향
      const fx = n.axis === "x" ? n.dir : 0;
      const fz = n.axis === "z" ? n.dir : 0;
      const dx = p.x - n.x;
      const dz = p.z - n.z;
      const ahead = dx * fx + dz * fz;
      const side = Math.abs(dx * fz - dz * fx);
      let target = n.baseSpeed;
      if (n.stun > 0 || (ahead > 0 && ahead < 15 && side < 3.2)) target = 0;
      n.speed += clamp(target - n.speed, -45 * dt, 10 * dt);

      const prev = n.t;
      n.t += n.dir * n.speed * dt;
      const ca = Math.floor((prev + EDGE) / GRID);
      const cb = Math.floor((n.t + EDGE) / GRID);
      if (ca !== cb) {
        const g = (n.dir > 0 ? cb : ca) * GRID - EDGE;
        const mustTurn = Math.abs(g) >= EDGE && Math.sign(g) === n.dir;
        if (mustTurn || Math.random() < 0.35) {
          const oldLine = n.line;
          n.axis = n.axis === "x" ? "z" : "x";
          n.line = g;
          let nd: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
          if (Math.abs(oldLine) >= EDGE) nd = oldLine > 0 ? -1 : 1;
          n.dir = nd;
          n.t = oldLine + nd * 0.01;
        }
      }
      this.placeNpc(n);

      // 플레이어와 충돌
      const ddx = p.x - n.x;
      const ddz = p.z - n.z;
      const d = Math.hypot(ddx, ddz);
      if (d < 3.5 && d > 1e-4) {
        const nx = ddx / d;
        const nz = ddz / d;
        p.x += nx * (3.5 - d);
        p.z += nz * (3.5 - d);
        const vn = p.vx * nx + p.vz * nz - n.speed * (fx * nx + fz * nz);
        if (vn < 0) {
          p.vx -= vn * nx * 1.4;
          p.vz -= vn * nz * 1.4;
        }
        if (n.hitCd <= 0) {
          n.hitCd = 0.7;
          n.stun = 1.6;
          this.damage(3 + Math.abs(vn) * 0.45);
          this.heat = Math.min(100, this.heat + 22);
          this.say("접촉 사고! 수배 레벨이 올라갑니다");
        }
      }
    }
  }

  private wantedLevel() {
    return this.heat >= 85 ? 3 : this.heat >= 50 ? 2 : this.heat >= 20 ? 1 : 0;
  }

  private updatePolice(dt: number) {
    const p = this.player;
    this.heat = Math.max(0, this.heat - 1.6 * dt);
    const level = this.wantedLevel();

    while (this.police.length < level) {
      const pt = this.randomRoadPoint(130);
      const made = makeCar(0xf8f9fa, true);
      this.scene.add(made);
      const lights = made.userData.lights as THREE.MeshStandardMaterial[];
      this.police.push({
        mesh: made,
        x: pt.x,
        z: pt.z,
        vx: 0,
        vz: 0,
        h: Math.atan2(p.x - pt.x, p.z - pt.z),
        speed: 0,
        hitCd: 0,
        red: lights[0],
        blue: lights[1],
      });
    }
    while (this.police.length > level) {
      const gone = this.police.pop()!;
      this.scene.remove(gone.mesh);
      if (level === 0) this.say("경찰을 따돌렸습니다");
    }

    let near = false;
    const flash = Math.floor(this.time * 6) % 2 === 0;
    for (const c of this.police) {
      c.hitCd -= dt;
      const dx = p.x - c.x;
      const dz = p.z - c.z;
      const dist = Math.hypot(dx, dz);
      c.h += clamp(wrapAngle(Math.atan2(dx, dz) - c.h), -2.6 * dt, 2.6 * dt);
      const target = dist < 9 ? 8 : 42 + level * 3;
      c.speed += clamp(target - c.speed, -50 * dt, 22 * dt);
      c.vx = Math.sin(c.h) * c.speed;
      c.vz = Math.cos(c.h) * c.speed;
      c.x += c.vx * dt;
      c.z += c.vz * dt;
      if (this.collide(c, CAR_R) > 4) c.speed *= 0.6;

      if (dist < 3.6 && dist > 1e-4) {
        const nx = dx / dist;
        const nz = dz / dist;
        p.x += nx * (3.6 - dist) * 0.6;
        p.z += nz * (3.6 - dist) * 0.6;
        c.x -= nx * (3.6 - dist) * 0.4;
        c.z -= nz * (3.6 - dist) * 0.4;
        if (c.hitCd <= 0) {
          c.hitCd = 0.9;
          p.vx = p.vx * 0.7 + nx * 5;
          p.vz = p.vz * 0.7 + nz * 5;
          c.speed *= 0.4;
          this.damage(5);
        }
      }
      if (dist < 8) near = true;

      c.mesh.position.set(c.x, 0, c.z);
      c.mesh.rotation.y = c.h;
      c.red.emissiveIntensity = flash ? 3 : 0.1;
      c.blue.emissiveIntensity = flash ? 0.1 : 3;
    }

    // 경찰 옆에서 멈춰 있으면 검거
    if (near && Math.hypot(p.vx, p.vz) < 4) this.bustTimer += dt;
    else this.bustTimer = Math.max(0, this.bustTimer - dt * 2);
    if (this.bustTimer > 2 && this.status === "playing") {
      this.status = "busted";
      this.emitHud();
    }
  }

  private updateMission(dt: number) {
    const p = this.player;
    const d = Math.hypot(this.target.x - p.x, this.target.z - p.z);
    if (this.phase === "pickup") {
      if (d < 7) this.startDelivery();
    } else {
      this.timeLeft -= dt;
      if (d < 7) {
        const bonus = Math.round((this.timeLeft * 150) / 100) * 100;
        const total = this.reward + bonus;
        this.money += total;
        this.deliveries++;
        this.health = Math.min(100, this.health + 15);
        this.newPickup();
        this.say(`배달 성공! +₩${total.toLocaleString("ko-KR")} (차량 수리 +15)`);
      } else if (this.timeLeft <= 0) {
        this.newPickup();
        this.say("시간 초과… 배달 실패. 새 주문을 받으세요");
      }
    }
    this.marker.scale.y = 1 + Math.sin(this.time * 3) * 0.05;
    this.markerMat.opacity = 0.3 + Math.sin(this.time * 4) * 0.08;
  }

  /* ----------------------------- 카메라/렌더 ----------------------------- */

  private syncPlayerMesh() {
    const p = this.player;
    this.playerMesh.position.set(p.x, 0, p.z);
    this.playerMesh.rotation.y = p.h;
  }

  private cameraGoal(out: THREE.Vector3) {
    const p = this.player;
    const sr = Math.min(Math.abs(this.forwardSpeed()) / MAX_SPEED, 1);
    const back = 12.5 + sr * 4;
    return out.set(p.x - Math.sin(p.h) * back, 5.6 + sr * 0.8, p.z - Math.cos(p.h) * back);
  }

  private tmp = new THREE.Vector3();

  private snapCamera() {
    this.camera.position.copy(this.cameraGoal(this.tmp));
    this.lookAtPlayer();
  }

  private lookAtPlayer() {
    const p = this.player;
    this.camera.lookAt(p.x + Math.sin(p.h) * 6, 2.2, p.z + Math.cos(p.h) * 6);
  }

  private updateCamera(dt: number) {
    if (!this.started) {
      // 시작 화면: 63빌딩 주위를 도는 카메라
      const a = this.time * 0.12 + 1.9;
      this.camera.position.set(B63.x + Math.sin(a) * 250, 70, B63.z + Math.cos(a) * 250);
      this.camera.lookAt(B63.x, 105, B63.z);
      return;
    }
    this.camera.position.lerp(this.cameraGoal(this.tmp), 1 - Math.exp(-5.5 * dt));
    this.lookAtPlayer();
    const sr = Math.min(Math.abs(this.forwardSpeed()) / MAX_SPEED, 1);
    const fov = 60 + sr * 14;
    if (Math.abs(fov - this.camera.fov) > 0.05) {
      this.camera.fov += (fov - this.camera.fov) * Math.min(1, dt * 4);
      this.camera.updateProjectionMatrix();
    }
  }

  private loop = (t: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min((t - (this.last || t)) / 1000, 0.05);
    this.last = t;
    this.time += dt;

    const active = this.started && !this.paused && this.status === "playing";
    if (active) {
      this.updatePlayer(dt);
      this.updateNpcs(dt);
      this.updatePolice(dt);
      this.updateMission(dt);
      this.syncPlayerMesh();
      if (this.messageTimer > 0) {
        this.messageTimer -= dt;
        if (this.messageTimer <= 0) this.message = "";
      }
    } else if (!this.started) {
      this.updateNpcsIdle(dt);
    }
    if (!this.paused) this.updateCamera(dt);
    this.renderer.render(this.scene, this.camera);

    this.hudTimer -= dt;
    if (this.hudTimer <= 0) {
      this.hudTimer = 0.1;
      this.emitHud();
      this.drawMinimap();
    }
  };

  /** 시작 화면에서도 교통은 흐르게 */
  private updateNpcsIdle(dt: number) {
    const saved = { ...this.player };
    this.player.x = 9999; // 플레이어와 상호작용 없음
    this.updateNpcs(dt);
    Object.assign(this.player, saved);
  }

  private emitHud() {
    const p = this.player;
    const pickup = this.phase === "pickup";
    this.onHud({
      speed: Math.round(Math.abs(this.forwardSpeed()) * 3.3),
      health: Math.round(this.health),
      money: this.money,
      deliveries: this.deliveries,
      wanted: this.wantedLevel(),
      missionTitle: pickup ? `주문 접수: ${this.missionName}` : `배달 중: ${this.missionName}`,
      missionDetail: pickup
        ? "노란 기둥으로 가서 물건을 픽업하세요"
        : `초록 기둥까지 배달 · 보수 ₩${this.reward.toLocaleString("ko-KR")}`,
      timeLeft: pickup ? null : Math.max(0, this.timeLeft),
      distance: Math.round(Math.hypot(this.target.x - p.x, this.target.z - p.z)),
      status: this.status,
      message: this.message,
    });
  }

  /* ----------------------------- 미니맵 ----------------------------- */

  private buildMinimapBg() {
    const S = this.minimap.width;
    const c = document.createElement("canvas");
    c.width = c.height = S;
    const ctx = c.getContext("2d")!;
    const k = S / (HALF * 2 + 40);
    const m = (v: number) => (v + HALF + 20) * k;
    ctx.fillStyle = "#274b63";
    ctx.fillRect(0, 0, S, S);
    ctx.fillStyle = "#3b4048";
    ctx.fillRect(m(-HALF), m(-HALF), HALF * 2 * k, HALF * 2 * k);
    ctx.fillStyle = "#3f7a45";
    for (const b of this.parks)
      ctx.fillRect(m(b.minX), m(b.minZ), (b.maxX - b.minX) * k, (b.maxZ - b.minZ) * k);
    ctx.strokeStyle = "#9aa0aa";
    ctx.lineWidth = Math.max(2, ROAD_W * k);
    for (const l of LINES) {
      ctx.beginPath();
      ctx.moveTo(m(l), m(-HALF));
      ctx.lineTo(m(l), m(HALF));
      ctx.moveTo(m(-HALF), m(l));
      ctx.lineTo(m(HALF), m(l));
      ctx.stroke();
    }
    ctx.fillStyle = "#f5b82e";
    ctx.fillRect(m(B63.x - 24), m(B63.z - 20), 48 * k, 40 * k);
    ctx.fillStyle = "#2b1a00";
    ctx.font = `bold ${Math.round(S * 0.055)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("63", m(B63.x), m(B63.z) + 1);
    return c;
  }

  private drawMinimap() {
    const S = this.minimap.width;
    const ctx = this.minimap.getContext("2d");
    if (!ctx) return;
    const k = S / (HALF * 2 + 40);
    const m = (v: number) => (v + HALF + 20) * k;
    ctx.drawImage(this.mapBg, 0, 0);

    // 목표 지점
    const pulse = 5 + Math.sin(this.time * 5) * 1.5;
    ctx.fillStyle = this.phase === "pickup" ? "#ffd60a" : "#38e07b";
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(m(this.target.x), m(this.target.z), pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 경찰
    const flash = Math.floor(this.time * 6) % 2 === 0;
    for (const c of this.police) {
      ctx.fillStyle = flash ? "#ff3b30" : "#3b82f6";
      ctx.beginPath();
      ctx.arc(m(c.x), m(c.z), 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // 플레이어 화살표
    const p = this.player;
    ctx.save();
    ctx.translate(m(p.x), m(p.z));
    ctx.rotate(-p.h);
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#d62839";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 8);
    ctx.lineTo(-5.5, -6);
    ctx.lineTo(0, -3);
    ctx.lineTo(5.5, -6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

/* ----------------------------- 차량 모델 ----------------------------- */

const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.34, 12).rotateZ(Math.PI / 2);
const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
const glassMat = new THREE.MeshStandardMaterial({
  color: 0x1b2430,
  roughness: 0.15,
  metalness: 0.6,
});
const headMat = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  emissive: 0xfff2c4,
  emissiveIntensity: 2.5,
});
const tailMat = new THREE.MeshStandardMaterial({
  color: 0xff2222,
  emissive: 0xff1111,
  emissiveIntensity: 2,
});

/** +z 방향이 앞인 박스형 자동차 */
function makeCar(color: number, police = false) {
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.45 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.7, 4.4), paint);
  body.position.y = 0.78;
  g.add(body);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.62, 2.2), glassMat);
  cabin.position.set(0, 1.42, -0.25);
  g.add(cabin);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.76, 0.08, 2.0), paint);
  roof.position.set(0, 1.76, -0.25);
  g.add(roof);

  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.position.set(sx * 1.0, 0.42, sz * 1.4);
      g.add(w);
      const lamp = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.2, 0.08),
        sz > 0 ? headMat : tailMat
      );
      lamp.position.set(sx * 0.65, 0.88, sz * 2.21);
      g.add(lamp);
    }

  if (police) {
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(2.04, 0.24, 4.44),
      new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.4 })
    );
    stripe.position.y = 0.78;
    g.add(stripe);
    const red = new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xff0000 });
    const blue = new THREE.MeshStandardMaterial({ color: 0x2255ff, emissive: 0x0033ff });
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.4), red);
    l.position.set(-0.4, 1.92, -0.25);
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.4), blue);
    r.position.set(0.4, 1.92, -0.25);
    g.add(l, r);
    g.userData.lights = [red, blue];
  }
  return g;
}
