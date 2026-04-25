import { useState, useCallback } from "react";
import { 
  Waves, 
  Activity, 
  Grid3X3, 
  BookOpen, 
  ChevronRight,
  Menu,
  X,
  Sparkles,
  PanelRightClose,
  PanelRightOpen
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/src/lib/utils";
import LabSinusoids from "./components/LabSinusoids";
import LabSampling from "./components/LabSampling";
import LabConvolution from "./components/LabConvolution";
import AiTutor from "./components/AiTutor";

type LabType = "sinusoids" | "sampling" | "convolution";

export default function App() {
  const [activeLab, setActiveLab] = useState<LabType>("sinusoids");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isTutorOpen, setIsTutorOpen] = useState(true);

  // --- Sinusoid Lab State ---
  const [sinState, setSinState] = useState({
    freq1: 100, amp1: 1, phase1: 0, show1: true,
    freq2: 200, amp2: 0.5, phase2: 0, show2: true,
    showSum: true, isAperiodic: false, windowWidth: 100
  });

  // --- Sampling Lab State ---
  const [sampState, setSampState] = useState({
    signalFreq: 440,
    samplingRate: 8000
  });

  // --- Convolution Lab State ---
  const [convState, setConvState] = useState<{
    selectedKernel: string;
    customKernels: Record<string, number[][]>;
  }>({
    selectedKernel: "Blur",
    customKernels: {}
  });

  const labs = [
    { id: "sinusoids", name: "Sinusoid Playground", icon: Waves, color: "text-indigo-600", bg: "bg-indigo-50" },
    { id: "sampling", name: "Sampling & Aliasing", icon: Activity, color: "text-emerald-600", bg: "bg-emerald-50" },
    { id: "convolution", name: "2D Convolution", icon: Grid3X3, color: "text-rose-600", bg: "bg-rose-50" },
  ];

  const getContext = () => {
    switch(activeLab) {
      case "sinusoids": return "Interactive sinusoid generation and superposition.";
      case "sampling": return "Sampling theory, Nyquist rate, and aliasing visualization. Supports audio file upload, frequency detection, and real-time audio sampling simulation.";
      case "convolution": return "2D image convolution with different kernels (blur, edge detection).";
      default: return "";
    }
  };

  const handleAiToolCall = useCallback((name: string, args: any) => {
    console.log("AI Tool Call:", name, args);
    
    if (name === "setSinusoidParameters") {
      setSinState(prev => ({ ...prev, ...args }));
      setActiveLab("sinusoids");
    } else if (name === "setSamplingParameters") {
      setSampState(prev => ({ ...prev, ...args }));
      setActiveLab("sampling");
    } else if (name === "setConvolutionKernel") {
      const { name: kernelName, kernel } = args;
      setConvState(prev => ({
        ...prev,
        customKernels: { ...prev.customKernels, [kernelName]: kernel },
        selectedKernel: kernelName
      }));
      setActiveLab("convolution");
    } else if (name === "switchLab") {
      setActiveLab(args.labId as LabType);
    }
  }, []);

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      {/* Sidebar Navigation */}
      <aside className={cn(
        "bg-white border-r border-slate-200 transition-all duration-300 flex flex-col",
        isSidebarOpen ? "w-64" : "w-20"
      )}>
        <div className="p-6 flex items-center gap-3 border-b border-slate-100">
          <div className="bg-indigo-600 p-2 rounded-lg text-white">
            <BookOpen size={20} />
          </div>
          {isSidebarOpen && <h1 className="font-bold text-lg tracking-tight">AudioVisor</h1>}
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {labs.map((lab) => (
            <button
              key={lab.id}
              onClick={() => setActiveLab(lab.id as LabType)}
              className={cn(
                "w-full flex items-center gap-3 p-3 rounded-xl transition-all group",
                activeLab === lab.id 
                  ? cn(lab.bg, "shadow-sm") 
                  : "hover:bg-slate-50"
              )}
            >
              <lab.icon className={cn(
                "w-5 h-5 shrink-0 transition-colors",
                activeLab === lab.id ? lab.color : "text-slate-400 group-hover:text-slate-600"
              )} />
              {isSidebarOpen && (
                <span className={cn(
                  "font-medium text-sm",
                  activeLab === lab.id ? "text-slate-900" : "text-slate-500 group-hover:text-slate-700"
                )}>
                  {lab.name}
                </span>
              )}
              {isSidebarOpen && activeLab === lab.id && (
                <ChevronRight className="ml-auto w-4 h-4 text-slate-400" />
              )}
            </button>
          ))}
        </nav>

        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-4 text-slate-400 hover:text-slate-600 flex items-center justify-center border-t border-slate-100"
        >
          {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center px-8 justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-sm font-medium uppercase tracking-wider">Module</span>
            <span className="text-slate-900 font-bold">CS2108: Media Computing</span>
          </div>
          <div className="flex items-center gap-4">
            {!isTutorOpen && (
              <button 
                onClick={() => setIsTutorOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors text-sm font-medium shadow-sm"
              >
                <Sparkles size={16} className="text-indigo-600" />
                Open AI Tutor
                <PanelRightOpen size={16} className="ml-1" />
              </button>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto bg-slate-50/50">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeLab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeLab === "sinusoids" && (
                <LabSinusoids 
                  state={sinState} 
                  setState={(update) => setSinState(prev => ({ ...prev, ...update }))} 
                />
              )}
              {activeLab === "sampling" && (
                <LabSampling 
                  state={sampState} 
                  setState={(update) => setSampState(prev => ({ ...prev, ...update }))} 
                />
              )}
              {activeLab === "convolution" && (
                <LabConvolution 
                  state={convState} 
                  setState={(update) => setConvState(prev => ({ ...prev, ...update }))} 
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* AI Tutor Sidebar */}
      <AnimatePresence>
        {isTutorOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 320, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="border-l border-slate-200 bg-white relative overflow-hidden flex flex-col"
          >
            <div className="absolute top-4 right-4 z-10">
              <button 
                onClick={() => setIsTutorOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
                title="Collapse Tutor"
              >
                <PanelRightClose size={18} />
              </button>
            </div>
            <AiTutor 
              context={getContext()} 
              onToolCall={handleAiToolCall}
            />
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}
