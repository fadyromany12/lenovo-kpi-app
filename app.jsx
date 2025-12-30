import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged, 
  updateProfile,
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
  orderBy,
  getDocs
} from 'firebase/firestore';
import { 
  Trophy, 
  Users, 
  Settings, 
  UserPlus, 
  LogOut, 
  CheckCircle, 
  XCircle, 
  Plus,
  Save,
  Medal,
  Activity,
  Search,
  Crown,
  AlertTriangle,
  Loader,
  ArrowUpRight,
  ArrowDownRight,
  Eye,
  Edit3,
  Shield,
  LayoutGrid,
  Mail,
  Download,
  FileSpreadsheet,
  TrendingUp,
  TrendingDown,
  Target
} from 'lucide-react';

// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyBiPHLP6Wx2JBJocWxbN7vc8TRmHfLHAIA",
  authDomain: "lenovo-kpi-app.firebaseapp.com",
  projectId: "lenovo-kpi-app",
  storageBucket: "lenovo-kpi-app.firebasestorage.app",
  messagingSenderId: "195262557870",
  appId: "1:195262557870:web:10424e6d20e124eb1dc73f",
  measurementId: "G-DXX4K24CBG"
};

const appId = "lenovo-v3"; 
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- Constants & Defaults ---
const ADMIN_SECRET = "lenovo2025"; 

// Updated Lenovo KPIs
const DEFAULT_KPIS = [
  { id: 'rev', name: 'Revenue Target', weight: 50, target: 10000, type: 'value', direction: 'higher', note: 'Client Shared Target' },
  { id: 'att', name: 'Adherence & Attendance', weight: 25, target: 95, type: 'percent', direction: 'higher', note: 'Check Table' },
  { id: 'conv', name: 'Customer Acceptance', weight: 15, target: 15, type: 'percent', direction: 'higher', note: 'Conversion Rate' },
  { id: 'qual', name: 'Quality & Escalation', weight: 10, target: 8, type: 'count', direction: 'higher', note: '8 contacts/mo' },
];

// Updated Lenovo Awards
const DEFAULT_AWARDS = [
  'Client Champion', 
  'Sales Star of the Month', 
  'Customer Delight Award', 
  'Team Spirit Award', 
  'Rising Performer'
];

// --- Helper Functions ---

const parseNameFromEmail = (email) => {
  if (!email) return '';
  const cleanEmail = email.toLowerCase().trim();
  if (cleanEmail.includes('@')) {
    const localPart = cleanEmail.split('@')[0];
    const parts = localPart.split('.');
    const firstName = parts[0] ? parts[0].charAt(0).toUpperCase() + parts[0].slice(1) : '';
    const lastName = parts[1] ? parts[1].charAt(0).toUpperCase() + parts[1].slice(1) : '';
    return `${firstName} ${lastName}`.trim() || localPart;
  }
  return email; 
};

// KPI Engine Calculation
const calculateKpiScore = (actual, target, direction, type) => {
  const act = parseFloat(actual);
  const tgt = parseFloat(target) || 1; 
  
  if (isNaN(act)) return 0;

  let scorePct = 0;

  if (direction === 'higher') {
    // Higher is better: (Actual / Target) * 100
    scorePct = (act / tgt) * 100;
  } else {
    // Lower is better (e.g. AHT): (Target / Actual) * 100
    if (act === 0) return 100; // Avoid infinity, assume perfect
    scorePct = (tgt / act) * 100;
  }

  // Cap score at 150% for robustness
  return Math.min(scorePct, 150);
};

// --- Components ---

const Button = ({ children, onClick, variant = 'primary', className = '', disabled = false, size = 'md' }) => {
  const sizes = { sm: "px-2 py-1 text-xs", md: "px-4 py-2 text-sm", lg: "px-6 py-3 text-base" };
  const variants = {
    primary: "bg-[#E2231A] hover:bg-[#c11c14] text-white shadow-[0_0_15px_rgba(226,35,26,0.3)]",
    secondary: "bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700",
    outline: "bg-transparent border border-[#E2231A] text-[#E2231A] hover:bg-[#E2231A] hover:text-white",
    ghost: "bg-transparent text-gray-400 hover:text-white hover:bg-white/5",
    success: "bg-emerald-600 hover:bg-emerald-700 text-white",
    danger: "bg-red-900/20 text-red-500 border border-red-900 hover:bg-red-900/40"
  };
  
  return (
    <button 
      onClick={onClick} 
      disabled={disabled}
      className={`rounded-sm font-bold transition-all duration-300 flex items-center justify-center gap-2 uppercase tracking-wide ${sizes[size]} ${variants[variant]} ${disabled ? 'opacity-50 cursor-not-allowed grayscale' : ''} ${className}`}
    >
      {children}
    </button>
  );
};

