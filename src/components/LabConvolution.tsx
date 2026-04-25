import React, { useState, useRef, useEffect, useCallback, ChangeEvent, ClipboardEvent as ReactClipboardEvent, KeyboardEvent } from "react";
import { Grid3X3, ArrowRight, Upload, Clipboard, Image as ImageIcon, RefreshCw, Download, Zap, Plus, Trash2, Save, Sparkles, MessageSquare, Loader2 } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const DEFAULT_KERNELS = {
  Identity: [[0, 0, 0], [0, 1, 0], [0, 0, 0]],
  Blur: [[1/9, 1/9, 1/9], [1/9, 1/9, 1/9], [1/9, 1/9, 1/9]],
  Sharpen: [[0, -1, 0], [-1, 5, -1], [0, -1, 0]],
  Edge: [[-1, -1, -1], [-1, 8, -1], [-1, -1, -1]],
  Emboss: [[-2, -1, 0], [-1, 1, 1], [0, 1, 2]],
};

const KERNEL_DESCRIPTIONS: Record<string, string> = {
  Identity: "The center weight is 1 and all others are 0. This returns the original pixel value, leaving the image unchanged.",
  Blur: "All weights are equal (1/9). This averages the pixel with its neighbors, smoothing out sharp details and noise.",
  Sharpen: "The center is high (5) while neighbors are negative. This amplifies the difference between a pixel and its surroundings.",
  Edge: "The center is 8 and neighbors are -1. This highlights areas where intensity changes rapidly, effectively finding outlines.",
  Emboss: "Asymmetric weights create a 3D shadow effect by highlighting intensity differences in a specific diagonal direction.",
  Custom: "A user-defined spatial filter. Adjust the weights to experiment with different image processing effects.",
};

interface LabConvolutionProps {
  state: {
    selectedKernel: string;
    customKernels: Record<string, number[][]>;
  };
  setState: (update: Partial<LabConvolutionProps["state"]>) => void;
}

