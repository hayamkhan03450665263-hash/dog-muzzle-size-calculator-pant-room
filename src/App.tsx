/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, 
  Bot, 
  User, 
  Search, 
  Database,
  Loader2,
  Sparkles,
  CheckCircle2,
  Activity,
  Ruler,
  AlertTriangle,
  FileText,
  BarChart3,
  Clock,
  ShieldAlert,
  Settings,
  Info,
  Download,
  Moon,
  Sun,
  ArrowRight,
  Menu,
  Database as DatabaseIcon
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';
import { sendMessageToAgentStream, ChatMessage, ToolCall, MOCK_DB, AgentStep } from '@/services/gemini';

// --- Components ---

const Sidebar = ({ activeTab, setActiveTab }: { activeTab: string, setActiveTab: (tab: string) => void }) => {
  const menuItems = [
    { id: 'tool', label: 'Clinical Tool', icon: Activity },
    { id: 'chat', label: 'Safety Agent', icon: Bot },
    { id: 'dashboards', label: 'Dosage Tiers', icon: BarChart3 },
    { id: 'reports', label: 'Clinical Reports', icon: FileText },
    { id: 'fittings', label: 'Recent Cycles', icon: Clock },
    { id: 'guides', label: 'Safety Intel', icon: ShieldAlert },
  ];

  return (
    <aside className="hidden md:flex w-[280px] flex-col h-screen pt-8 pb-6 pl-8 pr-4 border-r border-black/[0.04] bg-white z-20">
      <div className="mb-10 px-6 flex flex-col">
        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em] mb-1">Brocia Clinical</span>
        <h1 className="text-xl font-bold text-black tracking-tight leading-tight">
          Safety Intel Engine
        </h1>
      </div>
      
      <nav className="flex-1 space-y-1.5 pr-2">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-full text-[14px] font-medium transition-all group",
              activeTab === item.id 
                ? "bg-zinc-50 text-black shadow-sm" 
                : "text-zinc-500 hover:bg-zinc-50/50 hover:text-black"
            )}
          >
            <div className={cn(
              "w-1.5 h-6 rounded-full transition-all mr-1",
              activeTab === item.id ? "bg-[#1559ed]" : "bg-transparent group-hover:bg-zinc-100"
            )} />
            <item.icon size={16} strokeWidth={activeTab === item.id ? 2.5 : 2} />
            {item.label}
          </button>
        ))}
      </nav>
    </aside>
  );
};

const AgentStepBlock = ({ step }: { step: AgentStep }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "p-4 rounded-3xl transition-all",
        step.status === 'streaming' ? "bg-white shadow-[0_2px_12px_rgba(0,0,0,0.03)] border border-black/5" : "bg-zinc-50 border border-black/[0.02]"
      )}
    >
      <div className="flex items-center gap-3 mb-2">
        <div className={cn(
          "w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-white shadow-sm border border-black/5 text-zinc-500"
        )}>
          {step.type === 'tool' ? <DatabaseIcon size={12} /> : <Bot size={12} />}
        </div>
        <span className="font-semibold text-[13px] text-zinc-800 truncate">
          {step.type === 'tool' ? `Tool Call: ${step.toolName}` : 'Thinking'}
        </span>
        {step.status === 'streaming' && <Loader2 size={12} className="animate-spin text-zinc-400 ml-auto shrink-0" />}
        {step.status === 'completed' && (
          <div className="flex items-center gap-2 ml-auto shrink-0">
            {step.latencyMs !== undefined && (
              <span className="text-[10px] text-zinc-500 font-medium">
                {(step.latencyMs / 1000).toFixed(2)}s
              </span>
            )}
            <div className="text-emerald-500">
              <CheckCircle2 size={14} />
            </div>
          </div>
        )}
      </div>
      
      {step.type === 'tool' && step.toolArgs && (
        <pre className="text-[10px] bg-white text-zinc-500 p-3 rounded-2xl overflow-x-auto mt-3 font-mono whitespace-pre-wrap border border-black/[0.04]">
          {JSON.stringify(step.toolArgs, null, 2)}
        </pre>
      )}
      
      {step.type === 'text' && step.content && (
        <div className="text-[13px] text-zinc-500 mt-2 line-clamp-2 leading-relaxed">"{step.content}"</div>
      )}

      {step.result && (
        <div className="mt-4 pt-3 border-t border-black/[0.04] flex flex-col gap-1 text-[11px]">
          <span className="font-semibold text-zinc-400 uppercase tracking-wider text-[9px]">Result</span> 
          <span className="text-zinc-700 truncate font-medium">{step.result.message || 'Success'}</span>
        </div>
      )}
    </motion.div>
  );
};

