import React from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

const FACE_STORIES = {
  1: { title: "Mímica do azar", text: "O dado quase caiu da mesa. Ainda assim, ele voltou para a sua mão pedindo revanche.", aura: "from-rose-500/25 via-orange-400/10 to-transparent" },
  2: { title: "Passo cauteloso", text: "Nem toda vitória chega correndo. Às vezes ela só pede que você continue.", aura: "from-amber-500/25 via-yellow-300/10 to-transparent" },
  3: { title: "Faísca baixa", text: "Pouca sorte, mas o bastante para acender uma ideia nova.", aura: "from-amber-400/25 via-emerald-300/10 to-transparent" },
  4: { title: "Rolagem firme", text: "Nada espetacular. Nada perdido. É o tipo de resultado que constrói consistência.", aura: "from-cyan-500/25 via-sky-300/10 to-transparent" },
  5: { title: "Vento favorável", text: "O dado ainda gira bonito. Hoje a sorte está aprendendo seu nome.", aura: "from-sky-500/25 via-cyan-300/10 to-transparent" },
  6: { title: "Boa trilha", text: "Não é milagre. É caminho aberto.", aura: "from-teal-500/25 via-emerald-300/10 to-transparent" },
  7: { title: "Sinal promissor", text: "Tem chance boa vindo por perto. Vale insistir em algo que você quer.", aura: "from-emerald-500/25 via-lime-300/10 to-transparent" },
  8: { title: "Ritmo forte", text: "O dado encontrou cadência. Você também.", aura: "from-emerald-500/25 via-teal-300/10 to-transparent" },
  9: { title: "Sorte em marcha", text: "Um resultado sólido, limpo, sem truque. O tipo que dá gosto de ver.", aura: "from-violet-500/25 via-sky-300/10 to-transparent" },
  10: { title: "Metade lendária", text: "A mesa aprovou. O universo também não reclamou.", aura: "from-fuchsia-500/25 via-violet-300/10 to-transparent" },
  11: { title: "Portal aberto", text: "Passou da metade. Agora o dado já começou a sorrir de volta.", aura: "from-violet-500/25 via-fuchsia-300/10 to-transparent" },
  12: { title: "Golpe bonito", text: "Tem resultado que cai redondo. Esse caiu brilhando.", aura: "from-indigo-500/25 via-violet-300/10 to-transparent" },
  13: { title: "Sorte afiada", text: "Hoje a sua rolagem anda com lâmina curta e precisão limpa.", aura: "from-indigo-500/25 via-sky-300/10 to-transparent" },
  14: { title: "Mesa em silêncio", text: "Aquele momento em que todo mundo olha o dado e entende que veio coisa boa.", aura: "from-cyan-500/25 via-indigo-300/10 to-transparent" },
  15: { title: "Crítico quase lá", text: "O tipo de rolagem que já merece comemoração antes mesmo da próxima rodada.", aura: "from-emerald-500/25 via-cyan-300/10 to-transparent" },
  16: { title: "Presente raro", text: "A sorte resolveu caprichar. Não discuta com ela.", aura: "from-amber-400/25 via-violet-300/10 to-transparent" },
  17: { title: "Aplauso da sorte", text: "A rolagem bateu forte na mesa. Daquelas que mudam o humor da noite.", aura: "from-amber-400/25 via-fuchsia-300/10 to-transparent" },
  18: { title: "Luz nas faces", text: "Pouco faltou para o impossível. Ainda assim, já veio grande.", aura: "from-fuchsia-500/25 via-amber-300/10 to-transparent" },
  19: { title: "Quase lendário", text: "Uma rolagem dessas não pede desculpa. Ela entra, vence e senta no melhor lugar.", aura: "from-violet-500/30 via-amber-300/15 to-transparent" },
  20: { title: "Crítico natural", text: "O presente veio dourado. Tem dias em que o d20 decide te tratar como lenda.", aura: "from-amber-400/35 via-yellow-200/20 to-transparent" },
};

