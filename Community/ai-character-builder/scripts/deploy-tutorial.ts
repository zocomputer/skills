#!/usr/bin/env bun
/**
 * AI Character Builder - Tutorial Page Deployer
 * Deploys the interactive tutorial to your zo.space
 */

import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";

const PAGE_CODE = `import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, CheckCircle2, Cpu, Mic, Share2, Terminal, User, Video, Trash2, Copy, Image as ImageIcon, Wand2, CheckSquare, Square } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

type PhaseId = "identity" | "avatar" | "animation" | "voice" | "content";

const PHASES: { id: PhaseId; label: string }[] = [
  { id: "identity", label: "Define Identity" },
  { id: "avatar", label: "Build Avatar" },
  { id: "animation", label: "Animate" },
  { id: "voice", label: "Voice Synthesis" },
  { id: "content", label: "Content & Auto" },
];

// --- Hooks ---
function useProgress() {
  const [completedPhases, setCompletedPhases] = useState<PhaseId[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("ai-character-progress");
    if (saved) {
      try {
        setCompletedPhases(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse progress", e);
      }
    }
    setIsLoaded(true);
  }, []);

  const togglePhase = (phaseId: PhaseId) => {
    setCompletedPhases((prev) => {
      const newPhases = prev.includes(phaseId)
        ? prev.filter((id) => id !== phaseId)
        : [...prev, phaseId];
      localStorage.setItem("ai-character-progress", JSON.stringify(newPhases));
      return newPhases;
    });
  };

  const resetProgress = () => {
    setCompletedPhases([]);
    localStorage.removeItem("ai-character-progress");
  };

  const isComplete = (phaseId: PhaseId) => completedPhases.includes(phaseId);
  const progressPercentage = Math.round((completedPhases.length / PHASES.length) * 100);

  return { completedPhases, togglePhase, resetProgress, isComplete, progressPercentage, isLoaded };
}

// --- Page Components ---
function Hero({ onStart }: { onStart: () => void }) {
  return (
    <section className="relative min-h-[70vh] flex items-center justify-center overflow-hidden border-b border-border bg-zinc-950">
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/80 via-zinc-900/50 to-zinc-950" />
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent" />
      </div>
      
      <div className="container relative z-10 flex flex-col items-center text-center gap-6 max-w-4xl px-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary font-mono text-xs tracking-wider uppercase mb-4">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          System Ready // v1.0.0
        </div>
        
        <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tighter leading-none">
          BUILD YOUR <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-emerald-400">
            DIGITAL SOUL
          </span>
        </h1>
        
        <p className="text-xl md:text-2xl text-zinc-400 max-w-2xl mx-auto">
          The comprehensive interactive guide to creating, animating, and automating AI characters.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 mt-8">
          <Button size="lg" onClick={onStart} className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-none h-14 px-8 text-lg font-mono">
            START_TUTORIAL <Terminal className="ml-2 w-5 h-5" />
          </Button>
        </div>
      </div>
    </section>
  );
}

function PhaseCard({ 
  phase, 
  isCompleted, 
  onClick 
}: { 
  phase: typeof phases[0]; 
  isCompleted: boolean;
  onClick: () => void;
}) {
  const Icon = phase.icon;
  return (
    <Card 
      onClick={onClick}
      className={\`group relative overflow-hidden border-border bg-zinc-900/50 transition-all duration-300 cursor-pointer h-full rounded-none hover:border-primary/50 \${isCompleted ? 'border-primary/30' : ''}\`}
    >
      <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-transparent via-primary to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      <CardHeader className="relative z-20">
        <div className="flex justify-between items-start mb-2">
          <span className={\`font-mono text-4xl font-bold opacity-20 group-hover:opacity-100 transition-opacity duration-300 \${phase.color}\}>
            {phase.id}
          </span>
          <div className="relative">
            <Icon className={\`w-8 h-8 \${phase.color} opacity-80 group-hover:scale-110 transition-transform duration-300\`} />
            {isCompleted && (
              <div className="absolute -top-2 -right-2 bg-zinc-950 rounded-full p-0.5">
                <CheckCircle2 className="w-4 h-4 text-primary fill-primary/20" />
              </div>
            )}
          </div>
        </div>
        <CardTitle className="text-2xl font-bold tracking-tight group-hover:text-primary transition-colors">
          {phase.title}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="relative z-20">
        <CardDescription className="text-base mb-6 text-zinc-400">
          {phase.description}
        </CardDescription>
        <div className={\`flex items-center text-sm font-medium \${phase.color} opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300\`}>
          ACCESS_MODULE <ArrowRight className="ml-2 w-4 h-4" />
        </div>
      </CardContent>
    </Card>
  );
}

// --- Phase Content Components ---
function IdentityPhase({ 
  isComplete, 
  onToggle 
}: { 
  isComplete: boolean; 
  onToggle: () => void;
}) {
  const [formData, setFormData] = useState({ name: "", niche: "", audience: "", backstory: "", values: "" });
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2 text-primary font-mono text-sm uppercase tracking-wider mb-2">
            <span className="w-2 h-2 bg-primary rounded-full" />
            Phase 01
          </div>
          <h2 className="text-4xl font-bold">DEFINE_IDENTITY</h2>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onToggle}
          className={\`font-mono text-xs gap-2 \${isComplete ? 'bg-primary/10 border-primary text-primary' : ''}\`}
        >
          {isComplete ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
          {isComplete ? "PHASE_COMPLETE" : "MARK_COMPLETE"}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <div className="space-y-4">
            <h3 className="text-xl font-bold font-mono flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              CORE_CONCEPTS
            </h3>
            <div className="space-y-4 text-zinc-400 text-sm">
              <p><strong className="text-zinc-200">Niche & Audience:</strong> Avoid broad categories. Instead of "Travel", choose "Sustainable Budget Travel".</p>
              <p><strong className="text-zinc-200">Backstory:</strong> The "why" behind your character. It explains their perspective and motivations.</p>
              <p><strong className="text-zinc-200">Core Values:</strong> Unwavering principles that guide every interaction.</p>
            </div>
          </div>
          
          <Card className="bg-zinc-900/50 border-primary/20 rounded-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-mono uppercase text-primary">Pro Tip</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-zinc-400">
              Treat your AI character like a brand. Consistency builds trust faster than visual perfection.
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card className="border-border bg-zinc-900/50 rounded-none">
            <CardHeader className="border-b border-border bg-zinc-950/50">
              <CardTitle className="font-mono text-lg">IDENTITY_MATRIX_BUILDER</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name" className="font-mono text-xs uppercase">Character Name</Label>
                  <Input 
                    id="name" name="name" placeholder="e.g. Aria Nova"
                    className="rounded-none bg-zinc-950"
                    value={formData.name} onChange={handleChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="niche" className="font-mono text-xs uppercase">Specific Niche</Label>
                  <Input 
                    id="niche" name="niche" placeholder="e.g. Ethical AI Tech Reviews"
                    className="rounded-none bg-zinc-950"
                    value={formData.niche} onChange={handleChange}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="audience" className="font-mono text-xs uppercase">Target Audience</Label>
                <Input 
                  id="audience" name="audience" placeholder="Who are you talking to?"
                  className="rounded-none bg-zinc-950"
                  value={formData.audience} onChange={handleChange}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="backstory" className="font-mono text-xs uppercase">Backstory & Origin</Label>
                <Textarea 
                  id="backstory" name="backstory" placeholder="What drives your character?"
                  className="min-h-[100px] rounded-none bg-zinc-950 resize-none"
                  value={formData.backstory} onChange={handleChange}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="values" className="font-mono text-xs uppercase">Core Values (3-5)</Label>
                <Textarea 
                  id="values" name="values" placeholder="e.g. Radical Transparency, Optimism, Curiosity"
                  className="min-h-[80px] rounded-none bg-zinc-950 resize-none"
                  value={formData.values} onChange={handleChange}
                />
              </div>
            </CardContent>
          </Card>

          {formData.name && (
            <div className="mt-8 animate-in fade-in">
              <h4 className="font-mono text-sm text-zinc-500 mb-4 uppercase">Preview_Output</h4>
              <div className="border border-primary/30 bg-primary/5 p-6">
                <h3 className="text-2xl font-bold mb-2">{formData.name}</h3>
                <div className="text-sm font-mono text-primary mb-4">{formData.niche}</div>
                <p className="text-zinc-400 italic">&quot;{formData.backstory || 'Your backstory here...'}&quot;</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AvatarPhase({ isComplete, onToggle }: { isComplete: boolean; onToggle: () => void }) {
  const prompts = [
    { style: "Photorealistic", prompt: "Portrait of a 25-year-old tech enthusiast, mixed heritage, wearing minimalist streetwear, soft studio lighting, 85mm lens, f/1.8, highly detailed skin texture, 8k --ar 2:3" },
    { style: "Cyberpunk", prompt: "Digital avatar, neon accents, glowing cybernetic interface, dark background with cyan and magenta rim light, octane render, unreal engine 5 style, futuristic fashion --ar 2:3" },
    { style: "3D Claymation", prompt: "3D character design, clay material, soft rounded shapes, friendly expression, bright pastel colors, clean background, pixar style, high quality render --ar 2:3" },
  ];

  const copyPrompt = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Prompt copied to clipboard!");
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2 text-cyan-400 font-mono text-sm uppercase tracking-wider mb-2">
            <span className="w-2 h-2 bg-cyan-400 rounded-full" />
            Phase 02
          </div>
          <h2 className="text-4xl font-bold">BUILD_AVATAR</h2>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onToggle}
          className={\`font-mono text-xs gap-2 \${isComplete ? 'bg-cyan-400/10 border-cyan-400 text-cyan-400' : ''}\`}
        >
          {isComplete ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
          {isComplete ? "PHASE_COMPLETE" : "MARK_COMPLETE"}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-xl font-bold font-mono flex items-center gap-2">
              <Cpu className="w-5 h-5 text-cyan-400" />
              GENERATION_TIPS
            </h3>
            <div className="space-y-4 text-zinc-400 text-sm">
              <p><strong className="text-zinc-200">Consistency:</strong> Use the same seed or reference image to keep features consistent.</p>
              <p><strong className="text-zinc-200">Detail:</strong> Be specific about lighting, angles, and clothing.</p>
              <p><strong className="text-zinc-200">Variety:</strong> Generate poses and expressions for different contexts.</p>
            </div>
          </div>

          <Card className="border-border bg-zinc-900/50 rounded-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-mono uppercase text-cyan-400">Tools</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <Wand2 className="w-4 h-4 text-cyan-400" />
                <span className="text-zinc-200">Midjourney</span>
                <span className="text-zinc-500 text-xs ml-auto">Best for artistic quality</span>
              </div>
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-cyan-400" />
                <span className="text-zinc-200">Stable Diffusion</span>
                <span className="text-zinc-500 text-xs ml-auto">Best for control</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-bold font-mono">PROMPT_LIBRARY</h3>
          {prompts.map((item, index) => (
            <Card key={index} className="border-border bg-zinc-900/50 rounded-none group">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-mono text-cyan-400">{item.style}</CardTitle>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => copyPrompt(item.prompt)}
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <code className="text-xs text-zinc-400 font-mono block bg-zinc-950 p-3 border border-border">
                  {item.prompt}
                </code>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

function AnimationPhase({ isComplete, onToggle }: { isComplete: boolean; onToggle: () => void }) {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2 text-purple-400 font-mono text-sm uppercase tracking-wider mb-2">
            <span className="w-2 h-2 bg-purple-400 rounded-full" />
            Phase 03
          </div>
          <h2 className="text-4xl font-bold">ANIMATE</h2>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onToggle}
          className={\`font-mono text-xs gap-2 \${isComplete ? 'bg-purple-400/10 border-purple-400 text-purple-400' : ''}\`}
        >
          {isComplete ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
          {isComplete ? "PHASE_COMPLETE" : "MARK_COMPLETE"}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-border bg-zinc-900/50 rounded-none">
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Video className="w-5 h-5 text-purple-400" />
              Image-to-Video
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-zinc-400 space-y-4">
            <p>Transform static avatar images into animated videos.</p>
            <ul className="space-y-2 text-zinc-500">
              <li>• Runway Gen-2 / Gen-3</li>
              <li>• Pika Labs</li>
              <li>• Stable Video Diffusion</li>
              <li>• Kling AI</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="border-border bg-zinc-900/50 rounded-none">
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-purple-400" />
              Talking Head
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-zinc-400 space-y-4">
            <p>Generate lip-synced videos from audio.</p>
            <ul className="space-y-2 text-zinc-500">
              <li>• D-ID</li>
              <li>• HeyGen</li>
              <li>• Synthesia</li>
              <li>• wav2lip</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function VoicePhase({ isComplete, onToggle }: { isComplete: boolean; onToggle: () => void }) {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2 text-emerald-400 font-mono text-sm uppercase tracking-wider mb-2">
            <span className="w-2 h-2 bg-emerald-400 rounded-full" />
            Phase 04
          </div>
          <h2 className="text-4xl font-bold">VOICE_SYNTHESIS</h2>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onToggle}
          className={\`font-mono text-xs gap-2 \${isComplete ? 'bg-emerald-400/10 border-emerald-400 text-emerald-400' : ''}\`}
        >
          {isComplete ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
          {isComplete ? "PHASE_COMPLETE" : "MARK_COMPLETE"}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-border bg-zinc-900/50 rounded-none">
          <CardHeader>
            <CardTitle className="text-base font-bold text-emerald-400">ElevenLabs</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-zinc-400">
            <p className="mb-3">Most natural-sounding voices. Best for premium content.</p>
            <div className="text-xs text-zinc-500 font-mono">Recommended: Rachel, Adam, Bella</div>
          </CardContent>
        </Card>

        <Card className="border-border bg-zinc-900/50 rounded-none">
          <CardHeader>
            <CardTitle className="text-base font-bold text-emerald-400">Azure TTS</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-zinc-400">
            <p className="mb-3">Enterprise-grade with SSML control. Best for scale.</p>
            <div className="text-xs text-zinc-500 font-mono">Recommended: Jenny, Guy, Aria</div>
          </CardContent>
        </Card>

        <Card className="border-border bg-zinc-900/50 rounded-none">
          <CardHeader>
            <CardTitle className="text-base font-bold text-emerald-400">Amazon Polly</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-zinc-400">
            <p className="mb-3">Cost-effective with neural voices. Best for budget.</p>
            <div className="text-xs text-zinc-500 font-mono">Recommended: Joanna, Matthew</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ContentPhase({ isComplete, onToggle }: { isComplete: boolean; onToggle: () => void }) {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2 text-amber-400 font-mono text-sm uppercase tracking-wider mb-2">
            <span className="w-2 h-2 bg-amber-400 rounded-full" />
            Phase 05
          </div>
          <h2 className="text-4xl font-bold">CONTENT_AUTOMATION</h2>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onToggle}
          className={\`font-mono text-xs gap-2 \${isComplete ? 'bg-amber-400/10 border-amber-400 text-amber-400' : ''}\`}
        >
          {isComplete ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
          {isComplete ? "PHASE_COMPLETE" : "MARK_COMPLETE"}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-border bg-zinc-900/50 rounded-none">
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Share2 className="w-5 h-5 text-amber-400" />
              Scheduling Tools
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-zinc-400 space-y-3">
            <p>Automate posting across platforms.</p>
            <ul className="space-y-2 text-zinc-500">
              <li>• Blotato (Zo integrated)</li>
              <li>• Buffer</li>
              <li>• Later</li>
              <li>• Hootsuite</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="border-border bg-zinc-900/50 rounded-none">
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Terminal className="w-5 h-5 text-amber-400" />
              Workflow Ideas
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-zinc-400 space-y-3">
            <ul className="space-y-3 text-zinc-500">
              <li><strong className="text-zinc-300">Auto-Crosspost:</strong> Post to TikTok → auto-share to Reels/Shorts</li>
              <li><strong className="text-zinc-300">Content Repurposing:</strong> Long video → clips → quotes</li>
              <li><strong className="text-zinc-300">Engagement Bot:</strong> Auto-reply to comments in first hour</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// --- Main Page Component ---
const phases = [
  { id: "01", phaseId: "identity" as PhaseId, title: "Define Identity", description: "Craft persona, niche, and backstory.", icon: User, color: "text-primary", borderColor: "border-primary" },
  { id: "02", phaseId: "avatar" as PhaseId, title: "Build Avatar", description: "Generate visual assets with AI.", icon: Cpu, color: "text-cyan-400", borderColor: "border-cyan-400" },
  { id: "03", phaseId: "animation" as PhaseId, title: "Animate", description: "Bring character to life with motion.", icon: Video, color: "text-purple-400", borderColor: "border-purple-400" },
  { id: "04", phaseId: "voice" as PhaseId, title: "Voice Synthesis", description: "Give your character a unique voice.", icon: Mic, color: "text-emerald-400", borderColor: "border-emerald-400" },
  { id: "05", phaseId: "content" as PhaseId, title: "Content & Auto", description: "Automate workflow and distribution.", icon: Share2, color: "text-amber-400", borderColor: "border-amber-400" },
];

export default function CharacterBuilderPage() {
  const [activePhase, setActivePhase] = useState<PhaseId | null>(null);
  const { isComplete, togglePhase, progressPercentage, isLoaded, resetProgress } = useProgress();

  const renderPhaseContent = () => {
    switch (activePhase) {
      case "identity": return <IdentityPhase isComplete={isComplete("identity")} onToggle={() => togglePhase("identity")} />;
      case "avatar": return <AvatarPhase isComplete={isComplete("avatar")} onToggle={() => togglePhase("avatar")} />;
      case "animation": return <AnimationPhase isComplete={isComplete("animation")} onToggle={() => togglePhase("animation")} />;
      case "voice": return <VoicePhase isComplete={isComplete("voice")} onToggle={() => togglePhase("voice")} />;
      case "content": return <ContentPhase isComplete={isComplete("content")} onToggle={() => togglePhase("content")} />;
      default: return null;
    }
  };

  if (activePhase) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <div className="border-b border-border">
          <div className="container px-4 py-4 flex items-center justify-between">
            <Button variant="ghost" onClick={() => setActivePhase(null)} className="font-mono text-sm">
              ← BACK_TO_MODULES
            </Button>
            <div className="font-mono text-xs text-zinc-500">
              Progress: {progressPercentage}%
            </div>
          </div>
        </div>
        <main className="container px-4 py-8 max-w-5xl mx-auto">
          {renderPhaseContent()}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <Hero onStart={() => setActivePhase("identity")} />
      
      {/* Progress Section */}
      {isLoaded && (
        <section className="container px-4 -mt-8 relative z-20">
          <div className="bg-zinc-900 border border-border p-6 shadow-lg max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="space-y-1">
                <h3 className="font-mono text-sm font-bold uppercase tracking-wider text-primary">System_Progress</h3>
                <p className="text-xs text-zinc-500">Completion: {progressPercentage}%</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="font-mono text-2xl font-bold text-primary">{progressPercentage}%</div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-500 hover:text-red-400">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-zinc-950 border-red-500/30">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-red-400 font-mono uppercase">System_Reset</AlertDialogTitle>
                      <AlertDialogDescription className="text-zinc-400">
                        This will permanently delete your progress. Cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="rounded-none font-mono text-xs bg-zinc-900">CANCEL</AlertDialogCancel>
                      <AlertDialogAction onClick={resetProgress} className="bg-red-500 text-white rounded-none font-mono text-xs">
                        CONFIRM_RESET
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
            <Progress value={progressPercentage} className="h-2 bg-zinc-800" />
          </div>
        </section>
      )}

      {/* Phases Grid */}
      <section className="container px-4 py-16">
        <div className="flex items-center justify-between mb-12">
          <h2 className="text-3xl font-bold tracking-tight font-mono border-l-4 border-primary pl-4">
            SYSTEM_MODULES
          </h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {phases.map((phase) => (
            <PhaseCard 
              key={phase.id} 
              phase={phase} 
              isCompleted={isComplete(phase.phaseId)}
              onClick={() => setActivePhase(phase.phaseId)}
            />
          ))}
          
          <Card className="border-dashed border-border bg-zinc-900/20 flex items-center justify-center min-h-[200px] rounded-none opacity-60">
            <div className="text-center p-6">
              <div className="font-mono text-sm text-zinc-500 mb-2">MORE_MODULES</div>
              <div className="text-xl font-bold text-zinc-400">COMING_SOON...</div>
            </div>
          </Card>
        </div>
      </section>
      
      {/* Stats Section */}
      <section className="container px-4 py-12 border-y border-border bg-zinc-900/20">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div className="space-y-2">
            <div className="text-4xl font-bold font-mono text-primary">05</div>
            <div className="text-sm text-zinc-500 uppercase tracking-wider">Core Phases</div>
          </div>
          <div className="space-y-2">
            <div className="text-4xl font-bold font-mono text-cyan-400">10+</div>
            <div className="text-sm text-zinc-500 uppercase tracking-wider">AI Tools</div>
          </div>
          <div className="space-y-2">
            <div className="text-4xl font-bold font-mono text-purple-400">∞</div>
            <div className="text-sm text-zinc-500 uppercase tracking-wider">Possibilities</div>
          </div>
          <div className="space-y-2">
            <div className="text-4xl font-bold font-mono text-emerald-400">24/7</div>
            <div className="text-sm text-zinc-500 uppercase tracking-wider">Availability</div>
          </div>
        </div>
      </section>
      
      {/* CLI Section */}
      <section className="container px-4 py-16">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <h2 className="text-3xl font-bold font-mono">ALSO AVAILABLE AS CLI</h2>
          <p className="text-zinc-400">
            Power users can automate character creation with the command-line tools.
          </p>
          <div className="bg-zinc-900 border border-border p-6 rounded-none text-left">
            <code className="text-sm font-mono text-zinc-300 block space-y-2">
              <div><span className="text-zinc-500"># Generate identity</span></div>
              <div><span className="text-cyan-400">bun</span> generate-identity.ts --interactive</div>
              <div className="pt-2"><span className="text-zinc-500"># Generate avatar images</span></div>
              <div><span className="text-cyan-400">bun</span> generate-avatar.ts --identity ./my-character.json</div>
              <div className="pt-2"><span className="text-zinc-500"># Generate voice config</span></div>
              <div><span className="text-cyan-400">bun</span> generate-voice.ts --identity ./my-character.json</div>
            </code>
          </div>
        </div>
      </section>
    </div>
  );
}
`;

