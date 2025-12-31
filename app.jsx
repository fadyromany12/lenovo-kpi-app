import React, { useState, useEffect, useMemo, createContext, useContext, useCallback, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged, 
  signInWithCustomToken
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  onSnapshot, 
  query, 
  where, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  serverTimestamp,
  getDocs,
  writeBatch,
  limit,       // NEW: For chat limits
  orderBy      // NEW: For chat sorting
} from 'firebase/firestore';

import { 
  Trophy, Users, Settings, UserPlus, LogOut, CheckCircle, XCircle, Plus, 
  Save, Medal, Activity, Search, Crown, AlertTriangle, Loader, 
  ArrowUpRight, Eye, Edit3, Shield, LayoutGrid, Mail, Upload, FileSpreadsheet, 
  TrendingUp, TrendingDown, Target, Lock, ChevronRight, BarChart3, Calculator,
  Info, Zap, Sparkles, Download, Trash2, UserMinus, Trash, Edit2, BookOpen, 
  Heart, MessageSquare, Send, X // NEW: Added icons for Chat
} from 'lucide-react';

// --- STYLES & ANIMATIONS ---
const GlobalStyles = () => (
  <style>{`
    /* UPDATED LAYOUT STYLES - PHASE 1 FIXES */
    html, body {
      width: 100%;
      min-height: 100vh;
      margin: 0;
      padding: 0;
      background-color: #050505;
      overflow-x: hidden; /* Prevent horizontal scroll on body */
      scroll-behavior: smooth;
    }
    #root {
      min-height: 100vh;
      width: 100%; /* FIX: Forces the app to fill the screen width */
      display: flex;
      flex-direction: column;
    }

    @keyframes float { 0% { transform: translateY(0px); } 50% { transform: translateY(-10px); } 100% { transform: translateY(0px); } }
    @keyframes pulse-glow { 0% { box-shadow: 0 0 5px #E2231A; } 50% { box-shadow: 0 0 20px #E2231A, 0 0 10px #E2231A; } 100% { box-shadow: 0 0 5px #E2231A; } }
    @keyframes slide-up { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
    
    .animate-float { animation: float 6s ease-in-out infinite; }
    .animate-slide-up { animation: slide-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; opacity: 0; }
    .animate-fade-in { animation: fade-in 0.5s ease-out forwards; }
    
    /* Improved Glass Effect */
    .glass-panel { background: rgba(24, 24, 27, 0.6); backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.08); }
    .glass-card { 
      background: linear-gradient(145deg, rgba(32,32,35,0.7) 0%, rgba(10,10,12,0.9) 100%); 
      backdrop-filter: blur(20px); 
      border: 1px solid rgba(255,255,255,0.05); 
      box-shadow: 0 4px 30px rgba(0, 0, 0, 0.3);
    }
    
    .hover-glow:hover { box-shadow: 0 0 25px rgba(226,35,26,0.2); border-color: rgba(226,35,26,0.5); }
    
    /* Sleek Scrollbar */
    ::-webkit-scrollbar { width: 8px; height: 8px; }
    ::-webkit-scrollbar-track { background: #09090b; }
    ::-webkit-scrollbar-thumb { background: #27272a; border-radius: 4px; border: 2px solid #09090b; }
    ::-webkit-scrollbar-thumb:hover { background: #E2231A; }


   /* REPLACE existing .kpi-row-split and input styles with this */

/* Modern Grid Layout for Config */
.config-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 12px;
  align-items: start;
}

.kpi-card-styled {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.kpi-card-styled:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(226, 35, 26, 0.3);
  box-shadow: 0 4px 20px rgba(0,0,0,0.2);
}

.kpi-input-group label {
  display: block;
  font-size: 10px;
  text-transform: uppercase;
  font-weight: 800;
  color: #71717a; /* zinc-500 */
  margin-bottom: 6px;
  letter-spacing: 0.05em;
}

.kpi-input-styled, .kpi-select-styled {
  width: 100%;
  background: #09090b;
  border: 1px solid #27272a;
  color: white;
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 13px;
  outline: none;
  transition: all 0.2s;
}

.kpi-input-styled:focus, .kpi-select-styled:focus {
  border-color: #E2231A;
  box-shadow: 0 0 0 1px #E2231A;
}

.btn-icon-danger {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
  padding: 8px;
  border-radius: 6px;
  transition: all 0.2s;
}
.btn-icon-danger:hover { background: #ef4444; color: white; }

/* MOUSE SPOTLIGHT EFFECT */
    .mouse-spotlight {
      pointer-events: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 1; /* Behind content but above background */
      background: radial-gradient(600px circle at var(--x) var(--y), rgba(226, 35, 26, 0.15), transparent 40%);
      transition: opacity 0.3s;
    }

    @media (hover: none) {
      .mouse-spotlight { display: none; }
    }
  `}</style>
);

// --- CONFIGURATION ---
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "lenovo-kpi-app.firebaseapp.com",
  projectId: "lenovo-kpi-app",
  storageBucket: "lenovo-kpi-app.firebasestorage.app",
  messagingSenderId: "195262557870",
  appId: "1:195262557870:web:10424e6d20e124eb1dc73f",
  measurementId: "G-DXX4K24CBG"
};

let app, auth, db;
let configError = null;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (e) {
  console.error("Firebase Init Error:", e);
  configError = e.message;
}

const appId = typeof __app_id !== 'undefined' ? __app_id : 'lenovo-kpi-v5';
const ADMIN_SECRET = "lenovo2025"; 

// --- DEFAULT DATA ---
const DEFAULT_KPIS = [
  // --- CORE KPIS (75%) ---
  { 
    id: 'rev', 
    name: 'Revenue Target', 
    category: 'Core KPIs',
    weight: 50, 
    target: 10000, 
    type: 'value', 
    direction: 'higher', 
    note: 'Client Shared Target' 
  },
  { 
    id: 'cust_acc', 
    name: 'Customer Acceptance', 
    category: 'Core KPIs',
    weight: 15, 
    target: 15, 
    type: 'percent', 
    direction: 'higher', 
    note: 'Conversion Rate' 
  },
  { 
    id: 'qual', 
    name: 'Quality Audit', 
    category: 'Core KPIs',
    weight: 10, 
    target: 8, 
    type: 'count', 
    direction: 'higher', 
    note: '8 contacts/month' 
  },
  
  // --- ADHERENCE & ATTENDANCE (25%) ---
  { 
    id: 'att_absent', 
    name: 'Attendance (Absenteeism)', 
    category: 'Adherence & Attendance',
    weight: 15, 
    type: 'step', // UPDATED: Step-based logic
    unit: '%',
    note: '1 Day (4.55%) = 100%, 2 Days (9.09%) = 50%',
    steps: [
      { limit: 4.55, score: 100, label: '0-1 Days (100%)' }, // 0 to 4.55% Absenteeism = Full Score
      { limit: 9.09, score: 50,  label: '2 Days (50%)' },    // 4.56% to 9.09% Absenteeism = Half Score
      { limit: 9999, score: 0,   label: '3+ Days (0%)' }     // > 9.09% = Zero Score
    ]
  },
  { 
    id: 'adh_login', 
    name: 'Login/Out Adherence', 
    category: 'Adherence & Attendance',
    weight: 5, 
    target: 3, 
    type: 'count', 
    direction: 'lower', 
    note: 'Gate: >3 = 0%',
    gates: [
      { threshold: 3, multiplier: 1.0, label: 'Pass' },
      { threshold: 1000, multiplier: 0.0, label: 'Fail' }
    ]
  },
  { 
    id: 'adh_aux', 
    name: 'Exceed AUX', 
    category: 'Adherence & Attendance',
    weight: 5, 
    target: 3, 
    type: 'count', 
    direction: 'lower', 
    note: 'Gate: >3 = 0%',
    gates: [
      { threshold: 3, multiplier: 1.0, label: 'Pass' },
      { threshold: 1000, multiplier: 0.0, label: 'Fail' }
    ]
  }
];

const DEFAULT_AWARDS = [
  'Client Champion', 'Sales Star', 'Customer Delight', 'Team Spirit', 'Rising Performer'
];

// --- UTILS ---
const cn = (...classes) => classes.filter(Boolean).join(" ");
const parseNameFromEmail = (email) => {
  if (!email) return 'Unknown';
  const clean = email.toLowerCase().trim().split('@')[0];
  const parts = clean.split('.');
  return parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
};

// --- UPDATED CALCULATION ENGINE (With Auto-Sorting) ---
const calculateScore = (actual, target, direction, weight, type = 'value', steps = []) => {
  // 1. Handle Step/Gate Logic (Attendance)
  if (type === 'step' && Array.isArray(steps) && steps.length > 0) {
    const act = parseFloat(actual);
    if (isNaN(act)) return 0;
    
    // CRITICAL FIX: Sort steps by limit (ascending) so we check <= 1 before <= 2
    // We use [...steps] to create a copy and not mutate the original array
    const sortedSteps = [...steps].sort((a, b) => parseFloat(a.limit) - parseFloat(b.limit));

    // Iterate through sorted steps
    for (const step of sortedSteps) {
      if (act <= parseFloat(step.limit)) {
        return (parseFloat(step.score) / 100) * weight;
      }
    }
    // If actual value is higher than all steps (e.g., 5 days absent), return 0
    return 0; 
  }

  // 2. Handle Binary (Pass/Fail)
  if (type === 'binary') {
    const isPass = actual === true || actual === 'true' || actual === 'pass' || actual === 1;
    return isPass ? parseFloat(weight) : 0;
  }

  // 3. Handle Linear Numeric (Revenue, Quality)
  const act = parseFloat(actual);
  if (isNaN(act)) return 0;
  
  const tgt = parseFloat(target) || 1;
  let scorePct = 0;

  if (direction === 'higher') {
    scorePct = (act / tgt) * 100;
  } else { 
    // Lower is better logic (standard linear)
    if (act === 0) scorePct = 120; 
    else scorePct = (tgt / act) * 100; 
  }

  // Cap at 150% performance per KPI
  return (Math.min(scorePct, 150) / 100) * weight;
};

// 2. New Helper: Calculate Total with Global Gateways
const calculateFinalScore = (kpis, actuals, gateways = []) => {
  let totalScore = 0;
  
  // Step A: Sum individual KPIs
  kpis.forEach(k => {
    totalScore += calculateScore(actuals?.[k.id], k.target, k.direction, k.weight, k.type);
  });

  // Step B: Apply Global Gateways
  // Example Actuals for gateways: { "gateway_attendance": "fail" }
  gateways.forEach(g => {
    const gateVal = actuals?.[g.id];
    // If the gateway is triggered (e.g., Value is 'fail')
    if (gateVal === 'fail' || gateVal === false || gateVal === 'false') {
      if (g.penalty === 'zero') {
        totalScore = 0; // The "Kill Switch"
      } else if (g.penalty === 'deduct') {
        totalScore -= parseFloat(g.weight || 0); // Flat point deduction
      }
    }
  });

  return Math.max(0, totalScore); // Never go below 0
};

// --- GAMIFICATION UTILS (MOVED OUTSIDE) ---
const getAgentLevel = (xp) => Math.floor((xp || 0) / 1000) + 1;

const getAgentRank = (level) => {
  if (level >= 20) return { name: 'Diamond', color: 'text-cyan-400', border: 'border-cyan-500/50', bg: 'bg-cyan-950/30' };
  if (level >= 10) return { name: 'Gold', color: 'text-yellow-400', border: 'border-yellow-500/50', bg: 'bg-yellow-950/30' };
  if (level >= 5) return { name: 'Silver', color: 'text-zinc-300', border: 'border-zinc-500/50', bg: 'bg-zinc-800/50' };
  return { name: 'Bronze', color: 'text-amber-700', border: 'border-amber-700/50', bg: 'bg-orange-950/30' };
};



