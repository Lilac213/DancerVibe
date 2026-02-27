
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { X, RefreshCw, Volume2, VolumeX, Loader2, StopCircle, ThumbsUp, ThumbsDown, Settings2 } from 'lucide-react';
import { saveVideo } from '../services/videoStorage';

// --- 1. Core Data Structures ---

interface Keypoint {
    x: number;
    y: number;
    z: number;
    visibility: number;
}

interface IMUState {
    pitch: number; // Beta: Front/Back tilt
    roll: number;  // Gamma: Left/Right tilt
}

interface PoseFrame {
    ceilingRatio: number;
    groundRatio: number;
    bodyRatio: number;
    bodyCenterY: number;
    headVisible: boolean;
    footVisible: boolean;
}

interface ShootingState extends PoseFrame {
    pitch: number;
    roll: number;
}

type GuidanceType = 'noPerson' | 'headOut' | 'feetOut' | 'tooLeft' | 'tooRight' | 'tooFar' | 'tooClose' | 'stable' | 'tilt_bad';

interface GuidanceResult {
    type: GuidanceType;
    confidence: number;
}

// MediaPipe Pose Landmark Indices
const LANDMARKS = {
    NOSE: 0,
    LEFT_SHOULDER: 11,
    RIGHT_SHOULDER: 12,
    LEFT_HIP: 23,
    RIGHT_HIP: 24,
    LEFT_ANKLE: 27,
    RIGHT_ANKLE: 28,
    LEFT_FOOT_INDEX: 31,
    RIGHT_FOOT_INDEX: 32
};

// --- 2. Logic Engines ---

class Analyzer {
    static analyzePose(landmarks: Keypoint[]): PoseFrame {
        const getKp = (index: number) => landmarks[index];
        const nose = getKp(LANDMARKS.NOSE);
        const leftFoot = getKp(LANDMARKS.LEFT_FOOT_INDEX);
        const rightFoot = getKp(LANDMARKS.RIGHT_FOOT_INDEX);

        // MediaPipe Y: 0 is top, 1 is bottom
        const headY = nose ? nose.y : 0;
        
        // Find lowest point of feet
        const footY = Math.max(
            leftFoot ? leftFoot.y : 0,
            rightFoot ? rightFoot.y : 0
        );

        // Calculate Ratios
        // Ceiling: Space above head
        const ceilingRatio = Math.max(0, headY);
        
        // Ground: Space below feet (1.0 is bottom)
        const groundRatio = Math.max(0, 1.0 - footY);
        
        // Body: Space occupied by person
        const bodyRatio = footY - headY;
        
        const bodyCenterY = (headY + footY) / 2;

        return {
            ceilingRatio,
            groundRatio,
            bodyRatio,
            bodyCenterY,
            headVisible: nose && nose.visibility > 0.5,
            footVisible: (leftFoot && leftFoot.visibility > 0.5) || (rightFoot && rightFoot.visibility > 0.5)
        };
    }

    static generateGuidance(state: ShootingState): GuidanceResult {
        // 1. Check Visibility
        if (!state.headVisible && !state.footVisible) return { type: 'noPerson', confidence: 1 };
        
        // 2. Check Tilt (IMU) - Simple Leveler Check
        if (Math.abs(state.roll) > 10) {
            return { type: 'tilt_bad', confidence: 0.9 }; // "Keep phone level"
        }

        // 3. Composition Rules
        if (!state.headVisible || state.ceilingRatio < 0.05) return { type: 'headOut', confidence: 0.9 };
        if (!state.footVisible || state.groundRatio < 0.02) return { type: 'feetOut', confidence: 0.9 };

        // 4. Centering (Body Center Y should be roughly middle, X logic is separate but assumed handled)
        // Note: For dance, we usually want full body. 
        // If Ceiling is huge (>30%) and Floor is huge (>30%), too far.
        if (state.ceilingRatio > 0.3 && state.groundRatio > 0.3) return { type: 'tooFar', confidence: 0.7 };
        
        // If both are tiny, too close
        if (state.ceilingRatio < 0.05 && state.groundRatio < 0.05) return { type: 'tooClose', confidence: 0.7 };

        return { type: 'stable', confidence: 1 };
    }
}