const DIE_RADIUS = 1.56;
const FACE_TEXTURE_SIZE = 256;
const CAMERA_FACE_VECTOR = new THREE.Vector3(0, 0, 1);
const FACE_BASE_GEOMETRY = new THREE.IcosahedronGeometry(DIE_RADIUS, 0).toNonIndexed();
const FACE_DATA = buildFaceData(FACE_BASE_GEOMETRY);
const FACE_LOOKUP = new Map(FACE_DATA.map((face) => [face.number, face]));
const SPARKS = Array.from({ length: 24 }, (_, i) => ({
  id: i,
  left: 8 + ((i * 11) % 84),
  delay: (i % 8) * 0.045,
  duration: 0.72 + (i % 6) * 0.11,
  size: 4 + (i % 5) * 2,
}));

function buildFaceData(geometry) {
  const position = geometry.attributes.position;
  const faces = [];

  for (let i = 0; i < position.count; i += 3) {
    const a = new THREE.Vector3().fromBufferAttribute(position, i);
    const b = new THREE.Vector3().fromBufferAttribute(position, i + 1);
    const c = new THREE.Vector3().fromBufferAttribute(position, i + 2);

    const center = a.clone().add(b).add(c).multiplyScalar(1 / 3);
    const normal = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
    if (normal.dot(center) < 0) normal.multiplyScalar(-1);

    const tangent = b.clone().sub(a).normalize();
    const bitangent = new THREE.Vector3().crossVectors(normal, tangent).normalize();
    const quaternion = new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(tangent, bitangent, normal),
    );

    faces.push({
      number: 0,
      center,
      normal,
      tangent,
      bitangent,
      quaternion,
    });
  }

  faces.sort((fa, fb) => {
    if (Math.abs(fb.center.y - fa.center.y) > 0.08) return fb.center.y - fa.center.y;
    if (Math.abs(fb.center.z - fa.center.z) > 0.08) return fb.center.z - fa.center.z;
    return fa.center.x - fb.center.x;
  });

  return faces.map((face, index) => ({ ...face, number: index + 1 }));
}

