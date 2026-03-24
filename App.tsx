import React, { useState, useRef, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, Upload, Image as ImageIcon, Check, RefreshCw, ChevronRight, ChevronLeft, Download, Sparkles, User, MapPin, Target } from 'lucide-react';
import confetti from 'canvas-confetti';
import { cn } from './lib/utils';
import { AppState, Pose, SceneType, FilterType } from './types';
import { detectScene, generatePoseImage } from './services/gemini';
import { initPoseDetection, drawSkeleton, calculatePoseAccuracy } from './services/poseDetection';
import * as poseDetection from '@tensorflow-models/pose-detection';

const WebcamAny = Webcam as any;

export default function App() {
  const [state, setState] = useState<AppState>({
    step: 'welcome',
    generatedPoses: [],
    activeFilter: 'none',
  });
  const [loading, setLoading] = useState(false);
  const [accuracy, setAccuracy] = useState(0);
  const [isPoseMatch, setIsPoseMatch] = useState(false);
  
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const detectorRef = useRef<poseDetection.PoseDetector | null>(null);
  const requestRef = useRef<number>(null);

  // Initialize detector
  useEffect(() => {
    initPoseDetection().then(d => {
      detectorRef.current = d;
    });
  }, []);

  const handleCaptureBackground = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      setState(prev => ({ ...prev, backgroundImage: imageSrc, step: 'filter-bg' }));
    }
  }, [webcamRef]);

  const handleProfileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setState(prev => ({ ...prev, profileImage: reader.result as string, step: 'generating' }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Generation Logic
  useEffect(() => {
    if (state.step === 'generating' && state.backgroundImage && state.profileImage) {
      const generate = async () => {
        setLoading(true);
        try {
          const { scene, poses } = await detectScene(state.backgroundImage!);
          
          // Generate up to 20 poses for a rich gallery
          const generated: Pose[] = [];
          const maxPoses = Math.min(poses.length, 20);
          
          // Use a staggered approach to show progress if needed, 
          // but for now we'll wait for all to finish for simplicity in this turn
          const generationPromises = poses.slice(0, maxPoses).map(async (poseName, i): Promise<Pose | null> => {
            try {
              const img = await generatePoseImage(state.backgroundImage!, state.profileImage!, poseName);
              return {
                id: `pose-${i}-${Date.now()}`,
                name: poseName,
                description: `Influencer-inspired ${poseName} pose for ${scene}.`,
                imageUrl: img
              };
            } catch (e) {
              console.error(`Failed to generate pose: ${poseName}`, e);
              return null;
            }
          });

          const results = await Promise.all(generationPromises);
          const validPoses = results.filter((p): p is Pose => p !== null);
          
          setState(prev => ({ 
            ...prev, 
            sceneType: scene as SceneType, 
            generatedPoses: validPoses,
            step: 'gallery' 
          }));
        } catch (error) {
          console.error("Generation failed", error);
          alert("Something went wrong during generation. Please try again.");
          setState(prev => ({ ...prev, step: 'welcome' }));
        } finally {
          setLoading(false);
        }
      };
      generate();
    }
  }, [state.step, state.backgroundImage, state.profileImage]);

  const [targetSkeleton, setTargetSkeleton] = useState<poseDetection.Pose | null>(null);

  const handleSelectPose = async (pose: Pose) => {
    setState(prev => ({ ...prev, selectedPose: pose, step: 'pose-guide' }));
    setAccuracy(0);
    setIsPoseMatch(false);
    
    // Detect skeleton from the AI image to use as target
    if (detectorRef.current && pose.imageUrl) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = pose.imageUrl;
      img.onload = async () => {
        const poses = await detectorRef.current!.estimatePoses(img);
        if (poses.length > 0) {
          setTargetSkeleton(poses[0]);
        }
      };
    }
  };

  const filters: { id: FilterType; name: string }[] = [
    { id: 'none', name: 'Original' },
    { id: 'cinematic', name: 'Cinematic' },
    { id: 'vintage', name: 'Vintage' },
    { id: 'bw', name: 'B&W' },
    { id: 'vivid', name: 'Vivid' },
    { id: 'warm', name: 'Warm' },
  ];

  const FilterSelector = ({ onSelect }: { onSelect: () => void }) => (
    <div className="flex flex-col h-full bg-zinc-950 text-white">
      <div className="p-6 border-b border-zinc-900">
        <h2 className="text-2xl font-bold">Apply Filter</h2>
        <p className="text-zinc-500">Set the mood for your photoshoot.</p>
      </div>
      <div className="flex-1 p-6 flex flex-col justify-center items-center space-y-8">
        <div className={cn("w-full max-w-[300px] aspect-[3/4] rounded-3xl overflow-hidden border-4 border-zinc-800 shadow-2xl", `filter-${state.activeFilter}`)}>
          <img src={state.backgroundImage} className="w-full h-full object-cover" alt="Preview" />
        </div>
        <div className="w-full overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-max px-2">
            {filters.map((f) => (
              <button
                key={f.id}
                onClick={() => setState(prev => ({ ...prev, activeFilter: f.id }))}
                className={cn(
                  "flex flex-col items-center gap-2 p-2 rounded-2xl transition-all",
                  state.activeFilter === f.id ? "bg-orange-500 text-white" : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800"
                )}
              >
                <div className={cn("w-16 h-16 rounded-xl overflow-hidden border-2", state.activeFilter === f.id ? "border-white" : "border-transparent", `filter-${f.id}`)}>
                  <img src={state.backgroundImage} className="w-full h-full object-cover" alt={f.name} />
                </div>
                <span className="text-xs font-bold">{f.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="p-6 bg-zinc-900/50 border-t border-zinc-800">
        <button
          onClick={onSelect}
          className="w-full bg-white text-black py-4 rounded-2xl font-bold text-lg hover:bg-orange-500 hover:text-white transition-all flex items-center justify-center gap-2"
        >
          Continue <ChevronRight />
        </button>
      </div>
    </div>
  );

  // Pose Detection Loop
  const detectPose = useCallback(async () => {
    if (
      webcamRef.current &&
      webcamRef.current.video &&
      webcamRef.current.video.readyState === 4 &&
      detectorRef.current &&
      canvasRef.current
    ) {
      const video = webcamRef.current.video;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        try {
          const poses = await detectorRef.current.estimatePoses(video);
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          if (poses.length > 0) {
            drawSkeleton(ctx, poses[0], isPoseMatch ? '#22c55e' : '#ffffff');
            const currentAccuracy = calculatePoseAccuracy(poses[0], targetSkeleton);
            setAccuracy(currentAccuracy);
            
            if (currentAccuracy > 75) { // Lowered threshold for better UX
              setIsPoseMatch(true);
            } else {
              setIsPoseMatch(false);
            }
          }
        } catch (error) {
          // Silently handle texture import errors during video transitions
          console.warn("Pose detection frame skipped:", error);
        }
      }
    }
    requestRef.current = requestAnimationFrame(detectPose);
  }, [isPoseMatch, targetSkeleton]);

  useEffect(() => {
    if (state.step === 'pose-guide') {
      requestRef.current = requestAnimationFrame(detectPose);
    } else if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [state.step, detectPose]);

  const handleCaptureFinal = () => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      setState(prev => ({ ...prev, capturedPhoto: imageSrc, step: 'comparison' }));
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
  };

  const renderStep = () => {
    switch (state.step) {
      case 'welcome':
        return (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-8 bg-black text-white">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="relative"
            >
              <div className="absolute -inset-4 bg-orange-500/20 blur-3xl rounded-full" />
              <ImageIcon size={80} className="text-orange-500 relative" />
            </motion.div>
            <div className="space-y-4">
              <h1 className="text-5xl font-bold tracking-tighter italic">POSE AI</h1>
              <p className="text-zinc-400 max-w-xs mx-auto">
                Your personal AI photographer. Capture a background, and we'll show you how to pose like a pro.
              </p>
            </div>
            <button 
              onClick={() => setState(prev => ({ ...prev, step: 'capture-bg' }))}
              className="group flex items-center gap-3 bg-white text-black px-8 py-4 rounded-full font-bold text-lg hover:bg-orange-500 hover:text-white transition-all"
            >
              Start Session <ChevronRight className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        );

      case 'capture-bg':
        return (
          <div className="relative h-full bg-black">
            <WebcamAny
              ref={webcamRef}
              audio={false}
              screenshotFormat="image/jpeg"
              className="h-full w-full object-cover"
              videoConstraints={{ facingMode: 'environment' }}
            />
            <div className="absolute inset-0 flex flex-col justify-between p-6 pointer-events-none">
              <div className="bg-black/50 backdrop-blur-md p-4 rounded-2xl self-center pointer-events-auto">
                <p className="text-white font-medium flex items-center gap-2">
                  <MapPin size={18} className="text-orange-500" />
                  Capture the background (no people)
                </p>
              </div>
              <div className="flex justify-center pb-8 pointer-events-auto">
                <button 
                  onClick={handleCaptureBackground}
                  className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center hover:scale-110 transition-transform"
                >
                  <div className="w-16 h-16 rounded-full bg-white" />
                </button>
              </div>
            </div>
          </div>
        );

      case 'filter-bg':
        return <FilterSelector onSelect={() => setState(prev => ({ ...prev, step: 'upload-profile' }))} />;

      case 'upload-profile':
        return (
          <div className="flex flex-col items-center justify-center h-full p-8 space-y-8 bg-zinc-950 text-white">
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-bold">Who's Posing?</h2>
              <p className="text-zinc-500">Upload a clear profile photo for face reference.</p>
            </div>
            <label className="w-full max-w-sm aspect-square border-2 border-dashed border-zinc-800 rounded-3xl flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-orange-500 transition-colors bg-zinc-900/50">
              <input type="file" accept="image/*" className="hidden" onChange={handleProfileUpload} />
              <div className="p-6 bg-zinc-800 rounded-full">
                <User size={40} className="text-orange-500" />
              </div>
              <span className="font-medium">Choose Profile Photo</span>
            </label>
            <button 
              onClick={() => setState(prev => ({ ...prev, step: 'capture-bg' }))}
              className="text-zinc-500 flex items-center gap-2 hover:text-white"
            >
              <ChevronLeft size={18} /> Back to Background
            </button>
          </div>
        );

      case 'generating':
        return (
          <div className="flex flex-col items-center justify-center h-full p-8 space-y-12 bg-black text-white overflow-hidden">
            <div className="relative">
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                className="w-48 h-48 border-t-2 border-orange-500 rounded-full"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <Sparkles size={48} className="text-orange-500 animate-pulse" />
              </div>
            </div>
            <div className="text-center space-y-4">
              <h2 className="text-4xl font-bold tracking-tight">AI is crafting your poses...</h2>
              <div className="flex flex-col items-center gap-2">
                <p className="text-zinc-500 animate-pulse">Analyzing scene: {state.sceneType || "Detecting..."}</p>
                <div className="flex gap-1">
                  {[0, 1, 2].map(i => (
                    <motion.div 
                      key={i}
                      animate={{ y: [0, -10, 0] }}
                      transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.2 }}
                      className="w-2 h-2 bg-orange-500 rounded-full"
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

      case 'gallery':
        return (
          <div className="h-full bg-zinc-950 text-white flex flex-col">
            <div className="p-6 border-b border-zinc-900 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold">Pose Gallery</h2>
                <p className="text-zinc-500 text-sm">Recommended for {state.sceneType}</p>
              </div>
              <button 
                onClick={() => setState(prev => ({ ...prev, step: 'capture-bg' }))}
                className="p-2 bg-zinc-900 rounded-full hover:bg-zinc-800"
              >
                <RefreshCw size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-2 gap-4">
                {state.generatedPoses.map((pose) => (
                  <motion.div 
                    key={pose.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800 flex flex-col"
                  >
                    <div 
                      className={cn("w-full aspect-[3/4] overflow-hidden cursor-pointer", `filter-${state.activeFilter}`)}
                      onClick={() => handleSelectPose(pose)}
                    >
                      <img src={pose.imageUrl} alt={pose.name} className="w-full h-full object-cover hover:scale-105 transition-transform" />
                    </div>
                    <div className="p-3 space-y-2 flex-1 flex flex-col justify-between">
                      <div>
                        <h3 className="text-sm font-bold truncate">{pose.name}</h3>
                        <p className="text-zinc-500 text-[10px] line-clamp-2 leading-tight">{pose.description}</p>
                      </div>
                      <div className="flex gap-1 pt-2">
                        <button 
                          onClick={() => {
                            const link = document.createElement('a');
                            link.href = pose.imageUrl!;
                            link.download = `${pose.name}.png`;
                            link.click();
                          }}
                          className="p-2 bg-zinc-800 rounded-lg hover:bg-zinc-700"
                          title="Save"
                        >
                          <Download size={14} />
                        </button>
                        <button 
                          onClick={() => handleSelectPose(pose)}
                          className="flex-1 bg-orange-500 py-2 rounded-lg text-xs font-bold hover:bg-orange-600"
                        >
                          Try Pose
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        );

      case 'pose-guide':
        return (
          <div className="relative h-full bg-black">
            <WebcamAny
              ref={webcamRef}
              audio={false}
              screenshotFormat="image/jpeg"
              className="h-full w-full object-cover"
              videoConstraints={{ facingMode: 'user' }}
            />
            <canvas 
              ref={canvasRef}
              className="absolute inset-0 w-full h-full pointer-events-none opacity-70"
            />
            
            {/* Target Pose Overlay */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-30">
               <img src={state.selectedPose?.imageUrl} className="h-full w-full object-cover grayscale" alt="guide" />
            </div>

            <div className="absolute inset-0 flex flex-col justify-between p-6">
              <div className="flex justify-between items-start">
                <button 
                  onClick={() => setState(prev => ({ ...prev, step: 'gallery' }))}
                  className="p-3 bg-black/50 backdrop-blur-md rounded-full text-white pointer-events-auto"
                >
                  <ChevronLeft size={24} />
                </button>
                <div className="bg-black/50 backdrop-blur-md px-6 py-3 rounded-full text-white pointer-events-auto flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full border-4 border-zinc-800 flex items-center justify-center relative">
                    <svg className="w-full h-full -rotate-90">
                      <circle
                        cx="24" cy="24" r="20"
                        fill="transparent"
                        stroke="currentColor"
                        strokeWidth="4"
                        className="text-orange-500"
                        strokeDasharray={125}
                        strokeDashoffset={125 - (125 * accuracy) / 100}
                      />
                    </svg>
                    <span className="absolute text-xs font-bold">{accuracy}%</span>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">Accuracy</p>
                    <p className="font-bold">{isPoseMatch ? "Perfect Match!" : "Match the Pose"}</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-center pb-8">
                <button 
                  onClick={handleCaptureFinal}
                  disabled={!isPoseMatch}
                  className={cn(
                    "w-20 h-20 rounded-full border-4 flex items-center justify-center transition-all pointer-events-auto",
                    isPoseMatch ? "border-green-500 scale-110" : "border-white/50 opacity-50"
                  )}
                >
                  <div className={cn("w-16 h-16 rounded-full", isPoseMatch ? "bg-green-500" : "bg-white/50")} />
                </button>
              </div>
            </div>
          </div>
        );

      case 'comparison':
        return (
          <div className="h-full bg-zinc-950 text-white flex flex-col">
            <div className="p-6 border-b border-zinc-900">
              <h2 className="text-2xl font-bold">Nailed it!</h2>
              <p className="text-zinc-500">How does it look compared to the AI?</p>
            </div>
            <div className="flex-1 p-6 space-y-6 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">AI Pose</p>
                  <div className={cn("rounded-2xl overflow-hidden border border-zinc-800", `filter-${state.activeFilter}`)}>
                    <img src={state.selectedPose?.imageUrl} alt="AI" className="w-full aspect-[3/4] object-cover" />
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Your Photo</p>
                  <div className={cn("rounded-2xl overflow-hidden border border-orange-500", `filter-${state.activeFilter}`)}>
                    <img src={state.capturedPhoto} alt="Real" className="w-full aspect-[3/4] object-cover" />
                  </div>
                </div>
              </div>
              
              <div className="bg-zinc-900 p-6 rounded-3xl border border-zinc-800 space-y-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-green-500/20 rounded-2xl">
                    <Check className="text-green-500" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Pose Accuracy: 92%</h3>
                    <p className="text-sm text-zinc-500">You matched the {state.selectedPose?.name} perfectly!</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-6 bg-zinc-900/50 backdrop-blur-xl border-t border-zinc-800 flex gap-4">
              <button 
                onClick={() => setState(prev => ({ ...prev, step: 'gallery' }))}
                className="flex-1 py-4 bg-zinc-800 rounded-2xl font-bold hover:bg-zinc-700"
              >
                Try Another
              </button>
              <button 
                onClick={() => {
                  // Simple share logic - in real app would use Web Share API
                  alert("Sharing comparison image...");
                }}
                className="flex-1 py-4 bg-orange-500 rounded-2xl font-bold hover:bg-orange-600"
              >
                Share Result
              </button>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="h-screen w-full max-w-md mx-auto bg-black overflow-hidden shadow-2xl relative">
      <AnimatePresence mode="wait">
        <motion.div
          key={state.step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
          className="h-full w-full"
        >
          {renderStep()}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
