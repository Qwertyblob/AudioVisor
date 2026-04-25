import { useState, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, Cell, AreaChart, Area } from "recharts";
import { Sliders, Eye, EyeOff, Zap, Activity } from "lucide-react";
import { cn } from "@/src/lib/utils";

interface LabSinusoidsProps {
  state: {
    freq1: number; amp1: number; phase1: number; show1: boolean;
    freq2: number; amp2: number; phase2: number; show2: boolean;
    showSum: boolean; isAperiodic: boolean; windowWidth: number;
  };
  setState: (update: Partial<LabSinusoidsProps["state"]>) => void;
}

export default function LabSinusoids({ state, setState }: LabSinusoidsProps) {
  const { freq1, amp1, phase1, show1, freq2, amp2, phase2, show2, showSum, isAperiodic, windowWidth } = state;

  const data = useMemo(() => {
    const points = [];
    const step = 0.0001; 
    for (let t = -0.05; t <= 0.05; t += step) {
      let y1 = 0;
      let y2 = 0;
      
      if (isAperiodic) {
        // Generate a Sinusoidal Wave Packet (Windowed Sinusoid)
        // freq1 is carrier frequency, windowWidth is window width (ms)
        const wWidth = (windowWidth / 1000) * 0.1; // Scale to visible range
        const isInsideWindow = Math.abs(t) < wWidth / 2;
        y1 = isInsideWindow ? amp1 * Math.sin(2 * Math.PI * freq1 * t) : 0;
        y2 = 0;
      } else {
        y1 = amp1 * Math.sin(2 * Math.PI * freq1 * t + phase1);
        y2 = amp2 * Math.sin(2 * Math.PI * freq2 * t + phase2);
      }

      points.push({
        t: t.toFixed(3),
        "Signal 1": y1,
        "Signal 2": y2,
        "Summed Signal": y1 + y2,
      });
    }
    return points;
  }, [freq1, amp1, phase1, freq2, amp2, phase2, isAperiodic, windowWidth]);

  const frequencyData = useMemo(() => {
    const spectrum = [];
    
    for (let f = -500; f <= 500; f += 2) {
      let magnitude = 0;
      
      if (isAperiodic) {
        // Fourier Transform of a windowed sinusoid is a Sinc centered at carrier frequency
        // Rect(t/W) * sin(2pi fc t) -> W/2j * [Sinc(W(f-fc)) - Sinc(W(f+fc))]
        const W = (windowWidth / 1000) * 0.1;
        const fc = freq1;
        
        // Magnitude of the two shifted sincs
        const xPos = Math.PI * (f - fc) * W;
        const xNeg = Math.PI * (f + fc) * W;
        const sincPos = xPos === 0 ? 1 : Math.abs(Math.sin(xPos) / xPos);
        const sincNeg = xNeg === 0 ? 1 : Math.abs(Math.sin(xNeg) / xNeg);
        
        magnitude = (amp1 * W * (sincPos + sincNeg) / 2) * 500; // Scale for visibility
      } else {
        if (show1 && (Math.abs(f - freq1) < 2 || Math.abs(f + freq1) < 2)) magnitude += amp1 / 2;
        if (show2 && (Math.abs(f - freq2) < 2 || Math.abs(f + freq2) < 2)) magnitude += amp2 / 2;
      }
      
      if (isAperiodic || f % 10 === 0 || Math.abs(f - freq1) < 10 || Math.abs(f + freq1) < 10 || Math.abs(f - freq2) < 10 || Math.abs(f + freq2) < 10) {
        spectrum.push({
          freq: f,
          magnitude: magnitude,
          isPeak1: !isAperiodic && show1 && (Math.abs(f - freq1) < 2 || Math.abs(f + freq1) < 2),
          isPeak2: !isAperiodic && show2 && (Math.abs(f - freq2) < 2 || Math.abs(f + freq2) < 2),
        });
      }
    }
    return spectrum;
  }, [freq1, amp1, freq2, amp2, show1, show2, isAperiodic, windowWidth]);

  return (
    <div className="p-6 space-y-8 max-w-5xl mx-auto">
      <div className="flex justify-center mb-6">
        <button
          onClick={() => setState({ isAperiodic: !isAperiodic })}
          className={cn(
            "flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all shadow-md",
            isAperiodic 
              ? "bg-amber-500 text-white hover:bg-amber-600" 
              : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
          )}
        >
          <Activity className={cn("w-5 h-5", isAperiodic ? "animate-pulse" : "")} />
          {isAperiodic ? "Switch to Periodic Mode (Sinusoids)" : "Switch to Aperiodic Mode (Single Pulse)"}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6 bg-slate-50 p-6 rounded-xl border border-slate-200">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <Sliders className="w-4 h-4" /> {isAperiodic ? "Wave Packet Parameters" : "Signal 1 Parameters"}
            </h3>
            {!isAperiodic && (
              <button 
                onClick={() => setState({ show1: !show1 })}
                className={`p-2 rounded-lg transition-colors ${show1 ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 text-slate-500'}`}
                title={show1 ? "Hide Signal 1" : "Show Signal 1"}
              >
                {show1 ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
            )}
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-slate-500 uppercase">
                {isAperiodic ? `Carrier Frequency: ${freq1} Hz` : `Frequency (Hz): ${freq1}`}
              </label>
              <input type="range" min="1" max="500" step="1" value={freq1} onChange={e => setState({ freq1: Number(e.target.value) })} className="w-full h-2 bg-indigo-200 rounded-lg appearance-none cursor-pointer" />
            </div>
            {isAperiodic && (
              <div>
                <label className="text-xs font-medium text-slate-500 uppercase">
                  Window Width: {windowWidth} units
                </label>
                <input type="range" min="10" max="500" step="1" value={windowWidth} onChange={e => setState({ windowWidth: Number(e.target.value) })} className="w-full h-2 bg-indigo-200 rounded-lg appearance-none cursor-pointer" />
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-slate-500 uppercase">Amplitude: {amp1}</label>
              <input type="range" min="0" max="2" step="0.1" value={amp1} onChange={e => setState({ amp1: Number(e.target.value) })} className="w-full h-2 bg-indigo-200 rounded-lg appearance-none cursor-pointer" />
            </div>
            {!isAperiodic && (
              <div>
                <label className="text-xs font-medium text-slate-500 uppercase">Phase (rad): {phase1}</label>
                <input type="range" min="-3.14" max="3.14" step="0.01" value={phase1} onChange={e => setState({ phase1: Number(e.target.value) })} className="w-full h-2 bg-indigo-200 rounded-lg appearance-none cursor-pointer" />
              </div>
            )}
          </div>
        </div>

        <div className={cn("space-y-6 bg-slate-50 p-6 rounded-xl border border-slate-200 transition-opacity", isAperiodic ? "opacity-30 pointer-events-none" : "opacity-100")}>
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <Sliders className="w-4 h-4" /> Signal 2 Parameters
            </h3>
            <button 
              onClick={() => setState({ show2: !show2 })}
              className={`p-2 rounded-lg transition-colors ${show2 ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-500'}`}
              title={show2 ? "Hide Signal 2" : "Show Signal 2"}
            >
              {show2 ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-slate-500 uppercase">Frequency (Hz): {freq2}</label>
              <input type="range" min="1" max="500" step="1" value={freq2} onChange={e => setState({ freq2: Number(e.target.value) })} className="w-full h-2 bg-indigo-200 rounded-lg appearance-none cursor-pointer" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 uppercase">Amplitude: {amp2}</label>
              <input type="range" min="0" max="2" step="0.1" value={amp2} onChange={e => setState({ amp2: Number(e.target.value) })} className="w-full h-2 bg-indigo-200 rounded-lg appearance-none cursor-pointer" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 uppercase">Phase (rad): {phase2}</label>
              <input type="range" min="-3.14" max="3.14" step="0.01" value={phase2} onChange={e => setState({ phase2: Number(e.target.value) })} className="w-full h-2 bg-indigo-200 rounded-lg appearance-none cursor-pointer" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-[400px] relative">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-slate-800">{isAperiodic ? "Aperiodic Wave Packet (Time Domain)" : "Interactive Waveform Visualization"}</h3>
          {!isAperiodic && (
            <button 
              onClick={() => setState({ showSum: !showSum })}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${showSum ? 'bg-rose-100 text-rose-600 border border-rose-200' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}
            >
              {showSum ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              Summed Signal
            </button>
          )}
        </div>
        <ResponsiveContainer width="100%" height="90%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="t" hide />
            <YAxis domain={[-4, 4]} stroke="#64748b" fontSize={12} />
            <Tooltip />
            <Legend verticalAlign="top" height={36}/>
            {isAperiodic ? (
              <Line type="monotone" dataKey="Signal 1" stroke="#f59e0b" strokeWidth={3} dot={false} isAnimationActive={false} name="Sinusoidal Pulse" />
            ) : (
              <>
                {show1 && <Line type="monotone" dataKey="Signal 1" stroke="#6366f1" strokeWidth={2} dot={false} isAnimationActive={false} />}
                {show2 && <Line type="monotone" dataKey="Signal 2" stroke="#10b981" strokeWidth={2} dot={false} isAnimationActive={false} />}
                {showSum && <Line type="monotone" dataKey="Summed Signal" stroke="#f43f5e" strokeWidth={3} dot={false} isAnimationActive={false} />}
              </>
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
      {isAperiodic ? 
         <div> </div>
          :
        <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100 text-sm text-indigo-800">
          <strong>Concept:</strong> Superposition Principle. Adding two sinusoids results in a complex periodic signal. If the ratio of frequencies is rational, the result is periodic.
      </div>
      }

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-[350px] relative">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500" /> Frequency Domain (Fourier Transform)
          </h3>
          <span className="text-xs text-slate-500 font-mono">Magnitude Spectrum | -500 to 500 Hz</span>
        </div>
        <ResponsiveContainer width="100%" height="85%">
          {isAperiodic ? (
            <AreaChart data={frequencyData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis 
                dataKey="freq" 
                stroke="#64748b" 
                fontSize={10} 
                label={{ value: 'Frequency (Hz)', position: 'insideBottom', offset: -5 }}
              />
              <YAxis 
                stroke="#64748b" 
                fontSize={10} 
                label={{ value: 'Magnitude', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip 
                contentStyle={{ fontSize: '12px', borderRadius: '8px' }}
                formatter={(value: number) => [value.toFixed(2), 'Magnitude']}
                labelFormatter={(label) => `${label} Hz`}
              />
              <Area type="monotone" dataKey="magnitude" stroke="#f59e0b" fill="#fef3c7" isAnimationActive={false} />
            </AreaChart>
          ) : (
            <BarChart data={frequencyData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis 
                dataKey="freq" 
                stroke="#64748b" 
                fontSize={10} 
                label={{ value: 'Frequency (Hz)', position: 'insideBottom', offset: -5 }}
              />
              <YAxis 
                stroke="#64748b" 
                fontSize={10} 
                label={{ value: 'Magnitude', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip 
                contentStyle={{ fontSize: '12px', borderRadius: '8px' }}
                formatter={(value: number) => [value.toFixed(2), 'Magnitude']}
                labelFormatter={(label) => `${label} Hz`}
              />
              <Bar dataKey="magnitude" isAnimationActive={false}>
                {frequencyData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.isPeak1 ? "#6366f1" : entry.isPeak2 ? "#10b981" : "#cbd5e1"} 
                  />
                ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      <div className="bg-amber-50 p-4 rounded-lg border border-amber-100 text-sm text-amber-800">
        <strong>Fourier Insight:</strong> {isAperiodic 
          ? "A sinusoidal wave packet is aperiodic. In the frequency domain, it creates a continuous Sinc-shaped spectrum centered at the carrier frequency. Notice how narrowing the window spreads the spectrum wider!" 
          : "The Fourier Transform decomposes a complex time-domain signal into its constituent frequencies. Each peak in this graph represents a pure sinusoid present in the original signal."}
      </div>
    </div>
  );
}
