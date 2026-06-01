"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import {
  VRM,
  VRMLoaderPlugin,
  VRMUtils,
  VRMHumanBoneName,
} from "@pixiv/three-vrm";

type CharacterActionType = "send" | "ok" | "no";

type CharacterAction = {
  type: CharacterActionType;
  nonce: number;
};

type VrmCharacterProps = {
  action?: CharacterAction;
};

type FloatingParticle = {
  sprite: THREE.Sprite;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  rotationSpeed: number;
  scaleUpSpeed: number;
  gravity: number;
};

const IDLE_ANIMATION_URL = "/models/Happy%20Idle.fbx";

const ACTION_ANIMATION_URLS: Record<CharacterActionType, string> = {
  send: "/models/Send.fbx",
  ok: "/models/OK.fbx",
  no: "/models/NO.fbx",
};

const ARM_DOWN_CORRECTION = 2.1;

// 先生指定のサイズ。ここは変えない。
const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 220;

const CAMERA_FOV = 24;
const CAMERA_POSITION = new THREE.Vector3(0, -0.55, 4.25);
const CAMERA_LOOK_AT = new THREE.Vector3(0, 0.55, 0);

// 先生が調整済みの位置。ここも変えない。
const MODEL_POSITION_X = -0.85;
const MODEL_POSITION_Y = -0.0;
const MODEL_POSITION_Z = 0;
const MODEL_ROTATION_Y = Math.PI;

const mixamoVRMRigMap: Partial<Record<string, VRMHumanBoneName>> = {
  mixamorigHips: VRMHumanBoneName.Hips,
  mixamorigSpine: VRMHumanBoneName.Spine,
  mixamorigSpine1: VRMHumanBoneName.Chest,
  mixamorigSpine2: VRMHumanBoneName.UpperChest,
  mixamorigNeck: VRMHumanBoneName.Neck,
  mixamorigHead: VRMHumanBoneName.Head,

  mixamorigLeftShoulder: VRMHumanBoneName.LeftShoulder,
  mixamorigLeftArm: VRMHumanBoneName.LeftUpperArm,
  mixamorigLeftForeArm: VRMHumanBoneName.LeftLowerArm,
  mixamorigLeftHand: VRMHumanBoneName.LeftHand,

  mixamorigRightShoulder: VRMHumanBoneName.RightShoulder,
  mixamorigRightArm: VRMHumanBoneName.RightUpperArm,
  mixamorigRightForeArm: VRMHumanBoneName.RightLowerArm,
  mixamorigRightHand: VRMHumanBoneName.RightHand,

  mixamorigLeftUpLeg: VRMHumanBoneName.LeftUpperLeg,
  mixamorigLeftLeg: VRMHumanBoneName.LeftLowerLeg,
  mixamorigLeftFoot: VRMHumanBoneName.LeftFoot,
  mixamorigLeftToeBase: VRMHumanBoneName.LeftToes,

  mixamorigRightUpLeg: VRMHumanBoneName.RightUpperLeg,
  mixamorigRightLeg: VRMHumanBoneName.RightLowerLeg,
  mixamorigRightFoot: VRMHumanBoneName.RightFoot,
  mixamorigRightToeBase: VRMHumanBoneName.RightToes,
};

function getArmCorrection(vrmBoneName: VRMHumanBoneName) {
  if (vrmBoneName === VRMHumanBoneName.LeftUpperArm) {
    return new THREE.Quaternion().setFromEuler(
      new THREE.Euler(0, 0, ARM_DOWN_CORRECTION)
    );
  }

  if (vrmBoneName === VRMHumanBoneName.RightUpperArm) {
    return new THREE.Quaternion().setFromEuler(
      new THREE.Euler(0, 0, -ARM_DOWN_CORRECTION)
    );
  }

  return null;
}