class GuidanceStateMachine {
    private stableDuration: number = 2000;
    private minPromptInterval: number = 3000;
    
    private lastGuidance: GuidanceType | null = null;
    private lastPromptTime: number = 0;
    private stableStartTime: number | null = null;

    public onSpeak?: (type: GuidanceType) => void;
    public onStable?: () => void;
    public onUnstable?: () => void;

    public reset() {
        this.lastGuidance = null;
        this.lastPromptTime = 0;
        this.stableStartTime = null;
    }

    public handle(guidance: GuidanceResult) {
        const now = Date.now();

        if (guidance.type === 'stable') {
            if (this.stableStartTime === null) {
                this.stableStartTime = now;
            } else if (now - this.stableStartTime >= this.stableDuration) {
                this.onStable?.();
                // Prevent repeated firing until reset
                this.stableStartTime = null; 
            }
            return;
        }

        // Not stable -> Reset stable timer
        if (this.stableStartTime !== null) {
            this.stableStartTime = null;
            this.onUnstable?.();
        }

        // Throttle prompts
        if (
            guidance.type === this.lastGuidance &&
            (now - this.lastPromptTime) < this.minPromptInterval
        ) {
            return;
        }

        this.lastGuidance = guidance.type;
        this.lastPromptTime = now;
        this.onSpeak?.(guidance.type);
    }
}

class CountdownController {
    private timer: number | null = null;
    private remaining: number = 0;
    public isRunning: boolean = false;

    public onTick?: (seconds: number) => void;
    public onFinish?: () => void;

    public start(seconds: number = 3) {
        if (this.isRunning) return;

        this.isRunning = true;
        this.remaining = seconds;
        this.onTick?.(this.remaining);

        // Immediate tick
        if (this.remaining > 0) this.onTick?.(this.remaining);

        this.timer = window.setInterval(() => {
            this.remaining -= 1;
            if (this.remaining > 0) {
                this.onTick?.(this.remaining);
            } else {
                this.stop();
                this.onFinish?.();
            }
        }, 1000);
    }

    public stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        this.isRunning = false;
        this.onTick?.(0); 
    }
}

// --- React Component ---

interface SmartCameraProps {
    isOpen: boolean;
    onClose: () => void;
    onCaptureComplete: () => void;
}

declare global {
    interface Window {
        Pose: any;
        Camera: any;
        drawConnectors: any;
        drawLandmarks: any;
        POSE_CONNECTIONS: any;
    }
}