function createFaceTexture(value) {
  const canvas = document.createElement("canvas");
  canvas.width = FACE_TEXTURE_SIZE;
  canvas.height = FACE_TEXTURE_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const cx = FACE_TEXTURE_SIZE / 2;
  const cy = FACE_TEXTURE_SIZE / 2;
  const gradient = ctx.createRadialGradient(cx, cy - 24, 24, cx, cy, 108);
  gradient.addColorStop(0, value === 20 ? "rgba(253, 224, 71, .95)" : "rgba(255,255,255,.94)");
  gradient.addColorStop(1, value >= 18 ? "rgba(34,211,238,.08)" : "rgba(59,130,246,.05)");

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(cx, cy, 94, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = value === 20 ? "rgba(253, 224, 71, .5)" : "rgba(255,255,255,.18)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(cx, cy, 94, 0, Math.PI * 2);
  ctx.stroke();

  ctx.shadowColor = value === 20 ? "rgba(251,191,36,.6)" : "rgba(255,255,255,.42)";
  ctx.shadowBlur = 18;
  ctx.fillStyle = value === 20 ? "#fff8db" : "#ffffff";
  ctx.font = `900 ${value >= 10 ? 116 : 134}px Inter, Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(value), cx, cy + 10);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  texture.anisotropy = 8;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function storyFor(value) {
  return FACE_STORIES[value] || FACE_STORIES[10];
}

function FaceNumbers() {
  const textures = React.useMemo(() => {
    if (typeof document === "undefined") return [];
    return FACE_DATA.map((face) => ({
      number: face.number,
      texture: createFaceTexture(face.number),
    }));
  }, []);

  React.useEffect(() => {
    return () => {
      textures.forEach((entry) => entry.texture?.dispose?.());
    };
  }, [textures]);

  return (
    <group>
      {FACE_DATA.map((face, index) => {
        const texture = textures[index]?.texture;
        if (!texture) return null;
        const pos = face.center.clone().add(face.normal.clone().multiplyScalar(0.03));
        return (
          <mesh
            key={face.number}
            position={pos.toArray()}
            quaternion={face.quaternion}
            scale={[0.64, 0.64, 1]}
          >
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial
              map={texture}
              transparent
              depthWrite={false}
              alphaTest={0.05}
              side={THREE.DoubleSide}
            />
          </mesh>
        );
      })}
    </group>
  );
}

function DiceScene({ rolling, faceValue, flash }) {
  const groupRef = React.useRef(null);
  const shellRef = React.useRef(null);
  const innerRef = React.useRef(null);
  const glowRef = React.useRef(null);
  const spinState = React.useRef({
    active: false,
    startedAt: 0,
    duration: 0,
    from: new THREE.Quaternion(),
    to: new THREE.Quaternion(),
    spins: new THREE.Vector3(0, 0, 0),
  });
  const idleTime = React.useRef(0);

  React.useEffect(() => {
    if (!shellRef.current) return;
    const currentQuat = shellRef.current.quaternion.clone();
    const face = FACE_LOOKUP.get(faceValue) || FACE_LOOKUP.get(20);
    const targetQuat = face
      ? new THREE.Quaternion().setFromUnitVectors(face.normal.clone().normalize(), CAMERA_FACE_VECTOR)
      : new THREE.Quaternion();

    if (rolling) {
      spinState.current = {
        active: true,
        startedAt: performance.now(),
        duration: 2.55,
        from: currentQuat,
        to: targetQuat,
        spins: new THREE.Vector3(
          THREE.MathUtils.randInt(3, 5) * Math.PI * 2,
          THREE.MathUtils.randInt(4, 7) * Math.PI * 2,
          THREE.MathUtils.randInt(2, 4) * Math.PI * 2,
        ),
      };
    } else {
      spinState.current = {
        active: false,
        startedAt: performance.now(),
        duration: 0,
        from: targetQuat.clone(),
        to: targetQuat.clone(),
        spins: new THREE.Vector3(0, 0, 0),
      };
      shellRef.current.quaternion.copy(targetQuat);
    }
  }, [rolling, faceValue]);

  useFrame((state, delta) => {
    const group = groupRef.current;
    const shell = shellRef.current;
    const inner = innerRef.current;
    const glow = glowRef.current;
    if (!group || !shell || !inner || !glow) return;

    idleTime.current += delta;
    const bounce = rolling ? 0.12 + Math.sin(idleTime.current * 9.2) * 0.08 : Math.sin(idleTime.current * 1.6) * 0.04;
    group.position.y = bounce;
    group.rotation.z = rolling ? Math.sin(idleTime.current * 12) * 0.07 : Math.sin(idleTime.current * 0.9) * 0.015;

    const spin = spinState.current;
    if (spin.active) {
      const elapsed = (performance.now() - spin.startedAt) / 1000;
      const t = Math.min(elapsed / spin.duration, 1);
      const e = easeOutCubic(t);
      const spinEuler = new THREE.Euler(
        spin.spins.x * (1 - e),
        spin.spins.y * (1 - e),
        spin.spins.z * (1 - e),
        "XYZ",
      );
      const spinQuat = new THREE.Quaternion().setFromEuler(spinEuler);
      const baseQuat = spin.from.clone().slerp(spin.to, e);
      shell.quaternion.copy(baseQuat.multiply(spinQuat));
      if (t >= 1) spin.active = false;
    } else if (!rolling) {
      const face = FACE_LOOKUP.get(faceValue) || FACE_LOOKUP.get(20);
      if (face) {
        const targetQuat = new THREE.Quaternion().setFromUnitVectors(face.normal.clone().normalize(), CAMERA_FACE_VECTOR);
        shell.quaternion.copy(targetQuat);
      }
    }

    const flare = rolling ? 1.15 : flash ? 1.08 : 1;
    glow.material.opacity = THREE.MathUtils.lerp(glow.material.opacity, rolling ? 0.58 : flash ? 0.46 : 0.28, 0.12);
    glow.scale.setScalar(THREE.MathUtils.lerp(glow.scale.x, flare, 0.12));
    inner.material.emissiveIntensity = THREE.MathUtils.lerp(inner.material.emissiveIntensity, rolling ? 1.8 : flash ? 1.35 : 0.85, 0.12);
  });

  return (
    <>
      <color attach="background" args={["#000000"]} />
      <fog attach="fog" args={["#020617", 5, 10.5]} />
      <ambientLight intensity={1.2} color="#dbeafe" />
      <directionalLight position={[2.6, 4.8, 3.2]} intensity={3.1} color="#e0f2fe" />
      <pointLight position={[-3.6, -1.2, 2.4]} intensity={10} distance={12} color="#22d3ee" />
      <pointLight position={[3.2, 1.8, -1.4]} intensity={9} distance={12} color="#a855f7" />
      <spotLight position={[0, 5, 2]} angle={0.55} penumbra={0.8} intensity={14} color="#fef3c7" />

      <group ref={groupRef} position={[0, 0.1, 0]}>
        <group ref={shellRef}>
          <mesh geometry={FACE_BASE_GEOMETRY}>
            <meshPhysicalMaterial
              color="#66d9ff"
              metalness={0.22}
              roughness={0.18}
              transmission={0.2}
              transparent
              opacity={0.96}
              thickness={1.1}
              clearcoat={1}
              clearcoatRoughness={0.12}
              ior={1.24}
              reflectivity={0.68}
              emissive="#1d4ed8"
              emissiveIntensity={0.28}
            />
          </mesh>

          <mesh ref={innerRef} scale={0.88} geometry={FACE_BASE_GEOMETRY}>
            <meshStandardMaterial
              color="#081225"
              emissive="#38bdf8"
              emissiveIntensity={0.85}
              metalness={0.46}
              roughness={0.42}
              transparent
              opacity={0.94}
            />
          </mesh>

          <FaceNumbers />

          <lineSegments>
            <edgesGeometry args={[new THREE.IcosahedronGeometry(DIE_RADIUS + 0.005, 0), 1]} />
            <lineBasicMaterial color="#e2e8f0" transparent opacity={0.56} />
          </lineSegments>

          <mesh position={[0, 0.52, 0.74]} rotation={[-0.66, 0, 0]}>
            <circleGeometry args={[0.78, 40]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.1} />
          </mesh>
        </group>

        <mesh ref={glowRef}>
          <sphereGeometry args={[2.22, 32, 32]} />
          <meshBasicMaterial color="#38bdf8" transparent opacity={0.28} side={THREE.BackSide} />
        </mesh>
      </group>

      <mesh position={[0, -2.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[2.24, 64]} />
        <meshBasicMaterial color="#020617" transparent opacity={0.72} />
      </mesh>
      <mesh position={[0, -2.17, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.54, 2.28, 72]} />
        <meshBasicMaterial color={rolling ? "#67e8f9" : flash ? "#fde68a" : "#7c3aed"} transparent opacity={rolling ? 0.24 : 0.14} />
      </mesh>
    </>
  );
}

export default function VipPresentD20({ accessToken = "", user = null, isVip = false, cycleKey = "" }) {
  const [loading, setLoading] = React.useState(true);
  const [rolling, setRolling] = React.useState(false);
  const [result, setResult] = React.useState(1);
  const [targetValue, setTargetValue] = React.useState(1);
  const [flash, setFlash] = React.useState(false);
  const [showResult, setShowResult] = React.useState(false);
  const [burstKey, setBurstKey] = React.useState(0);
  const [settledAt, setSettledAt] = React.useState(Date.now());
  const [status, setStatus] = React.useState(null);
  const [error, setError] = React.useState("");
  const [claimMessage, setClaimMessage] = React.useState("");
  const [claiming, setClaiming] = React.useState(false);
  const [copyOk, setCopyOk] = React.useState(false);
  const intervalRef = React.useRef(null);
  const endRef = React.useRef(null);
  const revealRef = React.useRef(null);
  const flashTimeoutRef = React.useRef(null);
  const copyRef = React.useRef(null);

  const loadStatus = React.useCallback(async () => {
    if (!accessToken || !user?.id) {
      setLoading(false);
      setStatus(null);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const resp = await fetch('/api/vip-present?action=status', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.error || 'Não foi possível carregar o presente VIP.');
      setStatus(data || null);
      if (data?.roll?.roll_value) {
        setResult(Number(data.roll.roll_value));
        setTargetValue(Number(data.roll.roll_value));
        setShowResult(true);
        setSettledAt(data?.roll?.created_at ? new Date(data.roll.created_at).getTime() : Date.now());
      } else {
        setShowResult(false);
      }
    } catch (err) {
      setError(err?.message || 'Não foi possível carregar o presente VIP.');
    } finally {
      setLoading(false);
    }
  }, [accessToken, user?.id]);

  React.useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  React.useEffect(() => () => {
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    if (endRef.current) window.clearTimeout(endRef.current);
    if (revealRef.current) window.clearTimeout(revealRef.current);
    if (flashTimeoutRef.current) window.clearTimeout(flashTimeoutRef.current);
    if (copyRef.current) window.clearTimeout(copyRef.current);
  }, []);

  const rollData = status?.roll || null;
  const currentValue = rollData?.roll_value ? Number(rollData.roll_value) : result;
  const isJackpot = Boolean(rollData && currentValue === 20);
  const currentStory = storyFor(currentValue);
  const canRoll = Boolean(status?.can_roll && !rolling && !loading && !error && isVip);

  async function handleRoll() {
    if (!canRoll) return;
    setError("");
    setClaimMessage("");
    setCopyOk(false);
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    if (endRef.current) window.clearTimeout(endRef.current);
    if (revealRef.current) window.clearTimeout(revealRef.current);
    if (flashTimeoutRef.current) window.clearTimeout(flashTimeoutRef.current);

    try {
      const resp = await fetch('/api/vip-present?action=roll', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.error || 'Não foi possível registrar a rolagem.');

      const roll = data?.roll || null;
      const finalValue = Number(roll?.roll_value || 1);
      setRolling(true);
      setFlash(false);
      setShowResult(false);
      setBurstKey((v) => v + 1);
      setTargetValue(finalValue);

      const startedAt = performance.now();
      intervalRef.current = window.setInterval(() => {
        const elapsed = performance.now() - startedAt;
        if (elapsed > 1500 && Math.random() > 0.78) setFlash((v) => !v);
      }, 74);

      endRef.current = window.setTimeout(() => {
        if (intervalRef.current) window.clearInterval(intervalRef.current);
        intervalRef.current = null;
        setStatus((prev) => ({ ...(prev || {}), can_roll: false, roll }));
        setResult(finalValue);
        setRolling(false);
        setFlash(true);
        setSettledAt(Date.now());
        revealRef.current = window.setTimeout(() => setShowResult(true), 2000);
        flashTimeoutRef.current = window.setTimeout(() => setFlash(false), 650);
      }, 2550);
    } catch (err) {
      setError(err?.message || 'Não foi possível registrar a rolagem.');
    }
  }

  async function handleClaimPrize() {
    if (!accessToken || claiming || currentValue !== 20) return;
    setClaiming(true);
    setError("");
    try {
      const resp = await fetch('/api/vip-present?action=claim', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ cycle_key: status?.cycle_key || cycleKey || '' }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.error || 'Não foi possível solicitar o prêmio.');
      setClaimMessage(data?.message || 'Entraremos em contato com você, aguarde.');
      setStatus((prev) => prev ? { ...prev, roll: { ...(prev.roll || {}), claim_status: 'requested', claimed_at: new Date().toISOString() } } : prev);
    } catch (err) {
      setError(err?.message || 'Não foi possível solicitar o prêmio.');
    } finally {
      setClaiming(false);
    }
  }

  async function copyCoupon() {
    const code = String(rollData?.coupon?.code || rollData?.coupon_code || '').trim();
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopyOk(true);
      if (copyRef.current) window.clearTimeout(copyRef.current);
      copyRef.current = window.setTimeout(() => setCopyOk(false), 1600);
    } catch {}
  }

  return (
    <div className="rounded-[28px] bg-white/5 ring-1 ring-white/10 p-4 sm:p-5 overflow-hidden">
      <style>{`
        .vip-present-stage-canvas canvas {
          display: block;
          width: 100% !important;
          height: 100% !important;
          filter: drop-shadow(0 22px 60px rgba(3,7,18,.7));
        }
        .vip-present-grid {
          background-image:
            radial-gradient(circle at 50% 18%, rgba(125,211,252,.18), transparent 28%),
            radial-gradient(circle at 50% 82%, rgba(168,85,247,.14), transparent 38%),
            linear-gradient(rgba(255,255,255,.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,.05) 1px, transparent 1px);
          background-size: 100% 100%, 100% 100%, 34px 34px, 34px 34px;
          background-position: center center, center center, center center, center center;
        }
        .vip-present-burst {
          animation: vip-present-burst 850ms ease-out forwards;
        }
        .vip-present-ring {
          animation: vip-present-ring 1.25s ease-out forwards;
        }
        .vip-present-pill {
          backdrop-filter: blur(18px);
          box-shadow: 0 16px 38px rgba(2,6,23,.42);
        }
        @keyframes vip-present-burst {
          0% { transform: translate3d(0,0,0) scale(.25); opacity: 0; }
          15% { opacity: 1; }
          100% { transform: translate3d(var(--dx), var(--dy), 0) scale(1.15); opacity: 0; }
        }
        @keyframes vip-present-ring {
          0% { transform: translate(-50%, -50%) scale(.45); opacity: .62; }
          100% { transform: translate(-50%, -50%) scale(1.32); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .vip-present-burst, .vip-present-ring { animation: none !important; }
        }
      `}</style>

      <div className="rounded-[26px] bg-gradient-to-br from-slate-950 via-slate-900 to-black p-5 ring-1 ring-white/10">
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs uppercase tracking-[0.28em] text-slate-400">Presente VIP</div>
          <div className="rounded-full bg-white/6 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300 ring-1 ring-white/10">
            Ciclo {status?.cycle_key || cycleKey || '—'}
          </div>
        </div>

        {error ? <div className="mt-4 rounded-2xl bg-rose-500/10 ring-1 ring-rose-400/20 px-4 py-3 text-sm text-rose-100">{error}</div> : null}
        {!isVip ? <div className="mt-4 rounded-2xl bg-amber-500/10 ring-1 ring-amber-400/20 px-4 py-3 text-sm text-amber-50">Esta rolagem fica disponível apenas para assinantes VIP com plano ativo.</div> : null}

        <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-stretch">
          <div className="relative flex-1 rounded-[30px] overflow-hidden bg-[linear-gradient(180deg,rgba(2,6,23,.96),rgba(2,6,23,.8))] ring-1 ring-white/10 min-h-[340px] sm:min-h-[420px] lg:min-h-[460px]">
            <div className={`absolute inset-x-0 top-0 h-56 bg-gradient-to-b ${currentStory.aura} pointer-events-none`} />
            <div className="vip-present-grid absolute inset-0 opacity-65 pointer-events-none" />
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,.06),transparent_28%,transparent_72%,rgba(255,255,255,.03))] pointer-events-none" />

            <div className="relative h-full flex flex-col items-center justify-between px-4 py-5 sm:px-6 sm:py-6">
              <div className="w-full flex items-start justify-between gap-3">
                <div className="rounded-2xl bg-black/25 px-4 py-3 ring-1 ring-white/10">
                  <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Status da rodada</div>
                  <div className="mt-2 text-sm font-semibold text-slate-100">{loading ? 'Carregando presente...' : rolling ? 'Rolando o d20...' : rollData ? 'Resultado definido para este ciclo' : 'Pronto para rolar'}</div>
                </div>
                <div className="hidden sm:inline-flex items-center gap-2 rounded-full bg-white/6 px-3 py-1.5 text-xs font-semibold text-slate-200 ring-1 ring-white/10">
                  <span className="material-icons text-[16px] text-cyan-200">redeem</span>
                  Presente mensal VIP
                </div>
              </div>

              <div className="relative w-full flex-1 min-h-[200px] sm:min-h-[260px] lg:min-h-[300px] grid place-items-center">
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                  {SPARKS.map((spark, index) => (
                    <span
                      key={`${burstKey}-${spark.id}`}
                      className={`absolute bottom-[24%] rounded-full bg-gradient-to-b from-white via-cyan-200 to-transparent ${rolling || flash ? 'vip-present-burst' : 'opacity-0'}`}
                      style={{
                        left: `${spark.left}%`,
                        width: `${spark.size}px`,
                        height: `${spark.size * 2.4}px`,
                        animationDelay: `${spark.delay}s`,
                        animationDuration: `${spark.duration}s`,
                        ['--dx']: `${(index % 2 === 0 ? -1 : 1) * (26 + (index % 5) * 18)}px`,
                        ['--dy']: `${-120 - (index % 4) * 34}px`,
                        filter: 'blur(.28px)',
                      }}
                    />
                  ))}
                  <span className={`${rolling || flash ? 'vip-present-ring' : 'opacity-0'} absolute left-1/2 top-[58%] h-44 w-44 rounded-full border border-cyan-300/40`} />
                  <span className={`${rolling || flash ? 'vip-present-ring' : 'opacity-0'} absolute left-1/2 top-[58%] h-60 w-60 rounded-full border border-fuchsia-300/26`} style={{ animationDelay: '.12s' }} />
                </div>

                <div className="vip-present-stage-canvas relative h-[220px] sm:h-[290px] lg:h-[330px] w-full max-w-[260px] sm:max-w-[420px] lg:max-w-[520px]">
                  <Canvas dpr={[1, 1.8]} camera={{ position: [0, 0.2, 5.4], fov: 34 }}>
                    <DiceScene rolling={rolling} faceValue={rolling ? targetValue : currentValue} flash={flash} />
                  </Canvas>
                </div>

                <div
                  className={`vip-present-pill absolute bottom-[10%] sm:bottom-[12%] left-1/2 z-10 -translate-x-1/2 rounded-[28px] border border-white/10 bg-slate-950/50 px-4 py-3 text-center ring-1 ring-white/10 transition-all duration-500 ${rolling || !showResult ? 'pointer-events-none translate-y-4 scale-95 opacity-0' : 'translate-y-0 scale-100 opacity-100'}`}
                  aria-hidden={rolling || !showResult}
                >
                  <div className="text-[11px] uppercase tracking-[0.28em] text-slate-400">Resultado</div>
                  <div className={`mt-1 text-5xl font-black leading-none ${flash ? 'text-amber-200' : 'text-white'}`}>{currentValue}</div>
                </div>
              </div>

              <div className="w-full flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-center">
                <button
                  type="button"
                  onClick={handleRoll}
                  disabled={!canRoll}
                  className={`group inline-flex items-center justify-center gap-3 rounded-2xl px-5 py-4 font-extrabold ring-1 ring-white/10 transition ${canRoll ? 'bg-gradient-to-r from-cyan-300 via-sky-200 to-fuchsia-200 text-slate-950 hover:scale-[1.02] hover:shadow-[0_12px_40px_rgba(56,189,248,.22)]' : 'bg-slate-700/60 text-slate-300 cursor-not-allowed'}`}
                >
                  <span className="material-icons text-[20px]">casino</span>
                  {loading ? 'Carregando...' : rolling ? 'Rolando...' : rollData ? 'Rolagem usada neste mês' : 'Rolar meu presente'}
                </button>
              </div>
            </div>
          </div>

          <div className="w-full lg:w-[380px] shrink-0 space-y-4">
            <div className={`rounded-[26px] p-5 ring-1 ${isJackpot ? 'bg-gradient-to-br from-amber-400/20 via-yellow-300/10 to-transparent ring-amber-300/30' : 'bg-gradient-to-br from-slate-950 via-slate-900 to-black ring-white/10'}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Resultado do ciclo</div>
                  <div className="mt-2 text-2xl font-extrabold text-slate-100">{rollData ? rollData.reward_title : 'Seu presente ainda não foi rolado'}</div>
                </div>
                <div className={`grid h-14 w-14 place-items-center rounded-2xl ring-1 ring-white/10 text-xl font-black ${isJackpot ? 'bg-gradient-to-br from-amber-300 to-yellow-200 text-black' : currentValue >= 12 ? 'bg-gradient-to-br from-violet-300 to-cyan-300 text-black' : 'bg-gradient-to-br from-slate-800 to-slate-700 text-white'}`}>
                  {currentValue}
                </div>
              </div>

              <div className="mt-4 rounded-2xl bg-black/25 p-4 ring-1 ring-white/10">
                <div className="text-sm font-bold text-slate-100">{rollData ? rollData.reward_label : 'Faça a rolagem para descobrir seu presente.'}</div>
                <p className="mt-2 text-sm leading-6 text-slate-300">{rollData ? rollData.reward_message : 'O sistema registra a rolagem do mês, guarda o resultado e libera automaticamente o benefício correspondente.'}</p>
              </div>

              {rollData?.coupon?.code ? (
                <div className="mt-4 rounded-2xl bg-emerald-500/10 p-4 ring-1 ring-emerald-300/20">
                  <div className="text-[11px] uppercase tracking-[0.24em] text-emerald-200/80">Cupom salvo na sua conta</div>
                  <div className="mt-2 text-xl font-black text-emerald-50">{rollData.coupon.code}</div>
                  <div className="mt-1 text-sm text-emerald-100/90">{rollData.coupon.label}</div>
                  <div className="mt-1 text-xs text-emerald-100/70">Validade: {rollData.coupon.expires_at ? new Date(rollData.coupon.expires_at).toLocaleDateString('pt-BR') : '—'}</div>
                  <button type="button" onClick={copyCoupon} className="mt-3 rounded-xl bg-emerald-200 px-4 py-3 text-sm font-extrabold text-black hover:bg-emerald-100">{copyOk ? 'Cupom copiado' : 'Copiar cupom'}</button>
                </div>
              ) : null}

              {isJackpot && rollData ? (
                <div className="mt-4 rounded-2xl bg-amber-400/10 p-4 ring-1 ring-amber-300/20">
                  <div className="text-sm font-extrabold text-amber-50">Parabéns, você tirou 20!</div>
                  <p className="mt-2 text-sm leading-6 text-amber-50/90">Você liberou uma miniatura personalizada exclusiva 🎁.</p>
                  {String(rollData.claim_status || '').toLowerCase() === 'requested' ? (
                    <div className="mt-3 rounded-xl bg-black/25 px-4 py-3 text-sm text-amber-50">{claimMessage || 'Entraremos em contato com você, aguarde.'}</div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleClaimPrize}
                      disabled={claiming}
                      className="mt-3 rounded-xl bg-amber-300 px-4 py-3 text-sm font-extrabold text-black hover:bg-amber-200 disabled:opacity-60"
                    >
                      {claiming ? 'Enviando...' : 'Solicitar meu prêmio'}
                    </button>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
