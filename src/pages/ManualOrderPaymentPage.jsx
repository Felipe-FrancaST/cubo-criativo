import React from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';


function Order3DViewer({ url }) {
  const hostRef = React.useRef(null);
  const [viewerError, setViewerError] = React.useState('');
  const [isModelLoading, setIsModelLoading] = React.useState(false);
  const [loadProgress, setLoadProgress] = React.useState(0);

  React.useEffect(() => {
    if (!url || !hostRef.current) return undefined;
    let disposed = false;
    const host = hostRef.current;
    host.innerHTML = '';
    setViewerError('');
    setIsModelLoading(true);
    setLoadProgress(0);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x07131d);
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    camera.position.set(0, 1.1, 4.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    host.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = true;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.2;

    scene.add(new THREE.HemisphereLight(0xffffff, 0x233040, 2.4));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(4, 6, 5);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x8bdcff, 1.1);
    fill.position.set(-4, 2, -3);
    scene.add(fill);

    const grid = new THREE.GridHelper(6, 24, 0x1d5364, 0x163241);
    grid.position.y = -1;
    scene.add(grid);

    function resize() {
      if (!host || !renderer) return;
      const rect = host.getBoundingClientRect();
      const width = Math.max(280, Math.floor(rect.width || 720));
      const height = Math.max(320, Math.floor(rect.height || 460));
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    }

    const loader = new GLTFLoader();
    loader.load(
      url,
      (gltf) => {
        if (disposed) return;
        const model = gltf.scene;
        scene.add(model);

        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);
        model.position.sub(center);

        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        const scale = 2.7 / maxDim;
        model.scale.setScalar(scale);

        const fittedBox = new THREE.Box3().setFromObject(model);
        const fittedSize = new THREE.Vector3();
        fittedBox.getSize(fittedSize);
        model.position.y -= fittedBox.min.y + Math.min(1, fittedSize.y * 0.08);

        controls.target.set(0, Math.min(0.9, fittedSize.y * 0.35), 0);
        camera.position.set(0, Math.max(1.1, fittedSize.y * 0.45), Math.max(3.4, fittedSize.z * 1.8 + 3));
        controls.update();
        setIsModelLoading(false);
        setLoadProgress(100);
      },
      (event) => {
        if (disposed || !event?.total) return;
        setLoadProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
      },
      () => {
        if (!disposed) {
          setIsModelLoading(false);
          setViewerError('Não foi possível carregar o modelo 3D. Verifique se o arquivo .glb está público no Storage.');
        }
      }
    );

    resize();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    if (ro) ro.observe(host);
    window.addEventListener('resize', resize);

    function animate() {
      if (disposed) return;
      controls.update();
      renderer.render(scene, camera);
      window.requestAnimationFrame(animate);
    }
    animate();

    return () => {
      disposed = true;
      window.removeEventListener('resize', resize);
      if (ro) ro.disconnect();
      controls.dispose();
      renderer.dispose();
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose?.();
        if (obj.material) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach((m) => m?.dispose?.());
        }
      });
      if (host && renderer.domElement?.parentNode === host) host.removeChild(renderer.domElement);
    };
  }, [url]);

  return (
    <div className="relative overflow-hidden rounded-3xl bg-[#07131d] ring-1 ring-white/10">
      <div ref={hostRef} className="h-[70vh] min-h-[360px] w-full" />
      {isModelLoading ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#07131d]/85 backdrop-blur-sm">
          <div className="rounded-3xl bg-black/40 px-6 py-5 text-center ring-1 ring-cyan-300/20">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-cyan-300/20 border-t-cyan-300" />
            <div className="mt-4 text-base font-extrabold text-white">Carregando modelo 3D...</div>
            <div className="mt-1 text-xs text-slate-300">Aguarde enquanto preparamos a visualização.</div>
            {loadProgress > 0 ? <div className="mt-3 text-xs font-bold text-cyan-100">{loadProgress}%</div> : null}
          </div>
        </div>
      ) : null}
      <div className="pointer-events-none absolute left-4 top-4 rounded-2xl bg-black/35 px-3 py-2 text-xs text-slate-200 ring-1 ring-white/10 backdrop-blur">
        Arraste para girar • Pinça/scroll para zoom
      </div>
      {viewerError ? <div className="absolute inset-x-4 bottom-4 rounded-2xl bg-red-500/10 p-3 text-sm text-red-100 ring-1 ring-red-400/20">{viewerError}</div> : null}
    </div>
  );
}

