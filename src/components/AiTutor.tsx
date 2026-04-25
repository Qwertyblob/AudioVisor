import { GoogleGenAI, Type } from "@google/genai";
import { useState, useRef, useEffect } from "react";
import { Send, Sparkles, Loader2, User, Bot } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/src/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

interface Message {
  role: "user" | "model";
  text: string;
}

interface AiTutorProps {
  context: string;
  onToolCall: (name: string, args: any) => void;
}

export default function AiTutor({ context, onToolCall }: AiTutorProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "model",
      text: "Hi! I'm your personal AI Tutor. I can help explain concepts and even show you visualizations. For example, I can change the phase of a sinusoid or create a custom image filter for you. What would you like to explore?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: userMessage }]);
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      
      const tools = [
        {
          functionDeclarations: [
            {
              name: "setSinusoidParameters",
              description: "Update the parameters of the sinusoids in the playground.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  freq1: { type: Type.NUMBER, description: "Frequency of Signal 1 (Hz). Prefer 100-500Hz for standard examples." },
                  amp1: { type: Type.NUMBER, description: "Amplitude of Signal 1" },
                  phase1: { type: Type.NUMBER, description: "Phase of Signal 1 (radians)" },
                  freq2: { type: Type.NUMBER, description: "Frequency of Signal 2 (Hz). Prefer 100-500Hz for standard examples." },
                  amp2: { type: Type.NUMBER, description: "Amplitude of Signal 2" },
                  phase2: { type: Type.NUMBER, description: "Phase of Signal 2 (radians)" },
                  isAperiodic: { type: Type.BOOLEAN, description: "Whether to show a wave packet pulse" },
                }
              }
            },
            {
              name: "setSamplingParameters",
              description: "Update the sampling rate in the sampling lab. The signal frequency is derived from the uploaded audio.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  samplingRate: { type: Type.NUMBER, description: "Rate at which the signal is sampled (Hz). Realistic range: 1000 to 44100 Hz." },
                },
                required: ["samplingRate"]
              }
            },
            {
              name: "setConvolutionKernel",
              description: "Create and apply a custom 3x3 convolution kernel to the image.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING, description: "A descriptive name for the kernel" },
                  kernel: { 
                    type: Type.ARRAY, 
                    description: "A 3x3 matrix (array of 3 arrays, each with 3 numbers)",
                    items: { type: Type.ARRAY, items: { type: Type.NUMBER } }
                  },
                },
                required: ["name", "kernel"]
              }
            },
            {
              name: "switchLab",
              description: "Switch the active lab view.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  labId: { 
                    type: Type.STRING, 
                    description: "The ID of the lab to switch to",
                    enum: ["sinusoids", "sampling", "convolution"]
                  }
                },
                required: ["labId"]
              }
            }
          ]
        }
      ];

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        config: {
          systemInstruction: `You are an expert tutor for CS2108 (Introduction to Media Computing). 
          The student is currently looking at: ${context}. 
          
          GUIDELINES:
          1. Explain concepts clearly using mathematical intuition (Fourier, Nyquist, Convolution).
          2. ONLY use tools (visualizations) if the user explicitly asks for a demonstration OR if the concept is complex enough that a visual aid is strictly necessary. Do not force visualizations on every response.
          3. When providing frequency examples, use realistic ranges:
             - For audible-like signals in the Sinusoid Playground, prefer 100Hz to 500Hz.
             - Avoid very low frequencies (like 1-5Hz) unless specifically discussing low-frequency phenomena.
          4. If a user asks a direct question, answer it directly before offering a visualization.
          5. Always explain what you are doing if you use a tool.`,
          tools,
          toolConfig: { includeServerSideToolInvocations: true }
        },
        contents: [
          ...messages.map(m => ({ role: m.role, parts: [{ text: m.text }] })), 
          { role: "user", parts: [{ text: userMessage }] }
        ],
      });

      const functionCalls = response.functionCalls;
      if (functionCalls) {
        for (const call of functionCalls) {
          onToolCall(call.name, call.args);
        }
      }

      const text = response.text || (functionCalls ? "I've updated the visualization for you. Let me know if you have more questions!" : "I'm sorry, I couldn't process that.");
      setMessages((prev) => [...prev, { role: "model", text }]);
    } catch (error) {
      console.error(error);
      setMessages((prev) => [...prev, { role: "model", text: "Sorry, I encountered an error. Please try again." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white w-full">
      <div className="p-4 pr-12 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-indigo-600" />
        <h2 className="font-semibold text-slate-800">Joseph</h2>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        <AnimatePresence initial={false}>
          {messages.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "flex gap-2 max-w-[90%]",
                m.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                m.role === "user" ? "bg-indigo-100 text-indigo-600" : "bg-slate-100 text-slate-600"
              )}>
                {m.role === "user" ? <User size={16} /> : <Bot size={16} />}
              </div>
              <div className={cn(
                "p-3 rounded-2xl text-sm",
                m.role === "user" ? "bg-indigo-600 text-white rounded-tr-none" : "bg-slate-100 text-slate-800 rounded-tl-none"
              )}>
                {m.role === "user" ? (
                  m.text
                ) : (
                  <div className="markdown-body prose prose-sm max-w-none prose-slate">
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm, remarkMath]} 
                      rehypePlugins={[rehypeKatex]}
                    >
                      {m.text}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {isLoading && (
          <div className="flex gap-2 items-center text-slate-400 text-xs italic">
            <Loader2 className="w-3 h-3 animate-spin" />
            Jospeh is thinking...
          </div>
        )}
      </div>

      <div className="p-4 border-t border-slate-200">
        <div className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ask a question..."
            className="w-full pl-4 pr-10 py-2 bg-slate-100 border-none rounded-full text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          />
          <button
            onClick={handleSend}
            disabled={isLoading}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-indigo-600 hover:text-indigo-700 disabled:opacity-50"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