async function deployTutorial(options: {
  path?: string;
  public?: boolean;
}): Promise<void> {
  const routePath = options.path || '/character-builder';
  const isPublic = options.public || false;
  
  console.log(`🚀 Deploying AI Character Builder tutorial to zo.space\n`);
  console.log(`  Route: ${routePath}`);
  console.log(`  Visibility: ${isPublic ? 'Public' : 'Private'}`);
  console.log(`\n  This will create/update the route on your zo.space.`);
  console.log(`  You'll need to use the update_space_route tool to complete deployment.`);
  
  // Save the code to a temp file for reference
  const tempDir = '/home/.z/workspaces/con_ZnVT2a5CzSOOV631/character-builder-deploy';
  if (!existsSync(tempDir)) {
    await mkdir(tempDir, { recursive: true });
  }
  
  await writeFile(`${tempDir}/page.tsx`, PAGE_CODE);
  console.log(`\n💾 Page code saved to: ${tempDir}/page.tsx`);
  
  console.log(`\n📋 To complete deployment, run:`);
  console.log(`  update_space_route({`);
  console.log(`    path: "${routePath}",`);
  console.log(`    route_type: "page",`);
  console.log(`    code: PAGE_CODE,`);
  console.log(`    public: ${isPublic}`);
  console.log(`  })`);
}

// Parse command line arguments
const args = process.argv.slice(2);
const options: Record<string, string | boolean> = {};

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg.startsWith('--')) {
    const key = arg.slice(2);
    const nextArg = args[i + 1];
    if (nextArg && !nextArg.startsWith('--')) {
      options[key] = nextArg;
      i++;
    } else {
      options[key] = true;
    }
  }
}

deployTutorial({
  path: options.path as string,
  public: options.public === true
}).catch(err => {
  console.error("❌ Error:", err);
  process.exit(1);
});