const ChatInterface = ({ 
  history, 
  onSendMessage, 
  isProcessing,
  currentTool,
  agentSteps,
  streamingText,
  setActiveTab
}: { 
  history: ChatMessage[], 
  onSendMessage: (msg: string) => void,
  isProcessing: boolean,
  currentTool: ToolCall | null,
  agentSteps: AgentStep[],
  streamingText: string,
  setActiveTab: (tab: string) => void
}) => {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const leftScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history, isProcessing, currentTool, streamingText]);

  useEffect(() => {
    if (leftScrollRef.current) {
      leftScrollRef.current.scrollTop = leftScrollRef.current.scrollHeight;
    }
  }, [agentSteps]);

  const isGeneratingReport = agentSteps.some(s => s.type === 'tool' && s.toolName === 'generate_clinical_report');
  const isGeneratingDashboard = agentSteps.some(s => s.type === 'tool' && s.toolName === 'create_dosage_dashboard');
  const isGeneratingWidget = isGeneratingReport || isGeneratingDashboard;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;
    onSendMessage(input);
    setInput("");
  };

  return (
    <div className="flex flex-col md:flex-row-reverse h-auto md:h-full w-full gap-4 md:gap-6 pb-24 md:pb-0">
      {/* Right side: Process & Agent Steps (Below chat on mobile) */}
      <div className="order-2 md:order-1 min-h-[350px] md:min-h-0 flex-1 md:flex-initial w-full md:w-[60%] flex flex-col rounded-[32px] bg-white border border-black/[0.04] shadow-[0_4px_24px_rgba(0,0,0,0.02)] overflow-hidden relative">
        <header className="h-[64px] md:h-[72px] flex items-center px-6 md:px-8 bg-white shrink-0 border-b border-black/[0.04]">
          <h2 className="font-semibold text-zinc-900 text-[14px] md:text-[15px] flex items-center gap-3">
            {isProcessing ? (
              <Loader2 className="text-zinc-400 animate-spin" size={16} />
            ) : (
              <div className="w-8 h-8 rounded-full bg-zinc-50 flex items-center justify-center border border-black/5">
                <Activity className="text-zinc-600" size={14} />
              </div>
            )}
            Execution Trace
          </h2>
        </header>
        <div className="flex-1 overflow-y-auto px-6 md:px-8 pb-6 md:pb-8 pt-4 md:pt-6 space-y-4 custom-scrollbar" ref={leftScrollRef}>
          {agentSteps.length === 0 && !isProcessing && (
             <div className="text-zinc-400 text-sm font-medium mt-10 text-center">Start a task to see agent steps here.</div>
          )}
          {agentSteps.map((step) => (
            <AgentStepBlock key={step.id} step={step} />
          ))}
        </div>
      </div>

      {/* Left side: Chat (Top on mobile) */}
      <div className="order-1 md:order-2 h-[550px] md:h-full flex-1 md:min-h-0 md:flex-initial w-full md:w-[40%] flex flex-col rounded-[32px] bg-white border border-black/[0.04] shadow-[0_4px_24px_rgba(0,0,0,0.02)] overflow-hidden relative">
        {/* Header */}
        <header className="h-[64px] md:h-[72px] flex items-center px-6 md:px-8 justify-between shrink-0 border-b border-black/[0.04]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-zinc-50 flex items-center justify-center border border-black/5">
              <Bot className="text-zinc-600" size={14} />
            </div>
            <h2 className="font-semibold text-zinc-900 text-[14px] md:text-[15px]">Virtual Assistant</h2>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 md:px-8 py-6 md:py-8 space-y-6 custom-scrollbar" ref={scrollRef}>
          {history.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-zinc-400 space-y-6">
              <div className="w-16 h-16 bg-white shadow-sm border border-black/5 rounded-full flex items-center justify-center">
                <Bot size={32} className="text-zinc-300" />
              </div>
              <p className="font-medium text-zinc-500">Clinical diphenhydramine dosage & safety monitoring.</p>
              <div className="flex flex-wrap justify-center gap-3 w-full max-w-md">
                <button onClick={() => onSendMessage("What is the safe Benadryl dosage for a 45lb Golden Retriever?")} className="px-5 py-2.5 bg-zinc-50 hover:bg-zinc-100 rounded-full transition-all border border-black/5 text-zinc-600 font-medium text-[13px]">
                Safe dose for 45lb retriever
                </button>
                <button onClick={() => onSendMessage("Does this ingredient list contain Xylitol? (Menthol, Sorbitol, Xylitol, Water)")} className="px-5 py-2.5 bg-zinc-50 hover:bg-zinc-100 rounded-full transition-all border border-black/5 text-zinc-600 font-medium text-[13px]">
                Verify dangerous ingredients
                </button>
                <button onClick={() => onSendMessage("Create a dosage tiers dashboard for my upcoming travel.")} className="px-5 py-2.5 bg-zinc-50 hover:bg-zinc-100 rounded-full transition-all border border-black/5 text-zinc-600 font-medium text-[13px]">
                Dosage tiers dashboard
                </button>
              </div>
            </div>
          )}

          {history.map((msg, idx) => (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={idx} 
              className={cn(
                "flex gap-4 max-w-full",
                msg.role === 'user' ? "ml-auto flex-row-reverse" : ""
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-auto mb-1",
                msg.role === 'user' ? "bg-black text-white" : "bg-white border border-black/5 text-zinc-900 shadow-sm"
              )}>
                {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
              </div>
              
              <div className={cn(
                "rounded-3xl text-[14px] leading-relaxed max-w-[85%] font-medium",
                msg.role === 'user' 
                  ? "p-5 bg-black text-white rounded-br-[8px]" 
                  : msg.hasReport || msg.hasDashboard 
                    ? "p-0" 
                    : "p-5 bg-white rounded-bl-[8px] text-zinc-800 border border-black/[0.04] shadow-[0_2px_12px_rgba(0,0,0,0.02)]"
              )}>
                {msg.role === 'model' && (msg.hasReport || msg.hasDashboard) ? (
                  <div className="flex flex-col gap-3 min-w-[200px]">
                    <div className="p-4 bg-white border border-black/5 rounded-3xl rounded-bl-[8px] shadow-[0_2px_12px_rgba(0,0,0,0.02)] flex flex-col gap-3">
                      <span className="font-medium text-[14px] text-zinc-800">
                        {msg.hasReport && msg.hasDashboard ? 'Report & Dashboard ready' : msg.hasReport ? 'Report now ready' : 'Dashboard now ready'}
                      </span>
                      {msg.latencyMs && (
                        <div className="text-emerald-600 flex items-center gap-1.5 text-[11px] font-medium">
                          <Activity size={12} className="text-emerald-500" /> Latency {(msg.latencyMs / 1000).toFixed(2)}s
                        </div>
                      )}
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                      {msg.hasReport && (
                        <button 
                          onClick={() => setActiveTab('reports')}
                          className="bg-black text-white px-6 py-3 rounded-full font-medium w-max hover:bg-zinc-800 transition-colors text-[13px] shadow-sm flex items-center gap-2"
                        >
                          go to reports &rarr;
                        </button>
                      )}
                      {msg.hasDashboard && (
                        <button 
                          onClick={() => setActiveTab('dashboards')}
                          className="bg-black text-white px-6 py-3 rounded-full font-medium w-max hover:bg-zinc-800 transition-colors text-[13px] shadow-sm flex items-center gap-2"
                        >
                          go to dashboards &rarr;
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className={cn("markdown-body", msg.role === 'user' ? "text-white" : "text-zinc-800")}>
                      <ReactMarkdown>{msg.parts?.map((p: any) => p.text || "").join("") || ""}</ReactMarkdown>
                    </div>

                    {msg.role === 'model' && msg.latencyMs !== undefined && (
                      <div className="mt-4 pt-4 border-t border-black/[0.04] flex items-center justify-end text-emerald-600 text-[11px]">
                        <span className="font-mono bg-emerald-50/50 text-emerald-600 px-2 py-0.5 rounded-md flex items-center gap-1.5">
                          <CheckCircle2 size={12} />
                          {(msg.latencyMs / 1000).toFixed(2)}s
                        </span>
                      </div>
                    )}
                  </>
                )}
                
                {/* Grounding Sources */}
                {msg.groundingMetadata?.groundingChunks && (
                  <div className="mt-4 pt-4 border-t border-black/[0.04]">
                    <p className="text-[10px] font-semibold text-zinc-400 mb-2.5 flex items-center gap-1.5 uppercase tracking-wider">
                      <Search size={12} /> Sources
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {msg.groundingMetadata.groundingChunks.map((chunk: any, i: number) => (
                        <a 
                          key={i} 
                          href={chunk.web?.uri} 
                          target="_blank" 
                          rel="noreferrer"
                          className="text-[11px] px-3 py-1.5 bg-zinc-50 hover:bg-zinc-100 rounded-full text-zinc-500 border border-black/5 transition-colors"
                        >
                          {chunk.web?.title || new URL(chunk.web?.uri).hostname}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
          
          {isProcessing && streamingText && !isGeneratingWidget && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-4 max-w-full"
            >
              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-auto mb-1 bg-white border border-black/5 text-zinc-900 shadow-sm">
                <Bot size={14} />
              </div>
              <div className="p-5 rounded-3xl text-[14px] leading-relaxed max-w-[85%] font-medium bg-white rounded-bl-[8px] border border-black/[0.04] shadow-[0_2px_12px_rgba(0,0,0,0.02)] text-zinc-800 opacity-70">
                <div className="markdown-body text-zinc-800">
                  <ReactMarkdown>{streamingText}</ReactMarkdown>
                </div>
              </div>
            </motion.div>
          )}

          {isProcessing && !streamingText && !isGeneratingWidget && (
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-white border border-black/5 text-zinc-900 shadow-sm flex items-center justify-center mt-auto mb-1">
                <Bot size={14} />
              </div>
              <div className="bg-white px-5 py-4 rounded-3xl rounded-bl-[8px] shadow-[0_2px_12px_rgba(0,0,0,0.02)] border border-black/[0.04] flex items-center gap-2">
                <div className="w-2 h-2 bg-zinc-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-zinc-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-zinc-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}

          {isProcessing && isGeneratingWidget && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-4 max-w-full"
            >
              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-auto mb-1 bg-white border border-black/5 text-zinc-900 shadow-sm">
                <Bot size={14} />
              </div>
              <div className="flex flex-col gap-3 min-w-[200px]">
                <div className="p-4 bg-white border border-black/5 rounded-3xl rounded-bl-[8px] shadow-[0_2px_12px_rgba(0,0,0,0.02)] flex flex-col gap-3">
                  <span className="font-medium text-[14px] text-zinc-800">
                    {isGeneratingReport && isGeneratingDashboard ? 'Finalizing Report & Dashboard...' : isGeneratingReport ? 'Report now ready' : 'Dashboard now ready'}
                  </span>
                  <div className="text-zinc-400 flex items-center gap-1.5 text-[11px] font-medium">
                    <Loader2 size={12} className="animate-spin" /> Finalizing...
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {isGeneratingReport && (
                    <button 
                      disabled
                      className="bg-black/50 text-white px-6 py-3 rounded-full font-medium w-max text-[13px] shadow-sm flex items-center gap-2 cursor-not-allowed"
                    >
                      go to reports &rarr;
                    </button>
                  )}
                  {isGeneratingDashboard && (
                    <button 
                      disabled
                      className="bg-black/50 text-white px-6 py-3 rounded-full font-medium w-max text-[13px] shadow-sm flex items-center gap-2 cursor-not-allowed"
                    >
                      go to dashboards &rarr;
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 md:p-6 shrink-0 bg-white">
          <form onSubmit={handleSubmit} className="relative flex items-center bg-zinc-50 rounded-full border border-black/5 p-2 focus-within:ring-2 focus-within:ring-black/5 focus-within:border-black/10 transition-all">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Write a message..."
              disabled={isProcessing}
              className="flex-1 bg-transparent px-5 py-2 outline-none placeholder:text-zinc-400 text-zinc-900 text-[14px] font-medium"
            />
            <button 
              type="submit"
              disabled={!input.trim() || isProcessing}
              className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center disabled:opacity-50 transition-colors ml-2 hover:bg-zinc-800"
            >
              {isProcessing ? <Loader2 size={16} className="animate-spin text-white" /> : <Send size={16} className="text-white relative right-0.5 top-0.5" strokeWidth={2} />}
            </button>
          </form>

          {history.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2 mt-4 w-full">
              <button onClick={() => onSendMessage("What is the current safety gap for basket muzzles?")} className="px-4 py-2 bg-zinc-50 hover:bg-zinc-100 rounded-full transition-all border border-black/5 text-zinc-600 font-medium text-[12px] whitespace-nowrap">
              Safety gap for baskets?
              </button>
              <button onClick={() => onSendMessage("Calculate pant room for a Pitbull.")} className="px-4 py-2 bg-zinc-50 hover:bg-zinc-100 rounded-full transition-all border border-black/5 text-zinc-600 font-medium text-[12px] whitespace-nowrap">
              Sizing for Pitbull
              </button>
              <button onClick={() => onSendMessage("Analyze risk of nylon muzzles in summer.")} className="px-4 py-2 bg-zinc-50 hover:bg-zinc-100 rounded-full transition-all border border-black/5 text-zinc-600 font-medium text-[12px] whitespace-nowrap">
              Nylon muzzle risk 
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ClinicalToolView = ({ onAction }: { onAction: (msg: string) => void }) => {
  const [weight, setWeight] = useState<string>("");
  const [formulation, setFormulation] = useState<'tablet' | 'liquid'>('tablet');
  const [results, setResults] = useState<{ mg: number, volume: string } | null>(null);

  const handleCalculate = () => {
    if (!weight) return;
    const mg = parseFloat(weight);
    const volume = formulation === 'tablet' 
      ? `${(mg / 25).toFixed(1)} tablets` 
      : `${(mg / 2.5).toFixed(1)} ml`;
    setResults({ mg, volume });
  };

  return (
    <div className="p-4 md:p-8 h-full overflow-y-auto pb-24 md:pb-8">
      <div className="max-w-6xl mx-auto space-y-10">
        <div className="flex justify-between items-end mb-4 pl-2 text-zinc-900 border-l-4 border-[#1559ed] pl-6 transition-all">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Clinical Parameters</h2>
            <p className="text-zinc-500 mt-1 text-[14px] md:text-[15px] font-medium">Precisely derive diphenhydramine calculations based on mass.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-10">
          <div className="bg-white p-6 md:p-8 rounded-[32px] border border-black/[0.04] shadow-[0_4px_24px_rgba(0,0,0,0.02)] space-y-8 h-full flex flex-col">
            <div className="space-y-4">
              <label className="text-[12px] font-bold text-zinc-400 uppercase tracking-wider ml-1 flex items-center gap-2">
                <Activity size={14} className="text-zinc-300" /> Patient Weight (lb)
              </label>
              <input 
                type="number" 
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="Enter weight in pounds"
                className="w-full bg-zinc-50 border-none rounded-[24px] px-6 py-4 md:py-5 text-[16px] focus:ring-2 focus:ring-[#1559ed]/20 transition-all placeholder:text-zinc-300 font-medium outline-none"
              />
            </div>

            <div className="space-y-4 flex-1">
              <label className="text-[12px] font-bold text-zinc-400 uppercase tracking-wider ml-1 flex items-center gap-2">
                <Settings size={14} className="text-zinc-300" /> Formulation Strategy
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                <button 
                  onClick={() => setFormulation('tablet')}
                  className={cn(
                    "w-full py-4 rounded-[24px] text-[13px] md:text-[14px] font-bold transition-all border",
                    formulation === 'tablet' ? "bg-black text-white border-black" : "bg-white text-zinc-400 border-black/5 hover:border-black/20"
                  )}
                >
                  Tablets (25mg)
                </button>
                <button 
                  onClick={() => setFormulation('liquid')}
                  className={cn(
                    "w-full py-4 rounded-[24px] text-[13px] md:text-[14px] font-bold transition-all border",
                    formulation === 'liquid' ? "bg-black text-white border-black" : "bg-white text-zinc-400 border-black/5 hover:border-black/20"
                  )}
                >
                  Liquid (12.5mg/5ml)
                </button>
              </div>
            </div>

            <button 
              onClick={handleCalculate}
              disabled={!weight}
              className="w-full py-4 md:py-5 bg-[#1559ed] text-white rounded-[24px] text-[14px] md:text-[15px] font-bold hover:bg-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_8px_30px_rgb(21,89,237,0.2)] mt-auto"
            >
              Run clinical calculation
            </button>
          </div>

          <div className={cn(
            "min-h-[300px] md:min-h-0 rounded-[32px] p-8 md:p-10 flex flex-col justify-center items-center text-center transition-all duration-500",
            results ? "bg-[#1559ed] text-white shadow-[0_20px_50px_rgba(21,89,237,0.3)]" : "bg-zinc-50 border border-dashed border-black/10"
          )}>
            {!results ? (
              <div className="space-y-4">
                <div className="w-16 h-16 rounded-full bg-black/5 flex items-center justify-center mx-auto">
                  <Ruler className="text-zinc-400" size={24} />
                </div>
                <p className="text-zinc-400 font-medium max-w-[200px]">Define parameters to derive clinical outcome.</p>
              </div>
            ) : (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-8 w-full"
              >
                <div>
                  <span className="text-[12px] font-bold uppercase tracking-[0.2em] opacity-60">Calculated Dose</span>
                  <div className="flex items-baseline justify-center gap-2 mt-2">
                    <h3 className="text-7xl font-black tracking-tighter leading-none">{results.mg}</h3>
                    <span className="text-xl font-bold opacity-80">mg</span>
                  </div>
                </div>

                <div className="h-px bg-white/20 w-1/3 mx-auto" />

                <div>
                  <span className="text-[12px] font-bold uppercase tracking-[0.2em] opacity-60">Administration</span>
                  <p className="text-3xl font-bold mt-2">{results.volume}</p>
                  <p className="text-[13px] font-medium mt-2 opacity-70">Administer every 8-12 hours as clinically indicated.</p>
                </div>

                <button 
                  onClick={() => onAction(`I calculated a ${results.mg}mg dose for my ${weight}lb dog. Can you verify safety?`)}
                  className="mt-4 px-8 py-4 bg-white text-[#1559ed] rounded-full text-[14px] font-bold hover:bg-zinc-100 transition-colors"
                >
                  Verify with safety agent
                </button>
              </motion.div>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-[24px] border border-black/5 flex gap-4 items-start">
          <Info className="text-zinc-400 shrink-0 mt-0.5" size={18} />
          <div className="text-[13px] text-zinc-500 leading-relaxed font-medium">
            Standard clinical protocols derive 1mg of diphenhydramine per 1lb of body weight. The Brocia Safety Intel Engine enforces rigorous ingredient scrubbing to mitigate risk from non-canine adjuvants.
          </div>
        </div>
      </div>
    </div>
  );
};

const FittingsView = () => {
  return (
  <div className="p-4 md:p-8 h-full overflow-y-auto pb-24 md:pb-8">
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-end mb-8 pl-2">
        <div>
          <h2 className="text-3xl font-bold text-zinc-900 tracking-tight">Recent Cycles</h2>
          <p className="text-zinc-500 mt-1 text-[15px] font-medium">Verify your previous dosage derivations.</p>
        </div>
      </div>
      
      <div className="grid gap-4">
        {MOCK_DB.fittings.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-black/[0.04]">
            <p className="text-zinc-400 font-medium">No cycles found.</p>
          </div>
        ) : (
          MOCK_DB.fittings.map((fitting, i) => (
            <div key={i} className="bg-white p-6 rounded-3xl border border-black/[0.04] shadow-[0_2px_12px_rgba(0,0,0,0.02)] flex flex-col sm:flex-row justify-between sm:items-center gap-4 transition-all hover:border-black/10">
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h3 className="font-semibold text-lg text-zinc-900">{fitting.breed}</h3>
                  <span className="px-3 py-1 bg-zinc-50 rounded-full text-xs font-medium text-zinc-600 border border-black/5">{fitting.date}</span>
                </div>
                <div className="mt-4 flex flex-wrap gap-x-8 gap-y-4 text-sm text-zinc-600">
                  <div className="flex flex-col">
                    <span className="text-[11px] text-zinc-400 font-medium uppercase tracking-wider mb-1">Formulation</span>
                    <strong className="text-zinc-900 text-[15px] font-semibold">{fitting.formulation}</strong>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[11px] text-zinc-400 font-medium uppercase tracking-wider mb-1">Derived Dose</span>
                    <strong className="text-[#1559ed] text-[15px] font-semibold">{fitting.dose_mg}</strong>
                  </div>
                </div>
              </div>
              <span className={cn(
                "px-4 py-1.5 text-xs font-medium rounded-full border w-fit",
                fitting.safety_rating === 'High' ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-orange-50 border-orange-200 text-orange-700"
              )}>
                Precision: {fitting.safety_rating}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  </div>
  );
};

const SafetyGuidesView = () => {
  return (
  <div className="p-4 md:p-8 h-full overflow-y-auto pb-24 md:pb-8">
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-end mb-8 pl-2">
        <div>
          <h2 className="text-3xl font-bold text-zinc-900 tracking-tight">Safety Guides</h2>
          <p className="text-zinc-500 mt-1 text-[15px] font-medium">Critical knowledge for responsible owners.</p>
        </div>
      </div>

      <div className="grid gap-4">
        {MOCK_DB.safety_guides?.map((guide, i) => (
          <div key={i} className="bg-white p-6 rounded-3xl border border-black/[0.04] shadow-[0_2px_12px_rgba(0,0,0,0.02)] flex items-start gap-4 transition-all hover:border-black/10">
            <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center border border-red-100 shrink-0 mt-1">
              <Activity className="text-red-500" size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="font-semibold text-[17px] text-zinc-900">{guide.topic}</span>
                <span className="text-[12px] px-2 py-0.5 bg-red-500 text-white rounded-full font-bold uppercase tracking-tighter">{guide.risk}</span>
              </div>
              <p className="text-zinc-700 text-[15px] leading-relaxed">{guide.description}</p>
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-12 p-8 bg-zinc-900 rounded-[40px] text-white">
          <h3 className="text-2xl font-bold mb-4">Precision Safety Protocols</h3>
          <p className="text-zinc-400 text-lg leading-relaxed">
            Diphenhydramine is a potent clinical agent that requires absolute precision in derivation. 
            The Brocia Safety Intel Engine is designed to mitigate common risks such as <strong>Xylitol contamination</strong> and <strong>decongestant toxicity</strong>. 
            Always verify ingredients and consult with a licensed veterinary professional for dogs with pre-existing cardiovascular or ocular conditions.
          </p>
      </div>
    </div>
  </div>
  );
};

const ReportsView = ({ onAction }: { onAction: (msg?: string) => void }) => {
  const handleGenerateReport = () => {
    onAction();
  };

  return (
    <div className="p-4 md:p-8 h-full overflow-y-auto pb-24 md:pb-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-end mb-8 pl-2">
          <div>
            <h2 className="text-3xl font-bold text-zinc-900 tracking-tight">Safety Reports</h2>
            <p className="text-zinc-500 mt-1 text-[15px] font-medium">Critical insights and summaries for your dog.</p>
          </div>
          <button onClick={handleGenerateReport} className="px-5 py-2.5 bg-black text-white rounded-full text-[13px] font-medium hover:bg-zinc-800 transition-colors">
            + Generate report
          </button>
        </div>

        <div className="grid gap-6">
          {MOCK_DB.reports.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border border-black/[0.04]">
              <p className="text-zinc-400 font-medium">No reports generated yet. Ask the bot to generate a safety assessment.</p>
            </div>
          ) : (
            [...MOCK_DB.reports].reverse().map((report, i) => (
              <div key={i} className="bg-white rounded-[32px] border border-black/[0.04] shadow-[0_2px_12px_rgba(0,0,0,0.02)] overflow-hidden hover:border-black/10 transition-all">
                <div className="bg-zinc-50/50 px-10 py-6 border-b border-black/[0.04] flex justify-between items-center">
                  <h3 className="font-semibold text-[20px] text-zinc-900 tracking-tight">{report.title}</h3>
                  <span className="text-[12px] font-medium bg-white text-zinc-600 px-4 py-1.5 rounded-full border border-black/5">{report.year}</span>
                </div>
                <div className="p-10">
                  <h4 className="font-semibold text-zinc-900 mb-3 text-[15px]">Executive Summary</h4>
                  <p className="text-zinc-500 leading-relaxed mb-10 font-medium text-[14px]">{report.executive_summary}</p>
                  
                  {report.metrics && report.metrics.length > 0 && (
                    <div className="mb-12">
                      <h4 className="font-semibold text-zinc-900 mb-5 text-[15px]">Key Performance Metrics</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        {report.metrics.filter((m: any) => m.value !== 'N/A' && m.value !== 'n/a').map((m: any, idx: number) => (
                          <div key={idx} className="p-6 bg-zinc-50/50 border border-black/[0.04] rounded-3xl">
                            <span className="text-[11px] text-zinc-400 font-medium uppercase tracking-wider block mb-2">{m.label}</span>
                            <div className="flex items-end gap-3">
                              <span className="text-[28px] font-semibold text-zinc-900 tracking-tight leading-none">
                                {m.label.toLowerCase().includes('revenue') || m.label.toLowerCase().includes('value') || m.label.toLowerCase().includes('price') || m.label.toLowerCase().includes('cost') || m.label.toLowerCase().includes('amount') ? '$' : ''}
                                {m.value?.toLocaleString() || 0}
                              </span>
                              {m.trend && m.trend !== 'N/A' && m.trend !== 'n/a' && (
                                <span className={cn(
                                  "text-[13px] font-semibold mb-1",
                                  m.trend.startsWith('+') ? "text-emerald-500" : m.trend.startsWith('-') ? "text-red-500" : "text-zinc-400"
                                )}>
                                  {m.trend}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {report.detailed_analysis && (
                    <div className="mb-12 border-t border-black/[0.04] pt-10">
                      <h4 className="font-semibold text-zinc-900 mb-5 text-[15px]">Detailed Analysis</h4>
                      <div className="markdown-body text-zinc-500 text-[14px] leading-relaxed font-medium">
                        <ReactMarkdown>{report.detailed_analysis}</ReactMarkdown>
                      </div>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10 border-t border-black/[0.04] pt-10">
                    <div>
                      <h4 className="font-semibold text-zinc-900 mb-5 text-[15px]">Key Insights</h4>
                      <div className="grid gap-4">
                        {report.key_insights?.map((insight: string, idx: number) => (
                          <div key={idx} className="bg-zinc-50/50 p-5 rounded-[24px] flex items-start gap-4 border border-black/[0.02]">
                            <div className="w-6 h-6 rounded-full bg-white border border-black/5 flex items-center justify-center shrink-0">
                              <CheckCircle2 size={12} className="text-zinc-400" />
                            </div>
                            <span className="text-zinc-600 font-medium leading-relaxed text-[13.5px]">{insight}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {report.recommendations && (
                      <div>
                        <h4 className="font-semibold text-zinc-900 mb-5 text-[15px]">Strategic Recommendations</h4>
                        <div className="grid gap-4">
                          {report.recommendations?.map((rec: string, idx: number) => (
                            <div key={idx} className="bg-zinc-900 text-white p-5 rounded-[24px] flex items-start gap-4">
                              <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                                <Sparkles size={12} className="text-white/80" />
                              </div>
                              <span className="text-zinc-200 font-medium leading-relaxed text-[13.5px]">{rec}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

const DashboardsView = ({ onAction }: { onAction: (msg?: string) => void }) => {
  const handleGenerateDashboard = () => {
    onAction();
  };

  return (
    <div className="p-4 md:p-8 h-full overflow-y-auto pb-24 md:pb-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-end mb-8 pl-2">
          <div>
            <h2 className="text-3xl font-bold text-zinc-900 tracking-tight">Clinical Snapshots</h2>
            <p className="text-zinc-500 mt-1 text-[15px] font-medium">Visual dosage tiers and formulation performance.</p>
          </div>
          <button onClick={handleGenerateDashboard} className="px-5 py-2.5 bg-black text-white rounded-full text-[13px] font-medium hover:bg-zinc-800 transition-colors">
            + Create dashboard
          </button>
        </div>

        <div className="grid gap-6">
          {MOCK_DB.dashboards.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border border-black/[0.04]">
              <p className="text-zinc-400 font-medium">No dashboards created yet. Ask the bot to visualize safety margins.</p>
            </div>
          ) : (
            [...MOCK_DB.dashboards].reverse().map((dashboard, i) => {
              const mainChartMax = Math.max(...(dashboard.main_chart?.data || []).map((m: any) => m.value || 0));
              const secondaryChartMax = Math.max(...(dashboard.secondary_chart?.data || []).map((m: any) => m.value || 0));

              return (
                <div key={i} className="flex flex-col gap-6 mb-12">
                  <h3 className="font-semibold text-2xl text-zinc-900 tracking-tight pl-2">{dashboard.title}</h3>
                  
                  {/* KPIs Row */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {dashboard.kpis?.filter((kpi: any) => kpi.value !== 'N/A' && kpi.value !== 'n/a').map((kpi: any, idx: number) => (
                      <div key={idx} className="bg-white p-6 rounded-3xl border border-black/[0.04] shadow-[0_2px_12px_rgba(0,0,0,0.02)] flex flex-col justify-between hover:border-black/10 transition-all">
                        <span className="text-[12px] text-zinc-400 font-medium uppercase tracking-wider mb-2">{kpi.label}</span>
                        <div className="flex items-end justify-between">
                          <span className="text-2xl font-bold text-zinc-900 tracking-tight leading-none">{kpi.value}</span>
                          {kpi.trend && kpi.trend !== 'N/A' && kpi.trend !== 'n/a' && (
                            <span className={cn(
                              "text-[12px] font-semibold",
                              kpi.trend.startsWith('+') ? "text-emerald-500" : kpi.trend.startsWith('-') ? "text-red-500" : "text-zinc-400"
                            )}>
                              {kpi.trend}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main Chart */}
                    <div className="lg:col-span-2 bg-white p-8 rounded-[32px] border border-black/[0.04] shadow-[0_2px_12px_rgba(0,0,0,0.02)] flex flex-col">
                      <h4 className="font-semibold text-[17px] text-zinc-900 tracking-tight mb-1">{dashboard.main_chart?.title}</h4>
                      <p className="text-[10px] text-zinc-400 font-medium mb-8 uppercase tracking-wider">{dashboard.main_chart?.type} Chart</p>
                      
                      <div className="flex-1 flex flex-col justify-start gap-5">
                        {dashboard.main_chart?.data?.map((metric: any, idx: number) => {
                          const heightPercent = mainChartMax > 0 ? (metric.value / mainChartMax) * 100 : 0;
                          return (
                            <div key={idx} className="flex items-center gap-2 sm:gap-5">
                              <div className="w-16 sm:w-24 text-[11px] sm:text-[13px] font-medium text-zinc-500 truncate text-right">{metric.label}</div>
                              <div className="flex-1 h-9 bg-zinc-50/80 rounded-full flex items-center border border-black/5 p-1.5 relative overflow-hidden">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${Math.max(heightPercent, 5)}%` }}
                                  className="h-full bg-black rounded-full shadow-sm absolute left-1.5"
                                />
                                <span className={cn("text-[12px] font-semibold tracking-tight absolute z-10", heightPercent > 15 ? "text-white left-4" : "text-zinc-700 left-8")} style={{ left: heightPercent > 15 ? 16 : `calc(${Math.max(heightPercent, 5)}% + 14px)` }}>
                                  {metric.value.toLocaleString()}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex flex-col gap-6">
                      {/* Secondary Chart */}
                      <div className="bg-white p-8 rounded-[32px] border border-black/[0.04] shadow-[0_2px_12px_rgba(0,0,0,0.02)] flex-1">
                        <h4 className="font-semibold text-[15px] text-zinc-900 tracking-tight mb-1">{dashboard.secondary_chart?.title}</h4>
                        <p className="text-[10px] text-zinc-400 font-medium mb-6 uppercase tracking-wider">{dashboard.secondary_chart?.type} Chart</p>
                        
                        <div className="flex flex-col gap-4">
                          {dashboard.secondary_chart?.data?.map((metric: any, idx: number) => {
                            const pct = secondaryChartMax > 0 ? (metric.value / secondaryChartMax) * 100 : 0;
                            return (
                              <div key={idx} className="flex flex-col gap-1.5">
                                <div className="flex justify-between text-[12px] font-medium">
                                  <span className="text-zinc-600 truncate mr-2">{metric.label}</span>
                                  <span className="text-zinc-900 font-semibold">{metric.value.toLocaleString()}</span>
                                </div>
                                <div className="h-2 w-full bg-zinc-100 rounded-full overflow-hidden">
                                  <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${pct}%` }}
                                    className="h-full bg-black rounded-full"
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Recent Activity */}
                      <div className="bg-white p-8 rounded-[32px] border border-black/[0.04] shadow-[0_2px_12px_rgba(0,0,0,0.02)] flex-1">
                        <h4 className="font-semibold text-[15px] text-zinc-900 tracking-tight mb-6">Quick Insights</h4>
                        <div className="flex flex-col gap-4">
                          {dashboard.recent_activity?.map((activity: any, idx: number) => (
                            <div key={idx} className="flex items-start gap-3">
                              <div className="w-5 h-5 rounded-full bg-zinc-50 border border-black/5 flex items-center justify-center shrink-0 mt-0.5">
                                <Activity size={10} className="text-zinc-400" />
                              </div>
                              <p className="text-[13px] text-zinc-600 leading-relaxed font-medium">{activity.text}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

const MobileNav = ({ activeTab, setActiveTab }: { activeTab: string, setActiveTab: (t: string) => void }) => {
  const menuItems = [
    { id: 'tool', label: 'Clinical', icon: Activity },
    { id: 'chat', label: 'Agent', icon: Bot },
    { id: 'dashboards', label: 'Tiers', icon: BarChart3 },
    { id: 'reports', label: 'Reports', icon: FileText },
    { id: 'fittings', label: 'Recent', icon: Clock },
    { id: 'guides', label: 'Safety', icon: ShieldAlert },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 grid grid-cols-6 bg-white border-t border-black/5 px-1 py-2 shrink-0 pb-safe z-50">
      {menuItems.map((item) => (
        <button
          key={item.id}
          onClick={() => setActiveTab(item.id)}
          className={cn(
            "flex flex-col items-center gap-1 p-1 rounded-xl transition-all",
            activeTab === item.id 
              ? "text-[#1559ed]" 
              : "text-zinc-400 hover:text-zinc-600"
          )}
        >
          <item.icon size={18} strokeWidth={activeTab === item.id ? 2.5 : 2} />
          <span className="text-[9px] font-medium truncate w-full text-center">{item.label}</span>
        </button>
      ))}
    </div>
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState('tool');
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentTool, setCurrentTool] = useState<ToolCall | null>(null);
  const [agentSteps, setAgentSteps] = useState<AgentStep[]>([]);
  const [streamingText, setStreamingText] = useState("");
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [showCookieNotice, setShowCookieNotice] = useState(true);

  const handleSendMessage = async (msg: string) => {
    setIsProcessing(true);
    setStreamingText("");
    setAgentSteps([]);
    try {
      await sendMessageToAgentStream(history, msg, (data) => {
        if (data.isDone) {
          setHistory(data.history);
          setIsProcessing(false);
          setStreamingText("");
        } else {
          setHistory(data.history);
          setAgentSteps(data.steps);
          setStreamingText(data.currentText);
        }
      });
    } catch (e) {
      console.error(e);
      setIsProcessing(false);
    }
  };

  const handleAction = (msg?: string) => {
    setActiveTab('chat');
    if (msg) {
      handleSendMessage(msg);
    }
  };

  return (
    <div className={cn("flex flex-col md:flex-row min-h-[100dvh] md:h-screen font-sans text-zinc-900 bg-[#F3F3F3] overflow-hidden selection:bg-[#1559ed] selection:text-white transition-colors", theme === 'dark' && "dark bg-zinc-900")}>
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        <header className="h-[72px] flex items-center justify-between px-6 md:px-8 bg-white/80 backdrop-blur-md border-b border-black/[0.04] z-10 shrink-0">
          <div className="md:hidden flex flex-col">
             <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest leading-none">Brocia</span>
             <span className="font-bold text-zinc-900 text-[13px]">Safety Intel</span>
          </div>
          
          <div className="hidden md:block" />

          <div className="flex items-center gap-2 md:gap-3">
            <button 
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className="p-2 md:p-2.5 rounded-full hover:bg-zinc-100 transition-colors text-zinc-500"
            >
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <button className="flex items-center gap-1.5 md:gap-2 px-4 md:px-5 py-2 md:py-2.5 bg-[#1559ed] text-white rounded-full text-[12px] md:text-[13px] font-bold hover:bg-blue-600 transition-all shadow-[0_4px_20px_rgba(21,89,237,0.2)]">
              <Download size={14} className="md:w-[15px] md:h-[15px]" /> <span className="hidden sm:inline">Clinical</span> Export
            </button>
          </div>
        </header>

        <main className="flex-1 flex flex-col overflow-hidden relative px-2 md:px-4 pb-20 md:pb-6 pt-2 md:pt-6 md:pr-6 md:pl-2 min-h-0">
          <div className="flex-1 min-h-0 overflow-y-auto md:overflow-hidden relative custom-scrollbar">
            {activeTab === 'chat' && (
              <ChatInterface 
                history={history} 
                onSendMessage={handleSendMessage} 
                isProcessing={isProcessing}
                currentTool={currentTool}
                agentSteps={agentSteps}
                streamingText={streamingText}
                setActiveTab={setActiveTab}
              />
            )}
            {activeTab === 'tool' && <ClinicalToolView onAction={handleAction} />}
            {activeTab === 'fittings' && <FittingsView />}
            {activeTab === 'guides' && <SafetyGuidesView />}
            {activeTab === 'reports' && <ReportsView onAction={handleAction} />}
            {activeTab === 'dashboards' && <DashboardsView onAction={handleAction} />}
          </div>
          
          <div className="mt-4 px-4 text-[10px] md:text-[11px] text-zinc-400 text-center md:text-right shrink-0 font-medium">
            Brocia Clinical • Industrial Luxury Safety Engine v2.4
          </div>
        </main>

        <MobileNav activeTab={activeTab} setActiveTab={setActiveTab} />

        <AnimatePresence>
          {showCookieNotice && (
            <motion.div 
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="fixed bottom-20 md:bottom-6 left-4 right-4 md:left-[280px] md:right-10 bg-white/90 backdrop-blur-xl border border-black/[0.04] p-5 md:p-6 rounded-[24px] md:rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.1)] z-40 flex flex-col md:flex-row items-center gap-4 md:gap-6"
            >
              <div className="flex-1">
                <p className="text-[12px] md:text-[14px] text-zinc-600 leading-relaxed font-medium text-center md:text-left">
                  We use performance cookies to derive clinical usage outcomes and optimize the dosage engine. By continuing, you accept our diagnostic protocol.
                </p>
              </div>
              <div className="flex gap-2 md:gap-3 shrink-0 w-full md:w-auto">
                <button onClick={() => setShowCookieNotice(false)} className="flex-1 md:flex-none px-4 md:px-6 py-2.5 md:py-3 text-[12px] md:text-[13px] font-bold text-zinc-400 hover:text-zinc-600 transition-colors">Preferences</button>
                <button onClick={() => setShowCookieNotice(false)} className="flex-1 md:flex-none px-6 md:px-8 py-2.5 md:py-3 bg-black text-white rounded-full text-[12px] md:text-[13px] font-bold hover:bg-zinc-800 transition-all">Accept Protocol</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
