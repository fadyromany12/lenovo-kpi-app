import React, { useState, useEffect, useMemo, createContext, useContext, useCallback } from 'react';
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
  writeBatch
} from 'firebase/firestore';
import { 
  Trophy, Users, Settings, UserPlus, LogOut, CheckCircle, XCircle, Plus, 
  Save, Medal, Activity, Search, Crown, AlertTriangle, Loader, 
  ArrowUpRight, Eye, Edit3, Shield, LayoutGrid, Mail, Upload, FileSpreadsheet, 
  TrendingUp, TrendingDown, Target, Lock, ChevronRight, BarChart3, Calculator,
  Info, Zap, Sparkles
} from 'lucide-react';

// --- STYLES & ANIMATIONS ---
const GlobalStyles = () => (
  <style>{`
    /* UPDATED LAYOUT STYLES */
    html, body {
      width: 100%;
      min-height: 100vh; /* Allow scroll */
      margin: 0;
      padding: 0;
      background-color: #050505;
      overflow-x: hidden;
    }
    #root {
      min-height: 100vh;
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
    
    .glass-panel { background: rgba(24, 24, 27, 0.6); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.08); }
    .glass-card { background: linear-gradient(145deg, rgba(32,32,35,0.6) 0%, rgba(20,20,22,0.8) 100%); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.05); }
    
    .hover-glow:hover { box-shadow: 0 0 15px rgba(226,35,26,0.3); border-color: rgba(226,35,26,0.5); }
    
    /* Scrollbar */
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: #09090b; }
    ::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: #E2231A; }
  `}</style>
);

// --- CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyBiPHLP6Wx2JBJocWxbN7vc8TRmHfLHAIA",
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
  // --- CORE KPIS ---
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
  
  // --- ADHERENCE & ATTENDANCE ---
  { 
    id: 'att_absent', 
    name: 'Attendance (Sick/Emergency)', 
    category: 'Adherence & Attendance',
    weight: 15, 
    target: 0, 
    type: 'percent', 
    direction: 'lower', 
    note: 'Gate System',
    gates: [
      { threshold: 4.55, multiplier: 1.0, label: 'Approved (100%)' },
      { threshold: 9.09, multiplier: 0.5, label: 'Warning (50%)' },
      { threshold: 100, multiplier: 0.0, label: 'Failed (0%)' } // Anything above 9.09 hits this
    ]
  },
  { 
    id: 'adh_login', 
    name: 'Login/Out Adherence', 
    category: 'Adherence & Attendance',
    weight: 5, // Split 10% between these two
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
const calculateScore = (actual, target, direction, weight, gates) => {
  const act = parseFloat(actual);
  if (isNaN(act)) return 0;

  // 1. Check Gates (Gateway Logic)
  if (gates && gates.length > 0) {
    const sortedGates = [...gates].sort((a, b) => a.threshold - b.threshold);
    let multiplier = 0; // Default to 0 (fail) if no gate matches
    
    // Find the range the actual value falls into
    for (const gate of sortedGates) {
      if (act <= gate.threshold) {
        multiplier = gate.multiplier;
        break; 
      }
    }
    return weight * multiplier;
  }

  // 2. Standard Calculation
  const tgt = parseFloat(target) || 1; 
  let scorePct = 0;
  
  if (direction === 'higher') {
    scorePct = (act / tgt) * 100;
  } else { 
    if (act === 0) scorePct = 120; 
    else scorePct = (tgt / act) * 100; 
  }

  return (Math.min(scorePct, 150) / 100) * weight;
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

  useEffect(() => {
    if (configError) return; // Don't try auth if config failed

    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth Init Failed:", err);
        setLoading(false); // Stop loading so we can show error screen
      }
    };
    initAuth();
    return onAuthStateChanged(auth, (u) => { setUser(u); if (!u) setLoading(false); });
  }, []);

  useEffect(() => {
    if (!user) return;
    const storedEmail = localStorage.getItem('lenovo_user_email');
    if (!storedEmail && !profile) { setLoading(false); return; }
    const emailToQuery = storedEmail || profile?.email;
    if (!emailToQuery) { setLoading(false); return; }

    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'users'), where('email', '==', emailToQuery));
    const unsubscribe = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const docData = snap.docs[0];
        setProfile({ id: docData.id, ...docData.data() });
        localStorage.setItem('lenovo_user_email', emailToQuery);
      } else {
        localStorage.removeItem('lenovo_user_email');
        setProfile(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  const login = async (email, role, secret) => {
    setLoading(true);
    if (role === 'super_user' && secret !== ADMIN_SECRET) {
      showToast("Access Denied: Invalid Secret", "error");
      setLoading(false); return;
    }

    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'users'), where('email', '==', email));
    const snap = await getDocs(q);

    if (!snap.empty) {
      const existing = snap.docs[0].data();
      if (role === 'super_user' && existing.role !== 'super_user') {
         await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', snap.docs[0].id), { role: 'super_user' });
      }
      localStorage.setItem('lenovo_user_email', email);
    } else {
      const name = parseNameFromEmail(email);
      // FIXED: Manager role is now granted immediately so they can see the 'Create Team' UI
      const finalRole = role; 
      
      const newRef = doc(collection(db, 'artifacts', appId, 'public', 'data', 'users'));
      await setDoc(newRef, { name, email, role: finalRole, joinedAt: serverTimestamp(), groupId: null });

      localStorage.setItem('lenovo_user_email', email);
    }
  };

  const logout = () => { localStorage.removeItem('lenovo_user_email'); setProfile(null); setLoading(false); };
  return ( <AuthContext.Provider value={{ user, profile, loading, login, logout }}>{children}</AuthContext.Provider> );
};

