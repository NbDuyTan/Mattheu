import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Trash2, Download, Receipt, Users, Calculator, ArrowRight, UserCog, Pencil, Check, X, UserPlus, UserMinus, Calendar, ChevronRight, Wallet, LogIn, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  db, 
  auth, 
  googleProvider, 
  signInWithPopup, 
  signInAnonymously,
  onAuthStateChanged, 
  collection, 
  doc, 
  onSnapshot, 
  addDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  serverTimestamp,
  getDoc,
  User
} from './firebase';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  // Don't throw for every error in the UI, just log it for debugging
  // unless it's a critical write failure.
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [accountCode, setAccountCode] = useState<string | null>(() => localStorage.getItem('lazaro_account_code'));
  const [userRole, setUserRole] = useState<'admin' | 'member' | null>(() => localStorage.getItem('lazaro_user_role') as any);
  const [enteredCode, setEnteredCode] = useState("");
  const [members, setMembers] = useState<string[]>(() => {
    const cached = localStorage.getItem('lazaro_members');
    return cached ? JSON.parse(cached) : ["Tân", "A Đạo", "Phương", "Phúc"];
  });
  const [passcode, setPasscode] = useState("tan.2001");
  const [defaultPayer, setDefaultPayer] = useState(() => localStorage.getItem('lazaro_default_payer') || "Tân");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authErrorCode, setAuthErrorCode] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [allAccounts, setAllAccounts] = useState<{id: string, role: string}[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>(() => {
    const cached = localStorage.getItem('lazaro_suggestions');
    return cached ? JSON.parse(cached) : ["tiền nhà", "cơm trưa", "cơm tối", "nhậu", "đi chợ"];
  });

  const [expenses, setExpenses] = useState<{id: string, date: string, desc: string, amount: number, payer: string, split: string[], shares: Record<string, number> | null}[]>(() => {
    const cached = localStorage.getItem('lazaro_expenses');
    return cached ? JSON.parse(cached) : [];
  });
  const [title, setTitle] = useState(() => localStorage.getItem('lazaro_title') || "Bảng thu chi tiêu nhà LazaroHome");
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  const todayDate = () => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  };

  const getMonthStr = (date: string) => date.split('-').slice(0, 2).join('-');
  const [selectedMonth, setSelectedMonth] = useState(getMonthStr(todayDate()));

  const isAdmin = userRole === 'admin';

  const capitalizeFirstLetter = (str: string) => {
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  const handleError = (error: unknown, operationType: OperationType, path: string | null) => {
    const errMessage = error instanceof Error ? error.message : String(error);
    const errInfo: FirestoreErrorInfo = {
      error: errMessage,
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        emailVerified: auth.currentUser?.emailVerified,
      },
      operationType,
      path
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    
    let userFriendlyMsg = "Có lỗi xảy ra khi thao tác với dữ liệu.";
    if (errMessage.includes("permission-denied") || errMessage.includes("insufficient permissions")) {
      userFriendlyMsg = `Lỗi phân quyền: Bạn không có quyền ${operationType} tại ${path}.`;
    } else if (errMessage.includes("offline")) {
      userFriendlyMsg = "Mất kết nối mạng. Vui lòng kiểm tra lại.";
    }
    
    setGlobalError(userFriendlyMsg);
  };

  const [editForm, setEditForm] = useState({ 
    desc: '', 
    amount: '', 
    payer: '', 
    date: '',
    split: [] as string[],
    isCustom: false,
    customAmounts: {} as Record<string, string>
  });

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      // If we have cached data, we don't need to show the full screen loading
      if (!localStorage.getItem('lazaro_expenses')) {
        setLoading(true);
      }
      
      if (!u) {
        try {
          const cred = await signInAnonymously(auth);
          setUser(cred.user);
        } catch (err: any) {
          if (err.code === 'auth/admin-restricted-operation') {
            setAuthErrorCode('ANONYMOUS_AUTH_DISABLED');
          }
          console.error("Auth error:", err.message);
          setLoading(false);
        }
      } else {
        setUser(u);
        // Check profile to load role and account code
        try {
          const profileSnap = await getDoc(doc(db, 'profiles', u.uid));
          if (profileSnap.exists()) {
            const code = profileSnap.data().code;
            setAccountCode(code);
            localStorage.setItem('lazaro_account_code', code);
            
            // Get role
            const accountSnap = await getDoc(doc(db, 'accounts', code));
            if (accountSnap.exists()) {
              const role = accountSnap.data().role;
              setUserRole(role);
              localStorage.setItem('lazaro_user_role', role);
            }
          }
        } catch (err) {
          console.error("Error loading account profile:", err);
        }
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  // All Accounts Listener (Admin Only)
  useEffect(() => {
    if (!isAdmin) {
      setAllAccounts([]);
      return;
    }
    const unsub = onSnapshot(collection(db, 'accounts'), (snapshot) => {
      setAllAccounts(snapshot.docs.map(d => ({ 
        id: d.id, 
        role: d.data().role 
      })));
    }, (err) => handleError(err, OperationType.LIST, 'accounts'));
    return unsub;
  }, [isAdmin]);

  // Settings Listener
  useEffect(() => {
    if (!user || !accountCode) return;
    const unsub = onSnapshot(doc(db, 'settings', 'house'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.members) {
          setMembers(data.members);
          localStorage.setItem('lazaro_members', JSON.stringify(data.members));
        }
        if (data.title) {
          setTitle(data.title);
          localStorage.setItem('lazaro_title', data.title);
        }
        if (data.defaultPayer) {
          setDefaultPayer(data.defaultPayer);
          localStorage.setItem('lazaro_default_payer', data.defaultPayer);
        }
        if (data.suggestions) {
          setSuggestions(data.suggestions);
          localStorage.setItem('lazaro_suggestions', JSON.stringify(data.suggestions));
        }
      } else {
        // Init settings if not exists (only if admin)
        if (isAdmin) {
          setDoc(doc(db, 'settings', 'house'), {
            members: ["Tân", "A Đạo", "Phương", "Phúc"],
            title: "Bảng thu chi tiêu nhà LazaroHome",
            defaultPayer: "Tân",
            passcode: "tan.2001",
            suggestions: ["tiền nhà", "cơm trưa", "cơm tối", "nhậu", "đi chợ"],
            updatedAt: serverTimestamp()
          }).catch(err => handleError(err, OperationType.WRITE, 'settings/house'));
        }
      }
    }, (err) => handleError(err, OperationType.GET, 'settings/house'));
    return unsub;
  }, [user, accountCode, isAdmin]);

  // Expenses Listener
  useEffect(() => {
    if (!user || !accountCode) return;
    const q = query(collection(db, 'expenses'), orderBy('date', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const exps = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      })) as any[];
      setExpenses(exps);
      localStorage.setItem('lazaro_expenses', JSON.stringify(exps));
      setIsDataLoaded(true);
      setLoading(false); // Make sure to clear loading state once we have real data
    }, (err) => {
      handleError(err, OperationType.LIST, 'expenses');
      setIsDataLoaded(true); // Stop spin even on error if data was cached
      setLoading(false);
    });
    return unsub;
  }, [user, accountCode]);

  const handleLogin = async () => {
    if (enteredCode.trim().length === 0 || !user) return;
    setError(null);
    setLoading(true);
    try {
      let accountSnap = await getDoc(doc(db, 'accounts', enteredCode));
      
      // Bootstrap tan.nd.05 if it's the first login with that code
      if (!accountSnap.exists() && enteredCode === 'tan.nd.05') {
        await setDoc(doc(db, 'accounts', 'tan.nd.05'), {
          role: 'admin',
          createdAt: serverTimestamp()
        });
        accountSnap = await getDoc(doc(db, 'accounts', 'tan.nd.05'));
      }

      if (accountSnap.exists()) {
        await setDoc(doc(db, 'profiles', user.uid), {
          code: enteredCode,
          linkedAt: serverTimestamp()
        });
        setAccountCode(enteredCode);
        setUserRole(accountSnap.data().role);
        localStorage.setItem('lazaro_account_code', enteredCode);
        setEnteredCode("");
      } else {
        setError("Mã tài khoản không tồn tại!");
      }
    } catch (err: any) {
      setError("Lỗi đăng nhập: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setAccountCode(null);
    setUserRole(null);
    localStorage.removeItem('lazaro_account_code');
    localStorage.removeItem('lazaro_user_role');
    localStorage.removeItem('lazaro_expenses');
    localStorage.removeItem('lazaro_members');
    localStorage.removeItem('lazaro_title');
    localStorage.removeItem('lazaro_suggestions');
    localStorage.removeItem('lazaro_default_payer');
    auth.signOut();
  };

  const addAccount = async (code: string, role: 'admin' | 'member' = 'member') => {
    if (!isAdmin) return;
    try {
      await setDoc(doc(db, 'accounts', code), { role, createdAt: serverTimestamp() });
    } catch (err) {
      handleError(err, OperationType.WRITE, `accounts/${code}`);
    }
  };

  const deleteAccount = async (code: string) => {
    if (!isAdmin || code === 'tan.nd.05') return;
    try {
      await deleteDoc(doc(db, 'accounts', code));
    } catch (err) {
      handleError(err, OperationType.DELETE, `accounts/${code}`);
    }
  };

  // Sync Settings to DB
  const updateSettings = async (updates: any) => {
    if (!user || !isAdmin) return;
    try {
      await updateDoc(doc(db, 'settings', 'house'), {
        ...updates,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      handleError(err, OperationType.UPDATE, 'settings/house');
    }
  };

  const [newExp, setNewExp] = useState({
    date: todayDate(),
    desc: '',
    amount: '',
    payer: defaultPayer,
    split: members,
    isCustom: false,
    customAmounts: {} as Record<string, string>
  });

  // Sync state when members change
  useEffect(() => {
    if (!members.includes(defaultPayer)) {
      setDefaultPayer(members[0] || "");
    }
    setNewExp(prev => ({ 
      ...prev, 
      payer: members.includes(prev.payer) ? prev.payer : (members[0] || ""),
      split: members 
    }));
  }, [members]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter(exp => getMonthStr(exp.date) === selectedMonth)
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)); 
  }, [expenses, selectedMonth]);

  const handleAddMember = async () => {
    const name = `TV${members.length + 1}`;
    await updateSettings({ members: [...members, name] });
  };

  const handleRemoveMember = async (name: string) => {
    if (members.length <= 1) return;
    await updateSettings({ members: members.filter(m => m !== name) });
    // Note: We don't bulk update expenses here as it's expensive in Firestore, 
    // instead the UI handles missing members gracefully.
  };

  const handleNameChange = async (index, newName) => {
    if (!newName.trim()) return;
    const oldName = members[index];
    if (oldName === newName) return;

    const newMembers = [...members];
    newMembers[index] = newName;
    await updateSettings({ 
      members: newMembers,
      defaultPayer: defaultPayer === oldName ? newName : defaultPayer
    });
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('vi-VN').format(Math.round(num));
  };

  const formatMoney = (amount: number) => {
    return formatNumber(amount) + 'đ';
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!user) return;
    const totalAmount = parseFloat(newExp.amount);
    if (!newExp.desc || !newExp.amount || totalAmount <= 0) {
      setGlobalError("Vui lòng nhập đầy đủ mô tả và số tiền hợp lệ (> 0).");
      return;
    }

    let finalShares: Record<string, number> | null = null;
    let finalSplit = newExp.split;

    if (newExp.isCustom) {
      finalShares = {};
      let customSum = 0;
      members.forEach(m => {
        const val = parseFloat(newExp.customAmounts[m] || "0");
        if (val > 0) {
          finalShares![m] = val;
          customSum += val;
        }
      });
      
      if (customSum === 0) {
        setGlobalError("Vui lòng nhập số tiền cho ít nhất một thành viên khi chọn Tùy chỉnh.");
        return;
      }
      finalSplit = Object.keys(finalShares);
    } else {
      if (newExp.split.length === 0) {
        setGlobalError("Vui lòng chọn ít nhất một thành viên để chia tiền.");
        return;
      }
    }

    try {
      await addDoc(collection(db, 'expenses'), {
        date: newExp.date,
        desc: newExp.desc,
        amount: newExp.isCustom ? Object.values(finalShares!).reduce((a, b) => a + b, 0) : totalAmount,
        payer: newExp.payer,
        split: finalSplit,
        shares: finalShares,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      setSelectedMonth(getMonthStr(newExp.date));
      setNewExp({ ...newExp, desc: '', amount: '', payer: defaultPayer, split: members, isCustom: false, customAmounts: {} });
    } catch (err) {
      handleError(err, OperationType.CREATE, 'expenses');
    }
  };

  const startEditing = (exp) => {
    setEditingId(exp.id);
    const customAmts: Record<string, string> = {};
    if (exp.shares) {
      Object.entries(exp.shares).forEach(([m, val]) => {
        customAmts[m] = val.toString();
      });
    }
    setEditForm({ 
      desc: exp.desc, 
      amount: exp.amount.toString(), 
      payer: exp.payer, 
      date: exp.date,
      split: exp.split,
      isCustom: !!exp.shares,
      customAmounts: customAmts
    });
  };

  const handleSaveEdit = async (id: string) => {
    if (!user) return;
    const totalAmount = parseFloat(editForm.amount);
    let finalShares: Record<string, number> | null = null;
    let finalSplit = editForm.split;

    if (editForm.isCustom) {
      finalShares = {};
      members.forEach(m => {
        const val = parseFloat(editForm.customAmounts[m] || "0");
        if (val > 0) finalShares![m] = val;
      });
      finalSplit = Object.keys(finalShares);
    }

    try {
      await updateDoc(doc(db, 'expenses', id), {
        desc: editForm.desc,
        amount: editForm.isCustom ? Object.values(finalShares!).reduce((a: number, b: number) => a + b, 0) : totalAmount,
        payer: editForm.payer,
        date: editForm.date,
        split: finalSplit,
        shares: finalShares,
        updatedAt: serverTimestamp()
      });
      setEditingId(null);
    } catch (err) {
      handleError(err, OperationType.UPDATE, `expenses/${id}`);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'expenses', id));
    } catch (err) {
      handleError(err, OperationType.DELETE, `expenses/${id}`);
    }
  };

  const toggleSplitNew = (member: string) => {
    setNewExp(prev => ({
      ...prev,
      split: prev.split.includes(member) 
        ? prev.split.filter(m => m !== member) 
        : [...prev.split, member]
    }));
  };

  const toggleSplitEdit = (member: string) => {
    setEditForm(prev => ({
      ...prev,
      split: prev.split.includes(member) 
        ? prev.split.filter(m => m !== member) 
        : [...prev.split, member]
    }));
  };

  const { balances, totalRow } = useMemo(() => {
    const bals: Record<string, { paid: number; consumed: number; net: number }> = {};
    members.forEach(m => bals[m] = { paid: 0, consumed: 0, net: 0 });

    filteredExpenses.forEach(exp => {
      if (bals[exp.payer]) bals[exp.payer].paid += exp.amount;
      
      if (exp.shares) {
        Object.entries(exp.shares).forEach(([m, amt]) => {
          if (bals[m]) bals[m].consumed += (amt as number);
        });
      } else {
        const splitAmount = exp.amount / (exp.split.length || 1);
        exp.split.forEach(m => {
          if (bals[m]) bals[m].consumed += splitAmount;
        });
      }
    });

    members.forEach(m => {
      bals[m].net = bals[m].consumed - bals[m].paid;
    });

    return { balances: bals, totalRow: members.map(m => bals[m].consumed) };
  }, [filteredExpenses, members]);

  const handleExportCSV = () => {
    let csv = '\uFEFF'; 
    csv += `${title} - Tháng ${selectedMonth}\n\n`;
    csv += "Ngày,Nội dung,Tổng tiền," + members.join(",") + "\n";
    
    filteredExpenses.forEach(exp => {
      let memberShares = [];
      if (exp.shares) {
        memberShares = members.map(m => exp.shares[m] || 0);
      } else {
        const share = exp.amount / (exp.split.length || 1);
        memberShares = members.map(m => exp.split.includes(m) ? share : 0);
      }
      csv += `${exp.date},"${exp.desc}",${exp.amount},` + memberShares.join(",") + "\n";
    });

    csv += ",Tổng:," + filteredExpenses.reduce((a, b) => a + b.amount, 0) + "," + totalRow.join(",") + "\n";
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Thu_Chi_LazaroHome_${selectedMonth}.csv`;
    link.click();
  };

  const totalMonthlySpend = filteredExpenses.reduce((acc, curr) => acc + curr.amount, 0);

  if (loading && !localStorage.getItem('lazaro_expenses')) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full"
          ></motion.div>
          <div className="flex flex-col items-center">
             <p className="text-slate-400 font-black uppercase tracking-widest text-[10px] animate-pulse">Khởi động hệ thống...</p>
             <p className="text-slate-300 text-[8px] mt-2 font-medium">Vui lòng đợi vài giây để máy chủ thức dậy</p>
          </div>
        </div>
      </div>
    );
  }

  // Show auth error screen if anonymous auth is required but disabled
  if (!user && authErrorCode === 'ANONYMOUS_AUTH_DISABLED') {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white rounded-[40px] p-10 shadow-2xl shadow-blue-100 border border-slate-100 text-center space-y-8"
        >
          <div className="w-20 h-20 bg-amber-100 rounded-3xl flex items-center justify-center mx-auto">
            <UserPlus size={40} className="text-amber-600" />
          </div>
          <div className="space-y-4">
            <h1 className="text-2xl font-black text-slate-900">Yêu cầu cấu hình Firebase</h1>
            <p className="text-slate-500 font-medium leading-relaxed">
              Hệ thống cần <b>Anonymous Authentication</b> được bật để xác định danh tính bảo mật mà không cần đăng nhập Google.
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-left space-y-4">
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Cách khắc phục:</p>
                  <ol className="text-xs text-amber-800 space-y-2 list-decimal ml-4 font-bold">
                    <li>Vào mục <b>Authentication</b> trong Firebase Console</li>
                    <li>Tab <b>Sign-in method</b> {"->"} <b>Add new provider</b></li>
                    <li>Chọn <b>Anonymous</b> và nhấn <b>Enable</b></li>
                  </ol>
                </div>
                <div className="flex flex-col gap-2 pt-2">
                  <a 
                    href="https://console.firebase.google.com/project/united-mantis-f8gvj/authentication/providers" 
                    target="_blank" 
                    rel="noreferrer"
                    className="block w-full bg-amber-600 text-white py-3 rounded-xl text-xs font-black text-center uppercase tracking-widest hover:bg-amber-700 transition-all shadow-md"
                  >
                    Mở Firebase Console
                  </a>
                  <button 
                    onClick={() => window.location.reload()}
                    className="block w-full bg-white text-amber-600 border border-amber-200 py-3 rounded-xl text-xs font-black text-center uppercase tracking-widest hover:bg-amber-50 transition-all cursor-pointer"
                  >
                    Tôi đã bật, thử lại ngay
                  </button>
                </div>
            </div>
            
            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-100"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-4 text-slate-400 font-black tracking-widest">Hoặc</span>
              </div>
            </div>

            <button 
               onClick={() => signInWithPopup(auth, googleProvider)}
               className="w-full bg-blue-600 text-white flex items-center justify-center gap-3 py-4 rounded-2xl font-black hover:bg-blue-700 transition-all cursor-pointer shadow-lg shadow-blue-100 active:scale-95"
            >
               <LogIn size={20} />
               ĐĂNG NHẬP VỚI GOOGLE
            </button>
            <p className="text-[10px] text-slate-400 font-medium italic">
              Nếu không bật Anonymous Auth, bạn phải dùng Google để định danh.
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!accountCode) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white rounded-[40px] p-10 shadow-2xl shadow-blue-100 border border-slate-100 text-center space-y-8"
        >
          <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center mx-auto shadow-xl shadow-blue-200">
            <Wallet size={40} className="text-white" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">LazaroHome</h1>
            <p className="text-slate-500 font-medium leading-relaxed">Vui lòng nhập mã tài khoản để truy cập</p>
          </div>
          
          <div className="space-y-4">
            <input 
              type="text"
              placeholder="Nhập mã tài khoản..."
              value={enteredCode}
              onChange={(e) => setEnteredCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-center text-xl font-black focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-inner"
            />
            {error && (
              <motion.p 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-rose-500 text-xs font-black uppercase tracking-widest"
              >
                {error}
              </motion.p>
            )}
            <button 
              onClick={handleLogin}
              disabled={loading}
              className="w-full bg-slate-900 text-white flex items-center justify-center gap-3 py-4 rounded-2xl font-black hover:bg-slate-800 transition-all cursor-pointer shadow-lg active:scale-95 disabled:opacity-50"
            >
              <LogIn size={20} />
              {loading ? "ĐANG ĐĂNG NHẬP..." : "ĐĂNG NHẬP"}
            </button>
            {/* Instruction removed */}
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 md:p-8 p-4 font-sans selection:bg-blue-100">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Global Error Display */}
        <AnimatePresence>
          {globalError && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 flex items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-rose-100 text-rose-600 rounded-lg">
                    <X size={18} />
                  </div>
                  <div className="flex flex-col">
                    <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest leading-none mb-1">Lỗi hệ thống</p>
                    <p className="text-sm font-bold text-rose-700">{globalError}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setGlobalError(null)}
                  className="p-2 text-rose-300 hover:text-rose-500 transition-all cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
               <input 
                 value={title}
                 readOnly={!isAdmin}
                 onChange={(e) => updateSettings({ title: e.target.value })}
                 className={`text-3xl md:text-4xl font-extrabold tracking-tight bg-transparent border-none p-0 outline-none focus:ring-0 ${!isAdmin ? 'cursor-default' : ''}`}
               />
               <div className="flex items-center gap-1">
                 {isAdmin && (
                   <button 
                     onClick={() => setShowAdminPanel(true)}
                     className="p-2 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all cursor-pointer"
                     title="Quản lý tài khoản"
                   >
                     <UserCog size={18} />
                   </button>
                 )}
                 <button 
                   onClick={handleLogout}
                   className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
                   title="Thoát"
                 >
                   <LogOut size={18} />
                 </button>
               </div>
            </div>
            <p className="text-slate-500 font-medium flex items-center gap-2">
              <Calendar size={16} />
              Quản lý chi tiêu nhà LazaroHome theo từng tháng
            </p>
          </div>
          
          <div className="flex items-center gap-3">
             <div className="bg-white px-4 py-2 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-3 h-14">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Tháng</span>
                <input 
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="font-bold text-blue-600 bg-transparent outline-none cursor-pointer"
                />
             </div>
             <button 
                onClick={handleExportCSV}
                className="h-14 aspect-square md:aspect-auto md:px-6 bg-slate-900 text-white rounded-2xl flex items-center justify-center gap-2 hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 cursor-pointer"
             >
                <Download size={20} />
                <span className="hidden md:inline font-bold">Xuất CSV</span>
             </button>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-bold text-xs uppercase tracking-widest">Tổng chi tháng</span>
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl"><Calculator size={20} /></div>
              </div>
              <div className="text-3xl font-black text-slate-900">{formatMoney(totalMonthlySpend)}</div>
           </div>
           
           <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-bold text-xs uppercase tracking-widest">Thủ quỹ mặc định</span>
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl"><Users size={20} /></div>
              </div>
              <select 
                value={defaultPayer} 
                disabled={!isAdmin}
                onChange={e => updateSettings({ defaultPayer: e.target.value })}
                className={`text-lg font-bold text-slate-900 bg-transparent outline-none w-full ${!isAdmin ? 'cursor-default' : 'cursor-pointer'}`}
              >
                {members.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
           </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
          
          <div className="xl:col-span-3 space-y-6">
            
            {/* Add Expense Form */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200"
            >
              <form onSubmit={handleAddExpense} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    <div className="md:col-span-12 relative">
                      <label className="text-xs font-bold text-slate-400 uppercase ml-1 block mb-1.5">Nội dung chi tiêu</label>
                      <input 
                        placeholder="Mô tả khoản chi... (vd: Cơm trưa, Cơm tối, Tiền điện...)" 
                        value={newExp.desc}
                        onChange={e => {
                          const val = capitalizeFirstLetter(e.target.value);
                          setNewExp({...newExp, desc: val});
                          setShowSuggestions(true);
                        }}
                        onFocus={() => setShowSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 focus:ring-2 focus:ring-blue-500 bg-white transition-all outline-none text-base font-bold placeholder:text-slate-300 shadow-sm"
                      />
                      <AnimatePresence>
                        {showSuggestions && (
                          <motion.div 
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="absolute z-50 w-full mt-2 bg-white border border-slate-100 rounded-2xl shadow-xl shadow-slate-200/50 overflow-hidden"
                          >
                            <div className="p-2 grid grid-cols-2 sm:grid-cols-3 gap-1">
                              {suggestions
                                .filter(s => s.toLowerCase().includes(newExp.desc.toLowerCase()))
                                .map(s => (
                                <button
                                  key={s}
                                  type="button"
                                  onClick={() => {
                                    setNewExp({...newExp, desc: capitalizeFirstLetter(s)});
                                    setShowSuggestions(false);
                                  }}
                                  className="text-left px-3 py-2.5 text-xs font-bold text-slate-600 hover:bg-blue-50 hover:text-blue-600 rounded-xl transition-all flex items-center justify-between group"
                                >
                                  <span>{s}</span>
                                  <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-all text-blue-400" />
                                </button>
                              ))}
                              {newExp.desc && !suggestions.includes(newExp.desc.toLowerCase()) && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const newSugs = [...suggestions, newExp.desc.toLowerCase()];
                                    setSuggestions(newSugs);
                                    await updateSettings({ suggestions: newSugs });
                                    setShowSuggestions(false);
                                  }}
                                  className="col-span-full mt-1 px-4 py-3 bg-blue-50 text-blue-600 text-xs font-black uppercase tracking-widest rounded-xl hover:bg-blue-100 transition-all flex items-center justify-center gap-2 border border-blue-100 border-dashed"
                                >
                                  <Plus size={16} />
                                  Lưu "{newExp.desc}" vào danh sách gợi ý
                                </button>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  <div className="md:col-span-6">
                    <label className="text-xs font-bold text-slate-400 uppercase ml-1 block mb-1.5">Số tiền (đ)</label>
                    <input 
                      type="number"
                      placeholder="0"
                      value={newExp.amount}
                      onChange={e => setNewExp({...newExp, amount: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 focus:ring-2 focus:ring-blue-500 bg-white transition-all outline-none text-base font-bold shadow-sm"
                    />
                  </div>
                  <div className="md:col-span-6">
                    <label className="text-xs font-bold text-slate-400 uppercase ml-1 block mb-1.5">Người trả</label>
                    <select 
                      value={newExp.payer}
                      onChange={e => setNewExp({...newExp, payer: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 focus:ring-2 focus:ring-blue-500 bg-white transition-all outline-none text-base font-bold cursor-pointer appearance-none shadow-sm"
                    >
                      {members.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-400 uppercase ml-1 block">Chia tiền như thế nào?</label>
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                       <button 
                         type="button"
                         onClick={() => setNewExp({...newExp, isCustom: false})}
                         className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${!newExp.isCustom ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                       >
                         Chia đều
                       </button>
                       <button 
                         type="button"
                         onClick={() => setNewExp({...newExp, isCustom: true})}
                         className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${newExp.isCustom ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                       >
                         Tùy chỉnh
                       </button>
                    </div>
                  </div>

                  {!newExp.isCustom ? (
                    <div className="flex flex-wrap gap-2">
                      {members.map(m => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => toggleSplitNew(m)}
                          className={`text-xs px-4 py-2 rounded-full border-2 transition-all font-extrabold ${newExp.split.includes(m) ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-100' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-200'}`}
                        >
                          {m}
                        </button>
                      ))}
                      <button 
                        type="button" 
                        onClick={() => setNewExp(prev => ({ ...prev, split: members }))}
                        className="text-xs px-4 py-2 rounded-full border-2 border-dashed border-slate-200 text-slate-400 font-bold hover:border-slate-300"
                      >
                        Tất cả
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                       {members.map(m => (
                         <div key={m} className="flex flex-col gap-1.5 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                            <span className="text-[10px] font-black text-slate-500 uppercase">{m}</span>
                            <div className="relative">
                               <input 
                                 type="number"
                                 placeholder="0"
                                 value={newExp.customAmounts[m] || ''}
                                 onChange={e => setNewExp({
                                   ...newExp,
                                   customAmounts: { ...newExp.customAmounts, [m]: e.target.value }
                                 })}
                                 className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 pr-8"
                               />
                               <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-300">đ</span>
                            </div>
                         </div>
                       ))}
                    </div>
                  )}
                  {newExp.isCustom && (
                    <div className="flex justify-between items-center px-2 py-1">
                       <span className="text-[10px] font-black text-slate-400 uppercase">Tổng chia: {formatMoney((Object.values(newExp.customAmounts) as string[]).reduce((a: number, b: string) => a + (parseFloat(b) || 0), 0))}</span>
                       {Math.abs((Object.values(newExp.customAmounts) as string[]).reduce((a: number, b: string) => a + (parseFloat(b) || 0), 0) - (parseFloat(newExp.amount) || 0)) > 1 && (
                         <span className="text-[10px] font-bold text-rose-500 italic">Chưa khớp với tổng tiền ({formatMoney(parseFloat(newExp.amount) || 0)})</span>
                       )}
                    </div>
                  )}
                </div>

                <div className="flex justify-end pt-2">
                  <button 
                    type="submit" 
                    className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white px-10 py-5 rounded-[24px] font-black tracking-tight transition-all flex items-center justify-center gap-3 shadow-xl shadow-blue-200 border-b-4 border-blue-800 active:border-b-0 active:translate-y-[2px] cursor-pointer group"
                  >
                    <Plus size={24} className="group-hover:rotate-90 transition-transform duration-300" />
                    <span className="text-lg">THÊM KHOẢN CHI</span>
                  </button>
                </div>
              </form>
            </motion.div>

            {/* Desktop Table */}
            <div className="bg-white rounded-[32px] shadow-sm border border-slate-200 overflow-hidden hidden md:block">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50">
                      <th className="py-5 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Ngày</th>
                      <th className="py-5 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest min-w-[200px]">Mô tả chi tiết</th>
                      <th className="py-5 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Tổng tiền</th>
                      {members.map(m => (
                        <th key={m} className="py-5 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">{m}</th>
                      ))}
                      <th className="py-5 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <AnimatePresence mode="popLayout">
                      {filteredExpenses.map((exp) => {
                        const share = exp.amount / exp.split.length;
                        const isEditing = editingId === exp.id;
                        return (
                          <motion.tr 
                            layout
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0, x: -20 }}
                            key={exp.id} 
                            className={`group transition-all font-medium ${isEditing ? 'bg-blue-50/30' : 'hover:bg-slate-50/50'}`}
                          >
                            <td className="py-4 px-6 text-slate-400 text-xs font-bold">
                               {exp.date.split('-').slice(2).join('/')}/{exp.date.split('-')[1]}
                            </td>
                            <td className="py-4 px-6">
                               <div className="flex flex-col gap-0.5">
                                  <span className="text-slate-900 font-bold">{exp.desc}</span>
                                  <div className="flex items-center gap-2">
                                     <span className="text-[10px] text-slate-400 font-black uppercase tracking-tighter">Trả bởi {exp.payer}</span>
                                     {exp.shares ? (
                                       <span className="text-[10px] text-emerald-500 font-black tracking-tighter bg-emerald-50 px-1 rounded">CHIA TÙY CHỈNH</span>
                                     ) : exp.split.length < members.length && (
                                       <span className="text-[10px] text-blue-500 font-black tracking-tighter bg-blue-50 px-1 rounded">CHIA {exp.split.length} TV</span>
                                     )}
                                  </div>
                               </div>
                            </td>
                            <td className="py-4 px-6 text-right font-black text-slate-900">
                               {formatNumber(exp.amount)}
                            </td>
                            {members.map(m => (
                              <td 
                                key={m} 
                                className={`py-4 px-6 text-center transition-all ${(exp.shares ? !!exp.shares[m] : exp.split.includes(m)) ? 'text-blue-600 font-black' : 'text-slate-200'}`}
                              >
                                {(exp.shares ? !!exp.shares[m] : exp.split.includes(m)) ? formatNumber(exp.shares ? exp.shares[m] : share) : "-"}
                              </td>
                            ))}
                            <td className="py-4 px-6 text-center">
                               <div className="flex items-center justify-center gap-1">
                                  {isAdmin && (
                                    <>
                                      <button 
                                        onClick={() => startEditing(exp)}
                                        className="text-slate-300 hover:text-blue-600 p-2 rounded-xl hover:bg-blue-50 transition-all cursor-pointer md:opacity-0 group-hover:opacity-100"
                                        title="Sửa"
                                      >
                                        <Pencil size={16} />
                                      </button>
                                      <button 
                                        onClick={() => handleDeleteExpense(exp.id)}
                                        className="text-slate-300 hover:text-red-500 p-2 rounded-xl hover:bg-red-50 transition-all cursor-pointer md:opacity-0 group-hover:opacity-100"
                                        title="Xóa"
                                      >
                                        <Trash2 size={16} />
                                      </button>
                                    </>
                                  )}
                               </div>
                            </td>
                          </motion.tr>
                        )
                      })}
                    </AnimatePresence>
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-900 text-white font-black">
                       <td colSpan={2} className="py-5 px-6 text-right uppercase tracking-[0.2em] text-[10px]">Cộng dồn tháng này</td>
                       <td className="py-5 px-6 text-right text-lg">{formatNumber(totalMonthlySpend)}</td>
                       {totalRow.map((total, idx) => (
                         <td key={idx} className="py-5 px-6 text-center text-blue-400">{formatNumber(total)}</td>
                       ))}
                       <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Mobile Cards View */}
            <div className="md:hidden space-y-4">
               <AnimatePresence mode="popLayout">
                  {filteredExpenses.map((exp) => {
                    const share = exp.amount / exp.split.length;
                    const isEditing = editingId === exp.id;
                    return (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          key={exp.id} 
                          className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-200 transition-all relative"
                        >
                           <div className="absolute top-4 right-4 flex items-center gap-1">
                              {isAdmin && (
                                <>
                                  <button 
                                    onClick={() => startEditing(exp)}
                                    className="text-slate-300 p-2 hover:text-blue-600 transition-all cursor-pointer"
                                  >
                                    <Pencil size={16} />
                                  </button>
                                  <button 
                                    onClick={() => handleDeleteExpense(exp.id)}
                                    className="text-slate-300 p-2 hover:text-red-500 transition-all cursor-pointer"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </>
                              )}
                           </div>
                           <div className="flex flex-col gap-6">
                               <div>
                                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">{exp.date.split('-').reverse().join('/')}</div>
                                  <div className="text-xl font-black text-slate-900 leading-tight">{exp.desc}</div>
                                  <div className="flex items-center gap-2 mt-2">
                                     <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-black uppercase">{exp.payer} chi</span>
                                  </div>
                               </div>
                               <div className="text-2xl font-black text-slate-900">{formatMoney(exp.amount)}</div>
                               
                               <div className="space-y-3 pt-4 border-t border-slate-50">
                                 <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Chia sẻ cho:</div>
                                 <div className="grid grid-cols-2 gap-2">
                                    {members.map(m => (
                                       <div key={m} className="relative">
                                          <div className={`w-full px-3 py-2 rounded-2xl text-[10px] font-black flex justify-between items-center transition-all ${(exp.shares ? !!exp.shares[m] : exp.split.includes(m)) ? 'bg-slate-50 text-slate-900 border-2 border-slate-100' : 'text-slate-200 border-2 border-slate-50/50'}`}>
                                            <span>{m}</span>
                                            {(exp.shares ? !!exp.shares[m] : exp.split.includes(m)) && (
                                              <span className="text-blue-600">{formatMoney(exp.shares ? exp.shares[m] : share)}</span>
                                            )}
                                          </div>
                                       </div>
                                    ))}
                                 </div>
                               </div>
                           </div>
                        </motion.div>
                    )
                  })}
               </AnimatePresence>
            </div>

            {filteredExpenses.length === 0 && (
               <div className="bg-white py-24 rounded-[32px] border-2 border-slate-100 border-dashed flex flex-col items-center justify-center text-slate-300 space-y-4">
                  <Receipt size={64} strokeWidth={1} />
                  <p className="font-extrabold uppercase tracking-widest text-xs">Chưa có dữ liệu tháng này</p>
               </div>
            )}

            <AnimatePresence>
              {editingId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    className="w-full max-w-2xl bg-white rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                  >
                    <div className="bg-slate-900 p-8 flex items-center justify-between text-white shrink-0">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-900/40"><Pencil size={24} /></div>
                        <div>
                          <h2 className="text-xl font-black">Chỉnh sửa khoản chi</h2>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ID: {editingId}</p>
                        </div>
                      </div>
                      <button onClick={() => setEditingId(null)} className="p-2 hover:bg-slate-800 rounded-xl transition-all cursor-pointer">
                        <X size={24} />
                      </button>
                    </div>

                    <div className="p-8 space-y-8 overflow-y-auto">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <div className="space-y-2 relative">
                             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nội dung</label>
                             <input 
                               value={editForm.desc}
                               onChange={e => {
                                 const val = capitalizeFirstLetter(e.target.value);
                                 setEditForm({...editForm, desc: val});
                                 setShowSuggestions(true);
                               }}
                               onFocus={() => setShowSuggestions(true)}
                               onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                               className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 font-bold outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all text-sm"
                               placeholder="Mô tả..."
                             />
                             {showSuggestions && (
                               <div className="absolute z-50 w-full mt-2 bg-white border border-slate-100 rounded-2xl shadow-xl shadow-slate-200/50 p-2 grid grid-cols-2 gap-1 overflow-hidden">
                                 {suggestions
                                   .filter(s => s.toLowerCase().includes(editForm.desc.toLowerCase()))
                                   .map(s => (
                                   <button
                                     key={s}
                                     type="button"
                                     onClick={() => {
                                       setEditForm({...editForm, desc: capitalizeFirstLetter(s)});
                                       setShowSuggestions(false);
                                     }}
                                     className="text-left px-3 py-2 text-[10px] font-bold text-slate-600 hover:bg-blue-50 hover:text-blue-600 rounded-xl transition-all"
                                   >
                                     {s}
                                   </button>
                                 ))}
                                 {editForm.desc && !suggestions.includes(editForm.desc.toLowerCase()) && (
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        const newSugs = [...suggestions, editForm.desc.toLowerCase()];
                                        setSuggestions(newSugs);
                                        await updateSettings({ suggestions: newSugs });
                                        setShowSuggestions(false);
                                      }}
                                      className="col-span-full mt-1 px-3 py-2 bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-blue-100 transition-all flex items-center justify-center gap-2 border border-blue-100 border-dashed"
                                    >
                                      <Plus size={14} />
                                      Thêm gợi ý này
                                    </button>
                                 )}
                               </div>
                             )}
                          </div>

                          <div className="space-y-2">
                             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Số tiền (đ)</label>
                             <input 
                               type="number"
                               value={editForm.amount}
                               onChange={e => setEditForm({...editForm, amount: e.target.value})}
                               className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-xl font-black outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all"
                             />
                          </div>

                          <div className="space-y-2">
                             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Người chi</label>
                             <select 
                               value={editForm.payer}
                               onChange={e => setEditForm({...editForm, payer: e.target.value})}
                               className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 font-bold outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all appearance-none cursor-pointer"
                             >
                               {members.map(m => <option key={m} value={m}>{m}</option>)}
                             </select>
                          </div>

                          {isAdmin && (
                            <div className="space-y-2">
                               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Ngày chi</label>
                               <input 
                                 type="date"
                                 value={editForm.date}
                                 onChange={e => setEditForm({...editForm, date: e.target.value})}
                                 className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 font-bold outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all"
                               />
                            </div>
                          )}
                        </div>

                        <div className="space-y-6 bg-slate-50 p-6 rounded-[32px] border border-slate-100">
                           <div className="flex items-center justify-between">
                              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Chia tiền</h4>
                              <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-100">
                                 <button 
                                   type="button"
                                   onClick={() => setEditForm({...editForm, isCustom: false})}
                                   className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all ${!editForm.isCustom ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400'}`}
                                 >Đều</button>
                                 <button 
                                   type="button"
                                   onClick={() => setEditForm({...editForm, isCustom: true})}
                                   className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all ${editForm.isCustom ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400'}`}
                                 >Tùy chỉnh</button>
                              </div>
                           </div>

                           <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                              {members.map(m => (
                                <div key={m} className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${!editForm.isCustom && editForm.split.includes(m) ? 'bg-blue-50 border-blue-100' : 'bg-white border-slate-100'}`}>
                                   <button 
                                      type="button"
                                      disabled={editForm.isCustom}
                                      onClick={() => toggleSplitEdit(m)}
                                      className={`flex-1 flex items-center gap-3 text-left ${editForm.isCustom ? 'cursor-default' : 'cursor-pointer'}`}
                                   >
                                      <div className={`w-5 h-5 rounded-md flex items-center justify-center transition-all ${editForm.split.includes(m) ? 'bg-blue-600 text-white' : 'bg-slate-100 text-transparent'}`}>
                                         <Check size={14} />
                                      </div>
                                      <span className={`text-sm font-black ${editForm.split.includes(m) ? 'text-slate-900' : 'text-slate-400'}`}>{m}</span>
                                   </button>

                                   {editForm.isCustom && (
                                     <div className="relative">
                                       <input 
                                         type="number"
                                         value={editForm.customAmounts[m] || ''}
                                         onChange={e => setEditForm({...editForm, customAmounts: {...editForm.customAmounts, [m]: e.target.value}})}
                                         className="w-24 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-black outline-none focus:ring-2 focus:ring-blue-500 text-right pr-6"
                                         placeholder="0"
                                       />
                                       <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-300">đ</span>
                                     </div>
                                   )}
                                   {!editForm.isCustom && editForm.split.includes(m) && (
                                      <span className="text-[10px] font-black text-blue-600">{formatMoney(parseFloat(editForm.amount) / (editForm.split.length || 1))}</span>
                                   )}
                                </div>
                              ))}
                           </div>

                           {!editForm.isCustom && (
                             <button 
                              type="button"
                              onClick={() => setEditForm({...editForm, split: members})}
                              className="w-full py-3 border-2 border-dashed border-slate-200 rounded-2xl text-[10px] font-black text-slate-400 uppercase tracking-widest hover:border-blue-200 hover:text-blue-500 transition-all"
                             >Tất cả thành viên</button>
                           )}

                           {editForm.isCustom && (
                             <div className="pt-2 flex flex-col gap-1">
                               <div className="flex justify-between items-center text-[10px] font-black">
                                  <span className="text-slate-400 uppercase">Tổng chia</span>
                                  <span className="text-slate-900">{formatMoney(Object.values(editForm.customAmounts).reduce((acc: number, val: string) => acc + (parseFloat(val) || 0), 0))}</span>
                               </div>
                               {Math.abs(Object.values(editForm.customAmounts).reduce((acc: number, val: string) => acc + (parseFloat(val) || 0), 0) - (parseFloat(editForm.amount) || 0)) > 1 && (
                                 <div className="bg-rose-50 text-rose-500 p-2 rounded-lg text-[9px] font-bold text-center">Tiền chia chưa khớp tổng chi</div>
                               )}
                             </div>
                           )}
                        </div>
                      </div>
                    </div>

                    <div className="p-8 bg-slate-50 border-t border-slate-100 flex gap-4 shrink-0">
                      <button 
                        onClick={() => setEditingId(null)}
                        className="flex-1 py-4 rounded-2xl font-black text-slate-400 bg-white border border-slate-200 hover:bg-slate-50 transition-all cursor-pointer"
                      >HỦY BỎ</button>
                      <button 
                        onClick={() => handleSaveEdit(editingId!)}
                        className="flex-1 py-4 rounded-[20px] font-black text-white bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-200 transition-all border-b-4 border-blue-800 active:border-b-0 active:translate-y-[2px] cursor-pointer"
                      >LƯU THAY ĐỔI</button>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {showAdminPanel && isAdmin && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    className="w-full max-w-xl bg-white rounded-[40px] shadow-2xl overflow-hidden"
                  >
                    <div className="bg-slate-900 p-8 flex items-center justify-between text-white">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-900/40"><Users size={24} /></div>
                        <div>
                          <h2 className="text-xl font-black">Quản lý Tài khoản</h2>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Danh sách mã truy cập</p>
                        </div>
                      </div>
                      <button onClick={() => setShowAdminPanel(false)} className="p-2 hover:bg-slate-800 rounded-xl transition-all">
                        <X size={24} />
                      </button>
                    </div>
                    
                    <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto">
                      <div className="space-y-4">
                         <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Thêm tài khoản mới</h4>
                         <div className="flex gap-2">
                           <input 
                             id="new-account-code"
                             placeholder="Mã tài khoản (vd: hung.nd.20)"
                             className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 font-black outline-none focus:ring-2 focus:ring-blue-500"
                           />
                           <button 
                             onClick={() => {
                               const el = document.getElementById('new-account-code') as HTMLInputElement;
                               if (el.value.trim()) {
                                 addAccount(el.value.trim());
                                 el.value = "";
                               }
                             }}
                             className="bg-blue-600 text-white px-6 rounded-2xl font-black hover:bg-blue-700 transition-all flex items-center gap-2"
                           >
                             <Plus size={20} />
                             THÊM
                           </button>
                         </div>
                      </div>

                      <div className="space-y-4">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Gợi ý chi tiêu</h4>
                        <div className="space-y-3">
                          <p className="text-[10px] text-slate-400 font-medium px-1">Ngăn cách bởi dấu phẩy (vd: Cơm trưa, Cơm tối...)</p>
                          <textarea 
                            value={suggestions.join(", ")}
                            onChange={e => {
                              const newSugs = e.target.value.split(",").map(s => s.trim()).filter(s => s !== "");
                              setSuggestions(newSugs);
                              updateSettings({ suggestions: newSugs });
                            }}
                            rows={3}
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 font-bold outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          />
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tài khoản hiện có</h4>
                        <div className="divide-y divide-slate-100 border border-slate-100 rounded-3xl overflow-hidden">
                          {allAccounts.map(acc => (
                            <div key={acc.id} className="flex items-center justify-between p-4 bg-white hover:bg-slate-50 transition-all">
                              <div className="flex items-center gap-3">
                                <div className={`w-2 h-2 rounded-full ${acc.role === 'admin' ? 'bg-rose-500' : 'bg-blue-500'}`}></div>
                                <span className="font-black text-slate-700">{acc.id}</span>
                                <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${acc.role === 'admin' ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'}`}>
                                  {acc.role === 'admin' ? 'Quản trị' : 'Thành viên'}
                                </span>
                              </div>
                              {acc.id !== 'tan.nd.05' && (
                                <button 
                                  onClick={() => deleteAccount(acc.id)}
                                  className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                                >
                                  <Trash2 size={18} />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

          </div>

          {/* Right Column: Settings & Settlement */}
          <div className="space-y-8">
            
            {/* Setting: Members */}
            <div className="bg-white p-7 rounded-[32px] shadow-sm border border-slate-200 space-y-6">
               <div className="flex items-center justify-between">
                  <h3 className="font-black text-slate-900 uppercase text-[10px] tracking-widest">Thành viên nhà</h3>
                  {isAdmin && (
                    <button onClick={handleAddMember} className="bg-slate-50 hover:bg-slate-100 p-2.5 rounded-2xl transition-all cursor-pointer">
                      <UserPlus size={20} className="text-slate-600" />
                    </button>
                  )}
               </div>
               <div className="space-y-3">
                  {members.map((m, idx) => (
                    <div key={idx} className="flex items-center gap-2 group">
                       <input 
                        value={m}
                        readOnly={!isAdmin}
                        onChange={e => handleNameChange(idx, e.target.value)}
                        className={`bg-slate-50 border-2 border-transparent rounded-2xl px-5 py-3 text-sm font-black w-full focus:bg-white focus:border-blue-100 outline-none transition-all shadow-sm ${!isAdmin ? 'cursor-default' : ''}`}
                       />
                       {isAdmin && (
                         <button onClick={() => handleRemoveMember(m)} className="text-slate-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all cursor-pointer p-1">
                          <UserMinus size={18} />
                         </button>
                       )}
                    </div>
                  ))}
               </div>
            </div>

            {/* Security Setting (Admin Only) */}
            {isAdmin && (
              <div className="bg-white p-7 rounded-[32px] shadow-sm border border-slate-200 space-y-6">
                 <div className="flex items-center justify-between">
                    <h3 className="font-black text-slate-900 uppercase text-[10px] tracking-widest">Bảo mật</h3>
                    <div className="p-2 bg-slate-50 text-slate-400 rounded-xl"><UserCog size={18} /></div>
                 </div>
                 <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mã xác thực bảng (passcode)</label>
                   <input 
                    type="password"
                    value={passcode}
                    onChange={e => updateSettings({ passcode: e.target.value })}
                    className="bg-slate-50 border-2 border-transparent rounded-2xl px-5 py-3 text-sm font-black w-full focus:bg-white focus:border-blue-100 outline-none transition-all shadow-sm"
                    placeholder="Nhập mã mới..."
                   />
                 </div>
              </div>
            )}

            {/* Settlement Summary */}
            <div className="bg-slate-900 text-white rounded-[40px] p-8 shadow-2xl shadow-blue-900/10 space-y-10 relative overflow-hidden">
               {/* Decorative Gradient */}
               <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/20 rounded-full blur-[80px] -mr-24 -mt-24"></div>
               <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-500/10 rounded-full blur-[60px] -ml-16 -mb-16"></div>
               
               <div className="space-y-2 relative">
                  <h3 className="font-black uppercase text-[10px] tracking-[0.3em] text-slate-500">Thanh toán cuối tháng</h3>
                  <div className="text-4xl font-black tracking-tighter">THÁNG {selectedMonth.split('-')[1]}</div>
               </div>

               <div className="space-y-6 relative">
                  {members.map(m => {
                    const bal = balances[m];
                    const isTreasurer = m === defaultPayer;
                    const amount = Math.abs(Math.round(bal.net));
                    
                    if (isTreasurer) return null;

                    return (
                      <div key={m} className="flex items-center justify-between group">
                         <div className="flex flex-col">
                            <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">{m}</span>
                            <div className="flex items-center gap-2 text-[10px] text-slate-600 font-bold">
                               <span>Dùng: {formatNumber(bal.consumed)}</span>
                               <span>•</span>
                               <span>Chi: {formatNumber(bal.paid)}</span>
                            </div>
                         </div>
                         <div className="flex items-center gap-4">
                            <div className="flex flex-col items-end">
                               <span className={`${bal.net >= 0 ? 'text-blue-400' : 'text-rose-400'} font-black text-2xl tracking-tight leading-none`}>
                                 {formatNumber(amount)}
                               </span>
                               <span className={`text-[8px] font-black uppercase tracking-widest mt-1.5 ${bal.net >= 0 ? 'text-blue-500/50' : 'text-rose-500/50'}`}>
                                 {bal.net >= 0 ? 'Cần chuyển' : 'Thừa chi'}
                               </span>
                            </div>
                            <div className="h-11 w-11 bg-slate-800/50 border border-slate-700/50 rounded-2xl flex items-center justify-center text-blue-400 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-500 group-hover:rotate-45 transition-all duration-500 cursor-default shadow-sm shadow-black/20">
                               <ArrowRight size={20} />
                            </div>
                         </div>
                      </div>
                    )
                  })}

                  <div className="pt-8 border-t border-slate-800/50 mt-10">
                     <div className="flex items-center justify-between">
                        <div>
                           <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Chuyển cho thủ quỹ</span>
                           <div className="text-xl font-black text-white">{defaultPayer}</div>
                        </div>
                        <div className="p-4 bg-blue-600 text-white rounded-3xl shadow-xl shadow-blue-900/40 rotate-12 transition-transform hover:rotate-0"><Wallet size={28} /></div>
                     </div>
                  </div>
               </div>
            </div>

            <div className="bg-blue-50 p-6 rounded-[32px] border-2 border-blue-100 border-dashed text-center">
               <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest leading-relaxed">
                 Hệ thống tự động tính toán<br/>dựa trên người thanh toán mặc định
               </p>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