function Model3DModal({ open, url, name, onClose }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[10000]">
      <div className="absolute inset-0 bg-[#020b10]/85" onClick={onClose} />
      <div className="absolute inset-x-3 top-3 mx-auto max-h-[calc(100vh-24px)] max-w-5xl overflow-y-auto rounded-[28px] bg-[#0a0f1a] p-4 ring-1 ring-white/10 sm:top-6 sm:max-h-[calc(100vh-48px)] sm:p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.25em] text-cyan-200/70">Visualizador 3D</div>
            <div className="mt-1 text-xl font-extrabold text-white">{name || 'Modelo do pedido'}</div>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl px-3 py-2 text-sm text-slate-200 ring-1 ring-white/10 hover:bg-white/4">Fechar</button>
        </div>
        <Order3DViewer url={url} />
      </div>
    </div>
  );
}

const fmtBRL = (n) => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function parseParams() {
  if (typeof window === 'undefined') return { order: '', sig: '', payment: '' };
  const params = new URLSearchParams(window.location.search || '');
  return {
    order: String(params.get('order') || '').trim(),
    sig: String(params.get('sig') || '').trim(),
    payment: String(params.get('payment') || '').trim().toLowerCase(),
  };
}

function PaymentSuccessNotice({ order }) {
  return (
    <div className="rounded-3xl bg-emerald-500/10 ring-1 ring-emerald-400/20 p-5 text-emerald-100">
      <div className="text-xl font-extrabold">Pagamento efetivado</div>
      <div className="mt-2 text-sm text-emerald-50/90">
        Seu pagamento foi confirmado. Criamos uma conta automaticamente para acompanhar este pedido em <b>Meus pedidos</b>.
      </div>
      <div className="mt-3 rounded-2xl bg-black/20 p-4 ring-1 ring-white/10 text-sm text-slate-100">
        <div><b>E-mail de acesso:</b> {order?.customer_email || '—'}</div>
        <div className="mt-1"><b>Senha inicial:</b> CPF do cliente</div>
      </div>
    </div>
  );
}