// --- APP ---

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

const MainLayout = () => {
  const { profile, loading } = useContext(AuthContext);
  const [view, setView] = useState('lobby');

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
      <div className="min-h-screen bg-[#050505] text-zinc-100 font-sans selection:bg-[#E2231A] selection:text-white w-full h-full">
        {/* Ambient Background */}
        <div className="fixed inset-0 pointer-events-none z-0">
           <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-[#E2231A] rounded-full blur-[150px] opacity-[0.08] animate-pulse"></div>
           <div className="absolute bottom-[-20%] left-[-10%] w-[800px] h-[800px] bg-blue-900 rounded-full blur-[150px] opacity-[0.06]"></div>
           <div className="absolute top-[20%] left-[20%] w-[400px] h-[400px] bg-purple-900 rounded-full blur-[120px] opacity-[0.05]"></div>
        </div>

        <Navbar view={view} setView={setView} />
        <main className="w-full max-w-[1600px] mx-auto px-4 md:px-12 py-8 relative z-10 animate-fade-in flex flex-col gap-6 flex-1">
          {view === 'admin_dash' && <AdminDashboard />}
          {view === 'lobby' && <LobbyView setView={setView} />}
          {view === 'create_team' && <CreateTeamView setView={setView} />}
          {view === 'team_dash' && <TeamDashboard />}
        </main>
      </div>
    </DataContextWrapper>
  );
};

const DataContextWrapper = ({ children, view, setView }) => {
  const { profile } = useContext(AuthContext);
  const [activeTeamId, setActiveTeamId] = useState(null);
  const [teams, setTeams] = useState([]);
  const [members, setMembers] = useState([]);
  const [performance, setPerformance] = useState({});
  
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'groups'), (snap) => {
      setTeams(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (profile?.groupId && view === 'team_dash') setActiveTeamId(profile.groupId);
    else if (view.startsWith('team_view_')) setActiveTeamId(view.replace('team_view_', ''));
    else setActiveTeamId(null);
  }, [profile, view]);

  useEffect(() => {
    if (!activeTeamId) { setMembers([]); setPerformance({}); return; }
    const unsubMembers = onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'users'), where('groupId', '==', activeTeamId)), (snap) => {
      setMembers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubPerf = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'groups', activeTeamId, 'performance'), (snap) => {
      const p = {}; snap.docs.forEach(d => p[d.id] = d.data()); setPerformance(p);
    });
    return () => { unsubMembers(); unsubPerf(); };
  }, [activeTeamId]);

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
                placeholder="user@lenovo.com"
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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
  const handleCreate = async () => {
    if (!name) return;
    const ref = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'groups'), {
      name, managerId: profile.id, kpis: DEFAULT_KPIS, awards: DEFAULT_AWARDS, createdAt: serverTimestamp()
    });
    if (profile.role === 'manager') await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', profile.id), { groupId: ref.id });
    setView('team_dash');
  };
  return (
    <div className="flex justify-center py-20 animate-slide-up">
      <Card title="Establish New Team" className="max-w-md w-full">
        <div className="space-y-6">
          <Input label="Team Identity" value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Alpha Squad" autoFocus />
          <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
             <Button variant="ghost" onClick={()=>setView('lobby')}>Abort</Button>
             <Button onClick={handleCreate}>Initialize Team</Button>
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
  <div className="relative group inline-block ml-2 translate-y-0.5 z-10">
    <Info size={14} className="text-zinc-500 hover:text-[#E2231A] cursor-help transition-colors" />
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-zinc-900 border border-white/10 p-2 rounded text-[10px] text-zinc-300 shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
      {text}
      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-zinc-900 border-r border-b border-white/10 rotate-45"></div>
    </div>
  </div>
);