const Input = ({ label, value, onChange, placeholder, type = "text", className = "", icon: Icon }) => (
  <div className={`flex flex-col gap-1 w-full ${className}`}>
    {label && <label className="text-[10px] text-gray-400 uppercase tracking-widest font-bold ml-1">{label}</label>}
    <div className="relative">
      {Icon && <div className="absolute left-3 top-2.5 text-gray-500"><Icon size={16}/></div>}
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`bg-black/40 border border-white/10 text-white px-3 py-2 rounded-sm focus:outline-none focus:border-[#E2231A] focus:ring-1 focus:ring-[#E2231A] transition-all placeholder-white/20 backdrop-blur-sm w-full ${Icon ? 'pl-9' : ''}`}
      />
    </div>
  </div>
);

const Card = ({ children, title, icon: Icon, className = "", action }) => (
  <div className={`bg-[#121212]/80 backdrop-blur-md border border-white/5 rounded-lg p-6 shadow-2xl relative overflow-hidden group ${className}`}>
    <div className="absolute top-0 left-0 w-1 h-full bg-[#E2231A] opacity-50 group-hover:opacity-100 transition-opacity"></div>
    {(title || action) && (
      <div className="flex items-center justify-between mb-6 border-b border-white/5 pb-4">
        <div className="flex items-center gap-3">
          {Icon && <div className="p-2 bg-white/5 rounded-md text-[#E2231A]"><Icon size={20} /></div>}
          <h3 className="text-xl font-bold text-white uppercase tracking-wider">{title}</h3>
        </div>
        {action}
      </div>
    )}
    {children}
  </div>
);

// --- Main App Logic ---