export default function ManualOrderPaymentPage({ onGoHome }) {
  const [{ order, sig, payment }] = React.useState(parseParams);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [busyMethod, setBusyMethod] = React.useState('');
  const [error, setError] = React.useState('');
  const [data, setData] = React.useState(null);
  const [pix, setPix] = React.useState({ qr_code: '', qr_code_base64: '', ticket_url: '' });
  const [copyMsg, setCopyMsg] = React.useState('');
  const [modelViewerOpen, setModelViewerOpen] = React.useState(false);

  const loadOrder = React.useCallback(async () => {
    if (!order || !sig) return;
    setLoading(true);
    setError('');
    try {
      const resp = await fetch(`/api/manual-order-payment?order=${encodeURIComponent(order)}&sig=${encodeURIComponent(sig)}`);
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(json?.error || 'Não foi possível carregar o pedido.');
      setData(json.order || null);
      if (json.order?.status === 'paid') setPix({ qr_code: '', qr_code_base64: '', ticket_url: '' });
    } catch (e) {
      setError(e?.message || 'Erro ao carregar pedido.');
    } finally {
      setLoading(false);
    }
  }, [order, sig]);

  React.useEffect(() => { loadOrder(); }, [loadOrder]);

  React.useEffect(() => {
    if (!order || !sig) return;
    if (data?.status === 'paid') return;
    const t = window.setInterval(async () => {
      try {
        const resp = await fetch('/api/manual-order-payment?action=status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order, sig }),
        });
        const json = await resp.json().catch(() => ({}));
        if (resp.ok && json?.order) {
          setData(json.order);
          if (json?.paid) setPix({ qr_code: '', qr_code_base64: '', ticket_url: '' });
        }
      } catch {}
    }, 5000);
    return () => window.clearInterval(t);
  }, [order, sig, data?.status]);

  React.useEffect(() => {
    if (!payment) return;
    if (payment === 'success' || payment === 'pending') {
      fetch('/api/manual-order-payment?action=status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order, sig }),
      }).then((r) => r.json().catch(() => ({}))).then((json) => {
        if (json?.order) setData(json.order);
      }).catch(() => {});
    }
  }, [payment, order, sig]);


  React.useEffect(() => {
    if (!copyMsg) return undefined;
    const t = window.setTimeout(() => setCopyMsg(''), 2200);
    return () => window.clearTimeout(t);
  }, [copyMsg]);

  async function copyPixCode() {
    const code = String(pix?.qr_code || '').trim();
    if (!code) {
      setCopyMsg('Código Pix indisponível.');
      return;
    }
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        const ta = document.createElement('textarea');
        ta.value = code;
        ta.setAttribute('readonly', 'readonly');
        ta.style.position = 'absolute';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopyMsg('Código Pix copiado.');
    } catch {
      setCopyMsg('Não foi possível copiar o código Pix.');
    }
  }

  async function handlePix() {
    setBusy(true);
    setBusyMethod('pix');
    setError('');
    try {
      const resp = await fetch('/api/manual-order-payment?action=create-pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order, sig }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(json?.error?.message || json?.error || 'Não foi possível gerar o Pix.');
      if (json?.already_paid) {
        await loadOrder();
        return;
      }
      setPix({ qr_code: json.qr_code || '', qr_code_base64: json.qr_code_base64 || '', ticket_url: json.ticket_url || '' });
      if (json?.order) setData(json.order);
    } catch (e) {
      setError(e?.message || 'Erro ao gerar Pix.');
    } finally {
      setBusy(false);
      setBusyMethod('');
    }
  }

  async function handleCard() {
    setBusy(true);
    setBusyMethod('card');
    setError('');
    try {
      const resp = await fetch('/api/manual-order-payment?action=create-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order, sig }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(json?.error?.message || json?.error || 'Não foi possível abrir o pagamento com cartão.');
      if (json?.already_paid) {
        await loadOrder();
        return;
      }
      if (json?.init_point) window.location.href = json.init_point;
      else throw new Error('Link de pagamento indisponível.');
    } catch (e) {
      setError(e?.message || 'Erro ao abrir checkout.');
      setBusy(false);
      setBusyMethod('');
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="rounded-[28px] bg-white/[0.03] ring-1 ring-white/10 p-5 sm:p-7">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.25em] text-cyan-200/70">Pagamento do pedido</div>
            <div className="mt-2 text-3xl font-extrabold text-white">Finalize seu pedido</div>
            <div className="mt-2 text-slate-300">Pague com Pix ou cartão. Depois do pagamento, sua conta já estará pronta para acompanhar em <b>Meus pedidos</b>.</div>
          </div>
          <button onClick={onGoHome} className="rounded-xl px-3 py-2 text-sm text-slate-200 hover:bg-white/4 ring-1 ring-white/10">Site</button>
        </div>

        {loading ? <div className="mt-6 text-slate-300">Carregando pedido…</div> : null}
        {error ? <div className="mt-4 rounded-2xl bg-red-500/10 ring-1 ring-red-500/20 px-4 py-3 text-red-100">{error}</div> : null}

        {data ? (
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-5">
            <div className="rounded-3xl bg-black/20 ring-1 ring-white/10 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm text-slate-400">Pedido #{data.order_number}</div>
                  <div className="text-lg font-bold text-white">{data.customer_name || 'Cliente'}</div>
                </div>
                <div className="rounded-full px-3 py-1 text-xs ring-1 ring-white/10 bg-white/5 text-slate-100">{String(data.status || 'pending').toLowerCase() === 'paid' ? 'Pago' : 'Aguardando pagamento'}</div>
              </div>
              {data.model_3d_url ? (
                <div className="mt-4 rounded-3xl bg-cyan-400/[0.06] p-4 ring-1 ring-cyan-300/20">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-bold text-cyan-100">Visualização 3D disponível</div>
                      <div className="mt-1 text-xs text-slate-400">Veja o modelo do seu pedido antes de finalizar o pagamento.</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setModelViewerOpen(true)}
                      className="rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-black text-[#031116] shadow-lg shadow-cyan-500/10"
                    >
                      Ver 3D
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="mt-4 space-y-3">
                {(data.items || []).map((it) => (
                  <div key={it.id || `${it.name}-${it.scale}`} className="rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-slate-100 font-semibold">{it.name}</div>
                      <div className="text-xs text-slate-400">Qtd: {it.qty}{it.scale ? ` • Escala: ${it.scale}` : ''}</div>
                    </div>
                    <div className="text-slate-100 font-semibold">{fmtBRL(Number(it.unit_price || 0) * Number(it.qty || 1))}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between text-lg font-extrabold text-white border-t border-white/10 pt-4">
                <span>Total</span>
                <span>{fmtBRL(data.total)}</span>
              </div>
            </div>

            <div className="space-y-4">
              {String(data.status || '').toLowerCase() === 'paid' ? (
                <PaymentSuccessNotice order={data} />
              ) : (
                <>
                  <div className="rounded-3xl bg-white/[0.03] ring-1 ring-white/10 p-5">
                    <div className="text-white font-bold text-lg">Pagar agora</div>
                    <div className="mt-2 text-sm text-slate-300">Escolha a forma de pagamento para concluir este pedido.</div>
                    <div className="mt-4 grid grid-cols-1 gap-3">
                      <button onClick={handleCard} disabled={busy} className="rounded-2xl bg-cyan-400 text-[#031116] font-black px-4 py-3 disabled:opacity-60 disabled:cursor-wait">{busy && busyMethod === 'card' ? 'Aguarde…' : 'Pagar com cartão'}</button>
                      <button onClick={handlePix} disabled={busy} className="rounded-2xl bg-white/5 text-white font-black px-4 py-3 ring-1 ring-white/10 disabled:opacity-60 disabled:cursor-wait">{busy && busyMethod === 'pix' ? 'Aguarde…' : 'Pagar com Pix'}</button>
                    </div>
                  </div>

                  {pix.qr_code_base64 ? (
                    <div className="rounded-3xl bg-white/[0.03] ring-1 ring-white/10 p-5">
                      <div className="text-white font-bold">Pix gerado</div>
                      <div className="mt-2 text-sm text-slate-300">Depois que o pagamento for aprovado, este QR Code some e sua conta ficará pronta.</div>
                      <img src={`data:image/png;base64,${pix.qr_code_base64}`} alt="QR Code Pix" className="mt-4 mx-auto w-56 h-56 rounded-2xl bg-white p-3" />
                      {pix.qr_code ? <textarea readOnly value={pix.qr_code} className="mt-4 h-24 w-full rounded-2xl bg-black/30 ring-1 ring-white/10 p-3 text-xs text-slate-200" /> : null}
                      {copyMsg ? <div className={`mt-3 rounded-xl px-3 py-2 text-sm ring-1 ${copyMsg.includes('copiado') ? 'bg-emerald-500/10 text-emerald-100 ring-emerald-400/20' : 'bg-red-500/10 text-red-100 ring-red-400/20'}`}>{copyMsg}</div> : null}
                      <div className="mt-3 flex flex-wrap gap-3">
                        {pix.qr_code ? <button type="button" onClick={copyPixCode} className="inline-flex rounded-xl px-3 py-2 text-sm text-white hover:bg-white/8 ring-1 ring-white/10">Copiar código Pix</button> : null}
                        {pix.ticket_url ? <a href={pix.ticket_url} target="_blank" rel="noreferrer" className="inline-flex rounded-xl px-3 py-2 text-sm text-cyan-200 hover:bg-white/4 ring-1 ring-white/10">Abrir link do Pix</a> : null}
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </div>
        ) : null}
      </div>
      <Model3DModal
        open={modelViewerOpen}
        url={data?.model_3d_url || ''}
        name={data?.model_3d_name || 'Modelo do pedido'}
        onClose={() => setModelViewerOpen(false)}
      />
    </div>
  );
}
