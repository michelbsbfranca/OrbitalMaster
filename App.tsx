
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BodyType, SpaceBody, Vector2 } from './types';
import { G, MAX_HISTORY, SUBSTEPS, BODY_CONFIGS, SOLAR_SYSTEM } from './constants';

type InteractionMode = 'LAUNCH' | 'PAN' | 'MOVE';

const calculatePrediction = (start: Vector2, vel: Vector2, bodies: SpaceBody[], mass: number, radius: number): Vector2[] => {
  const points: Vector2[] = [];
  let currPos = { ...start };
  let currVel = { ...vel };
  const steps = 80;
  const dt = 0.8;

  for (let i = 0; i < steps; i++) {
    let ax = 0, ay = 0;
    bodies.forEach(b => {
      const dx = b.pos.x - currPos.x, dy = b.pos.y - currPos.y;
      const d2 = dx*dx + dy*dy;
      const dist = Math.sqrt(d2);
      if (dist < radius + b.radius) return;
      ax += (dx/dist) * (G * b.mass / (d2 + 10));
      ay += (dy/dist) * (G * b.mass / (d2 + 10));
    });
    currVel.x += ax * dt; currVel.y += ay * dt;
    currPos.x += currVel.x * dt; currPos.y += currVel.y * dt;
    if (i % 2 === 0) points.push({ ...currPos });
  }
  return points;
};