async function loadMixamoAnimation(
  url: string,
  name: string,
  vrm: VRM
): Promise<THREE.AnimationClip> {
  const loader = new FBXLoader();
  const asset = await loader.loadAsync(url);

  const sourceClip = asset.animations[0];
  const tracks: THREE.KeyframeTrack[] = [];

  const restRotationInverse = new THREE.Quaternion();
  const parentRestWorldRotation = new THREE.Quaternion();
  const quatA = new THREE.Quaternion();

  sourceClip.tracks.forEach((track) => {
    const trackParts = track.name.split(".");
    const mixamoBoneName = trackParts[0];
    const propertyName = trackParts[1];

    const vrmBoneName = mixamoVRMRigMap[mixamoBoneName];
    if (!vrmBoneName) return;

    const vrmBoneNode = vrm.humanoid.getNormalizedBoneNode(vrmBoneName);
    const mixamoBoneNode = asset.getObjectByName(mixamoBoneName);

    if (!vrmBoneNode || !mixamoBoneNode) return;

    const vrmNodeName = vrmBoneNode.name;

    if (track instanceof THREE.QuaternionKeyframeTrack) {
      mixamoBoneNode.getWorldQuaternion(restRotationInverse).invert();

      if (mixamoBoneNode.parent) {
        mixamoBoneNode.parent.getWorldQuaternion(parentRestWorldRotation);
      } else {
        parentRestWorldRotation.identity();
      }

      const values = track.values.slice();
      const armCorrection = getArmCorrection(vrmBoneName);

      for (let i = 0; i < values.length; i += 4) {
        const flatQuaternion = quatA.fromArray(values, i);

        flatQuaternion
          .premultiply(parentRestWorldRotation)
          .multiply(restRotationInverse);

        if (armCorrection) {
          flatQuaternion.premultiply(armCorrection);
        }

        flatQuaternion.toArray(values, i);
      }

      tracks.push(
        new THREE.QuaternionKeyframeTrack(
          `${vrmNodeName}.quaternion`,
          track.times,
          values
        )
      );

      return;
    }

    if (
      track instanceof THREE.VectorKeyframeTrack &&
      propertyName === "position"
    ) {
      return;
    }
  });

  return new THREE.AnimationClip(name, sourceClip.duration, tracks);
}

function createSparkleTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 96;

  const context = canvas.getContext("2d");
  if (!context) return null;

  context.clearRect(0, 0, 96, 96);

  const cx = 48;
  const cy = 48;

  context.save();
  context.translate(cx, cy);

  context.fillStyle = "rgba(255, 245, 150, 0.45)";
  context.beginPath();
  context.moveTo(0, -42);
  context.bezierCurveTo(5, -12, 12, -5, 42, 0);
  context.bezierCurveTo(12, 5, 5, 12, 0, 42);
  context.bezierCurveTo(-5, 12, -12, 5, -42, 0);
  context.bezierCurveTo(-12, -5, -5, -12, 0, -42);
  context.closePath();
  context.fill();

  context.fillStyle = "rgba(255, 255, 255, 0.95)";
  context.beginPath();
  context.moveTo(0, -30);
  context.bezierCurveTo(3.5, -8, 8, -3.5, 30, 0);
  context.bezierCurveTo(8, 3.5, 3.5, 8, 0, 30);
  context.bezierCurveTo(-3.5, 8, -8, 3.5, -30, 0);
  context.bezierCurveTo(-8, -3.5, -3.5, -8, 0, -30);
  context.closePath();
  context.fill();

  context.fillStyle = "rgba(255, 226, 80, 0.95)";
  context.beginPath();
  context.arc(0, 0, 5, 0, Math.PI * 2);
  context.fill();

  context.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function createTextTexture(text: string, color = "#ffd84d") {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;

  const context = canvas.getContext("2d");
  if (!context) return null;

  context.clearRect(0, 0, 256, 256);

  context.font = "bold 180px sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";

  context.lineWidth = 18;
  context.strokeStyle = "rgba(255, 255, 255, 0.98)";
  context.strokeText(text, 128, 128);

  context.fillStyle = color;
  context.fillText(text, 128, 128);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

export default function VrmCharacter({ action }: VrmCharacterProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [message, setMessage] = useState("VRM読み込み中...");

  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const idleActionRef = useRef<THREE.AnimationAction | null>(null);
  const actionRefs = useRef<
    Partial<Record<CharacterActionType, THREE.AnimationAction>>
  >({});

  const previousNonceRef = useRef(action?.nonce ?? 0);
  const returnToIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const sparkleDelayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const vrmRef = useRef<VRM | null>(null);
  const modelRootRef = useRef<THREE.Group | null>(null);
  const baseVrmPositionRef = useRef<THREE.Vector3 | null>(null);
  const baseVrmScaleRef = useRef<number>(1);

  const sparkleGroupRef = useRef<THREE.Group | null>(null);
  const sparkleParticlesRef = useRef<FloatingParticle[]>([]);
  const createSparklesRef = useRef<(() => void) | null>(null);
  const clearSparklesRef = useRef<(() => void) | null>(null);

  const effectGroupRef = useRef<THREE.Group | null>(null);
  const effectParticlesRef = useRef<FloatingParticle[]>([]);
  const createMusicNotesRef = useRef<(() => void) | null>(null);
  const createQuestionMarksRef = useRef<(() => void) | null>(null);
  const clearEffectsRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(
      CAMERA_FOV,
      CANVAS_WIDTH / CANVAS_HEIGHT,
      0.1,
      100
    );

    camera.position.copy(CAMERA_POSITION);
    camera.lookAt(CAMERA_LOOK_AT);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
    });

    renderer.setSize(CANVAS_WIDTH, CANVAS_HEIGHT);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.domElement.style.display = "block";

    container.replaceChildren();
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 2.2));

    const light = new THREE.DirectionalLight(0xffffff, 3);
    light.position.set(1, 2, 3);
    scene.add(light);

    const modelRoot = new THREE.Group();
    modelRoot.position.set(MODEL_POSITION_X, MODEL_POSITION_Y, MODEL_POSITION_Z);
    modelRoot.rotation.set(0, MODEL_ROTATION_Y, 0);
    scene.add(modelRoot);
    modelRootRef.current = modelRoot;

    const sparkleGroup = new THREE.Group();
    scene.add(sparkleGroup);
    sparkleGroupRef.current = sparkleGroup;

    const effectGroup = new THREE.Group();
    scene.add(effectGroup);
    effectGroupRef.current = effectGroup;

    const sparkleTexture = createSparkleTexture();

    const musicNoteTextures = [
    createTextTexture("♪", "#ff6b6b"), // ピンク赤
    createTextTexture("♪", "#ffd84d"), // 黄色
    createTextTexture("♪", "#4dd8ff"), // 水色
    createTextTexture("♪", "#8ee86f"), // 黄緑
    createTextTexture("♪", "#c58cff"), // 紫
    ].filter((texture): texture is THREE.CanvasTexture => texture !== null);

    const questionTextures = [
    createTextTexture("?", "#ff6b6b"), // ピンク赤
    createTextTexture("?", "#ffd84d"), // 黄色
    createTextTexture("?", "#4dd8ff"), // 水色
    createTextTexture("?", "#8ee86f"), // 黄緑
    createTextTexture("?", "#c58cff"), // 紫
    ].filter((texture): texture is THREE.CanvasTexture => texture !== null);

    let animationId = 0;

    const clearSparkles = () => {
      sparkleParticlesRef.current.forEach((particle) => {
        sparkleGroupRef.current?.remove(particle.sprite);
        particle.sprite.material.dispose();
      });

      sparkleParticlesRef.current = [];
    };

    clearSparklesRef.current = clearSparkles;

    const clearEffects = () => {
      effectParticlesRef.current.forEach((particle) => {
        effectGroupRef.current?.remove(particle.sprite);
        particle.sprite.material.dispose();
      });

      effectParticlesRef.current = [];
    };

    clearEffectsRef.current = clearEffects;

    const createSparkles = () => {
      const group = sparkleGroupRef.current;
      if (!group || !sparkleTexture) return;

      clearSparkles();

      const sparkleColors = [
        new THREE.Color("#ffd84d"),
        new THREE.Color("#ffd84d"),
        new THREE.Color("#ffd84d"),
        new THREE.Color("#ffd84d"),
        new THREE.Color("#fff3a3"),
        new THREE.Color("#fff3a3"),
        new THREE.Color("#fff8cf"),
        new THREE.Color("#ffffff"),
      ];

      for (let i = 0; i < 18; i += 1) {
        const color =
          sparkleColors[Math.floor(Math.random() * sparkleColors.length)];

        const material = new THREE.SpriteMaterial({
          map: sparkleTexture,
          color,
          transparent: true,
          opacity: 0.9,
          depthWrite: false,
          blending: THREE.NormalBlending,
        });

        const sprite = new THREE.Sprite(material);

        sprite.position.set(
          MODEL_POSITION_X - 0.18 + Math.random() * 0.16,
          0.24 + Math.random() * 0.16,
          0.34 + Math.random() * 0.1
        );

        const size = 0.105 + Math.random() * 0.09;
        sprite.scale.set(size, size, size);

        const particle: FloatingParticle = {
          sprite,
          velocity: new THREE.Vector3(
            0.75 + Math.random() * 0.5,
            0.44 + Math.random() * 0.45,
            -0.08 + Math.random() * 0.16
          ),
          life: 0,
          maxLife: 1.6 + Math.random() * 0.7,
          rotationSpeed: -5 + Math.random() * 10,
          scaleUpSpeed: 0.25,
          gravity: 0.18,
        };

        sparkleParticlesRef.current.push(particle);
        group.add(sprite);
      }
    };

    createSparklesRef.current = createSparkles;

    const createMusicNotes = () => {
    const group = effectGroupRef.current;
    if (!group || musicNoteTextures.length === 0) return;

    clearEffects();

    // ばらけて見えるように、最初から散らした発生位置にする
    const notePositions = [
        { x: MODEL_POSITION_X + 0.52, y: 0.54 },
        { x: MODEL_POSITION_X + 0.74, y: 0.76 },
        { x: MODEL_POSITION_X + 0.98, y: 0.58 },
        { x: MODEL_POSITION_X + 1.18, y: 0.82 },
        { x: MODEL_POSITION_X + 1.34, y: 0.62 },
    ];

    for (let i = 0; i < notePositions.length; i += 1) {
        const texture =
        musicNoteTextures[Math.floor(Math.random() * musicNoteTextures.length)];

        const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        opacity: 0.98,
        depthWrite: false,
        blending: THREE.NormalBlending,
        });

        const sprite = new THREE.Sprite(material);

        const basePosition = notePositions[i];

        sprite.position.set(
        basePosition.x + (-0.04 + Math.random() * 0.08),
        basePosition.y + (-0.04 + Math.random() * 0.08),
        0.35
        );

        const size = 0.46 + Math.random() * 0.14;
        sprite.scale.set(size, size, size);

        const particle: FloatingParticle = {
        sprite,
        velocity: new THREE.Vector3(
            -0.02 + Math.random() * 0.16,
            0.12 + Math.random() * 0.12,
            0
        ),
        life: 0,
        maxLife: 1.45 + Math.random() * 0.45,
        rotationSpeed: -0.35 + Math.random() * 0.7,
        scaleUpSpeed: 0.04,
        gravity: 0.02,
        };

        effectParticlesRef.current.push(particle);
        group.add(sprite);
    }
    };

    createMusicNotesRef.current = createMusicNotes;

    const createQuestionMarks = () => {
    const group = effectGroupRef.current;
    if (!group || questionTextures.length === 0) return;

    clearEffects();

    // 重なりすぎないように、最初から位置をばらけさせる
    const questionPositions = [
        { x: MODEL_POSITION_X + 0.58, y: 0.58 },
        { x: MODEL_POSITION_X + 0.82, y: 0.82 },
        { x: MODEL_POSITION_X + 1.08, y: 0.62 },
        { x: MODEL_POSITION_X + 1.26, y: 0.86 },
    ];

    for (let i = 0; i < questionPositions.length; i += 1) {
        const texture =
        questionTextures[Math.floor(Math.random() * questionTextures.length)];

        const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        opacity: 0.98,
        depthWrite: false,
        blending: THREE.NormalBlending,
        });

        const sprite = new THREE.Sprite(material);

        const basePosition = questionPositions[i];

        sprite.position.set(
        basePosition.x + (-0.04 + Math.random() * 0.08),
        basePosition.y + (-0.04 + Math.random() * 0.08),
        0.35
        );

        const size = 0.48 + Math.random() * 0.14;
        sprite.scale.set(size, size, size);

        const particle: FloatingParticle = {
        sprite,
        velocity: new THREE.Vector3(
            -0.06 + Math.random() * 0.12,
            0.12 + Math.random() * 0.12,
            0
        ),
        life: 0,
        maxLife: 1.45 + Math.random() * 0.45,
        rotationSpeed: -0.35 + Math.random() * 0.7,
        scaleUpSpeed: 0.04,
        gravity: 0.02,
        };

        effectParticlesRef.current.push(particle);
        group.add(sprite);
    }
    };

    createQuestionMarksRef.current = createQuestionMarks;

    const updateParticles = (
      particles: FloatingParticle[],
      group: THREE.Group | null,
      delta: number
    ) => {
      if (!group) return;

      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const particle = particles[i];

        particle.life += delta;
        const progress = particle.life / particle.maxLife;

        particle.sprite.position.x += particle.velocity.x * delta;
        particle.sprite.position.y += particle.velocity.y * delta;
        particle.sprite.position.z += particle.velocity.z * delta;

        particle.velocity.y -= particle.gravity * delta;

        const material = particle.sprite.material as THREE.SpriteMaterial;
        material.rotation += particle.rotationSpeed * delta;
        material.opacity = Math.max(0, 0.95 * (1 - progress));

        const scaleUp = 1 + delta * particle.scaleUpSpeed;
        particle.sprite.scale.multiplyScalar(scaleUp);

        if (progress >= 1) {
          group.remove(particle.sprite);
          particle.sprite.material.dispose();
          particles.splice(i, 1);
        }
      }
    };

    const gltfLoader = new GLTFLoader();
    gltfLoader.register((parser) => new VRMLoaderPlugin(parser));

    gltfLoader.load(
      "/models/syukutokuma.vrm",
      async (gltf) => {
        const vrm = gltf.userData.vrm as VRM;

        VRMUtils.removeUnnecessaryVertices(vrm.scene);
        VRMUtils.removeUnnecessaryJoints(vrm.scene);

        const box = new THREE.Box3().setFromObject(vrm.scene);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        vrm.scene.position.sub(center);

        const maxSize = Math.max(size.x, size.y, size.z);
        const scale = 1.62 / maxSize;
        vrm.scene.scale.setScalar(scale);

        baseVrmPositionRef.current = vrm.scene.position.clone();
        baseVrmScaleRef.current = scale;

        modelRoot.add(vrm.scene);
        vrmRef.current = vrm;

        try {
          const idleClip = await loadMixamoAnimation(
            IDLE_ANIMATION_URL,
            "Happy Idle",
            vrm
          );

          const sendClip = await loadMixamoAnimation(
            ACTION_ANIMATION_URLS.send,
            "Send",
            vrm
          );

          const okClip = await loadMixamoAnimation(
            ACTION_ANIMATION_URLS.ok,
            "OK",
            vrm
          );

          const noClip = await loadMixamoAnimation(
            ACTION_ANIMATION_URLS.no,
            "NO",
            vrm
          );

          const mixer = new THREE.AnimationMixer(vrm.scene);
          mixerRef.current = mixer;

          const idleAction = mixer.clipAction(idleClip);
          idleAction.reset();
          idleAction.enabled = true;
          idleAction.paused = false;
          idleAction.setLoop(THREE.LoopRepeat, Infinity);
          idleAction.setEffectiveWeight(1);
          idleAction.play();
          idleActionRef.current = idleAction;

          const sendAction = mixer.clipAction(sendClip);
          const okAction = mixer.clipAction(okClip);
          const noAction = mixer.clipAction(noClip);

          [sendAction, okAction, noAction].forEach((singleAction) => {
            singleAction.reset();
            singleAction.enabled = false;
            singleAction.paused = false;
            singleAction.setLoop(THREE.LoopOnce, 1);
            singleAction.clampWhenFinished = false;
            singleAction.setEffectiveWeight(1);
          });

          actionRefs.current = {
            send: sendAction,
            ok: okAction,
            no: noAction,
          };

          setMessage("");
        } catch (error) {
          console.error(error);
          setMessage("アニメーションの読み込みに失敗しました");
        }
      },
      undefined,
      (error) => {
        console.error(error);
        setMessage("VRMの読み込みに失敗しました");
      }
    );

    const clock = new THREE.Clock();

    const lockCameraAndModel = () => {
      camera.position.copy(CAMERA_POSITION);
      camera.lookAt(CAMERA_LOOK_AT);

      const root = modelRootRef.current;
      if (root) {
        root.position.set(
          MODEL_POSITION_X,
          MODEL_POSITION_Y,
          MODEL_POSITION_Z
        );
        root.rotation.set(0, MODEL_ROTATION_Y, 0);
      }

      const vrm = vrmRef.current;
      const basePosition = baseVrmPositionRef.current;

      if (vrm && basePosition) {
        vrm.scene.position.copy(basePosition);
        vrm.scene.scale.setScalar(baseVrmScaleRef.current);
      }
    };

    const animate = () => {
      animationId = requestAnimationFrame(animate);

      const delta = clock.getDelta();

      if (mixerRef.current) {
        mixerRef.current.update(delta);
      }

      lockCameraAndModel();

      if (vrmRef.current) {
        vrmRef.current.update(delta);
      }

      updateParticles(
        sparkleParticlesRef.current,
        sparkleGroupRef.current,
        delta
      );

      updateParticles(effectParticlesRef.current, effectGroupRef.current, delta);

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationId);

      if (returnToIdleTimerRef.current) {
        clearTimeout(returnToIdleTimerRef.current);
        returnToIdleTimerRef.current = null;
      }

      if (sparkleDelayTimerRef.current) {
        clearTimeout(sparkleDelayTimerRef.current);
        sparkleDelayTimerRef.current = null;
      }

      clearSparkles();
      clearEffects();

      renderer.dispose();
      container.replaceChildren();

      mixerRef.current = null;
      idleActionRef.current = null;
      actionRefs.current = {};
      vrmRef.current = null;
      modelRootRef.current = null;
      baseVrmPositionRef.current = null;

      sparkleGroupRef.current = null;
      sparkleParticlesRef.current = [];
      createSparklesRef.current = null;
      clearSparklesRef.current = null;

      effectGroupRef.current = null;
      effectParticlesRef.current = [];
      createMusicNotesRef.current = null;
      createQuestionMarksRef.current = null;
      clearEffectsRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!action) return;
    if (action.nonce === previousNonceRef.current) return;

    previousNonceRef.current = action.nonce;

    const idle = idleActionRef.current;
    const targetAction = actionRefs.current[action.type];
    const mixer = mixerRef.current;

    if (!idle || !targetAction || !mixer) return;

    if (returnToIdleTimerRef.current) {
      clearTimeout(returnToIdleTimerRef.current);
      returnToIdleTimerRef.current = null;
    }

    if (sparkleDelayTimerRef.current) {
      clearTimeout(sparkleDelayTimerRef.current);
      sparkleDelayTimerRef.current = null;
    }

    clearSparklesRef.current?.();
    clearEffectsRef.current?.();

    Object.values(actionRefs.current).forEach((singleAction) => {
      if (!singleAction || singleAction === targetAction) return;
      singleAction.stop();
      singleAction.enabled = false;
    });

    idle.stop();

    targetAction.reset();
    targetAction.enabled = true;
    targetAction.paused = false;
    targetAction.setLoop(THREE.LoopOnce, 1);
    targetAction.clampWhenFinished = false;
    targetAction.setEffectiveWeight(1);
    targetAction.play();

    if (action.type === "send") {
      sparkleDelayTimerRef.current = setTimeout(() => {
        clearSparklesRef.current?.();
        createSparklesRef.current?.();
        sparkleDelayTimerRef.current = null;
      }, 1000);
    }

    if (action.type === "ok") {
      createMusicNotesRef.current?.();
    }

    if (action.type === "no") {
      createQuestionMarksRef.current?.();
    }

    mixer.update(0);

    const actionDurationMs =
      action.type === "send"
        ? Math.max(2400, targetAction.getClip().duration * 1000)
        : Math.max(1400, targetAction.getClip().duration * 1000);

    returnToIdleTimerRef.current = setTimeout(() => {
      const currentIdle = idleActionRef.current;
      const currentAction = actionRefs.current[action.type];
      const currentMixer = mixerRef.current;

      if (!currentIdle || !currentAction || !currentMixer) return;

      currentAction.stop();
      currentAction.enabled = false;

      currentIdle.reset();
      currentIdle.enabled = true;
      currentIdle.paused = false;
      currentIdle.setLoop(THREE.LoopRepeat, Infinity);
      currentIdle.setEffectiveWeight(1);
      currentIdle.play();

      currentMixer.update(0);
    }, actionDurationMs);
  }, [action]);

  return (
    <div className="relative h-[220px] w-[400px] overflow-visible">
      <div ref={containerRef} className="h-[220px] w-[400px]" />
      {message && <p className="text-sm text-slate-500">{message}</p>}
    </div>
  );
}