export default function LabConvolution({ state, setState }: LabConvolutionProps) {
  const { selectedKernel, customKernels } = state;
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  
  const sourceCanvasRef = useRef<HTMLCanvasElement>(null);
  const outputCanvasRef = useRef<HTMLCanvasElement>(null);

  const allKernels = { ...DEFAULT_KERNELS, ...customKernels };
  const currentKernel = allKernels[selectedKernel] || DEFAULT_KERNELS.Identity;
  const isCustom = selectedKernel in customKernels;

  const applyConvolution = useCallback(() => {
    const sourceCanvas = sourceCanvasRef.current;
    const outputCanvas = outputCanvasRef.current;
    if (!sourceCanvas || !outputCanvas || !imageSrc) return;

    setIsProcessing(true);
    const ctx = sourceCanvas.getContext("2d", { willReadFrequently: true });
    const outCtx = outputCanvas.getContext("2d");
    if (!ctx || !outCtx) return;

    const { width, height } = sourceCanvas;
    outputCanvas.width = width;
    outputCanvas.height = height;

    const inputData = ctx.getImageData(0, 0, width, height);
    const outputData = outCtx.createImageData(width, height);
    const kernel = allKernels[selectedKernel] || DEFAULT_KERNELS.Identity;
    const kSize = 3;
    const kHalf = 1;

    const input = inputData.data;
    const output = outputData.data;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let r = 0, g = 0, b = 0;

        for (let ky = 0; ky < kSize; ky++) {
          for (let kx = 0; kx < kSize; kx++) {
            const scy = Math.min(height - 1, Math.max(0, y + ky - kHalf));
            const scx = Math.min(width - 1, Math.max(0, x + kx - kHalf));
            const offset = (scy * width + scx) * 4;
            const weight = kernel[ky][kx];

            r += input[offset] * weight;
            g += input[offset + 1] * weight;
            b += input[offset + 2] * weight;
          }
        }

        const outOffset = (y * width + x) * 4;
        output[outOffset] = Math.min(255, Math.max(0, r));
        output[outOffset + 1] = Math.min(255, Math.max(0, g));
        output[outOffset + 2] = Math.min(255, Math.max(0, b));
        output[outOffset + 3] = 255; // Alpha
      }
    }

    outCtx.putImageData(outputData, 0, 0);
    setIsProcessing(false);
  }, [imageSrc, selectedKernel, customKernels]);

  const addCustomKernel = () => {
    const customCount = Object.keys(customKernels).length;
    if (customCount >= 4) return;
    
    const name = `Custom ${customCount + 1}`;
    const newKernel = [[0, 0, 0], [0, 1, 0], [0, 0, 0]];
    setState({
      customKernels: { ...customKernels, [name]: newKernel },
      selectedKernel: name
    });
  };

  const deleteCustomKernel = (name: string) => {
    const next = { ...customKernels };
    delete next[name];
    setState({
      customKernels: next,
      selectedKernel: selectedKernel === name ? "Blur" : selectedKernel
    });
  };

  const updateKernelValue = (r: number, c: number, val: number) => {
    if (!isCustom) return;
    const nextKernels = { ...customKernels };
    const kernel = [...nextKernels[selectedKernel]];
    kernel[r] = [...kernel[r]];
    kernel[r][c] = val;
    setState({ customKernels: { ...customKernels, [selectedKernel]: kernel } });
  };

  const generateKernelWithAi = async () => {
    if (!aiPrompt.trim()) return;
    setIsAiLoading(true);
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Generate a 3x3 convolution kernel (a 2D array of numbers) for the following effect: "${aiPrompt}". 
        Return ONLY a valid JSON object with a "name" (string) and "kernel" (3x3 array of numbers). 
        Example: {"name": "Emboss", "kernel": [[-2,-1,0],[-1,1,1],[0,1,2]]}.`,
        config: {
          responseMimeType: "application/json",
        }
      });
      
      const result = JSON.parse(response.text || "{}");
      if (result.name && result.kernel) {
        setState({
          customKernels: { ...customKernels, [result.name]: result.kernel },
          selectedKernel: result.name
        });
        setAiPrompt("");
      }
    } catch (error) {
      console.error("Gemini Generation Error:", error);
    } finally {
      setIsAiLoading(false);
    }
  };

  useEffect(() => {
    if (imageSrc) {
      const img = new Image();
      img.onload = () => {
        const canvas = sourceCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Resize canvas to fit image but keep it reasonable
        const maxDim = 400;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = (h / w) * maxDim;
            w = maxDim;
          } else {
            w = (w / h) * maxDim;
            h = maxDim;
          }
        }
        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(img, 0, 0, w, h);
        applyConvolution();
      };
      img.src = imageSrc;
    }
  }, [imageSrc, applyConvolution]);

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setImageSrc(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handlePaste = useCallback((e: ReactClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const blob = items[i].getAsFile();
        if (blob) {
          const reader = new FileReader();
          reader.onload = (ev) => setImageSrc(ev.target?.result as string);
          reader.readAsDataURL(blob);
        }
      }
    }
  }, []);

  useEffect(() => {
    const pasteHandler = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            const reader = new FileReader();
            reader.onload = (ev) => setImageSrc(ev.target?.result as string);
            reader.readAsDataURL(blob);
          }
        }
      }
    };
    window.addEventListener("paste", pasteHandler);
    return () => window.removeEventListener("paste", pasteHandler);
  }, []);

  return (
    <div className="p-6 space-y-8 max-w-6xl mx-auto min-h-screen">
      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
              <Grid3X3 className="text-indigo-600" /> 2D Image Convolution
            </h2>
            <p className="text-slate-500 text-sm mt-1">Upload an image or paste from clipboard to apply spatial filters.</p>
          </div>
          
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm cursor-pointer hover:bg-indigo-700 transition-all shadow-md">
              <Upload size={18} />
              Upload Image
              <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
            </label>
            <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-medium text-sm border border-slate-200">
              <Clipboard size={18} />
              Ctrl+V to Paste
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Controls - Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Select Filter</h3>
                {Object.keys(customKernels).length < 4 && (
                  <button 
                    onClick={addCustomKernel}
                    className="p-1.5 bg-indigo-100 text-indigo-600 rounded-lg hover:bg-indigo-200 transition-colors"
                    title="Add Custom Kernel"
                  >
                    <Plus size={16} />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-2">
                {Object.keys(allKernels).map((k) => (
                  <div key={k} className="group relative">
                    <button
                      onClick={() => setState({ selectedKernel: k })}
                      className={cn(
                        "w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-semibold transition-all",
                        selectedKernel === k 
                          ? "bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm" 
                          : "bg-white border-slate-200 text-slate-600 hover:border-indigo-200 hover:bg-slate-50"
                      )}
                    >
                      <span className="truncate pr-6">{k}</span>
                    </button>
                    {k in customKernels && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteCustomKernel(k);
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-300 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                        title="Delete Kernel"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Main Viewport */}
          <div className="lg:col-span-3 space-y-8">
            {/* Images Viewport */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase">Source Image</span>
                  {!imageSrc && <span className="text-[10px] text-rose-500 font-bold animate-pulse">Waiting for input...</span>}
                </div>
                <div className="aspect-square bg-slate-100 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden relative group">
                  {!imageSrc ? (
                    <div className="text-center p-6">
                      <ImageIcon size={48} className="mx-auto text-slate-300 mb-2" />
                      <p className="text-slate-400 text-sm">No image loaded</p>
                    </div>
                  ) : (
                    <canvas ref={sourceCanvasRef} className="max-w-full max-h-full object-contain" />
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase">Processed Output</span>
                  {isProcessing && <Loader2 size={14} className="animate-spin text-indigo-600" />}
                </div>
                <div className="aspect-square bg-slate-100 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden">
                  {!imageSrc ? (
                    <div className="text-center p-6">
                      <RefreshCw size={48} className="mx-auto text-slate-300 mb-2" />
                      <p className="text-slate-400 text-sm">Awaiting source</p>
                    </div>
                  ) : (
                    <canvas ref={outputCanvasRef} className="max-w-full max-h-full object-contain" />
                  )}
                </div>
              </div>
            </div>

            {/* Kernel Mechanics Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-1 p-6 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    {isCustom ? "Edit Weights" : "Kernel Weights"}
                  </h4>
                </div>
                <div className="grid grid-cols-3 gap-1.5 w-fit mx-auto">
                  {currentKernel.map((row, r) => row.map((val, c) => (
                    isCustom ? (
                      <KernelInput
                        key={`${r}-${c}`}
                        value={val}
                        onCommit={(newVal) => updateKernelValue(r, c, newVal)}
                      />
                    ) : (
                      <div key={`${r}-${c}`} className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-xs font-mono font-bold text-indigo-600 shadow-sm">
                        {val < 1 && val !== 0 ? val.toFixed(2) : val}
                      </div>
                    )
                  )))}
                </div>
              </div>

              <div className="md:col-span-2 p-6 bg-indigo-50/50 rounded-2xl border border-indigo-100 flex flex-col justify-center relative overflow-hidden">
                <div className="space-y-3 relative z-10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-indigo-600">
                      <Zap size={18} />
                      <h4 className="text-xs font-bold uppercase tracking-widest">Filter Effect</h4>
                    </div>
                  </div>
                  
                  <div className="min-h-[60px]">
                    <p className="text-sm text-slate-700 leading-relaxed font-medium italic">
                      {isCustom ? KERNEL_DESCRIPTIONS.Custom : KERNEL_DESCRIPTIONS[selectedKernel]}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-indigo-100/50">
                    <p className="text-[11px] text-indigo-400 font-semibold uppercase tracking-tighter">
                      {isCustom 
                        ? "You are editing a custom kernel. Changes are applied in real-time to the output image."
                        : `Each pixel in the output is a weighted sum of its neighbors defined by this ${selectedKernel} matrix.`}
                    </p>
                  </div>
                </div>
                
                {/* AI Generation Input */}
                <div className="mt-6 pt-6 border-t border-indigo-100/50 space-y-3">
                  <div className="flex items-center gap-2 text-indigo-600">
                    <Sparkles size={14} />
                    <h4 className="text-[10px] font-bold uppercase tracking-widest">AI Kernel Generator</h4>
                  </div>
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      placeholder="e.g. 'Dramatic high-pass filter' or 'Soft focus blur'..."
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && generateKernelWithAi()}
                      className="flex-1 bg-white border border-indigo-100 rounded-xl px-4 py-2 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none placeholder:text-slate-300"
                    />
                    <button 
                      onClick={generateKernelWithAi}
                      disabled={isAiLoading || !aiPrompt.trim()}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                      {isAiLoading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                      Generate
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-indigo-900 text-indigo-100 p-6 rounded-2xl shadow-xl border border-indigo-800">
        <div className="flex gap-4 items-start">
          <div className="bg-indigo-500/20 p-3 rounded-xl">
            <Grid3X3 className="text-indigo-300" />
          </div>
          <div>
            <h3 className="font-bold text-lg mb-1">How it works</h3>
            <p className="text-sm text-indigo-200 leading-relaxed">
              Convolution is a mathematical operation on two functions that produces a third function expressing how the shape of one is modified by the other. 
              In image processing, we slide a small matrix (the <strong>kernel</strong>) over each pixel of the image. 
              The new pixel value is the weighted sum of the original pixel and its neighbors.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

const KernelInput: React.FC<{ value: number; onCommit: (val: number) => void }> = ({ value, onCommit }) => {
  const [localValue, setLocalValue] = useState(value.toString());

  useEffect(() => {
    setLocalValue(value.toString());
  }, [value]);

  const handleBlur = () => {
    const parsed = parseFloat(localValue);
    onCommit(isNaN(parsed) ? 0 : parsed);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.currentTarget.blur();
    }
  };

  return (
    <input
      type="text"
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className="w-10 h-10 bg-white border border-indigo-200 rounded-xl flex items-center justify-center text-center text-xs font-mono font-bold text-indigo-600 shadow-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
    />
  );
};
