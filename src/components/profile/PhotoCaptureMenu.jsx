import { useEffect, useRef, useState } from 'react';
import { Camera, Image as ImageIcon, Minus, Plus, Trash, X } from 'lucide-react';
import { cn } from '../../lib/utils.js';
import { useToast } from '../../contexts/ToastContext.jsx';
import { isSupportedImage } from '../../lib/leadPhoto.js';
import { Btn } from '../ui/Btn.jsx';

// Foto do cliente: escolher a origem (galeria ou webcam) e ENQUADRAR no círculo
// antes de salvar. Devolve sempre um Blob JPEG 512×512 pelo callback onPicked —
// quem grava é o pai (LeadProfileView).
//
// Etapas: 'menu' → (galeria | 'camera') → 'crop' (zoom + arrastar) → onPicked.
//
// Props:
//   open            controla o overlay
//   onClose()       fecha
//   onPicked(blob)  recebe o recorte pronto
//   onRemove()      opcional — mostra "Remover foto" quando já existe foto

// Lado do quadro de recorte na tela (px). O círculo é inscrito nele.
const BOX = 260;
// Lado da imagem final gravada.
const OUT = 512;
const ZOOM_MIN = 1;
const ZOOM_MAX = 4;

function PhotoCaptureMenu({ open, onClose, onPicked, onRemove }) {
  const toast = useToast();
  const fileRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  // Imagem carregada para recorte (HTMLImageElement) + sua object URL.
  const imgRef = useRef(null);
  const urlRef = useRef(null);
  const dragRef = useRef(null);

  const [mode, setMode] = useState('menu');
  const [starting, setStarting] = useState(false);
  // Enquadramento: zoom e deslocamento (px na escala da tela).
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  // Tamanho base da imagem em "cover" no quadro (zoom 1).
  const [base, setBase] = useState({ w: BOX, h: BOX });

  const stopStream = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  };
  const releaseImage = () => {
    if (urlRef.current) { URL.revokeObjectURL(urlRef.current); urlRef.current = null; }
    imgRef.current = null;
  };

  // Fechou: desliga a câmera e larga a imagem (senão a luz fica acesa / vaza memória).
  useEffect(() => {
    if (!open) { stopStream(); releaseImage(); setMode('menu'); }
    return () => { stopStream(); releaseImage(); };
  }, [open]);

  if (!open) return null;

  // Carrega um Blob/File na etapa de recorte, calculando o "cover" inicial.
  const goToCrop = (blob) => {
    releaseImage();
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const scale = BOX / Math.min(img.naturalWidth, img.naturalHeight);
      setBase({ w: img.naturalWidth * scale, h: img.naturalHeight * scale });
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      imgRef.current = img;
      urlRef.current = url;
      setMode('crop');
    };
    img.onerror = () => { URL.revokeObjectURL(url); toast.error('Não foi possível abrir a imagem.'); };
    img.src = url;
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!isSupportedImage(file)) {
      toast.warning('Escolha uma imagem JPG, PNG ou WEBP de até 10MB.');
      return;
    }
    goToCrop(file);
  };

  const startCamera = async () => {
    setStarting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      streamRef.current = stream;
      setMode('camera');
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play?.().catch(() => {});
        }
      });
    } catch (err) {
      console.error(err);
      toast.error(
        err?.name === 'NotAllowedError'
          ? 'Permissão de câmera negada. Libere o acesso no navegador e tente de novo.'
          : 'Não foi possível abrir a câmera deste dispositivo.'
      );
    } finally {
      setStarting(false);
    }
  };

  // Congela o frame inteiro (espelhado) e manda pro recorte — o enquadramento
  // fino fica na etapa de zoom, não no clique da captura.
  const shoot = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) { toast.error('Não foi possível capturar a foto.'); return; }
        stopStream();
        goToCrop(blob);
      },
      'image/jpeg',
      0.92
    );
  };

  // ── Enquadramento ──
  // Mantém a imagem sempre cobrindo o quadro (sem "buraco" nas bordas).
  const clampOffset = (x, y, z) => {
    const limX = Math.max(0, (base.w * z - BOX) / 2);
    const limY = Math.max(0, (base.h * z - BOX) / 2);
    return {
      x: Math.min(limX, Math.max(-limX, x)),
      y: Math.min(limY, Math.max(-limY, y))
    };
  };

  const applyZoom = (z) => {
    const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
    setZoom(next);
    setOffset(prev => clampOffset(prev.x, prev.y, next));
  };

  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragRef.current = { px: e.clientX, py: e.clientY, ox: offset.x, oy: offset.y };
  };
  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    setOffset(clampOffset(d.ox + (e.clientX - d.px), d.oy + (e.clientY - d.py), zoom));
  };
  const endDrag = () => { dragRef.current = null; };

  // Converte o enquadramento da tela para coordenadas da imagem e grava 512×512.
  const confirmCrop = () => {
    const img = imgRef.current;
    if (!img) return;
    const dw = base.w * zoom;
    const dh = base.h * zoom;
    // Canto superior esquerdo da imagem em relação ao quadro.
    const tx = (BOX - dw) / 2 + offset.x;
    const ty = (BOX - dh) / 2 + offset.y;
    // Retângulo-fonte correspondente ao quadro visível.
    const sx = (-tx / dw) * img.naturalWidth;
    const sy = (-ty / dh) * img.naturalHeight;
    const sSide = (BOX / dw) * img.naturalWidth;
    const sSideY = (BOX / dh) * img.naturalHeight;

    const canvas = document.createElement('canvas');
    canvas.width = OUT;
    canvas.height = OUT;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, sx, sy, sSide, sSideY, 0, 0, OUT, OUT);
    canvas.toBlob(
      (blob) => {
        if (!blob) { toast.error('Não foi possível processar a imagem.'); return; }
        releaseImage();
        onPicked(blob);
        onClose();
      },
      'image/jpeg',
      0.85
    );
  };

  const title = mode === 'camera' ? 'Tirar foto' : mode === 'crop' ? 'Enquadrar foto' : 'Foto do cliente';

  return (
    <div className="fixed inset-0 z-[220] grid place-items-center p-4 bg-slate-900/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl bg-white dark:bg-ink-900 border border-slate-200 dark:border-white/[0.08] shadow-xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 py-4 flex items-center gap-2 border-b border-slate-100 dark:border-white/[0.06]">
          <h3 className="text-[15px] font-bold tracking-tight flex-1">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Fechar" className="text-slate-400 hover:text-slate-700 dark:hover:text-white">
            <X size={18} />
          </button>
        </div>

        {mode === 'menu' && (
          <div className="p-4 space-y-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-white/[0.08] hover:border-brand-400 hover:bg-brand-50/50 dark:hover:bg-white/[0.03] transition text-left"
            >
              <span className="w-10 h-10 rounded-xl grid place-items-center shrink-0 bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
                <ImageIcon size={18} />
              </span>
              <span className="min-w-0">
                <span className="block text-[13.5px] font-semibold text-slate-900 dark:text-white">Escolher da galeria</span>
                <span className="block text-[12px] text-slate-500 dark:text-slate-400">JPG, PNG ou WEBP</span>
              </span>
            </button>

            <button
              type="button"
              onClick={startCamera}
              disabled={starting}
              className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-white/[0.08] hover:border-brand-400 hover:bg-brand-50/50 dark:hover:bg-white/[0.03] transition text-left disabled:opacity-60"
            >
              <span className="w-10 h-10 rounded-xl grid place-items-center shrink-0 bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
                <Camera size={18} />
              </span>
              <span className="min-w-0">
                <span className="block text-[13.5px] font-semibold text-slate-900 dark:text-white">
                  {starting ? 'Abrindo câmera…' : 'Tirar foto agora'}
                </span>
                <span className="block text-[12px] text-slate-500 dark:text-slate-400">Webcam ou câmera do notebook</span>
              </span>
            </button>

            {onRemove && (
              <button
                type="button"
                onClick={() => { onRemove(); onClose(); }}
                className="w-full flex items-center gap-2 p-3 rounded-xl text-[13px] font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition"
              >
                <Trash size={15} /> Remover foto atual
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
          </div>
        )}

        {mode === 'camera' && (
          <div className="p-4 space-y-3">
            <div className="rounded-xl overflow-hidden bg-slate-900 aspect-square grid place-items-center">
              {/* Espelhado: a webcam mostra o reflexo, como a pessoa espera. */}
              <video ref={videoRef} playsInline muted className="w-full h-full object-cover -scale-x-100" />
            </div>
            <div className="flex items-center gap-2">
              <Btn kind="soft" onClick={() => { stopStream(); setMode('menu'); }}>Voltar</Btn>
              <div className="flex-1" />
              <Btn kind="brand" icon={<Camera size={14} />} onClick={shoot}>Capturar</Btn>
            </div>
          </div>
        )}

        {mode === 'crop' && (
          <div className="p-4 space-y-3">
            {/* Quadro de recorte: a imagem arrasta por baixo e a máscara escura
                deixa visível só o círculo — que é exatamente o que será salvo. */}
            <div
              className="relative mx-auto overflow-hidden rounded-xl bg-slate-900 touch-none cursor-grab active:cursor-grabbing select-none"
              style={{ width: BOX, height: BOX }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
            >
              {urlRef.current && (
                <img
                  src={urlRef.current}
                  alt=""
                  draggable={false}
                  className="absolute left-1/2 top-1/2 max-w-none pointer-events-none"
                  style={{
                    width: base.w * zoom,
                    height: base.h * zoom,
                    transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`
                  }}
                />
              )}
              {/* Máscara: escurece fora do círculo (sem bloquear o arraste). */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: 'rgba(15,23,42,0.55)',
                  WebkitMaskImage: 'radial-gradient(circle at center, transparent 0 49.5%, #000 50%)',
                  maskImage: 'radial-gradient(circle at center, transparent 0 49.5%, #000 50%)'
                }}
              />
              <div className="absolute inset-0 pointer-events-none rounded-full ring-2 ring-white/70" />
            </div>

            <p className="text-[11.5px] text-center text-slate-500 dark:text-slate-400">
              Arraste para posicionar e use o zoom para enquadrar.
            </p>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => applyZoom(zoom - 0.25)}
                disabled={zoom <= ZOOM_MIN}
                aria-label="Diminuir zoom"
                className={cn(
                  'w-8 h-8 rounded-lg grid place-items-center shrink-0 border transition',
                  'border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-slate-300',
                  'hover:bg-slate-50 dark:hover:bg-white/[0.05] disabled:opacity-40'
                )}
              >
                <Minus size={14} />
              </button>
              <input
                type="range"
                min={ZOOM_MIN}
                max={ZOOM_MAX}
                step={0.01}
                value={zoom}
                onChange={e => applyZoom(Number(e.target.value))}
                aria-label="Zoom"
                className="flex-1 accent-brand-600"
              />
              <button
                type="button"
                onClick={() => applyZoom(zoom + 0.25)}
                disabled={zoom >= ZOOM_MAX}
                aria-label="Aumentar zoom"
                className={cn(
                  'w-8 h-8 rounded-lg grid place-items-center shrink-0 border transition',
                  'border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-slate-300',
                  'hover:bg-slate-50 dark:hover:bg-white/[0.05] disabled:opacity-40'
                )}
              >
                <Plus size={14} />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <Btn kind="soft" onClick={() => { releaseImage(); setMode('menu'); }}>Voltar</Btn>
              <div className="flex-1" />
              <Btn kind="brand" onClick={confirmCrop}>Usar foto</Btn>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export { PhotoCaptureMenu };