export default function App() {
  const [user, setUser] = useState(null); 
  const [activeUserId, setActiveUserId] = useState(null); 
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [allGroups, setAllGroups] = useState([]);
  const [myGroup, setMyGroup] = useState(null);
  const [viewMode, setViewMode] = useState('lobby'); 
  const [managerRequests, setManagerRequests] = useState([]); 
  const [groupRequests, setGroupRequests] = useState([]); 
  const [groupMembers, setGroupMembers] = useState([]);
  const [performanceData, setPerformanceData] = useState({});

  // Auth Persistence & Init
  useEffect(() => {
    const initAuth = async () => {
      await signInAnonymously(auth);
    };
    initAuth();
    
    // Auto-restore session
    const savedEmail = localStorage.getItem('lenovo_user_email');
    if (savedEmail) {
      handleSmartLogin(savedEmail, null, true);
    } else {
      setLoading(false);
    }

    return onAuthStateChanged(auth, u => {
      setUser(u);
    });
  }, []);

  // Sync: User Profile
  useEffect(() => {
    if (!activeUserId) return;
    setLoading(true);
    const unsub = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'users', activeUserId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setUserProfile({ ...data, id: snap.id });
        
        // Auto-navigate logic
        if (data.role === 'admin' && viewMode === 'lobby') setViewMode('admin');
        else if (data.groupId && viewMode === 'lobby') setViewMode('team');
      } else {
        handleLogout();
      }
      setLoading(false);
    });
    return () => unsub();
  }, [activeUserId]);

  // Sync: Lobby Data
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'groups'), (snap) => {
      setAllGroups(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  // Sync: Admin Data
  useEffect(() => {
    if (userProfile?.role !== 'admin') return;
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'manager_requests'), where('status', '==', 'pending'));
    const unsub = onSnapshot(q, (snap) => {
      setManagerRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [userProfile]);

  // Sync: Active Group Data
  useEffect(() => {
    let targetGroupId = null;

    if (viewMode === 'team' && userProfile?.groupId) {
      targetGroupId = userProfile.groupId;
    } else if (viewMode !== 'lobby' && viewMode !== 'admin' && viewMode !== 'create_group') {
      targetGroupId = viewMode; // viewMode holds groupId when clicking from lobby
    }
    
    if (!targetGroupId) {
      setMyGroup(null);
      return;
    }

    const unsubGroup = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'groups', targetGroupId), (snap) => {
      if (snap.exists()) setMyGroup({ id: snap.id, ...snap.data() });
    });

    const unsubMembers = onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'users'), where('groupId', '==', targetGroupId)), (snap) => {
      setGroupMembers(snap.docs.map(d => ({ uid: d.id, ...d.data() })));
    });

    const unsubPerf = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'groups', targetGroupId, 'performance'), (snap) => {
      const d = {};
      snap.docs.forEach(doc => d[doc.id] = doc.data());
      setPerformanceData(d);
    });

    // Join Requests (Manager/Admin only)
    let unsubReqs = () => {};
    const isManager = (userProfile?.role === 'manager' && userProfile?.groupId === targetGroupId) || userProfile?.role === 'admin';
    
    if (isManager) {
      unsubReqs = onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'requests'), where('groupId', '==', targetGroupId), where('status', '==', 'pending')), (snap) => {
        setGroupRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
    }

    return () => { unsubGroup(); unsubMembers(); unsubPerf(); unsubReqs(); };
  }, [viewMode, userProfile]);


  // --- Actions ---

  const handleSmartLogin = async (email, role, isAuto = false) => {
    setLoading(true);
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'users'), where('email', '==', email));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      // Restore Session
      const docData = querySnapshot.docs[0];
      setActiveUserId(docData.id);
      localStorage.setItem('lenovo_user_email', email);
    } else {
      if (isAuto) { setLoading(false); return; } // Failed auto-login
      
      if (role === 'admin') return; 
      
      // Register New User
      const newRef = doc(collection(db, 'artifacts', appId, 'public', 'data', 'users'));
      await setDoc(newRef, {
        name: parseNameFromEmail(email),
        email,
        role: role === 'manager' ? 'agent' : role, 
        joinedAt: serverTimestamp(),
        groupId: null
      });
      
      if (role === 'manager') {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'manager_requests'), {
          userId: newRef.id,
          name: parseNameFromEmail(email),
          email,
          status: 'pending',
          requestedAt: serverTimestamp()
        });
        alert("Manager request sent to Fady. You are logged in as Agent until approved.");
      }
      
      setActiveUserId(newRef.id);
      localStorage.setItem('lenovo_user_email', email);
    }
  };

  const handleAdminLogin = async (email, secret) => {
    if (secret !== ADMIN_SECRET) {
      alert("Invalid Access Code");
      return;
    }
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'users'), where('email', '==', email));
    const snap = await getDocs(q);
    
    let uid;
    if (!snap.empty) {
      uid = snap.docs[0].id;
      if (snap.docs[0].data().role !== 'admin') {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', uid), { role: 'admin' });
      }
    } else {
      const newRef = doc(collection(db, 'artifacts', appId, 'public', 'data', 'users'));
      await setDoc(newRef, {
        name: parseNameFromEmail(email),
        email,
        role: 'admin',
        joinedAt: serverTimestamp(),
        groupId: null
      });
      uid = newRef.id;
    }
    setActiveUserId(uid);
    localStorage.setItem('lenovo_user_email', email);
  };

  const createGroup = async (name) => {
    const ref = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'groups'), {
      name,
      managerId: activeUserId,
      kpis: DEFAULT_KPIS,
      awards: DEFAULT_AWARDS,
      createdAt: serverTimestamp()
    });
    // If manager, assign to group. If admin, just create (don't force admin into group)
    if (userProfile.role === 'manager') {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', activeUserId), { groupId: ref.id });
    }
    setViewMode('team'); // Navigate to new team
    if(userProfile.role === 'admin') setViewMode(ref.id);
  };

  const handleGroupRequest = async (req, action) => {
    if (action === 'approve') {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', req.userId), { groupId: req.groupId });
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'groups', req.groupId, 'performance', req.userId), { actuals: {}, awards: [] });
    }
    await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'requests', req.id));
  };

  const updateKpiConfig = async (newKpis, newAwards) => {
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'groups', myGroup.id), { kpis: newKpis, awards: newAwards });
  };

  const updatePerformance = async (agentId, kpiId, value) => {
    const current = performanceData[agentId] || { actuals: {}, awards: [] };
    const newActuals = { ...current.actuals, [kpiId]: value }; 
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'groups', myGroup.id, 'performance', agentId), {
      ...current,
      actuals: newActuals
    }, { merge: true });
  };

  const toggleAward = async (agentId, award) => {
    const current = performanceData[agentId] || { awards: [] };
    const hasIt = current.awards?.includes(award);
    const newAwards = hasIt ? current.awards.filter(a => a !== award) : [...(current.awards || []), award];
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'groups', myGroup.id, 'performance', agentId), {
      ...current,
      awards: newAwards
    }, { merge: true });
  };

  const handleLogout = () => {
    localStorage.removeItem('lenovo_user_email');
    setActiveUserId(null);
    setUserProfile(null);
    setPerformanceData({});
    setViewMode('lobby');
  };

  // --- Views ---

  if (loading) return <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center text-[#E2231A] gap-4"><Loader className="animate-spin" size={32} /><p className="tracking-widest uppercase text-xs font-bold">Lenovo Pulse Loading...</p></div>;
  
  if (!userProfile) return <WelcomeScreen onLogin={handleSmartLogin} onAdminLogin={handleAdminLogin} />;

  // Common Header
  const Header = () => (
    <header className="sticky top-0 z-50 bg-[#050505]/90 backdrop-blur-xl border-b border-white/5 w-full">
      <div className="w-full px-6 h-20 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => setViewMode(userProfile.role === 'admin' ? 'admin' : 'lobby')} className="!p-0 w-10 h-10 rounded-full border border-white/10">
             <LayoutGrid size={18} />
          </Button>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight leading-none text-white"><span className="text-[#E2231A]">Lenovo</span> Perform</h1>
            {myGroup && <p className="text-[10px] text-gray-500 uppercase tracking-[0.2em]">{myGroup.name}</p>}
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="hidden md:flex flex-col items-end">
            <span className="font-bold text-sm text-right text-white">{userProfile.name}</span>
            <span className="text-[10px] bg-white/10 px-2 rounded text-gray-400 uppercase">{userProfile.role}</span>
          </div>
          <Button variant="ghost" onClick={handleLogout}><LogOut size={18}/></Button>
        </div>
      </div>
    </header>
  );

  // 1. ADMIN DASHBOARD
  if (userProfile.role === 'admin' && viewMode === 'admin') {
    return (
      <div className="min-h-screen bg-[#050505] text-white w-full">
        <Header />
        <div className="p-8 w-full max-w-[1920px] mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-black uppercase text-[#E2231A] tracking-tighter">Super User <span className="text-white">Dashboard</span></h1>
            <Button onClick={() => setViewMode('create_group')}><Plus size={16} /> Create Team</Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card title="Manager Approvals" icon={UserPlus}>
              {managerRequests.length === 0 ? <p className="text-gray-500 italic">No pending requests</p> : (
                <div className="space-y-2">
                  {managerRequests.map(req => (
                    <div key={req.id} className="flex justify-between items-center bg-white/5 p-3 rounded">
                      <div><div className="font-bold">{req.name}</div><div className="text-xs text-gray-500">{req.email}</div></div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="success" onClick={async () => {
                           await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', req.userId), { role: 'manager' });
                           await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'manager_requests', req.id));
                        }}>Approve</Button>
                        <Button size="sm" variant="danger" onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'manager_requests', req.id))}>Decline</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
            <Card title="All Teams" icon={LayoutGrid}>
              <div className="grid grid-cols-2 gap-4">
                {allGroups.map(g => (
                  <div key={g.id} className="flex justify-between items-center bg-white/5 p-3 rounded hover:bg-white/10 transition-colors cursor-pointer" onClick={() => setViewMode(g.id)}>
                    <span className="font-bold">{g.name}</span>
                    <ArrowUpRight size={16} className="text-gray-500" />
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // 2. LOBBY
  if (viewMode === 'lobby' || (userProfile.role === 'manager' && !userProfile.groupId && viewMode !== 'create_group')) {
    return (
      <div className="min-h-screen bg-[#050505] text-white w-full">
        <Header />
        <div className="p-8 w-full max-w-[1920px] mx-auto">
          <div className="flex justify-between items-end mb-8 border-b border-white/10 pb-4">
            <h2 className="text-2xl font-bold uppercase text-gray-400">Team Lobby</h2>
            <div className="flex gap-4">
              {userProfile.role === 'manager' && !userProfile.groupId && (
                <Button onClick={() => setViewMode('create_group')}><Plus size={16} /> Create Team</Button>
              )}
              {userProfile.role === 'admin' && <Button onClick={() => setViewMode('admin')}><Shield size={16}/> Admin</Button>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {allGroups.map(g => (
              <div key={g.id} onClick={() => setViewMode(g.id)} className={`p-6 rounded-lg border border-white/10 bg-[#121212] hover:border-[#E2231A]/50 hover:bg-[#1a1a1a] transition-all cursor-pointer group relative overflow-hidden h-40 flex flex-col justify-between`}>
                <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity text-[#E2231A]"><ArrowUpRight /></div>
                <h3 className="text-xl font-bold uppercase text-white">{g.name}</h3>
                {userProfile.groupId === g.id && <span className="text-xs bg-[#E2231A] text-white px-2 py-1 rounded w-fit">MY TEAM</span>}
              </div>
            ))}
            {allGroups.length === 0 && <div className="col-span-full text-center py-20 text-gray-500">No teams active.</div>}
          </div>
        </div>
      </div>
    );
  }

  // 3. CREATE GROUP
  if (viewMode === 'create_group' && (userProfile.role === 'manager' || userProfile.role === 'admin')) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center p-8">
         <div className="max-w-md w-full">
           <Card title="Create New Team">
             <div className="space-y-4">
                <Input label="Team Name" value={myGroup?.name || ''} onChange={e=>setMyGroup({...myGroup, name:e.target.value})} placeholder="e.g. Sales Alpha" />
                <div className="flex gap-2 justify-end mt-4">
                  <Button variant="ghost" onClick={() => setViewMode(userProfile.role === 'admin' ? 'admin' : 'lobby')}>Cancel</Button>
                  <Button onClick={() => createGroup(myGroup.name)}>Create</Button>
                </div>
             </div>
           </Card>
         </div>
      </div>
    );
  }

  // 4. TEAM VIEW (The Core App)
  if (myGroup) {
    const isManager = (userProfile.role === 'manager' && userProfile.groupId === myGroup.id) || userProfile.role === 'admin';
    const isMember = userProfile.groupId === myGroup.id;

    return (
      <div className="min-h-screen bg-[#050505] text-white font-sans w-full overflow-x-hidden pb-20">
        <Header />
        <main className="w-full px-6 py-8 grid grid-cols-1 xl:grid-cols-12 gap-8 max-w-[1920px] mx-auto">
          
          {/* SIDEBAR: Controls */}
          {isManager && (
            <div className="xl:col-span-3 space-y-6">
              <Card title="Join Requests" icon={UserPlus}>
                {groupRequests.length === 0 ? <p className="text-gray-500 text-sm">No pending requests</p> : (
                  <div className="space-y-3">
                    {groupRequests.map(r => (
                      <div key={r.id} className="bg-white/5 p-3 rounded text-sm flex justify-between items-center">
                        <span>{r.userName}</span>
                        <div className="flex gap-2">
                          <button onClick={()=>handleGroupRequest(r,'approve')} className="text-green-500 hover:text-green-400"><CheckCircle size={18}/></button>
                          <button onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'requests', r.id))} className="text-red-500 hover:text-red-400"><XCircle size={18}/></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
              
              <KPISettings group={myGroup} onUpdate={updateKpiConfig} />
            </div>
          )}

          {/* MAIN AREA */}
          <div className={`${isManager ? 'xl:col-span-9' : 'xl:col-span-12'} space-y-8`}>
            
            <Card title="Performance Matrix" icon={Activity} 
              action={!isMember && !isManager && <Button onClick={async () => {
                await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'requests'), {
                  userId: activeUserId,
                  userName: userProfile.name,
                  groupId: myGroup.id,
                  status: 'pending',
                  requestedAt: serverTimestamp()
                });
                alert("Request Sent");
              }}>Request to Join</Button>}
            >
              <PerformanceTable 
                members={groupMembers} 
                kpis={myGroup.kpis || []} 
                data={performanceData} 
                isManager={isManager}
                onUpdateActual={updatePerformance}
                onAward={toggleAward}
                awards={myGroup.awards || []}
              />
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Leaderboard members={groupMembers} kpis={myGroup.kpis || []} data={performanceData} />
              <AwardsDisplay members={groupMembers} data={performanceData} />
            </div>

          </div>
        </main>
      </div>
    );
  }

  return null;
}

// --- Sub-Components ---

const WelcomeScreen = ({ onLogin, onAdminLogin }) => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('agent');
  const [secret, setSecret] = useState('');

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#121212] border border-white/10 p-8 rounded-2xl shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#E2231A] to-purple-600"></div>
        <h1 className="text-4xl font-black text-white mb-2 uppercase tracking-tighter">Lenovo <span className="text-[#E2231A]">Pulse</span></h1>
        <p className="text-gray-500 mb-8 text-sm">Next-Gen Performance Tracking</p>

        <div className="space-y-6">
          <Input 
            label="Konecta Email" 
            value={email} 
            onChange={e => setEmail(e.target.value)} 
            placeholder="name.surname@konecta.com" 
            icon={Mail}
          />
          
          <div className="grid grid-cols-3 gap-2">
            {['agent', 'manager', 'admin'].map(r => (
              <button 
                key={r}
                onClick={() => setRole(r)}
                className={`p-3 border rounded text-xs uppercase font-bold transition-all ${role === r ? 'border-[#E2231A] bg-[#E2231A] text-white' : 'border-white/10 text-gray-500 hover:bg-white/5'}`}
              >
                {r === 'admin' ? 'Fady' : r}
              </button>
            ))}
          </div>

          {role === 'admin' && (
            <Input type="password" label="Admin Secret" value={secret} onChange={e => setSecret(e.target.value)} placeholder="Enter secret code" />
          )}

          <Button className="w-full py-4" onClick={() => role === 'admin' ? onAdminLogin(email, secret) : onLogin(email, role)} disabled={!email || !email.includes('@')}>
            Enter System
          </Button>
        </div>
      </div>
    </div>
  );
};

const KPISettings = ({ group, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [kpis, setKpis] = useState(group.kpis || []);
  
  const updateKpi = (idx, field, val) => {
    const n = [...kpis];
    n[idx][field] = val;
    setKpis(n);
  };

  if (!isEditing) return (
    <Card title="KPI Config" icon={Settings} action={<Button size="sm" variant="ghost" onClick={()=>setIsEditing(true)}><Edit3 size={14}/></Button>}>
      <div className="flex flex-wrap gap-2">
        {group.kpis?.map(k => (
          <div key={k.id} className="bg-white/5 border border-white/5 px-3 py-2 rounded text-xs flex flex-col gap-1 min-w-[100px]">
            <span className="font-bold text-[#E2231A] block">{k.name}</span>
            <span className="text-gray-400">{k.weight}% | T: {k.target} {k.unit || ''}</span>
          </div>
        ))}
      </div>
    </Card>
  );

  return (
    <Card title="Edit KPIs" className="border-[#E2231A]">
      <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
        {kpis.map((k, i) => (
          <div key={i} className="bg-white/5 p-4 rounded border border-white/5 space-y-3">
            <div className="flex justify-between items-center gap-2">
              <Input value={k.name} onChange={e=>updateKpi(i,'name',e.target.value)} label="KPI Name" />
              <div className="w-20"><Input type="number" value={k.weight} onChange={e=>updateKpi(i,'weight', parseFloat(e.target.value))} label="Wgt %" /></div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <Input type="number" value={k.target} onChange={e=>updateKpi(i,'target', parseFloat(e.target.value))} label="Target Value" />
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Direction</label>
                <select 
                  value={k.direction} 
                  onChange={e=>updateKpi(i,'direction',e.target.value)}
                  className="bg-black/40 border border-white/10 text-white px-3 py-2 rounded-sm text-sm focus:outline-none focus:border-[#E2231A]"
                >
                  <option value="higher">Higher is Better</option>
                  <option value="lower">Lower is Better</option>
                </select>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
               <div className="flex flex-col gap-1">
                <label className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Type</label>
                <select 
                  value={k.type} 
                  onChange={e=>updateKpi(i,'type',e.target.value)}
                  className="bg-black/40 border border-white/10 text-white px-3 py-2 rounded-sm text-sm focus:outline-none focus:border-[#E2231A]"
                >
                  <option value="percent">Percentage (%)</option>
                  <option value="value">Value (Number)</option>
                  <option value="count">Count (Int)</option>
                </select>
              </div>
              <Input value={k.note} onChange={e=>updateKpi(i,'note',e.target.value)} label="Note/Benchmark" />
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <Button variant="ghost" onClick={()=>setIsEditing(false)}>Cancel</Button>
        <Button onClick={()=>{ onUpdate(kpis, group.awards); setIsEditing(false); }}>Save</Button>
      </div>
    </Card>
  );
};

const PerformanceTable = ({ members, kpis, data, isManager, onUpdateActual, onAward, awards }) => {
  // Calculation
  const rows = useMemo(() => {
    return members.map(m => {
      const p = data[m.uid] || { actuals: {}, awards: [] };
      let totalWeightedScore = 0;
      
      const kpiResults = kpis.map(k => {
        const actual = p.actuals?.[k.id];
        // Calculate raw % achievement
        const achievementPct = (actual !== undefined && actual !== null && actual !== '') 
          ? calculateKpiScore(actual, k.target, k.direction, k.type) 
          : 0;
        
        const weightedScore = (achievementPct / 100) * k.weight;
        totalWeightedScore += weightedScore;

        return { ...k, actual, achievementPct, weightedScore };
      });

      return { 
        ...m, 
        kpiResults, 
        totalScore: totalWeightedScore, 
        awards: p.awards || [] 
      };
    }).sort((a,b) => b.totalScore - a.totalScore);
  }, [members, data, kpis]);

  const exportCSV = () => {
    const header = ['Agent', ...kpis.map(k => `${k.name} (Act)`), ...kpis.map(k => `${k.name} (%)`), 'Total Score'];
    const body = rows.map(r => [
      r.name,
      ...r.kpiResults.map(k => k.actual || 0),
      ...r.kpiResults.map(k => k.achievementPct.toFixed(1)),
      r.totalScore.toFixed(1)
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [header.join(','), ...body.map(e => e.join(','))].join('\n');
    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = "team_kpi.csv";
    link.click();
  };

  if(rows.length === 0) return <div className="text-center py-10 text-gray-500">No agents found. Invite them to join!</div>;

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button size="sm" variant="outline" onClick={exportCSV}><FileSpreadsheet size={14}/> Export CSV</Button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-xs uppercase text-gray-500 bg-[#1a1a1a]">
              <th className="p-4 sticky left-0 z-10 bg-[#1a1a1a] border-b border-white/10">Agent</th>
              {kpis.map(k => (
                <th key={k.id} className="p-4 text-center border-b border-white/10 min-w-[140px]">
                  <div className="text-white font-bold truncate">{k.name}</div>
                  <div className="text-[10px] text-gray-500 mt-1 flex items-center justify-center gap-1">
                    <span>{k.weight}%</span> | <Target size={10}/> {k.target}
                    {k.direction === 'higher' ? <TrendingUp size={10} className="text-green-500"/> : <TrendingDown size={10} className="text-red-500"/>}
                  </div>
                </th>
              ))}
              <th className="p-4 text-center border-b border-white/10 text-[#E2231A] font-bold text-lg">Total</th>
              {isManager && <th className="p-4 border-b border-white/10"></th>}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.uid} className="group hover:bg-white/5 transition-colors border-b border-white/5 last:border-0">
                <td className="p-4 bg-[#121212] sticky left-0 z-10 group-hover:bg-[#1a1a1a] transition-colors">
                  <div className="font-bold text-white text-base">{r.name}</div>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {r.awards.map(a => <span key={a} title={a} className="text-yellow-500"><Medal size={12} /></span>)}
                  </div>
                </td>
                {r.kpiResults.map(res => (
                  <td key={res.id} className="p-4 text-center align-middle">
                    {isManager ? (
                      <div className="flex flex-col items-center">
                        <input 
                          type="number" 
                          placeholder="Act"
                          className="bg-black/30 border border-white/10 w-20 text-center text-sm rounded py-1 focus:border-[#E2231A] outline-none text-white mb-1"
                          value={res.actual || ''}
                          onChange={(e) => onUpdateActual(r.uid, res.id, e.target.value)}
                        />
                      </div>
                    ) : (
                      <span className="block font-mono font-bold text-white">{res.actual || '-'}</span>
                    )}
                    <div className={`text-[10px] font-mono ${res.achievementPct >= 100 ? 'text-green-500' : res.achievementPct >= 80 ? 'text-yellow-500' : 'text-red-500'}`}>
                      {res.achievementPct.toFixed(0)}%
                    </div>
                  </td>
                ))}
                <td className="p-4 text-center font-black text-xl text-white">
                  {r.totalScore.toFixed(1)}%
                </td>
                {isManager && (
                  <td className="p-4 text-center">
                    <div className="dropdown relative group/drop inline-block">
                      <Button size="sm" variant="ghost"><Crown size={14}/></Button>
                      <div className="absolute right-0 top-full bg-[#1a1a1a] border border-white/10 p-2 rounded shadow-xl hidden group-hover/drop:block z-50 min-w-[180px] text-left">
                        <div className="text-[10px] uppercase text-gray-500 mb-2 px-2">Assign Award</div>
                        {awards.map(a => (
                          <div key={a} onClick={()=>onAward(r.uid, a)} className={`text-xs p-2 rounded cursor-pointer hover:bg-white/10 flex justify-between ${r.awards.includes(a) ? 'text-[#E2231A] font-bold' : 'text-gray-400'}`}>
                            {a} {r.awards.includes(a) && <CheckCircle size={12}/>}
                          </div>
                        ))}
                      </div>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const Leaderboard = ({ members, kpis, data }) => {
  const ranked = useMemo(() => {
    return members.map(m => {
      const p = data[m.uid] || { actuals: {} };
      let total = 0;
      kpis.forEach(k => {
         const act = p.actuals?.[k.id];
         const pct = (act !== undefined && act !== null) ? calculateKpiScore(act, k.target, k.direction) : 0;
         const capped = Math.min(pct, 150);
         total += (capped / 100) * k.weight;
      });
      return { ...m, total };
    }).sort((a,b) => b.total - a.total).slice(0, 5); 
  }, [members, kpis, data]);

  return (
    <Card title="Top Performers" icon={Trophy}>
      <div className="space-y-4">
        {ranked.map((m, idx) => (
          <div key={m.uid} className="flex items-center gap-4 relative group">
             <div className={`w-8 h-8 flex items-center justify-center font-black rounded ${idx === 0 ? 'bg-[#E2231A] text-white shadow-lg' : 'bg-white/10 text-gray-400'}`}>
                {idx + 1}
             </div>
             <div className="flex-1">
                <div className="flex justify-between mb-1">
                   <span className="font-bold text-white text-sm">{m.name}</span>
                   <span className="text-[#E2231A] font-mono text-sm font-bold">{m.total.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                   <div 
                      className="h-full bg-gradient-to-r from-[#E2231A] to-purple-600 transition-all duration-1000 ease-out" 
                      style={{ width: `${Math.min(m.total, 100)}%` }}
                   ></div>
                </div>
             </div>
          </div>
        ))}
         {ranked.length === 0 && <p className="text-gray-500 text-sm italic">Data pending...</p>}
      </div>
    </Card>
  );
};

const AwardsDisplay = ({ members, data }) => {
  const allAwards = useMemo(() => {
    let arr = [];
    members.forEach(m => {
      const uAwards = data[m.uid]?.awards || [];
      uAwards.forEach(a => arr.push({ user: m.name, award: a }));
    });
    return arr;
  }, [members, data]);

  return (
    <Card title="Hall of Fame" icon={Crown}>
      <div className="flex flex-wrap gap-2">
        {allAwards.length === 0 && <p className="text-gray-500 text-sm">No awards assigned yet.</p>}
        {allAwards.map((item, i) => (
          <div key={i} className="flex items-center gap-2 bg-gradient-to-r from-yellow-900/20 to-transparent border border-yellow-500/20 px-3 py-2 rounded-full">
            <Medal size={14} className="text-yellow-500" />
            <span className="text-xs text-white font-bold">{item.user}</span>
            <span className="text-[10px] text-yellow-500 uppercase tracking-wider">{item.award}</span>
          </div>
        ))}
      </div>
    </Card>
  );
};