const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [bodies, setBodies] = useState<SpaceBody[]>([]);
  const [paused, setPaused] = useState(false);
  const [showOrbits, setShowOrbits] = useState(true);
  const [interactionMode, setInteractionMode] = useState<InteractionMode>('LAUNCH');
  const [selectedType, setSelectedType] = useState<BodyType>(BodyType.ROCKY_PLANET);
  
  const [customName, setCustomName] = useState('Novo Mundo');
  const [customMass, setCustomMass] = useState(BODY_CONFIGS[BodyType.ROCKY_PLANET].mass);
  const [customRadius, setCustomRadius] = useState(BODY_CONFIGS[BodyType.ROCKY_PLANET].radius);
  const [customColor, setCustomColor] = useState(BODY_CONFIGS[BodyType.ROCKY_PLANET].color);

  const [selectedBodyId, setSelectedBodyId] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<Vector2 | null>(null);
  const [currentMousePos, setCurrentMousePos] = useState<Vector2 | null>(null);
  const [camera, setCamera] = useState<Vector2>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(0.5);
  const [showTrackingModal, setShowTrackingModal] = useState(false);
  const [modalMode, setModalMode] = useState<'TRACK' | 'ORBIT' | 'DOCK'>('TRACK');

  const selectedBody = bodies.find(b => b.id === selectedBodyId);

  const stepPhysics = useCallback((currentBodies: SpaceBody[], dt: number) => {
    if (paused) return currentBodies;
    let newBodies = currentBodies.map(b => ({ ...b, history: [...b.history] }));
    const subDt = (dt * 1.5) / SUBSTEPS;

    for (let s = 0; s < SUBSTEPS; s++) {
      const accels = newBodies.map((b1, i) => {
        let ax = 0, ay = 0;
        newBodies.forEach((b2, j) => {
          if (i === j) return;
          const dx = b2.pos.x - b1.pos.x, dy = b2.pos.y - b1.pos.y;
          const d2 = dx*dx + dy*dy;
          const dist = Math.sqrt(d2);
          if (dist < (b1.radius + b2.radius) * 0.5) return;
          const f = (G * b2.mass) / (d2 + 10);
          ax += (dx/dist)*f; ay += (dy/dist)*f;
        });

        const targetId = b1.orbitTargetId || b1.trackingTargetId;
        if (targetId) {
          const target = newBodies.find(t => t.id === targetId);
          if (target) {
            const dx = target.pos.x - b1.pos.x, dy = target.pos.y - b1.pos.y;
            const dist = Math.hypot(dx, dy);
            if (b1.isAutoOrbiting) {
              const vOrbital = Math.sqrt((G * target.mass) / Math.max(dist, 1));
              const tx = -dy / dist;
              const ty = dx / dist;
              const targetVelX = target.vel.x + tx * vOrbital;
              const targetVelY = target.vel.y + ty * vOrbital;
              ax += (targetVelX - b1.vel.x) * 0.5;
              ay += (targetVelY - b1.vel.y) * 0.5;
            }
          }
        }
        return { ax, ay };
      });

      newBodies.forEach((b, i) => {
        b.vel.x += accels[i].ax * subDt; b.vel.y += accels[i].ay * subDt;
        b.pos.x += b.vel.x * subDt; b.pos.y += b.vel.y * subDt;
      });

      for (let i = 0; i < newBodies.length; i++) {
        for (let j = i + 1; j < newBodies.length; j++) {
          const b1 = newBodies[i], b2 = newBodies[j];
          const dist = Math.hypot(b2.pos.x - b1.pos.x, b2.pos.y - b1.pos.y);
          if (dist < (b1.radius + b2.radius) * 0.95) {
            const bigger = b1.mass >= b2.mass ? b1 : b2, smaller = b1.mass >= b2.mass ? b2 : b1;
            const totalM = bigger.mass + smaller.mass;
            bigger.vel.x = (bigger.vel.x * bigger.mass + smaller.vel.x * smaller.mass) / totalM;
            bigger.vel.y = (bigger.vel.y * bigger.mass + smaller.vel.y * smaller.mass) / totalM;
            bigger.mass = totalM;
            bigger.radius = Math.sqrt(bigger.radius**2 + smaller.radius**2 * 0.3);
            newBodies.splice(newBodies.indexOf(smaller), 1);
            if (bigger === b1) j--; else { i--; break; }
          }
        }
      }
    }
    
    newBodies.forEach(b => {
      if (b.history.length === 0 || Math.hypot(b.pos.x - b.history[b.history.length-1].x, b.pos.y - b.history[b.history.length-1].y) > 10) {
        b.history.push({ ...b.pos });
        if (b.history.length > MAX_HISTORY) b.history.shift();
      }
    });
    return newBodies;
  }, [paused]);

  useEffect(() => {
    let animationId: number;
    const loop = () => {
      setBodies(prev => {
        const next = stepPhysics(prev, 0.16);
        if (selectedBodyId && isFocused && !isDragging) {
          const focused = next.find(b => b.id === selectedBodyId);
          if (focused) setCamera({ x: focused.pos.x, y: focused.pos.y });
          else setIsFocused(false);
        }
        return next;
      });
      animationId = requestAnimationFrame(loop);
    };
    animationId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationId);
  }, [stepPhysics, selectedBodyId, isFocused, isDragging]);

  const updateSelectedBody = (updates: Partial<SpaceBody>) => {
    if (!selectedBodyId) return;
    setBodies(prev => prev.map(b => b.id === selectedBodyId ? { ...b, ...updates } : b));
  };

  const handleOrbitAdjust = (newDist: number) => {
    if (!selectedBodyId || !selectedBody?.orbitTargetId) return;
    const target = bodies.find(t => t.id === selectedBody.orbitTargetId);
    if (!target) return;
    setBodies(prev => prev.map(b => {
      if (b.id !== selectedBodyId) return b;
      const dx = b.pos.x - target.pos.x, dy = b.pos.y - target.pos.y;
      const angle = Math.atan2(dy, dx);
      return { ...b, pos: { x: target.pos.x + Math.cos(angle) * newDist, y: target.pos.y + Math.sin(angle) * newDist }, history: [] };
    }));
  };

  const drawSpaceBody = (ctx: CanvasRenderingContext2D, b: SpaceBody, allBodies: SpaceBody[]) => {
    ctx.save();
    ctx.translate(b.pos.x, b.pos.y);

    const stars = allBodies.filter(body => body.type === BodyType.STAR);
    let nearestStar: SpaceBody | null = null;
    let minDist = Infinity;
    stars.forEach(s => {
      const d = Math.hypot(s.pos.x - b.pos.x, s.pos.y - b.pos.y);
      if (d < minDist) { minDist = d; nearestStar = s; }
    });

    const angleToStar = nearestStar ? Math.atan2(nearestStar.pos.y - b.pos.y, nearestStar.pos.x - b.pos.x) : 0;

    if (b.type === BodyType.STAR) {
      const grad = ctx.createRadialGradient(0, 0, b.radius * 0.2, 0, 0, b.radius);
      grad.addColorStop(0, '#fff');
      grad.addColorStop(0.3, b.color);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.shadowBlur = 40 / zoom;
      ctx.shadowColor = b.color;
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(0, 0, b.radius * 1.5, 0, Math.PI * 2); ctx.fill();
    } else if (b.type === BodyType.BLACK_HOLE) {
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(0, 0, b.radius, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#7c3aed'; ctx.lineWidth = 3/zoom; ctx.stroke();
    } else {
      ctx.save();
      // Anéis de Saturno/Gigantes
      if (b.type === BodyType.GAS_GIANT && (b.name.includes("Saturno") || b.radius > 30)) {
        ctx.beginPath();
        ctx.ellipse(0, 0, b.radius * 2.2, b.radius * 0.8, angleToStar + 0.5, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(214, 211, 209, 0.4)';
        ctx.lineWidth = b.radius * 0.4;
        ctx.stroke();
      }

      ctx.fillStyle = b.color;
      ctx.beginPath(); ctx.arc(0, 0, b.radius, 0, Math.PI * 2); ctx.fill();

      if (nearestStar) {
        const shadowGrad = ctx.createRadialGradient(
          -Math.cos(angleToStar) * b.radius * 0.5,
          -Math.sin(angleToStar) * b.radius * 0.5,
          b.radius * 0.1,
          0, 0, b.radius
        );
        shadowGrad.addColorStop(0, 'rgba(0,0,0,0)');
        shadowGrad.addColorStop(0.8, 'rgba(0,0,0,0.8)');
        shadowGrad.addColorStop(1, 'rgba(0,0,0,0.95)');
        ctx.fillStyle = shadowGrad;
        ctx.beginPath(); ctx.arc(0, 0, b.radius, 0, Math.PI * 2); ctx.fill();

        const highlightGrad = ctx.createRadialGradient(
          Math.cos(angleToStar) * b.radius * 0.6,
          Math.sin(angleToStar) * b.radius * 0.6,
          0,
          Math.cos(angleToStar) * b.radius * 0.6,
          Math.sin(angleToStar) * b.radius * 0.6,
          b.radius * 0.4
        );
        highlightGrad.addColorStop(0, 'rgba(255,255,255,0.4)');
        highlightGrad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = highlightGrad;
        ctx.beginPath(); ctx.arc(0, 0, b.radius, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }

    if (b.type === BodyType.SATELLITE || b.type === BodyType.ROCKET) {
      const angle = Math.atan2(b.vel.y, b.vel.x);
      ctx.rotate(angle);
      if (b.type === BodyType.SATELLITE) {
        const s = 0.7; ctx.fillStyle = b.isAutoOrbiting ? '#4ade80' : b.color;
        ctx.fillRect(-b.radius*s, -b.radius*s, b.radius*2*s, b.radius*2*s);
        ctx.fillStyle = '#3b82f6'; ctx.fillRect(-b.radius*2.5*s, -b.radius*0.4*s, b.radius*1.5*s, b.radius*0.8*s); ctx.fillRect(b.radius*s, -b.radius*0.4*s, b.radius*1.5*s, b.radius*0.8*s);
      } else if (b.type === BodyType.ROCKET) {
        const s = 1.8; ctx.fillStyle = b.color; ctx.beginPath(); ctx.moveTo(b.radius*2.5*s, 0); ctx.lineTo(-b.radius*s, b.radius*s); ctx.lineTo(-b.radius*s, -b.radius*s); ctx.fill();
      }
    }
    ctx.restore();
  };

  // Fix: use setSelectedType instead of non-existent setCustomType
  const setSolarPlanet = (p: typeof SOLAR_SYSTEM[0]) => {
    setCustomName(p.name);
    setSelectedType(p.type);
    setCustomMass(p.mass);
    setCustomRadius(p.radius);
    setCustomColor(p.color);
  };

  const [selectedSolarIndex, setSelectedSolarIndex] = useState(-1);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    ctx.fillStyle = '#020617'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.save(); ctx.translate(canvas.width/2, canvas.height/2); ctx.scale(zoom, zoom); ctx.translate(-camera.x, -camera.y);

    ctx.beginPath(); ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)'; ctx.lineWidth = 1/zoom;
    const gridSize = 500, limit = 10000;
    for(let x = -limit; x <= limit; x += gridSize) { ctx.moveTo(x, -limit); ctx.lineTo(x, limit); }
    for(let y = -limit; y <= limit; y += gridSize) { ctx.moveTo(-limit, y); ctx.lineTo(limit, y); }
    ctx.stroke();

    bodies.forEach(b => {
      const targetId = b.orbitTargetId || b.trackingTargetId;
      if (targetId) {
        const target = bodies.find(t => t.id === targetId);
        if (target) {
          ctx.beginPath(); ctx.setLineDash(b.isAutoOrbiting ? [] : [10/zoom, 10/zoom]);
          ctx.strokeStyle = b.isAutoOrbiting ? '#4ade80' : '#22c55e';
          ctx.globalAlpha = 0.4;
          ctx.lineWidth = (b.isAutoOrbiting ? 2 : 1)/zoom;
          ctx.moveTo(b.pos.x, b.pos.y); ctx.lineTo(target.pos.x, target.pos.y);
          ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
        }
      }

      if (showOrbits && b.history.length > 1) {
        ctx.beginPath(); ctx.strokeStyle = b.color; ctx.lineWidth = 1/zoom; ctx.globalAlpha = 0.15;
        ctx.moveTo(b.history[0].x, b.history[0].y);
        for (let i = 1; i < b.history.length; i++) ctx.lineTo(b.history[i].x, b.history[i].y);
        ctx.stroke(); ctx.globalAlpha = 1;
      }

      if (b.id === selectedBodyId) {
        ctx.beginPath(); ctx.arc(b.pos.x, b.pos.y, b.radius + 20/zoom, 0, Math.PI*2);
        ctx.strokeStyle = isFocused ? '#fbbf24' : '#38bdf8'; ctx.lineWidth = (isFocused ? 3 : 2)/zoom; ctx.stroke();
      }
      
      drawSpaceBody(ctx, b, bodies);

      if (zoom > 0.1) {
        ctx.fillStyle = '#fff'; ctx.font = `bold ${12/zoom}px Inter`; ctx.textAlign = 'center';
        ctx.fillText(b.name, b.pos.x, b.pos.y + b.radius + 22/zoom);
      }
    });

    if (isDragging && dragStart && currentMousePos && interactionMode === 'LAUNCH') {
      const dx = currentMousePos.x - dragStart.x, dy = currentMousePos.y - dragStart.y;
      const points = calculatePrediction(dragStart, { x: dx*0.06, y: dy*0.06 }, bodies, customMass, customRadius);
      ctx.beginPath(); ctx.strokeStyle = customColor; ctx.setLineDash([5/zoom, 5/zoom]);
      points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
      ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.restore();
  }, [bodies, camera, zoom, isDragging, dragStart, currentMousePos, interactionMode, selectedBodyId, paused, showOrbits, customMass, customRadius, customColor, isFocused]);

  const onMouseDown = (e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const pos = { x: (e.clientX - rect.left - rect.width/2)/zoom + camera.x, y: (e.clientY - rect.top - rect.height/2)/zoom + camera.y };
    setDragStart(pos); setCurrentMousePos(pos); setIsDragging(true);
    const hit = bodies.find(b => Math.hypot(b.pos.x - pos.x, b.pos.y - pos.y) < b.radius + 25/zoom);
    if (hit) { setSelectedBodyId(hit.id); } else if (interactionMode !== 'PAN') { setSelectedBodyId(null); setIsFocused(false); }
  };

  const handleTypeSelect = (type: BodyType) => {
    setSelectedType(type);
    setCustomMass(BODY_CONFIGS[type].mass);
    setCustomRadius(BODY_CONFIGS[type].radius);
    setCustomColor(BODY_CONFIGS[type].color);
    setCustomName(BODY_CONFIGS[type].label);
    setSelectedSolarIndex(-1);
  };

  const handleModalSelect = (targetId: string | undefined) => {
    if (!selectedBodyId) return;
    setBodies(prev => prev.map(b => {
      if (b.id !== selectedBodyId) return b;
      const updates: Partial<SpaceBody> = { trackingTargetId: modalMode === 'TRACK' ? targetId : b.trackingTargetId, orbitTargetId: modalMode === 'ORBIT' ? targetId : b.orbitTargetId, isAutoOrbiting: modalMode === 'ORBIT' ? !!targetId : b.isAutoOrbiting };
      if (modalMode === 'ORBIT' && targetId) {
        const target = bodies.find(t => t.id === targetId);
        if (target) {
          const dx = b.pos.x - target.pos.x, dy = b.pos.y - target.pos.y;
          const dist = Math.hypot(dx, dy);
          const vOrbital = Math.sqrt((G * target.mass) / Math.max(dist, 1));
          updates.vel = { x: target.vel.x + (-dy / dist) * vOrbital, y: target.vel.y + (dx / dist) * vOrbital };
        }
      }
      return { ...b, ...updates };
    }));
    setShowTrackingModal(false);
  };

  return (
    <div className="relative w-full h-screen bg-slate-950 text-white font-sans overflow-hidden select-none flex">
      <canvas ref={canvasRef} onMouseDown={onMouseDown} onMouseMove={e => {
        const rect = canvasRef.current!.getBoundingClientRect();
        const pos = { x: (e.clientX - rect.left - rect.width/2)/zoom + camera.x, y: (e.clientY - rect.top - rect.height/2)/zoom + camera.y };
        setCurrentMousePos(pos);
        if (isDragging && dragStart) {
          if (interactionMode === 'PAN') { setCamera(prev => ({ x: prev.x - e.movementX/zoom, y: prev.y - e.movementY/zoom })); setIsFocused(false); }
          else if (interactionMode === 'MOVE' && selectedBodyId) setBodies(prev => prev.map(b => b.id === selectedBodyId ? { ...b, pos: { ...pos }, history: [] } : b));
        }
      }} onMouseUp={() => {
        if (interactionMode === 'LAUNCH' && isDragging && dragStart && currentMousePos) {
          const dx = currentMousePos.x - dragStart.x, dy = currentMousePos.y - dragStart.y;
          setBodies(prev => [...prev, { id: Math.random().toString(36).substr(2, 9), name: customName, type: selectedType, pos: dragStart, vel: { x: dx*0.06, y: dy*0.06 }, mass: customMass, radius: customRadius, color: customColor, history: [] }]);
        }
        setIsDragging(false); setDragStart(null);
      }} onWheel={e => setZoom(z => Math.max(0.001, Math.min(10, z - e.deltaY * 0.001 * z)))} className="absolute inset-0 block" />

      {/* Painel de Criação */}
      <div className="relative z-10 m-6 w-80 pointer-events-none flex flex-col gap-4 max-h-[95vh]">
        <div className="bg-slate-900/95 backdrop-blur-xl p-6 rounded-[2rem] border border-white/10 pointer-events-auto shadow-2xl overflow-y-auto custom-scrollbar">
          <h1 className="text-[11px] font-black uppercase tracking-widest text-blue-400 mb-6 flex items-center gap-2">
            <div className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-pulse shadow-[0_0_10px_#3b82f6]" /> Laboratório Espacial
          </h1>
          
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[9px] uppercase text-slate-500 font-bold ml-1">Predefinições do Sistema Solar</label>
              <div className="grid grid-cols-4 gap-1.5">
                {SOLAR_SYSTEM.map((p, idx) => (
                  <button key={p.name} onClick={() => { setSolarPlanet(p); setSelectedSolarIndex(idx); }} className={`p-2 rounded-xl border text-[7px] font-black uppercase transition-all ${selectedSolarIndex === idx ? 'bg-amber-500 border-amber-300' : 'bg-slate-800 border-transparent hover:bg-white/5'}`}>
                    <div className="w-2 h-2 rounded-full mx-auto mb-1" style={{background: p.color}} /> {p.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[9px] uppercase text-slate-500 font-bold ml-1">Tipos de Corpos</label>
              <div className="grid grid-cols-4 gap-2">
                {(Object.keys(BODY_CONFIGS) as BodyType[]).map(t => (
                  <button key={t} onClick={() => handleTypeSelect(t)} className={`p-2 rounded-xl border text-[7px] font-black uppercase transition-all ${selectedType === t && selectedSolarIndex === -1 ? 'bg-blue-600 border-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.4)]' : 'bg-slate-800 border-transparent hover:bg-white/5'}`}>
                    <div className="w-2 h-2 rounded-full mx-auto mb-1" style={{background: BODY_CONFIGS[t].color}} /> {BODY_CONFIGS[t].label.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
               <div className="flex gap-2 flex-wrap">
                  {['#3b82f6', '#ef4444', '#f97316', '#fbbf24', '#4ade80', '#a855f7', '#f8fafc', '#1e293b'].map(c => (
                    <button key={c} onClick={() => setCustomColor(c)} className={`w-6 h-6 rounded-full border-2 ${customColor === c ? 'border-white scale-110 shadow-lg' : 'border-transparent'}`} style={{background: c}} />
                  ))}
                </div>
              <div className="space-y-2">
                <div className="flex justify-between text-[9px] uppercase text-slate-400 font-bold"><span>Massa</span><span className="text-blue-400 font-mono">{Math.round(customMass)}u</span></div>
                <input type="range" min="0.1" max="1000000" step="10" value={customMass} onChange={e => setCustomMass(+e.target.value)} className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none accent-blue-500" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-[9px] uppercase text-slate-400 font-bold"><span>Raio</span><span className="text-blue-400 font-mono">{Math.round(customRadius)}km</span></div>
                <input type="range" min="1" max="250" value={customRadius} onChange={e => setCustomRadius(+e.target.value)} className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none accent-blue-500" />
              </div>
            </div>

            <div className="flex gap-2 pt-4 border-t border-white/5">
              <button onClick={() => setPaused(!paused)} className={`flex-1 py-3 rounded-2xl text-[9px] font-black uppercase transition-colors ${paused ? 'bg-emerald-600 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'bg-slate-800 hover:bg-slate-700'}`}>{paused ? '▶ Resumir' : '▮▮ Pausar'}</button>
              <button onClick={() => { setBodies([]); setSelectedBodyId(null); setIsFocused(false); }} className="flex-1 py-3 rounded-2xl bg-red-500/10 text-red-500 text-[9px] font-black uppercase hover:bg-red-500/20">Zerar</button>
            </div>
          </div>
        </div>
      </div>

      {/* Controles da Câmera (Centro Baixo) */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20 flex gap-3 bg-slate-900/90 backdrop-blur-2xl p-2.5 rounded-3xl border border-white/10 shadow-2xl pointer-events-auto">
        {(['LAUNCH', 'PAN', 'MOVE'] as InteractionMode[]).map(mode => (
          <button key={mode} onClick={() => setInteractionMode(mode)} className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase transition-all ${interactionMode === mode ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'text-slate-400 hover:bg-white/5'}`}>
            {mode === 'LAUNCH' ? '🚀 Lançar' : mode === 'PAN' ? '🔭 Navegar' : '🖐️ Mover'}
          </button>
        ))}
      </div>

      {/* Painel de Telemetria */}
      {selectedBody && (
        <div className="absolute right-6 top-6 z-10 w-80 bg-slate-900/95 backdrop-blur-2xl p-6 rounded-[2rem] border border-blue-500/30 shadow-2xl pointer-events-auto animate-slideIn">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-[11px] font-black uppercase text-blue-300">Telemetria & Controle</h2>
            <button onClick={() => { setSelectedBodyId(null); setIsFocused(false); }} className="text-slate-500 hover:text-white p-1">✕</button>
          </div>
          <div className="space-y-5">
            <div className="space-y-3">
              <input type="text" value={selectedBody.name} onChange={e => updateSelectedBody({ name: e.target.value })} className="w-full bg-black/40 p-3 rounded-xl text-xs border border-white/5 outline-none focus:border-blue-500/50 font-bold" />
              <div className="flex gap-2 flex-wrap">
                {['#3b82f6', '#ef4444', '#f97316', '#fbbf24', '#4ade80', '#a855f7', '#f8fafc', '#1e293b'].map(c => (
                  <button key={c} onClick={() => updateSelectedBody({ color: c })} className={`w-6 h-6 rounded-full border-2 ${selectedBody.color === c ? 'border-white scale-110 shadow-lg' : 'border-transparent'}`} style={{background: c}} />
                ))}
              </div>
            </div>

            <div className="bg-black/40 p-4 rounded-2xl border border-white/5 grid grid-cols-2 gap-2">
              <div><div className="text-[7px] text-slate-500 uppercase font-black">Velocidade</div><div className="text-xs font-mono text-emerald-400">{(Math.hypot(selectedBody.vel.x, selectedBody.vel.y) * 100).toFixed(0)} km/h</div></div>
              <div><div className="text-[7px] text-slate-500 uppercase font-black">Massa</div><div className="text-xs font-mono text-blue-400">{Math.round(selectedBody.mass)}u</div></div>
            </div>

            <button onClick={() => setIsFocused(!isFocused)} className={`w-full py-3 rounded-2xl text-[9px] font-black uppercase transition-all ${isFocused ? 'bg-amber-500 text-white shadow-[0_0_15px_rgba(251,191,36,0.3)]' : 'bg-white/5 text-amber-400 border border-amber-500/20 hover:bg-amber-500/10'}`}>
              {isFocused ? '🎯 Seguir: Ativo' : '🎯 Focar Objeto'}
            </button>

            {selectedBody.orbitTargetId && (
              <div className="space-y-2 pt-2">
                <div className="flex justify-between text-[9px] uppercase text-slate-400 font-bold"><span>Ajuste Orbital</span><span className="text-emerald-400 font-mono">{Math.round(Math.hypot(selectedBody.pos.x - (bodies.find(b => b.id === selectedBody.orbitTargetId)?.pos.x || 0), selectedBody.pos.y - (bodies.find(b => b.id === selectedBody.orbitTargetId)?.pos.y || 0)))}km</span></div>
                <input type="range" min="20" max="4000" step="5" value={Math.hypot(selectedBody.pos.x - (bodies.find(b => b.id === selectedBody.orbitTargetId)?.pos.x || 0), selectedBody.pos.y - (bodies.find(b => b.id === selectedBody.orbitTargetId)?.pos.y || 0))} onChange={e => handleOrbitAdjust(+e.target.value)} className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none accent-emerald-500" />
              </div>
            )}

            <div className="grid grid-cols-1 gap-2 border-t border-white/5 pt-4">
              <button onClick={() => { setModalMode('ORBIT'); setShowTrackingModal(true); }} className={`w-full py-3 rounded-2xl text-[9px] font-black uppercase transition-all ${selectedBody.isAutoOrbiting ? 'bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'}`}>
                {selectedBody.isAutoOrbiting ? '🌀 Órbita Bloqueada' : '🌀 Iniciar Órbita'}
              </button>
              <button onClick={() => { setModalMode('TRACK'); setShowTrackingModal(true); }} className="w-full py-3 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-2xl text-[9px] font-black uppercase hover:bg-blue-500/20">📡 Laser de Rastreio</button>
              <button onClick={() => { setBodies(b => b.filter(x => x.id !== selectedBodyId)); setSelectedBodyId(null); setIsFocused(false); }} className="w-full py-3 bg-red-500/10 text-red-500 border border-red-500/20 rounded-2xl text-[9px] font-black uppercase hover:bg-red-500/20 font-bold">Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Alvo */}
      {showTrackingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-6 pointer-events-auto" onClick={() => setShowTrackingModal(false)}>
          <div className="bg-slate-900 border border-white/10 rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-8 border-b border-white/5">
              <h3 className="text-lg font-black uppercase tracking-tighter">{modalMode === 'ORBIT' ? 'Centro de Órbita' : 'Alvo do Laser'}</h3>
              <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-widest">Selecione o corpo celeste</p>
            </div>
            <div className="max-h-[40vh] overflow-y-auto p-4 custom-scrollbar">
              <button onClick={() => handleModalSelect(undefined)} className="w-full text-left p-5 rounded-2xl hover:bg-white/5 text-[10px] font-black text-slate-500 italic uppercase">Remover Conexão</button>
              {bodies.filter(b => b.id !== selectedBodyId).map(b => (
                <button key={b.id} onClick={() => handleModalSelect(b.id)} className="w-full text-left p-5 rounded-2xl hover:bg-blue-500/10 border border-transparent hover:border-blue-500/30 flex items-center gap-4 transition-all group">
                  <div className="w-4 h-4 rounded-full shadow-lg group-hover:scale-125 transition-transform" style={{ background: b.color }} />
                  <div><div className="text-xs font-black uppercase">{b.name}</div><div className="text-[8px] text-slate-500 uppercase font-bold tracking-widest">{b.type}</div></div>
                </button>
              ))}
            </div>
            <div className="p-6 border-t border-white/5 flex justify-end gap-3"><button onClick={() => setShowTrackingModal(false)} className="px-8 py-3 bg-slate-800 rounded-2xl text-[9px] font-black uppercase hover:bg-slate-700 transition-colors">Fechar</button></div>
          </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 10px; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; height: 16px; width: 16px; border-radius: 50%; background: #3b82f6; cursor: pointer; border: 3px solid #fff; box-shadow: 0 0 10px rgba(59,130,246,0.5); }
        input[type=range].accent-emerald-500::-webkit-slider-thumb { background: #10b981; }
        @keyframes slideIn { from { opacity: 0; transform: translateX(40px); } to { opacity: 1; transform: translateX(0); } }
        .animate-slideIn { animation: slideIn 0.5s cubic-bezier(0.16, 1, 0.3, 1); }
      `}</style>
    </div>
  );
};

export default App;
