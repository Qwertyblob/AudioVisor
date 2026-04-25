import { useState, useMemo, useRef, useEffect } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { Activity, Zap, Upload, Play, Pause, Music, Info } from "lucide-react";
import { cn } from "@/src/lib/utils";

interface LabSamplingProps {
  state: {
    signalFreq: number;
    samplingRate: number;
  };
  setState: (update: Partial<LabSamplingProps["state"]>) => void;
}

export default function LabSampling({ state, setState }: LabSamplingProps) {
  const { signalFreq, samplingRate } = state;
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioFileName, setAudioFileName] = useState<string | null>(null);
  const [detectedFreqs, setDetectedFreqs] = useState<{f: number, mag: number}[]>([]);
  const [maxFreq, setMaxFreq] = useState<number>(signalFreq);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);

  // Initialize Audio Context
  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAudioFileName(file.name);
    const arrayBuffer = await file.arrayBuffer();
    
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    const decodedData = await audioContextRef.current.decodeAudioData(arrayBuffer);
    setAudioBuffer(decodedData);
    
    // Analyze multiple frequency components
    analyzeFrequencies(decodedData);
  };

  const analyzeFrequencies = (buffer: AudioBuffer) => {
    const data = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;
    const fftSize = 2048;
    
    // Take a representative chunk
    const start = Math.floor(data.length / 2);
    const chunk = data.slice(start, start + fftSize);
    
    // Simple DFT implementation for analysis
    const freqs: { f: number; mag: number }[] = [];
    const step = sampleRate / fftSize;
    
    // Analyze up to 5000Hz (typical range for this lab's interest)
    for (let k = 1; k < fftSize / 4; k++) {
      let real = 0;
      let imag = 0;
      for (let n = 0; n < fftSize; n++) {
        const angle = (2 * Math.PI * k * n) / fftSize;
        real += chunk[n] * Math.cos(angle);
        imag -= chunk[n] * Math.sin(angle);
      }
      const mag = Math.sqrt(real * real + imag * imag);
      freqs.push({ f: Math.round(k * step), mag });
    }

    // Find peaks
    const peaks = freqs.filter((p, i) => {
      if (i === 0 || i === freqs.length - 1) return false;
      return p.mag > freqs[i-1].mag && p.mag > freqs[i+1].mag && p.mag > 2; // Threshold
    });

    // Sort by magnitude and take top 5
    const topPeaks = peaks.sort((a, b) => b.mag - a.mag).slice(0, 5);
    
    if (topPeaks.length > 0) {
      const highest = Math.max(...topPeaks.map(p => p.f));
      setDetectedFreqs(topPeaks.map(p => ({ f: p.f, mag: p.mag })));
      setMaxFreq(highest);
      setState({ signalFreq: highest }); // Use highest for Nyquist calculation
    }
  };

  const togglePlay = () => {
    if (!audioBuffer || !audioContextRef.current) return;

    if (isPlaying) {
      sourceNodeRef.current?.stop();
      setIsPlaying(false);
    } else {
      const ctx = audioContextRef.current;
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = samplingRate / 2;
      filter.Q.value = 0.707;

      source.connect(filter);
      filter.connect(ctx.destination);
      
      source.start();
      sourceNodeRef.current = source;
      setIsPlaying(true);
      
      source.onended = () => setIsPlaying(false);
    }
  };

  const data = useMemo(() => {
    if (audioBuffer) {
      const channelData = audioBuffer.getChannelData(0);
      const snippetSize = 800; 
      const start = Math.floor(channelData.length / 2);
      const continuous = [];
      const sampled = [];
      const step = Math.floor(audioBuffer.sampleRate / samplingRate);

      // Find max amplitude for normalization
      let maxAmp = 0;
      for (let i = 0; i < snippetSize; i++) {
        const amp = Math.abs(channelData[start + i]);
        if (amp > maxAmp) maxAmp = amp;
      }
      const scaleFactor = maxAmp > 0 ? 0.9 / maxAmp : 1;

      for (let i = 0; i < snippetSize; i++) {
        const t = i / audioBuffer.sampleRate;
        const val = channelData[start + i] * scaleFactor;
        continuous.push({ t, y: val });
        
        if (i % step === 0) {
          sampled.push({ t, val }); // Keep t as number for alignment
        }
      }

      const spectrum = [];
      const range = Math.max(samplingRate * 1.5, 3000);
      const spectrumStep = Math.max(20, Math.floor(range / 200)); 
      
      // Find max spectral magnitude for normalization
      const maxSpecMag = detectedFreqs.length > 0 ? Math.max(...detectedFreqs.map(p => p.mag)) : 1;

      for (let f = -range; f <= range; f += spectrumStep) {
        let magnitude = 0;
        
        detectedFreqs.forEach(peak => {
          const spread = 80; 
          const normalizedMag = peak.mag / maxSpecMag;
          
          magnitude += 0.8 * normalizedMag * Math.exp(-Math.pow(Math.abs(f) - peak.f, 2) / (2 * Math.pow(spread, 2)));
          
          for (let n = -2; n <= 2; n++) {
            if (n === 0) continue;
            const center = n * samplingRate;
            magnitude += 0.4 * normalizedMag * Math.exp(-Math.pow(Math.abs(f - center) - peak.f, 2) / (2 * Math.pow(spread, 2)));
            magnitude += 0.4 * normalizedMag * Math.exp(-Math.pow(Math.abs(f - center) + peak.f, 2) / (2 * Math.pow(spread, 2)));
          }
        });

        spectrum.push({ freq: f, magnitude });
      }

      return { continuous, sampled, spectrum };
    }

    // Fallback: Windowed Sine Wave
    const continuous = [];
    const pointsPerCycle = 50;
    const duration = 0.05;
    // Limit points to ~1000 for performance
    const continuousStep = Math.max(duration / 1000, Math.min(0.0001, 1 / (signalFreq * pointsPerCycle)));
    
    for (let t = 0; t <= duration; t += continuousStep) {
      const window = 0.5 * (1 - Math.cos((2 * Math.PI * t) / duration));
      continuous.push({ t, y: Math.sin(2 * Math.PI * signalFreq * t) * window });
    }

    const sampled = [];
    const sStep = 1 / samplingRate;
    for (let t = 0; t <= duration; t += sStep) {
      const window = 0.5 * (1 - Math.cos((2 * Math.PI * t) / duration));
      sampled.push({ t, val: Math.sin(2 * Math.PI * signalFreq * t) * window });
    }

    const spectrum = [];
    const range = Math.max(samplingRate * 2, 1200);
    const spread = 60;
    // Adaptive step size for spectrum
    const spectrumStep = Math.max(40, Math.floor(range / 150));
    
    for (let f = -range; f <= range; f += spectrumStep) {
      let magnitude = 0;
      magnitude += 1.0 * Math.exp(-Math.pow(Math.abs(f) - signalFreq, 2) / (2 * Math.pow(spread, 2)));
      
      for (let n = -2; n <= 2; n++) {
        if (n === 0) continue;
        const center = n * samplingRate;
        magnitude += 0.6 * Math.exp(-Math.pow(Math.abs(f - center) - signalFreq, 2) / (2 * Math.pow(spread, 2)));
        magnitude += 0.6 * Math.exp(-Math.pow(Math.abs(f - center) + signalFreq, 2) / (2 * Math.pow(spread, 2)));
      }
      spectrum.push({ freq: f, magnitude });
    }

    return { continuous, sampled, spectrum };
  }, [signalFreq, samplingRate, audioBuffer, detectedFreqs]);

  const isAliasing = samplingRate < 2 * signalFreq;

  return (
    <div className="p-6 space-y-8 max-w-6xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Controls Panel */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-600" /> Lab Configuration
            </h3>

            {/* Audio Upload */}
            <div className="space-y-3">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Audio Input</label>
              <div className="flex flex-col gap-3">
                <label className="flex items-center justify-center gap-2 px-4 py-3 bg-white border-2 border-dashed border-slate-200 rounded-xl hover:border-indigo-400 hover:bg-indigo-50 transition-all cursor-pointer group">
                  <Upload size={18} className="text-slate-400 group-hover:text-indigo-500" />
                  <span className="text-sm font-semibold text-slate-600 group-hover:text-indigo-600">
                    {audioFileName || "Upload Audio File"}
                  </span>
                  <input type="file" className="hidden" accept="audio/*" onChange={handleAudioUpload} />
                </label>
                
                {audioBuffer && (
                  <button 
                    onClick={togglePlay}
                    className={cn(
                      "flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-sm transition-all shadow-sm",
                      isPlaying ? "bg-rose-500 text-white hover:bg-rose-600" : "bg-indigo-600 text-white hover:bg-indigo-700"
                    )}
                  >
                    {isPlaying ? <Pause size={18} /> : <Play size={18} />}
                    {isPlaying ? "Stop Playing" : "Listen"}
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-slate-200">
              <div className="bg-white p-3 rounded-xl border border-slate-100">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Highest Component (f_max)</label>
                  <span className="text-sm font-mono font-bold text-indigo-600">{signalFreq} Hz</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1 italic">
                  {audioBuffer ? "Highest significant frequency detected." : "Default test tone."}
                </p>
              </div>

              {detectedFreqs.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {detectedFreqs.map((peak, i) => (
                    <span key={i} className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded text-[9px] font-bold border border-indigo-100">
                      {peak.f} Hz
                    </span>
                  ))}
                </div>
              )}

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sampling Rate (fs)</label>
                  <span className="text-[10px] font-bold text-indigo-600 uppercase">Hz</span>
                </div>
                <div className="flex gap-2">
                  <input 
                    type="number" 
                    min="1000" 
                    max="44100" 
                    value={samplingRate} 
                    onChange={e => setState({ samplingRate: Number(e.target.value) })} 
                    className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-mono font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    placeholder="e.g. 44100"
                  />
                </div>
                <div className="flex justify-between mt-2 px-1">
                  <button 
                    onClick={() => setState({ samplingRate: 8000 })}
                    className="text-[9px] font-bold text-slate-400 hover:text-indigo-500 transition-colors"
                  >
                    8 kHz (Phone)
                  </button>
                  <button 
                    onClick={() => setState({ samplingRate: 44100 })}
                    className="text-[9px] font-bold text-slate-400 hover:text-indigo-500 transition-colors"
                  >
                    44.1 kHz (CD)
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 space-y-3">
              <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100/50">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Nyquist Rate (2f)</span>
                  <span className="font-mono font-bold text-indigo-600">{2 * signalFreq} Hz</span>
                </div>
                <p className="text-[9px] text-slate-400 mt-1 italic">
                  Minimum rate needed to avoid aliasing for this signal.
                </p>
              </div>
              
              <div className={cn(
                "p-4 rounded-xl text-center font-bold text-sm flex items-center justify-center gap-2 transition-colors",
                isAliasing ? "bg-rose-50 text-rose-700 border border-rose-100" : "bg-emerald-50 text-emerald-700 border border-emerald-100"
              )}>
                {isAliasing ? (
                  <>⚠️ Aliasing Detected</>
                ) : (
                  <>✅ Clear Sampling</>
                )}
              </div>
              {isAliasing && (
                <p className="text-[10px] text-rose-500 leading-relaxed text-center">
                  Frequencies above {samplingRate/2} Hz will "fold back" and create distortion.
                </p>
              )}
            </div>
          </div>

          {detectedFreqs.length > 0 && (
            <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 flex items-start gap-3">
              <Info className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-amber-800">Spectral Analysis Complete</p>
                <p className="text-[11px] text-amber-700 mt-0.5">
                  Detected {detectedFreqs.length} prominent components. The highest frequency is <strong>{maxFreq} Hz</strong>. 
                  Nyquist Rate is set to <strong>{2 * maxFreq} Hz</strong>.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Visualizations */}
        <div className="lg:col-span-2 space-y-6">
          {/* Frequency Domain */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-[350px] relative">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" /> Frequency Domain Spectrum
              </h3>
              <div className="flex gap-4">
              </div>
            </div>
            <ResponsiveContainer width="100%" height="80%">
              <AreaChart data={data.spectrum}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="freq" 
                  stroke="#94a3b8" 
                  fontSize={10} 
                  tickFormatter={(val) => `${val}Hz`}
                />
                <YAxis hide domain={[0, 1.2]} />
                <Tooltip 
                  contentStyle={{ fontSize: '12px', borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  labelFormatter={(label) => `Freq: ${label} Hz`}
                />
                <Area 
                  type="stepAfter" 
                  dataKey="magnitude" 
                  stroke={isAliasing ? "#f43f5e" : "#6366f1"} 
                  fill={isAliasing ? "#fecdd3" : "#e0e7ff"} 
                  isAnimationActive={false} 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Time Domain */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-[350px]">
            <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-500" /> Time Domain Waveform
            </h3>
            <ResponsiveContainer width="100%" height="78%">
              <LineChart>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="t" type="number" hide domain={['auto', 'auto']} />
                <YAxis domain={[-1.2, 1.2]} hide />
                <Tooltip />
                <Line 
                  data={data.continuous}
                  type="monotone" 
                  dataKey="y" 
                  stroke="#cbd5e1" 
                  strokeWidth={1} 
                  dot={false} 
                  strokeDasharray="4 4"
                  isAnimationActive={false}
                />
                <Line 
                  data={data.sampled}
                  type="monotone" 
                  dataKey="val" 
                  stroke={isAliasing ? "#f43f5e" : "#10b981"} 
                  strokeWidth={3} 
                  dot={{ r: 3, fill: isAliasing ? "#f43f5e" : "#10b981" }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
            <div className="mt-4 flex justify-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-4 h-0.5 border-t border-dashed border-slate-300" />
                <span className="text-[10px] font-bold text-slate-400 uppercase">Continuous</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-1 bg-emerald-500 rounded-full" />
                <span className="text-[10px] font-bold text-slate-400 uppercase">Reconstructed</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