// --- CONTEXTS ---
const AuthContext = createContext(null);
const DataContext = createContext(null);
const ToastContext = createContext(null);
// --- CHAT CONTEXT ---
const ChatContext = createContext(null);

const ChatProvider = ({ children }) => {
  const { user, profile } = useContext(AuthContext);
  const { activeTeamId, members } = useContext(DataContext);
  const [messages, setMessages] = useState([]);
  const [activeChannel, setActiveChannel] = useState(null); // { type: 'team', id: 'teamId', name: '...' }
  const [isOpen, setIsOpen] = useState(false);

  // Sound Effect
  const playNotification = () => {
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    audio.volume = 0.5;
    audio.play().catch(e => console.log("Audio play failed interaction required"));
  };

  // 1. Auto-Join Team Channel
  useEffect(() => {
    if (activeTeamId && !activeChannel) {
      setActiveChannel({ type: 'team', id: activeTeamId, name: 'Team Comms' });
    }
  }, [activeTeamId]);

  // 2. Real-Time Listener
  useEffect(() => {
    if (!user || !activeChannel) return;

    setMessages([]); 
    
    const collectionRef = collection(db, 'artifacts', appId, 'public', 'data', 'messages');
    let q;

    if (activeChannel.type === 'team') {
      q = query(
        collectionRef, 
        where('type', '==', 'team'),
        where('teamId', '==', activeChannel.id),
        orderBy('createdAt', 'asc'),
        limit(100)
      );
    } else {
      // Phase 1 Simple DM Query
      q = query(
        collectionRef,
        where('type', '==', 'dm'),
        orderBy('createdAt', 'asc'),
        limit(200) 
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allMsgs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      
      // Filter Logic
      const filtered = activeChannel.type === 'team' ? allMsgs : allMsgs.filter(m => 
        (m.senderId === user.uid && m.receiverId === activeChannel.id) || 
        (m.senderId === activeChannel.id && m.receiverId === user.uid)
      );

      // Sound Logic
      const lastMsg = filtered[filtered.length - 1];
      if (lastMsg && lastMsg.senderId !== user.uid) {
         const isNew = Date.now() - (lastMsg.createdAt?.toMillis() || 0) < 5000;
         if (isNew) playNotification();
      }

      setMessages(filtered);
    });

    return () => unsubscribe();
  }, [activeChannel, user]);

  const sendMessage = async (text) => {
    if (!text.trim() || !activeChannel) return;
    
    const payload = {
      type: activeChannel.type,
      senderId: user.uid,
      senderName: profile.name,
      senderRole: profile.role,
      content: text,
      createdAt: serverTimestamp(),
      readBy: [user.uid]
    };

    if (activeChannel.type === 'team') {
      payload.teamId = activeChannel.id;
      payload.receiverId = null;
    } else {
      payload.teamId = null;
      payload.receiverId = activeChannel.id;
    }

    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'messages'), payload);
  };

  return (
    <ChatContext.Provider value={{ messages, activeChannel, setActiveChannel, isOpen, setIsOpen, sendMessage }}>
      {children}
    </ChatContext.Provider>
  );
};


const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const showToast = useCallback((msg, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);
  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className={cn(
            "pointer-events-auto px-5 py-3 rounded-lg shadow-2xl text-sm font-bold flex items-center gap-3 animate-slide-up backdrop-blur-md border",
            t.type === 'error' 
              ? "bg-red-950/80 text-red-200 border-red-800" 
              : "bg-zinc-900/90 text-white border-zinc-700"
          )}>
            {t.type === 'error' ? <AlertTriangle size={18}/> : <CheckCircle size={18} className="text-green-500"/>}
            {t.msg}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const { showToast } = useContext(ToastContext);

  // Safety Timeout
  useEffect(() => {
    const timer = setTimeout(() => {
      if (loading) {
        console.warn("System hung. Forcing load...");
        setLoading(false);
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [loading]);

  useEffect(() => {
    if (configError) return;
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth Init Failed:", err);
        setLoading(false);
      }
    };
    initAuth();
    return onAuthStateChanged(auth, (u) => { setUser(u); if (!u) setLoading(false); });
  }, []);

  useEffect(() => {
    if (!user) return;
    const storedEmail = localStorage.getItem('lenovo_user_email');
    if (!storedEmail && !profile) { setLoading(false); return; }
    
    // FIX: Force lowercase here to prevent mismatch
    const emailToQuery = (storedEmail || profile?.email || '').toLowerCase(); 
    
    if (!emailToQuery) { setLoading(false); return; }

    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'users'), where('email', '==', emailToQuery));
    
    const unsubscribe = onSnapshot(q, 
      (snap) => {
        if (!snap.empty) {
          const docData = snap.docs[0];
          setProfile({ id: docData.id, ...docData.data() });
          localStorage.setItem('lenovo_user_email', emailToQuery);
        } else {
          localStorage.removeItem('lenovo_user_email');
          setProfile(null);
        }
        setLoading(false);
      },
      (err) => {
        console.error("DB Error:", err);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [user]);

  const login = async (inputEmail, role, secret) => {
    setLoading(true);
    
    // FIX: Force lowercase and trim spaces immediately upon input
    const email = inputEmail.toLowerCase().trim();

    if (role === 'super_user' && secret !== ADMIN_SECRET) {
      showToast("Access Denied: Invalid Secret", "error");
      setLoading(false); return;
    }

    try {
      const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'users'), where('email', '==', email));
      const snap = await getDocs(q);
      
      let finalProfile = null;

      if (!snap.empty) {
        // User exists: fetch their data
        const docSnap = snap.docs[0];
        const existing = docSnap.data();
        finalProfile = { id: docSnap.id, ...existing };

        if (role === 'super_user' && existing.role !== 'super_user') {
           await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', docSnap.id), { role: 'super_user' });
           finalProfile.role = 'super_user';
        }
      } else {
        // --- NEW USER REGISTRATION ---
        const name = parseNameFromEmail(email);
        
        // Ensure new users requesting Manager start as Agents until approved
        let initialRole = role;
        if (role === 'manager') {
           initialRole = 'agent'; 
        }

        const newRef = doc(collection(db, 'artifacts', appId, 'public', 'data', 'users'));
        const newData = { name, email, role: initialRole, joinedAt: serverTimestamp(), groupId: null };
        await setDoc(newRef, newData);
        
        if (role === 'manager') {
           await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'manager_requests'), {
             userId: newRef.id, name, email, status: 'pending', requestedAt: serverTimestamp()
           });
           showToast("Account created. Manager access pending approval.");
        } else {
           showToast(`Welcome, ${name}`);
        }

        finalProfile = { id: newRef.id, ...newData };
      }

      localStorage.setItem('lenovo_user_email', email);
      setProfile(finalProfile);
      setLoading(false); 

    } catch (err) {
      console.error("Login Error:", err);
      showToast("Login Failed", "error");
      setLoading(false);
    }
  };

  const logout = () => { localStorage.removeItem('lenovo_user_email'); setProfile(null); setLoading(false); };
  return ( <AuthContext.Provider value={{ user, profile, loading, login, logout }}>{children}</AuthContext.Provider> );
};

// --- APP ---//

export default function App() {
  if (configError) return <ErrorScreen error={configError} />;
  
  return (
    <ToastProvider>
      <AuthProvider>
        <GlobalStyles />
        <MainLayout />
      </AuthProvider>
    </ToastProvider>
  );
}