const TeamDashboard = () => {
  const { activeTeamId, members, performance, teams } = useContext(DataContext);
  const { profile } = useContext(AuthContext);
  const { showToast } = useContext(ToastContext);
  const [requests, setRequests] = useState([]);
  const [history, setHistory] = useState([]); // Stores archived months
  
  const activeTeam = teams.find(t => t.id === activeTeamId);
  const isManager = (profile.role === 'manager' && profile.groupId === activeTeamId) || profile.role === 'super_user';
  const isObserver = !isManager && profile.groupId !== activeTeamId;

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
      activeTeam.kpis.forEach(k => {
        total += calculateScore(p.actuals?.[k.id], k.target, k.direction, k.weight, k.gates);
      });
      
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
           </div>
           <h2 className="text-5xl font-black text-white uppercase tracking-tighter drop-shadow-2xl">{activeTeam.name}</h2>
        </div>
        
        <div className="flex gap-3">
          {isManager && (
            <Button variant="outline" onClick={handleArchiveMonth} title="Finalize Month & Distribute XP">
              <Save size={16} /> Archive Period
            </Button>
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
             <KPIConfigurator team={activeTeam} />
           </div>
        )}

        <div className={cn("space-y-8", isManager ? "xl:col-span-3" : "xl:col-span-4")}>
          <PerformanceMatrix members={members} kpis={activeTeam.kpis || []} data={performance} isManager={isManager} teamId={activeTeam.id} awardsList={activeTeam.awards || []} />
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

// --- DATA COMPONENTS ---

const PerformanceMatrix = ({ members, kpis, data, isManager, teamId, awardsList }) => {
  const { showToast } = useContext(ToastContext);

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
        const weighted = calculateScore(val, k.target, k.direction, k.weight, k.gates);
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

  const toggleAward = async (userId, award) => {
    const current = data[userId] || { actuals: {}, awards: [] };
    const has = current.awards?.includes(award);
    const newAwards = has ? current.awards.filter(a => a !== award) : [...(current.awards||[]), award];
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'groups', teamId, 'performance', userId), { ...current, awards: newAwards }, { merge: true });
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
    <Card 
      title="Performance Matrix" 
      icon={Activity} 
      className="min-h-[500px]" // FIXED: Added min-height for better default size
      action={
        <div className="flex items-center gap-3">
          <InfoTooltip text="Input monthly actuals here. Scores update automatically based on logic. Import CSV for bulk updates." />
          {isManager && (
            <label className="cursor-pointer bg-zinc-800 hover:bg-[#E2231A] hover:text-white text-xs px-4 py-2 rounded-lg flex items-center gap-2 border border-white/10 transition-all shadow-lg">
              <Upload size={14} /> Import CSV
              <input type="file" accept=".csv" className="hidden" onChange={handleCSVUpload} />
            </label>
          )}
        </div>
      }
    >
      <div className="overflow-x-auto pb-12"> {/* Added padding bottom for dropdown space */}
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-[10px] uppercase text-zinc-500 bg-[#0c0c0e] border-b border-white/5">
              <th className="p-4 bg-[#0c0c0e] sticky left-0 z-20 w-56"></th>
              {kpiStructure.map(([category, catKpis]) => (
                <th key={category} colSpan={catKpis.length} className="p-2 text-center border-l border-white/10 bg-[#151518] text-[#E2231A] font-black tracking-widest">
                  {category}
                </th>
              ))}
              <th className="bg-[#0c0c0e]"></th>
              <th className="bg-[#0c0c0e]"></th>
            </tr>
            <tr className="text-[9px] uppercase text-zinc-400 bg-[#0c0c0e] border-b border-white/10">
              <th className="p-4 font-bold sticky left-0 bg-[#0c0c0e] z-20 shadow-[5px_0_20px_rgba(0,0,0,0.5)]">Agent Detail</th>
              {kpiStructure.flatMap(([_, catKpis]) => catKpis).map(k => (
                <th key={k.id} className="p-3 text-center min-w-[120px] border-l border-white/5 relative group/header">
                  <div className="font-bold text-zinc-200">{k.name}</div>
                  <div className="mt-1 opacity-60 flex justify-center gap-1">
                     <span className="bg-white/5 px-1 rounded">{k.weight}%</span>
                     <span className="bg-white/5 px-1 rounded">Target: {k.target}</span>
                  </div>
                  {k.gates && (
                    <div className="absolute top-full left-0 w-full bg-zinc-900 border border-white/20 p-2 z-50 hidden group-hover/header:block text-left shadow-xl rounded-b">
                      <div className="text-[9px] text-[#E2231A] font-bold mb-1">GATEWAY LOGIC:</div>
                      {k.gates.map((g, i) => (
                        <div key={i} className="text-[9px] text-zinc-400 flex justify-between">
                          <span>&le; {g.threshold}:</span>
                          <span className="text-white">{g.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </th>
              ))}
              <th className="p-3 text-center text-[#E2231A] font-black text-xs border-l border-white/10">Total Score</th>
              <th className="p-3 text-center w-24 border-l border-white/10">Actions</th>            
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={row.id} style={{ animationDelay: `${idx * 50}ms` }} className="border-b border-white/5 hover:bg-white/5 transition-colors group animate-slide-up">
                <td className="p-4 sticky left-0 bg-[#09090b] group-hover:bg-[#1a1a1c] transition-colors z-20 border-r border-white/5 shadow-[5px_0_20px_rgba(0,0,0,0.5)]">
                  <div className="flex items-center gap-3">
                    {(() => {
                       const lvl = getAgentLevel(row.lifetimeXP);
                       const rank = getAgentRank(lvl);
                       return (
                         <div className={cn("w-10 h-10 rounded-lg flex flex-col items-center justify-center border transition-colors relative overflow-hidden", rank.bg, rank.border)}>
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
                {row.kpiResults.map(res => (
                  <td key={res.id} className="p-3 text-center align-middle relative border-l border-white/5">
                    {isManager ? (
                      <input 
                        type="number" 
                        value={res.val || ''}
                        onChange={(e) => updateScore(row.id, res.id, e.target.value)}
                        className={cn(
                          "bg-black/40 border w-20 text-center text-xs p-2 rounded outline-none transition-all focus:scale-105",
                          res.weighted === 0 && res.val ? "border-red-500 text-red-500" : "border-white/10 text-white focus:border-[#E2231A]"
                        )}
                        placeholder="-"
                      />
                    ) : (
                      <span className={cn("font-mono text-sm font-bold", res.weighted === 0 && res.val ? "text-red-500" : "text-white")}>
                        {res.val || '-'}
                      </span>
                    )}
                    {res.val && (
                      <div className="absolute bottom-2 left-4 right-4 h-0.5 bg-zinc-800 rounded-full overflow-hidden">
                         <div className={cn("h-full transition-all duration-1000", res.weighted >= (res.weight * 0.9) ? "bg-green-500" : "bg-[#E2231A]")} style={{ width: `${Math.min((res.weighted/res.weight)*100, 100)}%` }}></div>
                      </div>
                    )}
                  </td>
                ))}
                <td className="p-3 text-center font-black text-xl text-white group-hover:scale-110 transition-transform origin-center border-l border-white/10">
                  <span className={cn(row.totalScore >= 100 ? "text-[#E2231A] drop-shadow-[0_0_10px_rgba(226,35,26,0.5)]" : "text-white")}>
                    {row.totalScore.toFixed(1)}%
                  </span>
                </td>
                
                {/* FIXED ACTIONS CELL */}
                <td className="p-3 text-center border-l border-white/10 relative">
                   <div className="flex items-center justify-center gap-2">
                      {/* PDF Button - No group wrapper here */}
                      <button 
                        onClick={() => generateAgentReport(row, kpis, row.kpiResults, row.totalScore, row.awards, teamId)}
                        className="p-2 bg-white/5 hover:bg-[#E2231A] hover:text-white rounded-full text-zinc-400 transition-all z-10"
                        title="Download PDF"
                      >
                        <FileSpreadsheet size={16}/>
                      </button>

                      {/* Manager Menu - ISOLATED GROUP WRAPPER */}
                      {isManager && (
                        <div className="relative group/menu">
                           <button className="p-2 bg-white/5 hover:bg-yellow-500/20 hover:text-yellow-500 rounded-full text-zinc-400 transition-all"><Crown size={16}/></button>
                           
                           {/* Popup */}
                           <div className="absolute right-0 top-full mt-2 bg-[#0c0c0e] border border-white/10 rounded-xl p-2 shadow-2xl z-50 opacity-0 group-hover/menu:opacity-100 pointer-events-none group-hover/menu:pointer-events-auto transition-all min-w-[200px] text-left">
                              <div className="text-[10px] uppercase text-zinc-500 font-bold px-2 py-1 mb-1">Assign Recognition</div>
                              {awardsList.map(a => (
                                <button key={a} onClick={() => toggleAward(row.id, a)} className={cn("flex items-center justify-between w-full text-left text-xs p-2 rounded hover:bg-white/5 transition-colors", row.awards.includes(a) ? "text-yellow-500 font-bold" : "text-zinc-400")}>
                                  {a} {row.awards.includes(a) && <CheckCircle size={12}/>}
                                </button>
                              ))}
                           </div>
                        </div>
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
  );
};

const KPIConfigurator = ({ team }) => {
  const [editing, setEditing] = useState(false);
  const [kpis, setKpis] = useState(team.kpis || []);
  const { showToast } = useContext(ToastContext);

  const save = async () => {
    const total = kpis.reduce((sum, k) => sum + parseFloat(k.weight || 0), 0);
    if (Math.round(total) !== 100) { showToast(`Weights must equal 100%. Current: ${total}%`, 'error'); return; }
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'groups', team.id), { kpis });
    setEditing(false);
    showToast("KPI Logic Updated Successfully");
  };
  const update = (idx, field, val) => { const n = [...kpis]; n[idx][field] = val; setKpis(n); };

  if (!editing) return (
    <Card 
      title="KPI Logic Engine" 
      icon={Settings} 
      action={<Button size="xs" variant="ghost" onClick={()=>setEditing(true)}><Edit3 size={14}/></Button>}
    >
      <div className="flex flex-col gap-2">
         {team.kpis?.map(k => (
           <div key={k.id} className="flex items-center justify-between bg-white/5 border border-white/5 px-3 py-2 rounded text-xs hover:border-[#E2231A]/40 transition-colors">
              <div>
                <span className="block font-bold text-[#E2231A]">{k.name}</span>
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider">{k.category || 'Core'}</span>
              </div>
              <div className="text-right">
                <span className="text-white font-bold">{k.weight}%</span>
                <span className="text-zinc-500 block text-[9px]">Target: {k.target}</span>
              </div>
           </div>
         ))}
      </div>
    </Card>
  );

  return (
    <Card title="Configure KPI Engine">
      <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
        {kpis.map((k, i) => (
          <div key={i} className="bg-white/5 p-3 rounded border border-white/5 space-y-3 animate-fade-in relative group">
             <div className="flex gap-2">
                <Input label="Name" value={k.name} onChange={e=>update(i,'name',e.target.value)} />
                <div className="w-24"><Input label="Weight %" type="number" value={k.weight} onChange={e=>update(i,'weight',parseFloat(e.target.value))} /></div>
             </div>
             
             {/* ADDED CATEGORY INPUT */}
             <Input label="Category Group" value={k.category || ''} onChange={e=>update(i,'category',e.target.value)} placeholder="e.g. Core KPIs" />

             <div className="grid grid-cols-2 gap-2">
               <Input type="number" label="Target" value={k.target} onChange={e=>update(i,'target',parseFloat(e.target.value))} />
               <div className="flex flex-col gap-2">
                 <label className="text-[10px] uppercase font-bold text-zinc-500">Direction</label>
                 <select value={k.direction} onChange={e=>update(i,'direction',e.target.value)} className="bg-black/50 border border-white/10 text-white text-xs p-3 rounded-lg focus:border-[#E2231A] outline-none w-full">
                   <option value="higher">Higher is Better</option>
                   <option value="lower">Lower is Better</option>
                 </select>
               </div>
             </div>
             
             {/* GATE INDICATOR */}
             {k.gates && k.gates.length > 0 && (
               <div className="bg-red-900/20 border border-red-500/20 p-2 rounded flex items-center gap-2">
                 <AlertTriangle size={12} className="text-[#E2231A]"/>
                 <span className="text-[10px] text-red-200">Active Gateways: {k.gates.length} rules applied.</span>
               </div>
             )}
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-white/10">
        <Button variant="ghost" size="sm" onClick={()=>{setEditing(false); setKpis(team.kpis);}}>Cancel</Button>
        <Button size="sm" onClick={save}>Apply Configuration</Button>
      </div>
    </Card>
  );
};


const Leaderboard = ({ members, kpis, data }) => {
  const ranked = useMemo(() => {
    return members.map(m => {
      const p = data[m.id] || { actuals: {} };
      let total = 0;
      kpis.forEach(k => { total += calculateScore(p.actuals?.[k.id], k.target, k.direction, k.weight, k.gates); });      return { ...m, total };
    }).sort((a,b) => b.total - a.total).slice(0, 5);
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
              {profile.role === 'super_user' && <NavBtn active={view === 'admin_dash'} onClick={()=>setView('admin_dash')} icon={Shield} label="Admin" />}
              {profile.groupId && <NavBtn active={view === 'team_dash'} onClick={()=>setView('team_dash')} icon={Users} label="My Team" />}
           </div>
        </div>
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
  <div className={cn("glass-card rounded-2xl p-6 shadow-xl relative overflow-hidden group hover:shadow-[0_0_30px_rgba(0,0,0,0.5)] transition-all duration-500", className)}>
    <div className="absolute top-0 left-0 w-1 h-full bg-[#E2231A] opacity-60 group-hover:opacity-100 transition-opacity"></div>
    {(title || action) && (
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          {Icon && <div className="p-2.5 bg-white/5 rounded-lg text-[#E2231A] group-hover:scale-110 transition-transform"><Icon size={20}/></div>}
          <h3 className="text-xl font-bold text-white uppercase tracking-tight">{title}</h3>
          {count !== undefined && <span className="bg-[#E2231A] text-white text-[10px] px-2 py-0.5 rounded-full font-bold shadow-lg">{count}</span>}
        </div>
        {action}
      </div>
    )}
    {children}
  </div>
);

const Button = ({ children, variant='primary', size='md', fullWidth, className, ...props }) => {
  const variants = {
    primary: "bg-[#E2231A] hover:bg-[#ff2f26] text-white shadow-[0_0_20px_rgba(226,35,26,0.2)] hover:shadow-[0_0_30px_rgba(226,35,26,0.4)] border border-transparent",
    secondary: "bg-white/10 hover:bg-white/20 text-white border border-transparent",
    outline: "bg-transparent border border-[#E2231A] text-[#E2231A] hover:bg-[#E2231A] hover:text-white",
    ghost: "bg-transparent hover:bg-white/5 text-zinc-400 hover:text-white",
    success: "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20",
    danger: "bg-red-950/50 text-red-400 border border-red-900/50 hover:bg-red-900/50 hover:text-white"
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