const SmartCamera: React.FC<SmartCameraProps> = ({ isOpen, onClose, onCaptureComplete }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
    const [isMuted, setIsMuted] = useState(false);
    
    // UI States
    const [guidanceText, setGuidanceText] = useState("正在初始化...");
    const [guidanceType, setGuidanceType] = useState<GuidanceType>('noPerson');
    const [countdown, setCountdown] = useState(0);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    
    // Debug Stats
    const [debugStats, setDebugStats] = useState<ShootingState | null>(null);

    // Refs
    const stateMachine = useRef(new GuidanceStateMachine());
    const countdownCtrl = useRef(new CountdownController());
    const imuRef = useRef<IMUState>({ pitch: 0, roll: 0 });
    const poseRef = useRef<any>(null);
    const cameraRef = useRef<any>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const isRecordingRef = useRef(false); // Sync ref for loop access

    // --- 1. IMU Initialization ---
    useEffect(() => {
        const handleOrientation = (e: DeviceOrientationEvent) => {
            if (e.beta !== null && e.gamma !== null) {
                imuRef.current = {
                    pitch: e.beta, // Front/Back tilt
                    roll: e.gamma  // Left/Right tilt
                };
            }
        };

        if (isOpen) {
            window.addEventListener('deviceorientation', handleOrientation);
        }
        return () => {
            window.removeEventListener('deviceorientation', handleOrientation);
        };
    }, [isOpen]);

    // --- 2. Camera & Logic Setup ---
    useEffect(() => {
        if (isOpen) {
            initMediaPipe();
        } else {
            cleanup();
        }
        return () => cleanup();
    }, [isOpen, facingMode]);

    // Sync isRecording state to ref for callbacks
    useEffect(() => {
        isRecordingRef.current = isRecording;
        if (!isRecording) {
            // Reset machine when not recording to allow re-detection
            stateMachine.current.reset();
        }
    }, [isRecording]);

    // Setup Logic Callbacks
    useEffect(() => {
        const sm = stateMachine.current;
        const cc = countdownCtrl.current;

        sm.onSpeak = (type) => {
            // Don't speak if recording or counting down
            if (isRecordingRef.current || cc.isRunning) return;

            const msgs: Record<GuidanceType, string> = {
                noPerson: "请入镜",
                headOut: "头顶留空太少",
                feetOut: "脚部被切",
                tooLeft: "往右移",
                tooRight: "往左移",
                tooFar: "太远了",
                tooClose: "太近了",
                stable: "保持...",
                tilt_bad: "手机拿平"
            };
            const text = msgs[type];
            setGuidanceText(text);
            setGuidanceType(type);
            speak(text);
        };

        sm.onStable = () => {
            if (isRecordingRef.current || cc.isRunning) return;
            setGuidanceText("构图完美 3秒后录制");
            setGuidanceType('stable');
            cc.start(3);
        };

        sm.onUnstable = () => {
            if (isRecordingRef.current) return;
            cc.stop();
            setCountdown(0);
        };

        cc.onTick = (sec) => {
            setCountdown(sec);
            if (sec > 0) speak(sec.toString());
        };

        cc.onFinish = () => {
            setCountdown(0);
            if (!isRecordingRef.current) {
                startRecording();
            }
        };

        return () => {
            sm.onSpeak = undefined;
            sm.onStable = undefined;
            sm.onUnstable = undefined;
            cc.onTick = undefined;
            cc.onFinish = undefined;
        };
    }, [isMuted]); // Dependencies minimal to avoid re-binding unnecessarily

    const speak = (text: string) => {
        if (isMuted || !window.speechSynthesis) return;
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'zh-CN';
        u.rate = 1.2;
        window.speechSynthesis.speak(u);
    };

    const initMediaPipe = async () => {
        if (!window.Pose) {
            setTimeout(initMediaPipe, 500);
            return;
        }

        const pose = new window.Pose({
            locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
        });

        pose.setOptions({
            modelComplexity: 1,
            smoothLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });

        pose.onResults(onPoseResults);
        poseRef.current = pose;

        if (videoRef.current) {
            const camera = new window.Camera(videoRef.current, {
                onFrame: async () => {
                    // Safety Check: Ensure refs are valid before using
                    if (poseRef.current && videoRef.current) {
                        try {
                            await poseRef.current.send({image: videoRef.current});
                        } catch (e) {
                            console.warn("Pose send error:", e);
                        }
                    }
                },
                width: 640,
                height: 480,
                facingMode: facingMode
            });
            camera.start();
            cameraRef.current = camera;
        }
    };

    const onPoseResults = (results: any) => {
        // If unmounted or refs invalid, stop
        if (!videoRef.current || !canvasRef.current) return;

        const landmarks = results.poseLandmarks as Keypoint[];
        const imu = imuRef.current;
        let shootingState: ShootingState | null = null;

        // 1. Calculate Metrics
        if (landmarks) {
            const poseMetrics = Analyzer.analyzePose(landmarks);
            shootingState = { ...poseMetrics, ...imu };
            setDebugStats(shootingState); // Update Debug UI
        }

        // 2. Draw Overlay (Always draw, even during recording)
        drawZonesOverlay(shootingState);

        // 3. Logic (Stop logic if recording)
        if (isRecordingRef.current) return;
        
        if (shootingState) {
            const guidance = Analyzer.generateGuidance(shootingState);
            stateMachine.current.handle(guidance);
        } else {
            stateMachine.current.handle({ type: 'noPerson', confidence: 1 });
        }
    };

    const drawZonesOverlay = (state: ShootingState | null) => {
        // Capture refs locally to prevent null access race conditions
        const video = videoRef.current;
        const canvas = canvasRef.current;

        if (!canvas || !video) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const w = video.videoWidth;
        const h = video.videoHeight;
        
        // Ensure dimensions are valid
        if (w === 0 || h === 0) return;

        canvas.width = w;
        canvas.height = h;

        ctx.clearRect(0, 0, w, h);

        if (!state) return;

        // --- A. Draw Zones (Ceiling & Floor) ---
        // Ceiling (Yellow)
        const ceilingH = h * state.ceilingRatio;
        ctx.fillStyle = "rgba(255, 200, 0, 0.15)";
        ctx.fillRect(0, 0, w, ceilingH);
        
        // Ceiling Border
        ctx.strokeStyle = "rgba(255, 200, 0, 0.5)";
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, ceilingH); ctx.lineTo(w, ceilingH); ctx.stroke();

        // Floor (Blue)
        const groundH = h * state.groundRatio;
        const floorY = h - groundH;
        ctx.fillStyle = "rgba(0, 200, 255, 0.15)";
        ctx.fillRect(0, floorY, w, groundH);

        // Floor Border
        ctx.strokeStyle = "rgba(0, 200, 255, 0.5)";
        ctx.beginPath(); ctx.moveTo(0, floorY); ctx.lineTo(w, floorY); ctx.stroke();

        // --- B. Draw Leveler (Roll) ---
        // Draw a line in center that rotates with phone roll
        const cx = w / 2;
        const cy = h / 2;
        const levelWidth = w * 0.4;
        
        ctx.save();
        ctx.translate(cx, cy);
        // If phone rotates left (gamma negative), we want line to tilt opposite to show "horizon"
        // But usually leveler shows *phone* tilt. Let's show a "horizon line" which stays flat relative to world
        // If phone tilts right (positive roll), horizon appears to tilt left.
        ctx.rotate((-state.roll * Math.PI) / 180); 
        
        ctx.strokeStyle = Math.abs(state.roll) < 5 ? "#22c55e" : "#ef4444"; // Green if level, red if not
        ctx.lineWidth = 3;
        ctx.shadowColor = "black";
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.moveTo(-levelWidth / 2, 0);
        ctx.lineTo(levelWidth / 2, 0);
        ctx.stroke();

        // Center dot
        ctx.fillStyle = Math.abs(state.roll) < 5 ? "#22c55e" : "#ef4444";
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        // --- C. Body Center Line ---
        if (state.headVisible || state.footVisible) {
            const bodyY = state.bodyCenterY * h;
            ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(0, bodyY);
            ctx.lineTo(w, bodyY);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    };

    const cleanup = () => {
        if (cameraRef.current) cameraRef.current.stop();
        if (poseRef.current) poseRef.current.close();
        countdownCtrl.current.stop();
        window.speechSynthesis.cancel();
    };

    const startRecording = () => {
        if (!videoRef.current || !videoRef.current.srcObject) return;
        
        const stream = videoRef.current.srcObject as MediaStream;
        const recorder = new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;
        chunksRef.current = [];

        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        recorder.onstop = async () => {
            const blob = new Blob(chunksRef.current, { type: 'video/webm' });
            const file = new File([blob], `Dance_${new Date().toISOString()}.webm`, { type: 'video/webm' });
            try {
                await saveVideo(file);
                onCaptureComplete();
                onClose();
            } catch (e) {
                alert("保存失败");
            }
        };

        recorder.start();
        setIsRecording(true);
        setRecordingTime(0);
        speak("开始录制");
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
            speak("录制完成");
        }
        setIsRecording(false);
    };

    useEffect(() => {
        let interval: any;
        if (isRecording) {
            interval = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isRecording]);

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col">
            {/* Top Bar */}
            <div className="absolute top-0 left-0 right-0 p-4 pt- safe-top z-20 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent">
                <button onClick={onClose} className="p-2 bg-black/40 backdrop-blur-md rounded-full text-white"><X /></button>
                <div className="bg-black/50 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 flex items-center gap-2">
                     <div className={`w-2 h-2 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></div>
                     <span className="text-xs font-bold text-white">
                        {isRecording ? formatTime(recordingTime) : '智能构图'}
                     </span>
                </div>
                <button onClick={() => setFacingMode(prev => prev === 'user' ? 'environment' : 'user')} className="p-2 bg-black/40 backdrop-blur-md rounded-full text-white"><RefreshCw size={20} /></button>
            </div>

            {/* Viewfinder */}
            <div className="flex-1 relative bg-gray-900 flex items-center justify-center overflow-hidden">
                {!window.Pose && (
                    <div className="absolute inset-0 flex items-center justify-center text-white z-50 bg-black">
                        <Loader2 className="animate-spin mr-2" /> 正在加载 CV 模型...
                    </div>
                )}

                <video 
                    ref={videoRef} 
                    playsInline 
                    muted 
                    className="w-full h-full object-cover"
                    style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }} 
                />
                <canvas 
                    ref={canvasRef}
                    className="absolute inset-0 w-full h-full pointer-events-none"
                    style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }} 
                />

                {/* Debug Stats Overlay (Bottom Left) */}
                {debugStats && !isRecording && (
                    <div className="absolute bottom-32 left-4 text-[10px] text-white/70 font-mono bg-black/40 p-2 rounded pointer-events-none">
                        <div>Ceiling: {(debugStats.ceilingRatio * 100).toFixed(0)}%</div>
                        <div>Floor: {(debugStats.groundRatio * 100).toFixed(0)}%</div>
                        <div>Roll: {debugStats.roll.toFixed(1)}°</div>
                        <div>Pitch: {debugStats.pitch.toFixed(1)}°</div>
                    </div>
                )}

                {/* Countdown Overlay */}
                {countdown > 0 && (
                    <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none">
                        <div className="text-[120px] font-black text-white drop-shadow-2xl animate-bounce">
                            {countdown}
                        </div>
                    </div>
                )}

                {/* Guidance Text */}
                {!isRecording && countdown === 0 && (
                    <div className="absolute bottom-40 left-0 right-0 flex flex-col items-center pointer-events-none transition-all duration-300">
                        <div className={`
                            px-6 py-3 rounded-2xl backdrop-blur-md border shadow-lg flex items-center gap-2 mb-2
                            ${guidanceType === 'stable' ? 'bg-green-500/90 border-green-400 text-white' : 
                              guidanceType === 'noPerson' ? 'bg-black/60 border-white/20 text-white' : 
                              'bg-yellow-500/90 border-yellow-400 text-white'}
                        `}>
                            <span className="text-sm font-bold">{guidanceText}</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Controls */}
            <div className="h-28 bg-black/90 flex items-center justify-around pb-6 px-8 relative">
                <button 
                    onClick={() => setIsMuted(!isMuted)}
                    className="p-3 bg-gray-800 rounded-full text-white hover:bg-gray-700 transition-colors"
                >
                    {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                </button>

                {isRecording ? (
                     <button 
                        onClick={stopRecording}
                        className="w-16 h-16 rounded-full border-4 border-white flex items-center justify-center relative group"
                    >
                         <div className="w-6 h-6 bg-red-500 rounded-sm group-hover:scale-110 transition-transform"></div>
                    </button>
                ) : (
                    <button 
                        onClick={() => startRecording()} // Manual trigger
                        className={`w-16 h-16 rounded-full border-4 flex items-center justify-center transition-all relative ${guidanceType === 'stable' ? 'border-green-400 scale-110' : 'border-white'}`}
                    >
                        <div className={`w-14 h-14 rounded-full transition-colors ${guidanceType === 'stable' ? 'bg-green-500' : 'bg-red-600'}`}></div>
                    </button>
                )}

                 {/* Simulated Feedback / Calibration Button */}
                 <button className="p-3 bg-gray-800 rounded-full text-white hover:bg-gray-700 transition-colors">
                    <Settings2 size={20} />
                 </button>
            </div>
        </div>
    );
};

export default SmartCamera;