const ChatInterface = () => {
  const { messages, activeChannel, sendMessage, isOpen, setIsOpen, setActiveChannel } = useContext(ChatContext);
  const { members, activeTeamId } = useContext(DataContext);
  const { user } = useContext(AuthContext);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-[#E2231A] rounded-full flex items-center justify-center text-white shadow-[0_0_30px_rgba(226,35,26,0.6)] z-[100] hover:scale-110 transition-transform animate-slide-up"
      >
        <MessageSquare size={24} />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-[350px] h-[500px] glass-card rounded-2xl flex flex-col shadow-2xl z-[100] overflow-hidden border border-white/10 animate-slide-up bg-[#09090b]">
      {/* Header */}
      <div className="p-4 bg-[#E2231A] flex justify-between items-center shrink-0">
        <div className="flex items-center gap-2 overflow-hidden">
          {activeChannel?.type === 'team' ? <Users size={16} className="shrink-0"/> : <UserPlus size={16} className="shrink-0"/>}
          <span className="font-bold text-white uppercase text-xs tracking-wider truncate">
            {activeChannel?.name || 'Comms'}
          </span>
        </div>
        <div className="flex gap-2 shrink-0">
           {/* Dropdown for Switching */}
           <div className="relative group">
              <button className="p-1 hover:bg-white/20 rounded"><Users size={14} className="text-white"/></button>
              <div className="absolute right-0 top-full mt-2 w-48 bg-black border border-white/20 rounded-lg p-2 hidden group-hover:block max-h-40 overflow-y-auto shadow-xl z-50">
                <div 
                   className="p-2 hover:bg-white/10 text-xs text-white cursor-pointer font-bold border-b border-white/10 mb-1"
                   onClick={() => setActiveChannel({ type: 'team', id: activeTeamId, name: 'Team General' })}
                >
                  Team Channel
                </div>
                {members.filter(m => m.id !== user.uid).map(m => (
                  <div 
                    key={m.id} 
                    className="p-2 hover:bg-white/10 text-xs text-zinc-400 hover:text-white cursor-pointer truncate"
                    onClick={() => setActiveChannel({ type: 'dm', id: m.id, name: m.name })}
                  >
                    {m.name}
                  </div>
                ))}
              </div>
           </div>
           <button onClick={() => setIsOpen(false)}><X size={16} className="text-white/80 hover:text-white"/></button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-black/40 backdrop-blur-md scrollbar-thin scrollbar-thumb-zinc-700">
        {messages.map((msg) => {
          const isMe = msg.senderId === user.uid;
          return (
            <div key={msg.id} className={cn("flex flex-col max-w-[85%]", isMe ? "ml-auto items-end" : "items-start")}>
              <div className="flex items-center gap-2 mb-1">
                 {!isMe && <span className="text-[9px] text-zinc-500 font-bold uppercase">{msg.senderName}</span>}
                 {!isMe && msg.senderRole === 'manager' && <span className="bg-purple-900/80 text-purple-200 text-[8px] px-1 rounded border border-purple-500/30">MGR</span>}
              </div>
              <div className={cn(
                "px-3 py-2 rounded-xl text-xs leading-relaxed break-words",
                isMe ? "bg-[#E2231A] text-white rounded-tr-none" : "bg-zinc-800 text-zinc-200 rounded-tl-none border border-white/5"
              )}>
                {msg.content}
              </div>
              <span className="text-[8px] text-zinc-600 mt-1">
                {msg.createdAt?.seconds ? new Date(msg.createdAt.seconds * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '...'}
              </span>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 bg-zinc-900 border-t border-white/10 flex gap-2 shrink-0">
        <input 
          className="flex-1 bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-[#E2231A] outline-none"
          placeholder="Transmit message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (sendMessage(input), setInput(''))}
        />
        <button 
          onClick={() => { sendMessage(input); setInput(''); }}
          className="bg-[#E2231A] hover:bg-red-600 text-white p-2 rounded-lg transition-colors"
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
};

const MainLayout = () => {
  const { profile, loading } = useContext(AuthContext);
  const [view, setView] = useState('lobby');

  // Mouse Tracking Logic
  useEffect(() => {
    const handleMouseMove = (e) => {
      const x = e.clientX;
      const y = e.clientY;
      document.documentElement.style.setProperty('--x', `${x}px`);
      document.documentElement.style.setProperty('--y', `${y}px`);
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  useEffect(() => {
    if (profile) {
      if (profile.role === 'super_user') setView('admin_dash');
      else if (profile.groupId) setView('team_dash');
      else setView('lobby');
    }
  }, [profile]);

  if (loading) return <LoadingScreen />;
  if (!profile) return <LoginScreen />;

  return (
    <DataContextWrapper view={view} setView={setView}>
      <ChatProvider>
        <div className="min-h-screen bg-[#050505] text-zinc-100 font-sans selection:bg-[#E2231A] selection:text-white w-full h-full relative">
          
          <div className="mouse-spotlight"></div>

          <div className="fixed inset-0 pointer-events-none z-0">
             <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-[#E2231A] rounded-full blur-[180px] opacity-[0.06] animate-pulse"></div>
             <div className="absolute bottom-[-20%] left-[-10%] w-[900px] h-[900px] bg-blue-900 rounded-full blur-[200px] opacity-[0.04]"></div>
             <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay"></div>
          </div>

          <Navbar view={view} setView={setView} />
          <main className="w-full max-w-[1600px] mx-auto px-4 md:px-12 py-8 relative z-10 animate-fade-in flex flex-col gap-6 flex-1">
            {view === 'admin_dash' && <AdminDashboard />}
            {view === 'lobby' && <LobbyView setView={setView} />}
            {view === 'create_team' && <CreateTeamView setView={setView} />}
            {view === 'team_dash' && <TeamDashboard />}
            {view === 'learning_hub' && <LearningHub />}
            {view === 'user_mgmt' && <UserManagement />}
          </main>

          <ChatInterface />
          
        </div>
      </ChatProvider>
    </DataContextWrapper>
  );
};

const DataContextWrapper = ({ children, view, setView }) => {
  const { profile } = useContext(AuthContext);
  const [activeTeamId, setActiveTeamId] = useState(null);
  const [rawTeams, setRawTeams] = useState([]);
  const [allUsers, setAllUsers] = useState([]); // Store all users for counts
  const [members, setMembers] = useState([]);
  const [performance, setPerformance] = useState({});
  
  // 1. Fetch Teams
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'groups'), (snap) => {
      setRawTeams(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  // 2. Fetch ALL Users (for Lobby Counts)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'users'), (snap) => {
      setAllUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  // 3. Calculate Team Member Counts dynamically
  const teams = useMemo(() => {
    return rawTeams.map(team => ({
      ...team,
      memberCount: allUsers.filter(u => u.groupId === team.id).length
    }));
  }, [rawTeams, allUsers]);

  // 4. Handle Active Team Logic
  useEffect(() => {
    if (profile?.groupId && view === 'team_dash') setActiveTeamId(profile.groupId);
    else if (view.startsWith('team_view_')) setActiveTeamId(view.replace('team_view_', ''));
    else setActiveTeamId(null);
  }, [profile, view]);

  // 5. Filter Members for Active Team View
  useEffect(() => {
    if (!activeTeamId) { setMembers([]); setPerformance({}); return; }
    
    // Filter from the already loaded allUsers
    setMembers(allUsers.filter(u => u.groupId === activeTeamId));

    // Keep Performance real-time
    const unsubPerf = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'groups', activeTeamId, 'performance'), (snap) => {
      const p = {}; snap.docs.forEach(d => p[d.id] = d.data()); setPerformance(p);
    });
    return () => { unsubPerf(); };
  }, [activeTeamId, allUsers]);

  return ( <DataContext.Provider value={{ teams, activeTeamId, members, performance, view, setView }}>{children}</DataContext.Provider> );
};

// --- SCREENS ---

const ErrorScreen = ({ error }) => (
  <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-8 text-center">
    <AlertTriangle size={64} className="text-[#E2231A] mb-4 animate-bounce" />
    <h1 className="text-3xl font-bold text-white mb-2">System Configuration Error</h1>
    <p className="text-zinc-500 max-w-md mb-8">{error}</p>
    <div className="bg-zinc-900 p-4 rounded text-left font-mono text-xs text-zinc-400 border border-zinc-800 w-full max-w-lg overflow-auto">
      <p>// Update firebaseConfig in source code:</p>
      <p className="text-green-500">const firebaseConfig = &#123; apiKey: "...", ... &#125;;</p>
    </div>
  </div>
);

const LoadingScreen = () => (
  <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center gap-6 relative overflow-hidden">
     <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(226,35,26,0.1)_0%,transparent_70%)] animate-pulse"></div>
     <div className="relative z-10 flex flex-col items-center">
       <Loader className="animate-spin text-[#E2231A]" size={48} />
       <div className="mt-4 text-sm uppercase tracking-[0.3em] text-white font-bold animate-pulse">Initializing Pulse</div>
       <div className="mt-2 text-[10px] text-zinc-600">Secure Handshake in progress...</div>
     </div>
  </div>
);

const LoginScreen = () => {
  const { login } = useContext(AuthContext);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('agent');
  const [secret, setSecret] = useState('');
  const [isHovering, setIsHovering] = useState(false);

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 relative overflow-hidden w-full h-full">
      {/* Dynamic Background */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
         <div className="absolute top-[-20%] left-[-10%] w-[1000px] h-[1000px] bg-gradient-to-br from-[#E2231A]/20 to-transparent rounded-full blur-[100px] animate-float opacity-30"></div>
         <div className="absolute bottom-[-20%] right-[-10%] w-[800px] h-[800px] bg-gradient-to-tl from-blue-900/20 to-transparent rounded-full blur-[100px] animate-float opacity-30" style={{ animationDelay: '2s' }}></div>
      </div>

      <div 
        className="w-full max-w-md glass-card p-10 rounded-2xl shadow-2xl relative z-10 animate-slide-up transition-all duration-500 hover:shadow-[0_0_50px_rgba(226,35,26,0.15)]"
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        <div className="text-center mb-10 relative">
          <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-24 h-24 bg-[#E2231A]/20 blur-[40px] rounded-full"></div>
          <h1 className="text-5xl font-black text-white mb-2 tracking-tighter uppercase relative z-10">
            Lenovo <span className="text-[#E2231A]">Pulse</span>
          </h1>
          <p className="text-zinc-500 text-xs tracking-[0.2em] uppercase font-bold">Performance Intelligence</p>
        </div>

        <div className="space-y-6">
          <div className="group">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1 mb-1 block group-focus-within:text-[#E2231A] transition-colors">Corporate Email</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-white transition-colors" size={18}/>
              <input 
                value={email} onChange={e=>setEmail(e.target.value)} 
                placeholder="firstname.lastname@Konecta.com"
                className="w-full bg-black/40 border border-white/10 rounded-lg py-3 pl-12 text-sm text-white focus:border-[#E2231A] focus:bg-black/60 outline-none transition-all"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-3">
            {['agent', 'manager', 'super_user'].map(r => (
              <button 
                key={r}
                onClick={() => setRole(r)}
                className={cn(
                  "p-3 rounded-lg border text-[10px] font-bold uppercase transition-all duration-300 flex flex-col items-center gap-1",
                  role === r 
                    ? "bg-[#E2231A] border-[#E2231A] text-white shadow-[0_0_15px_rgba(226,35,26,0.4)] scale-105" 
                    : "bg-transparent border-white/10 text-zinc-500 hover:bg-white/5 hover:text-white hover:border-white/30"
                )}
              >
                {r === 'agent' && <Users size={16}/>}
                {r === 'manager' && <Activity size={16}/>}
                {r === 'super_user' && <Shield size={16}/>}
                {r.replace('_', ' ')}
              </button>
            ))}
          </div>

          {role === 'super_user' && (
            <div className="animate-fade-in">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1 mb-1 block">Security Clearance</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[#E2231A]" size={18}/>
                <input 
                  type="password"
                  value={secret} onChange={e=>setSecret(e.target.value)} 
                  placeholder="Enter Secret Code"
                  className="w-full bg-black/40 border border-[#E2231A]/30 rounded-lg py-3 pl-12 text-sm text-white focus:border-[#E2231A] focus:shadow-[0_0_15px_rgba(226,35,26,0.2)] outline-none transition-all"
                />
              </div>
            </div>
          )}

          <button 
            onClick={() => login(email, role, secret)} 
            disabled={!email.includes('@')}
            className={cn(
              "w-full py-4 rounded-lg font-black uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2 group relative overflow-hidden",
              !email.includes('@') 
                ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                : "bg-white text-black hover:bg-[#E2231A] hover:text-white shadow-lg hover:shadow-[0_0_25px_rgba(226,35,26,0.5)]"
            )}
          >
            <span className="relative z-10 flex items-center gap-2">Initialize System <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform"/></span>
          </button>
        </div>
      </div>
    </div>
  );
};

// --- DASHBOARDS ---

const AdminDashboard = () => {
  const [requests, setRequests] = useState([]);
  const { showToast } = useContext(ToastContext);

  useEffect(() => {
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'manager_requests'), where('status', '==', 'pending'));
    return onSnapshot(q, (snap) => setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, []);

  const handleReq = async (req, approve) => {
    if (approve) {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', req.userId), { role: 'manager' });
      showToast(`${req.name} promoted to Manager`);
    } else {
      showToast(`Request rejected`, 'error');
    }
    await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'manager_requests', req.id));
  };

  return (
    <div className="space-y-8 animate-slide-up">
      <div className="flex justify-between items-center">
        <h2 className="text-4xl font-black text-white uppercase tracking-tighter drop-shadow-lg">Super User <span className="text-[#E2231A]">Command</span></h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card title="Pending Approvals" icon={Shield} className="h-full">
           {requests.length === 0 ? <p className="text-zinc-500 italic flex items-center gap-2"><CheckCircle size={16}/> All systems nominal. No pending requests.</p> : (
             <div className="space-y-3">
               {requests.map(r => (
                 <div key={r.id} className="bg-white/5 p-4 rounded-lg flex justify-between items-center border border-white/5 hover:border-[#E2231A]/30 transition-all">
                    <div>
                      <div className="font-bold text-white text-lg">{r.name}</div>
                      <div className="text-xs text-zinc-500 uppercase tracking-wider">{r.email}</div>
                    </div>
                    <div className="flex gap-3">
                      <Button size="sm" variant="success" onClick={()=>handleReq(r, true)}>Grant Access</Button>
                      <Button size="sm" variant="danger" onClick={()=>handleReq(r, false)}>Deny</Button>
                    </div>
                 </div>
               ))}
             </div>
           )}
        </Card>
        
        <LobbyView embed />
      </div>
    </div>
  );
};

const LobbyView = ({ setView, embed = false }) => {
  const { teams } = useContext(DataContext);
  const { profile } = useContext(AuthContext);
  const canCreate = profile?.role === 'manager' || profile?.role === 'super_user';

  return (
    <div className={cn("animate-slide-up", embed ? "" : "space-y-8")}>
      {!embed && (
        <div className="flex justify-between items-end border-b border-white/10 pb-6">
          <div>
            <h2 className="text-4xl font-black uppercase text-white tracking-tighter">Team <span className="text-[#E2231A] animate-pulse">Lobby</span></h2>
            <p className="text-zinc-500 mt-1 flex items-center gap-2"><Users size={14}/> Active Operational Units</p>
          </div>
          {canCreate && !profile?.groupId && (
            <Button onClick={() => setView('create_team')} className="animate-fade-in"><Plus size={16} /> New Team</Button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6">
        {teams.map((team, idx) => (
          <div 
            key={team.id} 
            style={{ animationDelay: `${idx * 100}ms` }}
            onClick={() => {
              if (profile.role === 'super_user') setView(`team_view_${team.id}`);
              else if (profile.groupId === team.id) setView('team_dash');
              else setView(`team_view_${team.id}`);
            }}
            className={cn(
              "glass-card p-6 rounded-2xl h-56 flex flex-col justify-between group cursor-pointer relative overflow-hidden transition-all duration-500 hover:-translate-y-2 animate-slide-up",
              profile?.groupId === team.id ? "border-[#E2231A] shadow-[0_0_30px_rgba(226,35,26,0.15)]" : "hover:border-white/20"
            )}
          >
             <div className="absolute top-0 right-0 p-5 opacity-0 group-hover:opacity-100 transition-all duration-300 text-[#E2231A] translate-x-4 group-hover:translate-x-0">
               <ArrowUpRight size={24} />
             </div>
             <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-[#E2231A] to-transparent opacity-50"></div>
             
             <div>
               <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center mb-4 text-[#E2231A] group-hover:scale-110 transition-transform">
                 <Users size={20} />
               </div>
               <h3 className="text-2xl font-black text-white uppercase tracking-tight truncate group-hover:text-[#E2231A] transition-colors">{team.name}</h3>
               <p className="text-xs text-zinc-500 uppercase tracking-widest mt-2 font-bold">
                 {team.memberCount || 0} Operatives
               </p>
             </div>

             <div className="flex items-center gap-2">
                {profile?.groupId === team.id ? (
                  <span className="text-[10px] font-black bg-[#E2231A] text-white px-3 py-1.5 rounded-full shadow-lg shadow-red-900/40">ASSIGNED UNIT</span>
                ) : (
                  <span className="text-[10px] font-bold text-zinc-500 group-hover:text-white flex items-center gap-1 transition-colors"><Eye size={12}/> OBSERVE ONLY</span>
                )}
             </div>
          </div>
        ))}
        {teams.length === 0 && (
          <div className="col-span-full py-20 text-center border-2 border-dashed border-white/10 rounded-2xl">
            <p className="text-zinc-600 font-bold uppercase tracking-widest">No Active Teams Detected</p>
            {canCreate && <p className="text-zinc-500 text-xs mt-2">Initialize a new team to begin.</p>}
          </div>
        )}
      </div>
    </div>
  );
};

const CreateTeamView = ({ setView }) => {
  const { profile } = useContext(AuthContext);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false); // Added loading state

  const handleCreate = async () => {
    if (!name) return;
    setLoading(true); // Start loading
    try {
      const ref = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'groups'), {
        name, managerId: profile.id, kpis: DEFAULT_KPIS, awards: DEFAULT_AWARDS, createdAt: serverTimestamp()
      });
      
      if (profile.role === 'manager') {
         await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', profile.id), { groupId: ref.id });
      }
      
      // Force a short delay to ensure DB propagation before switching
      setTimeout(() => {
        setLoading(false);
        setView('team_dash');
      }, 1000);

    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center py-20 animate-slide-up">
      <Card title="Establish New Team" className="max-w-md w-full">
        <div className="space-y-6">
          <Input label="Team Identity" value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Alpha Squad" autoFocus />
          <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
             <Button variant="ghost" onClick={()=>setView('lobby')}>Abort</Button>
             <Button onClick={handleCreate} disabled={loading}>
               {loading ? <Loader className="animate-spin" size={16}/> : "Initialize Team"}
             </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

const TrendChart = ({ data, kpis }) => {
  // Always render the Card to maintain layout size
  const hasData = data && data.length > 0;
  
  // Calculate team average per month if data exists
  const chartData = hasData ? data.map(month => {
    const scores = Object.values(month.stats).map(s => s.totalScore);
    const avg = scores.reduce((a, b) => a + b, 0) / (scores.length || 1);
    return { label: month.id, value: avg };
  }).sort((a, b) => a.label.localeCompare(b.label)) : [];

  const maxVal = 150; 

  return (
    <Card 
      title="Historical Velocity" 
      icon={TrendingUp} 
      className="h-full min-h-[300px]" // Added min-height
      action={<InfoTooltip text="Visualizes team performance trends over archived months." />}
    >
      <div className="flex items-end justify-between h-[200px] gap-2 pt-8 pb-2 px-4">
        {hasData ? chartData.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col justify-end items-center group relative animate-slide-up">
             <div className="absolute -top-8 bg-zinc-800 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 border border-white/10">
               {d.label}: {d.value.toFixed(1)}%
             </div>
             <div 
               className="w-full max-w-[40px] bg-gradient-to-t from-[#E2231A]/20 to-[#E2231A] rounded-t-sm transition-all duration-1000 relative overflow-hidden"
               style={{ height: `${(d.value / maxVal) * 100}%` }}
             >
               <div className="absolute top-0 left-0 w-full h-[2px] bg-white/50"></div>
             </div>
             <div className="mt-2 text-[10px] text-zinc-500 font-bold uppercase rotate-0 truncate w-full text-center">{d.label}</div>
          </div>
        )) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600 gap-2 border-2 border-dashed border-white/5 rounded-xl">
            <BarChart3 size={24} className="opacity-20"/>
            <span className="text-xs font-bold uppercase tracking-widest opacity-50">No History Archived</span>
          </div>
        )}
      </div>
    </Card>
  );
};

const InfoTooltip = ({ text }) => (
  <div className="relative group inline-block ml-2 translate-y-0.5 z-40">
    <Info size={14} className="text-zinc-500 hover:text-[#E2231A] cursor-help transition-colors duration-300" />
    {/* PHASE 1 FIX: Increased width (w-64), added z-[100], and improved positioning */}
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-64 bg-[#09090b] border border-white/20 p-3 rounded-xl text-[11px] leading-relaxed text-zinc-300 shadow-2xl opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 pointer-events-none transition-all duration-300 z-[100]">
      {text}
      <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-[#09090b] border-r border-b border-white/20 rotate-45"></div>
    </div>
  </div>
);

const TeamDashboard = () => {
  // FIX: Added 'setView' to context so we can redirect after deleting a team
  const { activeTeamId, members, performance, teams, setView } = useContext(DataContext);
  const { profile } = useContext(AuthContext);
  const { showToast } = useContext(ToastContext);
  const [requests, setRequests] = useState([]);
  const [history, setHistory] = useState([]); 
  
  const activeTeam = teams.find(t => t.id === activeTeamId);
  const isManager = (profile.role === 'manager' && profile.groupId === activeTeamId) || profile.role === 'super_user';
  const isObserver = !isManager && profile.groupId !== activeTeamId;
  
  // --- TEAM MANAGEMENT LOGIC ---
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState(''); 

  // FIX: Sync state with team name when data loads to prevent empty input
  useEffect(() => {
    if (activeTeam) setNewName(activeTeam.name);
  }, [activeTeam]);

  const handleRename = async () => {
    if (!newName.trim()) return;
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'groups', activeTeamId), { name: newName });
    setIsEditing(false);
    showToast("Team Renamed Successfully");
  };

  const handleDeleteTeam = async () => {
    const confirmMsg = `WARNING: You are about to DELETE ${activeTeam.name}.\n\nThis will:\n- Disband all ${members.length} agents\n- Delete all history\n\nType "DELETE" to confirm.`;
    if (prompt(confirmMsg) !== "DELETE") return;

    // 1. Free all agents
    const batch = writeBatch(db);
    members.forEach(m => {
       batch.update(doc(db, 'artifacts', appId, 'public', 'data', 'users', m.id), { groupId: null });
    });
    
    // 2. Delete Team
    batch.delete(doc(db, 'artifacts', appId, 'public', 'data', 'groups', activeTeamId));
    
    await batch.commit();
    showToast("Team Dissolved. Agents are now free agents.");
    
    // Redirect to Lobby
    setView('lobby');
  };

  const handleRemoveMember = async (memberId, memberName) => {
    if (!confirm(`Remove ${memberName} from the team?`)) return;
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', memberId), { groupId: null });
    showToast(`${memberName} removed from team.`);
  };

  useEffect(() => {
    if (isManager && activeTeamId) {
      const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'requests'), where('groupId', '==', activeTeamId), where('status', '==', 'pending'));
      const unsubReq = onSnapshot(q, (snap) => setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
      return () => unsubReq();
    }
  }, [isManager, activeTeamId]);

  // Fetch History
  useEffect(() => {
    if (activeTeamId) {
      const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'groups', activeTeamId, 'archives'));
      return onSnapshot(q, (snap) => setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    }
  }, [activeTeamId]);

const handleArchiveMonth = async () => {
    if (!confirm("Confirm Archive? This will:\n1. Save current stats to History\n2. Add XP to Agents\n3. This cannot be undone.")) return;
    
    const monthId = new Date().toISOString().slice(0, 7); // YYYY-MM
    const batch = writeBatch(db);
    const statsSnapshot = {};

    // 1. Calculate final scores and prepare XP updates
    members.forEach(m => {
      const p = performance[m.id] || { actuals: {} };
      let total = 0;
      
      // FIX: Ensure kpis exist before iterating
      if (activeTeam.kpis) {
        activeTeam.kpis.forEach(k => {
          total += calculateScore(p.actuals?.[k.id], k.target, k.direction, k.weight, k.type);
        });
      }
      
      // Save for history
      statsSnapshot[m.id] = { 
        name: m.name, 
        totalScore: total, 
        actuals: p.actuals || {},
        awards: p.awards || []
      };

      // Add XP (Score = XP)
      const xpEarned = Math.round(total * 10); // 100% = 1000 XP
      const newLifetimeXP = (m.lifetimeXP || 0) + xpEarned;
      const userRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', m.id);
      batch.update(userRef, { lifetimeXP: newLifetimeXP });
    });

    // 2. Create Archive Doc
    const archiveRef = doc(db, 'artifacts', appId, 'public', 'data', 'groups', activeTeamId, 'archives', monthId);
    batch.set(archiveRef, { stats: statsSnapshot, archivedAt: serverTimestamp() });

    await batch.commit();
    showToast(`Month ${monthId} Archived & XP Distributed!`);
  };

  if (!activeTeam) return <div className="min-h-[50vh] flex items-center justify-center"><Loader className="animate-spin text-[#E2231A]" /></div>;

  return (
    <div className="space-y-8 animate-slide-up">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-white/10">
        <div>
           <div className="flex items-center gap-3 text-zinc-500 mb-2">
             <span className="uppercase text-[10px] font-bold tracking-[0.2em] bg-white/5 px-2 py-1 rounded">Team Dashboard</span>
             {isObserver && <span className="bg-blue-500/10 text-blue-400 text-[10px] font-bold px-2 py-1 rounded border border-blue-500/20">READ ONLY MODE</span>}
             
             {profile.role === 'super_user' && (
               <select 
                 className="bg-zinc-800 text-xs text-white p-1 rounded border border-white/10 ml-4"
                 value={activeTeamId}
                 onChange={(e) => setView(`team_view_${e.target.value}`)}
               >
                 {teams.map(t => <option key={t.id} value={t.id}>Jump to: {t.name}</option>)}
               </select>
             )}
           </div>
           
           {/* RENAME LOGIC */}
           {isEditing ? (
             <div className="flex items-center gap-2">
               <input 
                 value={newName} 
                 onChange={e => setNewName(e.target.value)}
                 className="bg-zinc-800 text-3xl font-black text-white p-2 rounded border border-white/20 outline-none w-full max-w-md"
                 autoFocus
               />
               <Button size="sm" onClick={handleRename}><CheckCircle size={18}/></Button>
               <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}><X size={18}/></Button>
             </div>
           ) : (
             <div className="flex items-center gap-4 group">
               <h2 className="text-5xl font-black text-white uppercase tracking-tighter drop-shadow-2xl">{activeTeam.name}</h2>
               {isManager && (
                 <button onClick={() => { setIsEditing(true); setNewName(activeTeam.name); }} className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-500 hover:text-white">
                   <Edit2 size={20}/>
                 </button>
               )}
             </div>
           )}
        </div>
        
        <div className="flex gap-3">
          {isManager && (
            <>
              <Button variant="outline" onClick={handleArchiveMonth} title="Finalize Month & Distribute XP">
                <Save size={16} /> Archive Period
              </Button>
              <Button variant="danger" onClick={handleDeleteTeam} title="Dissolve Team">
                <Trash size={16} />
              </Button>
            </>
          )}
          {!isManager && !isObserver && !profile.groupId && (
            <RequestJoinButton teamId={activeTeamId} userId={profile.id} userName={profile.name} />
          )}
        </div>
      </div>

      {/* CHARTS & STATS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
         <div className="md:col-span-2">
            <TrendChart data={history} kpis={activeTeam.kpis} />
         </div>
         <div className="md:col-span-1">
            <Card title="Team Vitality" icon={Activity} className="h-full">
              <div className="flex flex-col justify-center h-full gap-4">
                 <div className="bg-white/5 p-4 rounded-lg">
                    <div className="text-zinc-500 text-xs uppercase font-bold">Total History</div>
                    <div className="text-2xl font-black text-white">{history.length} <span className="text-sm font-normal text-zinc-500">Months</span></div>
                 </div>
                 <div className="bg-white/5 p-4 rounded-lg">
                    <div className="text-zinc-500 text-xs uppercase font-bold">Top Rank</div>
                    <div className="text-2xl font-black text-[#E2231A]">
                       {members.reduce((max, m) => Math.max(max, getAgentLevel(m.lifetimeXP)), 0)} <span className="text-sm font-normal text-zinc-500">Lvl</span>
                    </div>
                 </div>
              </div>
            </Card>
         </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
        {isManager && (
           <div className="xl:col-span-1 space-y-6">
             <Card title="Requests" icon={UserPlus} count={requests.length} className="border-l-4 border-l-[#E2231A]">
               {requests.length === 0 ? <p className="text-zinc-600 text-xs italic">No pending join requests.</p> : (
                 <div className="space-y-2">
                   {requests.map(r => (
                     <div key={r.id} className="bg-white/5 p-3 rounded-lg flex justify-between items-center text-sm border border-white/5 animate-slide-up">
                       <span className="font-bold text-white">{r.userName}</span>
                       <div className="flex gap-1">
                         <button onClick={async () => {
                            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', r.userId), { groupId: r.groupId });
                            await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'requests', r.id));
                            showToast(`${r.userName} added to team`);
                         }} className="text-green-500 hover:bg-green-500/20 p-2 rounded-full transition-colors"><CheckCircle size={16}/></button>
                         <button onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'requests', r.id))} className="text-red-500 hover:bg-red-500/20 p-2 rounded-full transition-colors"><XCircle size={16}/></button>
                       </div>
                     </div>
                   ))}
                 </div>
               )}
             </Card>
             <KpiConfigurator currentTeam={activeTeam} />
           </div>
        )}

        <div className={cn("space-y-8", isManager ? "xl:col-span-3" : "xl:col-span-4")}>
          <PerformanceMatrix 
            members={members} 
            kpis={activeTeam.kpis || []} 
            data={performance} 
            isManager={isManager} 
            teamId={activeTeam.id} 
            awardsList={activeTeam.awards || []} 
            onRemoveMember={handleRemoveMember} 
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Leaderboard members={members} kpis={activeTeam.kpis || []} data={performance} />
            <AwardWall members={members} data={performance} />
          </div>
        </div>
      </div>
    </div>
  );
};

// --- PDF GENERATOR ---
const generateAgentReport = (agent, kpis, kpiResults, totalScore, awards, teamName) => {
  const doc = new jsPDF();
  const themeRed = [226, 35, 26]; // #E2231A
  const themeDark = [20, 20, 22];

  // Header Background
  doc.setFillColor(...themeDark);
  doc.rect(0, 0, 210, 40, 'F');
  
  // Title & Team
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("PERFORMANCE SCORECARD", 14, 20);
  
  doc.setFontSize(10);
  doc.setTextColor(200, 200, 200);
  doc.text(`UNIT: ${teamName.toUpperCase()}`, 14, 30);
  doc.text(`GENERATED: ${new Date().toLocaleDateString()}`, 14, 35);

  // Logo Placeholder (Red Strip)
  doc.setFillColor(...themeRed);
  doc.rect(0, 38, 210, 2, 'F');

  // Agent Identity Section
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(agent.name, 14, 55);
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(agent.email, 14, 61);

  // Score Badge (Right Side)
  doc.setFillColor(...(totalScore >= 100 ? themeRed : themeDark));
  doc.roundedRect(160, 48, 35, 20, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(`${totalScore.toFixed(1)}%`, 177.5, 61, { align: 'center' });
  doc.setFontSize(7);
  doc.text("FINAL SCORE", 177.5, 53, { align: 'center' });

  // Awards Section
  if (awards.length > 0) {
    doc.setFontSize(10);
    doc.setTextColor(...themeRed);
    doc.text("DISTINCTIONS:", 14, 75);
    doc.setTextColor(0,0,0);
    doc.text(awards.join("  •  "), 45, 75);
  }

  // KPI Table
  const tableRows = kpiResults.map(k => [
    k.name,
    k.category || 'Core',
    k.target,
    k.val || '-',
    `${k.weight}%`,
    `${k.weighted.toFixed(1)}`
  ]);

  autoTable(doc, {
    startY: 85,
    head: [['Metric', 'Category', 'Target', 'Actual', 'Weight', 'Score']],
    body: tableRows,
    theme: 'grid',
    headStyles: { fillColor: themeDark, textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { fontStyle: 'bold' },
      5: { fontStyle: 'bold', textColor: themeRed }
    },
    styles: { fontSize: 9, cellPadding: 3 },
    foot: [['', '', '', '', 'TOTAL', totalScore.toFixed(1)]],
    footStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold' }
  });

  // Footer
  const finalY = doc.lastAutoTable.finalY + 20;
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text("CONFIDENTIAL INTERNAL DOCUMENT", 105, 280, { align: 'center' });

  doc.save(`Report_${agent.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
};


// --- HELPER COMPONENTS ---
const DebouncedInput = ({ value, onSave, placeholder }) => {
  const [localVal, setLocalVal] = useState(value || '');
  const [status, setStatus] = useState('saved'); // 'saved', 'typing', 'saving'

  useEffect(() => { setLocalVal(value || ''); }, [value]);

  useEffect(() => {
    // Don't trigger save if value hasn't changed or isn't initialized
    if (localVal === (value || '')) return;

    setStatus('typing');
    const timer = setTimeout(async () => {
      setStatus('saving');
      await onSave(localVal);
      setStatus('saved');
    }, 600); // 600ms Debounce

    return () => clearTimeout(timer);
  }, [localVal]);

  return (
    <div className="relative group/input">
      <input 
        type="number" 
        value={localVal}
        onChange={(e) => setLocalVal(e.target.value)}
        className={cn(
          "bg-black/40 border w-20 text-center text-xs p-2 rounded outline-none transition-all focus:scale-105",
          status === 'saving' ? "border-yellow-500/50 text-yellow-500" : "border-white/10 text-white focus:border-[#E2231A]"
        )}
        placeholder={placeholder}
      />
      {/* Saving Indicator */}
      {status === 'saving' && (
        <div className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-500 rounded-full animate-ping"></div>
      )}
    </div>
  );
};


const PerformanceMatrix = ({ members, kpis, data, isManager, teamId, awardsList, onRemoveMember }) => { 
  const { showToast } = useContext(ToastContext);
  
  // NEW: State for the Recognition Modal (Fixes Z-Index Clipping)
  const [recognitionTarget, setRecognitionTarget] = useState(null);

  const kpiStructure = useMemo(() => {
    const groups = {};
    kpis.forEach(k => {
      const cat = k.category || 'Other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(k);
    });
    return Object.entries(groups); 
  }, [kpis]);

  const rows = useMemo(() => {
    return members.map(m => {
      const p = data[m.id] || { actuals: {}, awards: [] };
      let totalScore = 0;
      
      const kpiResults = kpis.map(k => {
        const val = p.actuals?.[k.id];
        // UPDATE: Pass 'k.steps' to enable the new Attendance logic
        const weighted = calculateScore(val, k.target, k.direction, k.weight, k.type, k.steps);
        totalScore += weighted;
        return { ...k, val, weighted };
      });
      return { ...m, kpiResults, totalScore, awards: p.awards || [] };
    }).sort((a,b) => b.totalScore - a.totalScore);
  }, [members, data, kpis]);

  const updateScore = async (userId, kpiId, val) => {
    const current = data[userId] || { actuals: {}, awards: [] };
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'groups', teamId, 'performance', userId), {
      ...current, actuals: { ...current.actuals, [kpiId]: val }
    }, { merge: true });
  };

  // UPDATE: Modified to accept currentAwards for Optimistic UI updates
  const toggleAward = async (userId, award, currentAwards) => {
    const has = currentAwards.includes(award);
    const newAwards = has ? currentAwards.filter(a => a !== award) : [...currentAwards, award];

    // Optimistic UI update for the modal so it feels instant
    if(recognitionTarget && recognitionTarget.id === userId) {
      setRecognitionTarget({ ...recognitionTarget, currentAwards: newAwards });
    }

    const current = data[userId] || { actuals: {}, awards: [] };
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'groups', teamId, 'performance', userId), { 
      ...current, awards: newAwards 
    }, { merge: true });
  };

  const handleCSVExport = () => {
    if (!members.length) return;
    const headers = ['Email', 'Name', ...kpis.map(k => k.name)].join(',');
    const rows = members.map(m => {
      const p = data[m.id] || { actuals: {} };
      const scores = kpis.map(k => p.actuals?.[k.id] || '').join(',');
      return `${m.email},${m.name},${scores}`;
    }).join('\n');
    const blob = new Blob([headers + '\n' + rows], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Performance_Export_${teamId}_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
  };

  const handleCSVUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = evt.target.result;
      const lines = text.split('\n');
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const batch = writeBatch(db);
      let updatedCount = 0;
      lines.slice(1).forEach(line => {
        const cols = line.split(',');
        if (cols.length < 2) return;
        const email = cols[0].trim();
        const member = members.find(m => m.email === email);
        if (member) {
          const current = data[member.id] || { actuals: {}, awards: [] };
          const newActuals = { ...current.actuals };
          kpis.forEach(k => {
             const idx = headers.indexOf(k.name.toLowerCase());
             if (idx > -1 && cols[idx]) newActuals[k.id] = cols[idx].trim();
          });
          const ref = doc(db, 'artifacts', appId, 'public', 'data', 'groups', teamId, 'performance', member.id);
          batch.set(ref, { ...current, actuals: newActuals }, { merge: true });
          updatedCount++;
        }
      });
      await batch.commit();
      showToast(`Processed ${updatedCount} agents from CSV`);
    };
    reader.readAsText(file);
  };

  return (
    <>
      <Card 
        title="Performance Matrix" 
        icon={Activity} 
        className="h-fit"
        action={
          <div className="flex items-center gap-3">
            <InfoTooltip text="Input monthly actuals here. Scores update automatically based on logic. Import CSV for bulk updates." />
            {isManager && (
              <div className="flex gap-2">
                <button 
                   onClick={handleCSVExport}
                   className="bg-zinc-800 hover:bg-zinc-700 text-white text-xs px-3 py-2 rounded-lg flex items-center gap-2 border border-white/10 transition-all"
                   title="Export current view to CSV"
                >
                  <Download size={14} /> Export
                </button>
                <label className="cursor-pointer bg-zinc-800 hover:bg-[#E2231A] hover:text-white text-xs px-3 py-2 rounded-lg flex items-center gap-2 border border-white/10 transition-all shadow-lg">
                  <Upload size={14} /> Import CSV
                  <input type="file" accept=".csv" className="hidden" onChange={handleCSVUpload} />
                </label>
              </div>
            )}
          </div>
        }
      >
        <div className="overflow-x-auto pb-4">
          <table className="w-full text-left border-collapse relative">
            <thead>
              {/* Top Header Row (Categories) */}
              <tr className="text-[10px] uppercase text-zinc-500 bg-[#0c0c0e]/95 backdrop-blur-md border-b border-white/5">
                {/* Corner Cell: Sticky Left & Top */}
                <th className="p-4 bg-[#0c0c0e] sticky left-0 top-0 z-30 w-56 border-r border-white/5 shadow-[5px_0_20px_rgba(0,0,0,0.5)]"></th>
                
                {/* Category Cells: Sticky Top */}
                {kpiStructure.map(([category, catKpis]) => (
                  <th key={category} colSpan={catKpis.length} className="p-2 text-center border-l border-white/10 bg-[#151518]/90 text-[#E2231A] font-black tracking-widest sticky top-0 z-20">
                    {category}
                  </th>
                ))}
                
                <th className="bg-[#0c0c0e]/95 sticky top-0 z-20"></th>
                <th className="bg-[#0c0c0e] sticky top-0 right-0 z-30 border-l border-white/10 shadow-[-5px_0_20px_rgba(0,0,0,0.5)]"></th>
              </tr>

              {/* Second Header Row (Metric Names) */}
              <tr className="text-[9px] uppercase text-zinc-400 bg-[#0c0c0e]/95 backdrop-blur-md border-b border-white/10">
                {/* Agent Detail Header: Sticky Left & Top */}
                <th className="p-4 font-bold sticky left-0 top-[33px] z-30 bg-[#0c0c0e] border-r border-white/5 shadow-[5px_0_20px_rgba(0,0,0,0.5)]">Agent Detail</th>
                
                {kpiStructure.flatMap(([_, catKpis]) => catKpis).map(k => (
                  <th key={k.id} className="p-3 text-center min-w-[120px] border-l border-white/5 relative group/header hover:bg-white/5 transition-colors sticky top-[33px] z-20 bg-[#0c0c0e]/95">
                    <div className="font-bold text-zinc-200">{k.name}</div>
                    <div className="mt-1 opacity-60 flex justify-center gap-1">
                       {/* Display STEP or Target depending on type */}
                       {k.type === 'step' 
                         ? <span className="bg-white/5 px-1.5 py-0.5 rounded text-[8px]">STEP</span>
                         : <>
                             <span className="bg-white/5 px-1.5 py-0.5 rounded text-[8px]">{k.weight}%</span>
                             <span className="bg-white/5 px-1.5 py-0.5 rounded text-[8px]">{k.type === 'binary' ? 'P/F' : `T: ${k.target}`}</span>
                           </>
                       }
                    </div>
                  </th>
                ))}
                <th className="p-3 text-center text-[#E2231A] font-black text-xs border-l border-white/10 sticky top-[33px] z-20 bg-[#0c0c0e]/95">Total Score</th>
                
                {/* Actions Header */}
                <th className="p-3 text-center w-24 border-l border-white/10 sticky right-0 top-[33px] z-30 bg-[#0c0c0e] shadow-[-5px_0_20px_rgba(0,0,0,0.5)]">Actions</th>            
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={row.id} className="border-b border-white/5 hover:bg-white/5 transition-all duration-300 group hover:z-10 relative">
                  {/* Agent Column: Sticky Left */}
                  <td className="p-4 sticky left-0 bg-[#09090b] group-hover:bg-[#1a1a1c] transition-colors z-20 border-r border-white/5 shadow-[5px_0_20px_rgba(0,0,0,0.5)]">
                    <div className="flex items-center gap-3">
                      
                      {/* RANKING BADGE */}
                      <div className="flex flex-col items-center justify-center w-6 shrink-0">
                         <span className={cn("text-xs font-black", idx === 0 ? "text-yellow-400 text-base" : idx === 1 ? "text-zinc-300" : idx === 2 ? "text-amber-700" : "text-zinc-600")}>
                           #{idx + 1}
                         </span>
                      </div>

                      {(() => {
                         const lvl = getAgentLevel(row.lifetimeXP);
                         const rank = getAgentRank(lvl);
                         return (
                           <div className={cn("w-10 h-10 rounded-lg flex flex-col items-center justify-center border transition-colors relative overflow-hidden shrink-0", rank.bg, rank.border)}>
                              <span className={cn("text-[8px] uppercase font-black tracking-widest", rank.color)}>{rank.name}</span>
                              <span className="text-sm font-bold text-white">{lvl}</span>
                           </div>
                         );
                      })()}
                      <div>
                        <div className="font-bold text-sm text-white group-hover:text-[#E2231A] transition-colors">{row.name}</div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {row.awards.map(a => <span key={a} title={a} className="text-yellow-500 animate-pulse"><Medal size={10}/></span>)}
                        </div>
                      </div>
                    </div>
                  </td>
                  
                  {/* KPI Columns */}
                  {row.kpiResults.map(res => (
                    <td key={res.id} className="p-3 text-center align-middle relative border-l border-white/5">
                      {isManager ? (
                        res.type === 'binary' ? (
                          <select
                            value={res.val || ''}
                            onChange={(e) => updateScore(row.id, res.id, e.target.value)}
                            className={cn(
                              "bg-black/40 border text-[10px] font-bold uppercase p-2 rounded outline-none w-24 text-center cursor-pointer",
                              res.val === 'pass' ? "border-green-500/50 text-green-500" : 
                              res.val === 'fail' ? "border-red-500/50 text-red-500" : "border-white/10 text-zinc-500"
                            )}
                          >
                            <option value="">-</option>
                            <option value="pass">PASS</option>
                            <option value="fail">FAIL</option>
                          </select>
                        ) : (
                          <DebouncedInput 
                            value={res.val} 
                            onSave={(val) => updateScore(row.id, res.id, val)}
                            placeholder={res.type === 'step' ? 'Days' : '-'} 
                          />
                        )
                      ) : (
                        <span className={cn("font-mono text-sm font-bold", 
                          res.val === 'fail' ? "text-red-500" : 
                          res.val === 'pass' ? "text-green-500" : "text-white"
                        )}>
                          {res.val === 'pass' ? 'PASS' : res.val === 'fail' ? 'FAIL' : (res.val || '-')}
                        </span>
                      )}
                    </td>
                  ))}

                  <td className="p-3 text-center font-black text-xl text-white group-hover:scale-110 transition-transform origin-center border-l border-white/10">
                    <span className={cn(row.totalScore >= 100 ? "text-[#E2231A] drop-shadow-[0_0_10px_rgba(226,35,26,0.5)]" : "text-white")}>
                      {row.totalScore.toFixed(1)}%
                    </span>
                  </td>
                  
                  {/* Actions Column: Sticky Right */}
                  <td className="p-3 text-center border-l border-white/10 relative sticky right-0 bg-[#09090b] group-hover:bg-[#1a1a1c] z-20 shadow-[-5px_0_20px_rgba(0,0,0,0.5)]">
                     <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => generateAgentReport(row, kpis, row.kpiResults, row.totalScore, row.awards, teamId)}
                          className="p-2 bg-white/5 hover:bg-[#E2231A] hover:text-white rounded-full text-zinc-400 transition-all z-10"
                          title="Download PDF"
                        >
                          <FileSpreadsheet size={16}/>
                        </button>

                        {isManager && (
                          <>
                             {/* UPDATED: Open Fixed Modal instead of inline dropdown */}
                             <button 
                               onClick={() => setRecognitionTarget({ id: row.id, name: row.name, currentAwards: row.awards })}
                               className="p-2 bg-white/5 hover:bg-yellow-500 hover:text-black rounded-full text-zinc-400 transition-all z-10"
                               title="Assign Recognition"
                             >
                               <Crown size={16}/>
                             </button>
                             
                             <button 
                               onClick={() => onRemoveMember(row.id, row.name)}
                               className="p-2 bg-white/5 hover:bg-red-500/20 hover:text-red-500 rounded-full text-zinc-400 transition-all ml-2"
                               title="Remove from Team"
                             >
                               <UserMinus size={16}/>
                             </button>
                          </>
                        )}
                     </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <div className="p-10 text-center text-zinc-600 text-sm italic">Initialize agent data via CSV or manual entry.</div>}
        </div>
      </Card>

      {/* FIXED RECOGNITION MODAL OVERLAY */}
      {recognitionTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in" onClick={() => setRecognitionTarget(null)}>
          <div className="bg-[#09090b] border border-white/20 p-6 rounded-2xl w-full max-w-sm shadow-2xl transform scale-100" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-bold text-white">Recognize Agent</h3>
                <p className="text-zinc-500 text-sm">Assign badges to <span className="text-[#E2231A]">{recognitionTarget.name}</span></p>
              </div>
              <button onClick={() => setRecognitionTarget(null)}><X size={20} className="text-zinc-500 hover:text-white"/></button>
            </div>
            
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {awardsList.map(award => {
                const isActive = recognitionTarget.currentAwards.includes(award);
                return (
                  <button 
                    key={award}
                    onClick={() => toggleAward(recognitionTarget.id, award, recognitionTarget.currentAwards)}
                    className={cn(
                      "w-full flex items-center justify-between p-4 rounded-xl border transition-all",
                      isActive 
                        ? "bg-[#E2231A]/10 border-[#E2231A] text-white" 
                        : "bg-white/5 border-white/5 text-zinc-400 hover:bg-white/10 hover:border-white/20"
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <Medal size={18} className={isActive ? "text-yellow-500" : "text-zinc-600"} />
                      <span className="font-bold text-sm">{award}</span>
                    </span>
                    {isActive && <CheckCircle size={16} className="text-[#E2231A]"/>}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const KpiConfigurator = ({ currentTeam }) => {
  const { showToast } = useContext(ToastContext);
  const [loading, setLoading] = useState(false);
  
  const [kpis, setKpis] = useState(currentTeam?.kpis || []);
  // Ensure gateways is initialized
  const [gateways, setGateways] = useState(currentTeam?.gateways || []);

  const addKpi = () => setKpis([...kpis, { id: `kpi_${Date.now()}`, name: '', weight: 10, target: 100, direction: 'higher', type: 'value', steps: [] }]);
  const updateKpi = (id, field, value) => setKpis(kpis.map(k => k.id === id ? { ...k, [field]: value } : k));
  const removeKpi = (id) => setKpis(kpis.filter(k => k.id !== id));

  // --- NEW: STEP MANAGEMENT FUNCTIONS ---
  const addStep = (kpiId) => {
    setKpis(kpis.map(k => {
      if (k.id === kpiId) {
        const newSteps = [...(k.steps || []), { limit: 0, score: 0 }];
        return { ...k, steps: newSteps };
      }
      return k;
    }));
  };

  const updateStep = (kpiId, stepIdx, field, value) => {
    setKpis(kpis.map(k => {
      if (k.id === kpiId) {
        const newSteps = [...(k.steps || [])];
        newSteps[stepIdx] = { ...newSteps[stepIdx], [field]: value };
        return { ...k, steps: newSteps };
      }
      return k;
    }));
  };

  const removeStep = (kpiId, stepIdx) => {
    setKpis(kpis.map(k => {
      if (k.id === kpiId) {
        return { ...k, steps: k.steps.filter((_, idx) => idx !== stepIdx) };
      }
      return k;
    }));
  };
  // --------------------------------------

  const addGateway = () => setGateways([...gateways, { id: `gate_${Date.now()}`, name: '', penalty: 'zero', weight: 0 }]);
  const updateGateway = (id, field, value) => setGateways(gateways.map(g => g.id === id ? { ...g, [field]: value } : g));
  const removeGateway = (id) => setGateways(gateways.filter(g => g.id !== id));

  const handleSave = async () => {
    setLoading(true);
    try {
      const totalWeight = kpis.reduce((sum, k) => sum + parseFloat(k.weight || 0), 0);
      if (totalWeight !== 100) showToast(`Warning: Total Weight is ${totalWeight}%`, 'error');

      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'groups', currentTeam.id), {
        kpis, gateways, lastUpdated: serverTimestamp()
      });
      showToast("Configuration Saved");
    } catch (err) {
      console.error(err);
      showToast("Save Failed", 'error');
    }
    setLoading(false);
  };

  return (
    <div className="space-y-8 animate-slide-up pb-10">
      <div className="flex justify-between items-end border-b border-white/10 pb-4">
        <div>
           <h3 className="text-xl font-black text-white uppercase tracking-tight">System Config</h3>
           <p className="text-zinc-500 text-xs mt-1">Define metrics & rules.</p>
        </div>
        <Button onClick={handleSave} disabled={loading} className={loading ? "opacity-50" : ""}>
          {loading ? <Loader className="animate-spin" size={16}/> : <Save size={16}/>}
          Save
        </Button>
      </div>

      {/* GATEWAYS SECTION */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="text-xs font-bold text-[#E2231A] uppercase tracking-widest flex items-center gap-2"><Shield size={14}/> Global Gateways</div>
          <button onClick={addGateway} className="text-xs text-zinc-400 hover:text-white flex items-center gap-1"><Plus size={12}/> Add Rule</button>
        </div>
        {gateways.length === 0 && <div className="text-zinc-600 text-xs italic border border-dashed border-white/10 p-4 rounded text-center">No rules defined.</div>}
        {gateways.map((g) => (
          <div key={g.id} className="kpi-card-styled border-l-4 border-l-[#E2231A] flex flex-col md:flex-row gap-4 items-end">
            <div className="w-full space-y-2">
              <div className="kpi-input-group"><label>Gateway Name</label><input className="kpi-input-styled" value={g.name} onChange={e => updateGateway(g.id, 'name', e.target.value)} /></div>
            </div>
            <div className="w-full md:w-48 space-y-2">
              <div className="kpi-input-group"><label>Penalty</label><select className="kpi-select-styled" value={g.penalty} onChange={e => updateGateway(g.id, 'penalty', e.target.value)}><option value="zero">Zero Out Score</option><option value="deduct">Deduct Points</option></select></div>
            </div>
            {g.penalty === 'deduct' && (
              <div className="w-24 space-y-2"><div className="kpi-input-group"><label>Ded. %</label><input type="number" className="kpi-input-styled text-center text-red-500 font-bold" value={g.weight} onChange={e => updateGateway(g.id, 'weight', e.target.value)} /></div></div>
            )}
            <button onClick={() => removeGateway(g.id)} className="btn-icon-danger mb-1"><Trash2 size={16}/></button>
          </div>
        ))}
      </div>

      {/* KPIS SECTION */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
           <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2"><Target size={14}/> Performance Metrics</div>
           <button onClick={addKpi} className="text-xs text-[#E2231A] hover:text-white flex items-center gap-1 font-bold"><Plus size={12}/> Add KPI</button>
        </div>

        {kpis.map((k) => (
          <div key={k.id} className="kpi-card-styled">
            {/* Header Row */}
            <div className="flex gap-4 items-start mb-4 border-b border-white/5 pb-4">
               <div className="flex-1 kpi-input-group">
                  <label>Metric Name</label>
                  <input className="kpi-input-styled font-bold text-lg" value={k.name} onChange={e => updateKpi(k.id, 'name', e.target.value)} placeholder="KPI Name" />
               </div>
               <button onClick={() => removeKpi(k.id)} className="btn-icon-danger mt-1"><Trash2 size={16}/></button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="kpi-input-group">
                <label>Type</label>
                <select className="kpi-select-styled" value={k.type || 'value'} onChange={e => updateKpi(k.id, 'type', e.target.value)}>
                  <option value="value">Numeric Target</option>
                  <option value="step">Step Logic</option> {/* Added Step Option */}
                  <option value="binary">Pass / Fail</option>
                </select>
              </div>
              <div className="kpi-input-group">
                <label>Weight (%)</label>
                <input type="number" className="kpi-input-styled text-[#E2231A] font-bold" value={k.weight} onChange={e => updateKpi(k.id, 'weight', e.target.value)} />
              </div>

              {k.type === 'value' && (
                <>
                  <div className="kpi-input-group"><label>Target</label><input type="number" className="kpi-input-styled" value={k.target} onChange={e => updateKpi(k.id, 'target', e.target.value)} /></div>
                  <div className="kpi-input-group"><label>Direction</label><select className="kpi-select-styled" value={k.direction} onChange={e => updateKpi(k.id, 'direction', e.target.value)}><option value="higher">Higher is Better</option><option value="lower">Lower is Better</option></select></div>
                </>
              )}
            </div>

            {/* --- NEW: RENDER STEP DEFINITION UI --- */}
            {k.type === 'step' && (
              <div className="bg-black/30 border border-white/5 rounded-lg p-4 mt-2">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase">Step Definition (If Actual ≤ X, then Y%)</span>
                  <button onClick={() => addStep(k.id)} className="text-[10px] bg-white/5 hover:bg-white/10 text-white px-2 py-1 rounded border border-white/10 flex items-center gap-1">
                    <Plus size={10}/> Add Step
                  </button>
                </div>
                
                <div className="space-y-2">
                  {(k.steps || []).map((step, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                       <div className="flex-1">
                         <div className="text-[9px] text-zinc-600 font-bold mb-1">THRESHOLD (≤)</div>
                         <input 
                           type="number" 
                           className="kpi-input-styled" 
                           value={step.limit} 
                           onChange={(e) => updateStep(k.id, idx, 'limit', e.target.value)} 
                         />
                       </div>
                       <div className="flex-1">
                         <div className="text-[9px] text-zinc-600 font-bold mb-1">SCORE %</div>
                         <input 
                           type="number" 
                           className="kpi-input-styled text-[#E2231A]" 
                           value={step.score} 
                           onChange={(e) => updateStep(k.id, idx, 'score', e.target.value)} 
                         />
                       </div>
                       <button onClick={() => removeStep(k.id, idx)} className="btn-icon-danger mt-4"><X size={14}/></button>
                    </div>
                  ))}
                  {(k.steps || []).length === 0 && <div className="text-center text-zinc-700 text-xs py-2 italic">No steps defined.</div>}
                </div>
              </div>
            )}
            {/* -------------------------------------- */}

          </div>
        ))}
      </div>
    </div>
  );
};


const Leaderboard = ({ members, kpis, data }) => {
  const ranked = useMemo(() => {
    // Safety check to prevent crash if data is missing
    if (!members || !kpis) return [];

    return members.map(m => {
      const p = data[m.id] || { actuals: {} };
      let total = 0;
      kpis.forEach(k => { 
        total += calculateScore(p.actuals?.[k.id], k.target, k.direction, k.weight, k.type); 
      });
      
      // --- FIX: THIS RETURN STATEMENT WAS MISSING ---
      return { ...m, total }; 
      // ----------------------------------------------
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);
  }, [members, kpis, data]);

  return (
    <Card title="Top Performers" icon={Trophy} className="h-full">
      <div className="space-y-4">
        {ranked.map((m, i) => (
          <div key={m.id} style={{ animationDelay: `${i * 100}ms` }} className="flex items-center gap-4 animate-slide-up group">
            <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center font-black text-lg shadow-lg transition-transform group-hover:scale-110", i===0 ? "bg-[#E2231A] text-white shadow-red-900/50" : "bg-white/5 text-zinc-500")}>
              {i+1}
            </div>
            <div className="flex-1">
              <div className="flex justify-between text-sm mb-1">
                <span className="font-bold text-white group-hover:text-[#E2231A] transition-colors">{m.name}</span>
                <span className="text-[#E2231A] font-mono font-bold">{m.total.toFixed(1)}%</span>
              </div>
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-[#E2231A] to-purple-600 relative overflow-hidden" style={{ width: `${Math.min(m.total, 100)}%` }}>
                   <div className="absolute top-0 left-0 w-full h-full bg-white/20 animate-[pulse_2s_infinite]"></div>
                </div>
              </div>
            </div>
          </div>
        ))}
        {ranked.length === 0 && <p className="text-zinc-600 italic text-center py-8">Awaiting Performance Data</p>}
      </div>
    </Card>
  );
};

const AwardWall = ({ members, data }) => {
  const all = useMemo(() => {
    let list = [];
    members.forEach(m => { (data[m.id]?.awards || []).forEach(a => list.push({ user: m.name, award: a })); });
    return list;
  }, [members, data]);

  return (
    <Card title="Hall of Fame" icon={Sparkles} className="h-full">
      <div className="flex flex-wrap gap-2 content-start">
        {all.map((item, i) => (
          <div key={i} style={{ animationDelay: `${i * 50}ms` }} className="animate-fade-in flex items-center gap-2 bg-gradient-to-r from-yellow-900/20 to-transparent border border-yellow-500/20 pl-2 pr-3 py-1.5 rounded-full hover:border-yellow-500/50 transition-colors cursor-default group">
            <Medal size={12} className="text-yellow-500 group-hover:rotate-12 transition-transform" />
            <span className="text-xs font-bold text-zinc-300">{item.user}</span>
            <span className="text-[10px] text-yellow-600 uppercase tracking-wide border-l border-yellow-500/20 pl-2 ml-1 font-bold">{item.award}</span>
          </div>
        ))}
        {all.length === 0 && <div className="w-full text-center py-8 text-zinc-600 italic">No distinctions awarded yet.</div>}
      </div>
    </Card>
  );
};

const LearningHub = () => {
  const { profile } = useContext(AuthContext);
  const { showToast } = useContext(ToastContext);
  const [posts, setPosts] = useState([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newPost, setNewPost] = useState({ title: '', content: '', tag: 'General' });

  useEffect(() => {
    // Corrected fetch without invalid orderBy
    const ref = collection(db, 'artifacts', appId, 'public', 'data', 'posts');
    return onSnapshot(ref, (snap) => {
      setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
    });
  }, []);

  const handleCreate = async () => {
    if (!newPost.title || !newPost.content) return;
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'posts'), {
      ...newPost, authorName: profile.name, authorId: profile.id, createdAt: serverTimestamp(), likes: []
    });
    setIsCreating(false);
    setNewPost({ title: '', content: '', tag: 'General' });
    showToast("Knowledge Shared!");
  };

  const toggleLike = async (postId, currentLikes = []) => {
    const likes = currentLikes.includes(profile.id) ? currentLikes.filter(id => id !== profile.id) : [...currentLikes, profile.id];
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'posts', postId), { likes });
  };

  return (
    <div className="space-y-8 animate-slide-up max-w-4xl mx-auto">
      {/* UI FIX: Added flex-wrap and gap to prevent overlapping */}
      <div className="flex flex-wrap justify-between items-end border-b border-white/10 pb-6 gap-4">
        <div>
          <h2 className="text-4xl font-black uppercase text-white tracking-tighter">Learning <span className="text-[#E2231A]">Hub</span></h2>
          <p className="text-zinc-500 mt-1 flex items-center gap-2"><BookOpen size={14}/> Share Best Practices & Intel</p>
        </div>
        <Button onClick={() => setIsCreating(!isCreating)}>{isCreating ? 'Cancel' : 'Share Knowledge'}</Button>
      </div>

      {isCreating && (
        <Card className="animate-fade-in border-[#E2231A]/50">
           <div className="space-y-4">
             <Input label="Topic Title" value={newPost.title} onChange={e => setNewPost({...newPost, title: e.target.value})} placeholder="Topic..." />
             <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Knowledge Content</label>
                <textarea 
                  className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-sm text-white focus:border-[#E2231A] outline-none min-h-[150px]" 
                  value={newPost.content} onChange={e => setNewPost({...newPost, content: e.target.value})}
                />
             </div>
             <div className="flex justify-end"><Button onClick={handleCreate}><Send size={16}/> Publish</Button></div>
           </div>
        </Card>
      )}

      <div className="grid gap-6">
        {posts.map(post => (
          <div key={post.id} className="glass-panel p-6 rounded-xl hover:border-white/20 transition-all group">
             <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold text-white mb-1">{post.title}</h3>
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <span className="text-[#E2231A] font-bold uppercase">{post.authorName}</span>
                    <span>•</span>
                    <span>{new Date(post.createdAt?.seconds * 1000).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="bg-white/5 px-3 py-1 rounded-full text-[10px] font-bold uppercase text-zinc-400">{post.tag}</div>
             </div>
             <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-line mb-6 pl-4 border-l-2 border-[#E2231A]/30">{post.content}</p>
             <div className="flex gap-4 border-t border-white/5 pt-4">
                <button onClick={() => toggleLike(post.id, post.likes)} className={cn("flex items-center gap-2 text-xs font-bold transition-colors", post.likes?.includes(profile.id) ? "text-pink-500" : "text-zinc-500 hover:text-white")}>
                  <Heart size={14} className={cn(post.likes?.includes(profile.id) && "fill-current")} /> {post.likes?.length || 0} Kudos
                </button>
             </div>
          </div>
        ))}
        {posts.length === 0 && !isCreating && <div className="text-center py-20 text-zinc-600 italic">No knowledge shared yet.</div>}
      </div>
    </div>
  );
};

const UserManagement = () => {
  const { teams } = useContext(DataContext);
  const { showToast } = useContext(ToastContext);
  const [allUsers, setAllUsers] = useState([]);
  const [filter, setFilter] = useState('');

  // Fetch real-time user list
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'users'), (snap) => {
      setAllUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => a.name.localeCompare(b.name)));
    });
    return () => unsub();
  }, []);

  const handleRoleChange = async (uid, newRole) => {
     await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', uid), { role: newRole });
     showToast("User Role Updated");
  };

  const handleTeamChange = async (uid, newGroupId) => {
     await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', uid), { groupId: newGroupId || null });
     showToast("Team Assignment Updated");
  };

  const handleDelete = async (uid) => {
    if(!confirm("Permanently delete this user? This cannot be undone.")) return;
    await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', uid));
    showToast("User Deleted");
  };

  const filteredUsers = allUsers.filter(u => 
    u.name?.toLowerCase().includes(filter.toLowerCase()) || 
    u.email?.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-slide-up max-w-5xl mx-auto">
       {/* Header */}
       <div className="flex flex-col md:flex-row justify-between md:items-end border-b border-white/10 pb-6 gap-4">
          <div>
            <h2 className="text-4xl font-black uppercase text-white tracking-tighter">User <span className="text-[#E2231A]">Matrix</span></h2>
            <p className="text-zinc-500 mt-1 flex items-center gap-2"><Settings size={14}/> Full Roster Control</p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={14} />
            <input 
              className="bg-zinc-900 border border-white/10 rounded-full py-2 pl-9 pr-4 text-xs text-white focus:border-[#E2231A] outline-none w-full md:w-64 transition-all focus:w-80"
              placeholder="Search personnel..."
              value={filter}
              onChange={e => setFilter(e.target.value)}
            />
          </div>
       </div>

       {/* User List */}
       <div className="grid gap-3">
         {filteredUsers.map(u => (
           <div key={u.id} className="glass-panel p-4 rounded-xl flex flex-col md:flex-row items-center gap-4 hover:border-white/20 transition-all group">
              
              {/* Identity */}
              <div className="flex items-center gap-4 flex-1 w-full">
                 <div className={cn("w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs shrink-0", 
                    u.role === 'super_user' ? "bg-[#E2231A] text-white shadow-[0_0_15px_rgba(226,35,26,0.4)]" : 
                    u.role === 'manager' ? "bg-purple-900/50 text-purple-200 border border-purple-500/30" : "bg-zinc-800 text-zinc-400"
                 )}>
                    {u.role === 'super_user' ? <Shield size={16}/> : u.role === 'manager' ? <Crown size={16}/> : <Users size={16}/>}
                 </div>
                 <div className="overflow-hidden">
                   <div className="font-bold text-white truncate">{u.name}</div>
                   <div className="text-xs text-zinc-500 truncate">{u.email}</div>
                 </div>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-2 w-full md:w-auto">
                 {/* Role Select */}
                 <div className="relative">
                   <select 
                     className="appearance-none bg-black/40 border border-white/10 rounded-lg py-2 pl-3 pr-8 text-xs text-white outline-none focus:border-[#E2231A] cursor-pointer hover:bg-white/5 transition-colors uppercase font-bold w-32"
                     value={u.role}
                     onChange={(e) => handleRoleChange(u.id, e.target.value)}
                   >
                     <option value="agent">Agent</option>
                     <option value="manager">Manager</option>
                     <option value="super_user">Super User</option>
                   </select>
                   <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500"><Settings size={10}/></div>
                 </div>

                 {/* Team Select */}
                 <div className="relative">
                   <select 
                     className="appearance-none bg-black/40 border border-white/10 rounded-lg py-2 pl-3 pr-8 text-xs text-white outline-none focus:border-[#E2231A] cursor-pointer hover:bg-white/5 transition-colors w-40 truncate"
                     value={u.groupId || ''}
                     onChange={(e) => handleTeamChange(u.id, e.target.value)}
                   >
                     <option value="">(Free Agent)</option>
                     {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                   </select>
                   <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500"><Users size={10}/></div>
                 </div>

                 <button 
                   onClick={() => handleDelete(u.id)} 
                   className="p-2 hover:bg-red-500/20 text-zinc-600 hover:text-red-500 rounded-lg transition-colors ml-2"
                   title="Delete User"
                 >
                   <Trash2 size={16}/>
                 </button>
              </div>
           </div>
         ))}
         {filteredUsers.length === 0 && <div className="text-center py-10 text-zinc-600 italic">No personnel found.</div>}
       </div>
    </div>
  );
};

// --- NAVIGATION & UI ---

const Navbar = ({ view, setView }) => {
  const { profile, logout } = useContext(AuthContext);
  return (
    <nav className="sticky top-0 z-50 bg-[#050505]/80 backdrop-blur-xl border-b border-white/5 animate-fade-in">
      <div className="max-w-[1800px] mx-auto px-6 h-20 flex items-center justify-between">
        <div className="flex items-center gap-8">
           <div className="text-2xl font-black uppercase tracking-tighter text-white cursor-pointer group" onClick={() => setView('lobby')}>
             Lenovo <span className="text-[#E2231A] group-hover:drop-shadow-[0_0_10px_rgba(226,35,26,0.8)] transition-all">Pulse</span>
           </div>
           
           <div className="hidden md:flex items-center gap-1 bg-white/5 p-1.5 rounded-full border border-white/5">
              <NavBtn active={view === 'lobby'} onClick={()=>setView('lobby')} icon={LayoutGrid} label="Lobby" />
              <NavBtn active={view === 'learning_hub'} onClick={()=>setView('learning_hub')} icon={BookOpen} label="Learning" />
              
              {/* Only Super User sees Admin & User Matrix */}
              {profile.role === 'super_user' && (
                <>
                  <NavBtn active={view === 'admin_dash'} onClick={()=>setView('admin_dash')} icon={Shield} label="Admin" />
                  <NavBtn active={view === 'user_mgmt'} onClick={()=>setView('user_mgmt')} icon={Settings} label="Users" />
                </>
              )}
              
              {profile.groupId && <NavBtn active={view === 'team_dash'} onClick={()=>setView('team_dash')} icon={Users} label="My Team" />}
           </div>
        </div>
        {/* ... User profile section ... */}
        <div className="flex items-center gap-6">
           <div className="text-right hidden md:block">
             <div className="text-sm font-bold text-white">{profile.name}</div>
             <div className="text-[10px] uppercase text-[#E2231A] tracking-widest font-bold">{profile.role.replace('_', ' ')}</div>
           </div>
           <Button variant="ghost" onClick={logout} className="text-zinc-500 hover:text-white hover:bg-white/10"><LogOut size={20}/></Button>
        </div>
      </div>
    </nav>
  );
};

const NavBtn = ({ active, onClick, icon: Icon, label }) => (
  <button onClick={onClick} className={cn("flex items-center gap-2 px-5 py-2 rounded-full text-xs font-bold uppercase transition-all duration-300", active ? "bg-[#E2231A] text-white shadow-lg shadow-red-900/30" : "text-zinc-400 hover:text-white hover:bg-white/5")}>
    <Icon size={14} /> {label}
  </button>
);

const RequestJoinButton = ({ teamId, userId, userName }) => {
  const [sent, setSent] = useState(false);
  const { showToast } = useContext(ToastContext);
  const handleReq = async () => {
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'requests'), {
      userId, userName, groupId: teamId, status: 'pending', sentAt: serverTimestamp()
    });
    setSent(true);
    showToast("Request Transmitted to Team Manager");
  };
  if (sent) return <span className="text-green-500 text-xs font-bold flex items-center gap-1 animate-fade-in"><CheckCircle size={14}/> Request Pending</span>;
  return <Button size="sm" onClick={handleReq} className="animate-fade-in">Request Access</Button>;
};

const Card = ({ title, icon: Icon, children, action, className, count }) => (
  // PHASE 1 FIX: Removed 'overflow-hidden' so tooltips can extend outside
  // Added specific rounded classes to the red accent line instead
  <div className={cn("glass-card rounded-2xl p-6 shadow-xl relative group hover:shadow-[0_0_40px_rgba(0,0,0,0.6)] hover:border-white/10 transition-all duration-500 ease-out", className)}>
    <div className="absolute top-0 left-0 w-1 h-full bg-[#E2231A] rounded-tl-2xl rounded-bl-2xl opacity-60 group-hover:opacity-100 transition-opacity"></div>
    {(title || action) && (
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          {Icon && <div className="p-2.5 bg-white/5 rounded-lg text-[#E2231A] group-hover:scale-110 group-hover:bg-[#E2231A]/10 transition-all duration-300"><Icon size={20}/></div>}
          <h3 className="text-xl font-bold text-white uppercase tracking-tight">{title}</h3>
          {count !== undefined && <span className="bg-[#E2231A] text-white text-[10px] px-2 py-0.5 rounded-full font-bold shadow-lg shadow-red-900/40">{count}</span>}
        </div>
        {action}
      </div>
    )}
    {children}
  </div>
);

const Button = ({ children, variant='primary', size='md', fullWidth, className, ...props }) => {
  const variants = {
    primary: "bg-gradient-to-r from-[#E2231A] to-[#D91E15] hover:from-[#ff2f26] hover:to-[#E2231A] text-white shadow-[0_0_20px_rgba(226,35,26,0.3)] hover:shadow-[0_0_35px_rgba(226,35,26,0.6)] border border-transparent hover:-translate-y-0.5",
    secondary: "bg-white/5 hover:bg-white/10 text-white border border-white/5 hover:border-white/20 backdrop-blur-md",
    outline: "bg-transparent border border-[#E2231A] text-[#E2231A] hover:bg-[#E2231A] hover:text-white shadow-[0_0_10px_rgba(226,35,26,0.1)] hover:shadow-[0_0_20px_rgba(226,35,26,0.4)]",
    ghost: "bg-transparent hover:bg-white/5 text-zinc-400 hover:text-white",
    success: "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20 hover:-translate-y-0.5",
    danger: "bg-red-950/30 text-red-400 border border-red-900/50 hover:bg-red-900/50 hover:text-white hover:border-red-500"
  };
  const sizes = { xs: "text-[10px] px-2 py-1", sm: "text-xs px-4 py-2", md: "text-sm px-6 py-3" };
  return (
    <button className={cn("rounded-lg font-bold uppercase tracking-wide transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95", variants[variant], sizes[size], fullWidth && "w-full", className)} {...props}>
      {children}
    </button>
  );
};

const Input = ({ label, icon: Icon, className, ...props }) => (
  <div className={cn("space-y-2", className)}>
    {label && <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">{label}</label>}
    <div className="relative group">
      {Icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-white transition-colors"><Icon size={16}/></div>}
      <input className={cn("w-full bg-black/40 border border-white/10 rounded-lg p-3 text-sm text-white focus:border-[#E2231A] focus:bg-black/60 outline-none transition-all duration-300 placeholder:text-zinc-700", Icon && "pl-10")} {...props} />
    </div>
  </div>
);
