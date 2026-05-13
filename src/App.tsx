import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Trash2, Download, Receipt, Users, Calculator, ArrowRight, UserCog, Pencil, Check, X, UserPlus, UserMinus, Calendar, ChevronRight, Wallet } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [members, setMembers] = useState(["Tân", "A Đạo", "Phương", "Phúc"]);
  const [defaultPayer, setDefaultPayer] = useState("Tân");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ 
    desc: '', 
    amount: '', 
    payer: '', 
    split: [] as string[],
    isCustom: false,
    customAmounts: {} as Record<string, string>
  });
  const [title, setTitle] = useState("Bảng thu chi tiêu nhà Lazaro");

  const todayDate = () => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  };

  const getMonthStr = (date: string) => date.split('-').slice(0, 2).join('-');
  const [selectedMonth, setSelectedMonth] = useState(getMonthStr(todayDate()));

  const [expenses, setExpenses] = useState([
    { id: 1, date: '2024-06-25', desc: 'Bánh mì', amount: 60000, payer: 'Tân', split: ["Tân", "A Đạo", "Phương", "Phúc"], shares: null as Record<string, number> | null },
    { id: 2, date: '2024-06-25', desc: 'Cafe Bảo Lộc', amount: 98000, payer: 'Tân', split: ["Tân", "A Đạo", "Phương", "Phúc"], shares: null as Record<string, number> | null },
    { id: 3, date: '2024-06-26', desc: 'Strongbow + Gửi xe (A Đạo)', amount: 100000, payer: 'A Đạo', split: ["Tân", "A Đạo", "Phương", "Phúc"], shares: null as Record<string, number> | null }
  ]);

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
      .sort((a, b) => b.id - a.id); // Show latest first
  }, [expenses, selectedMonth]);

  const handleAddMember = () => {
    const name = `TV${members.length + 1}`;
    setMembers([...members, name]);
  };

  const handleRemoveMember = (name: string) => {
    if (members.length <= 1) return;
    setMembers(members.filter(m => m !== name));
    setExpenses(expenses.map(exp => ({
      ...exp,
      split: exp.split.filter(m => m !== name),
      payer: exp.payer === name ? (members.find(m => m !== name) || "") : exp.payer
    })));
  };

  const handleNameChange = (index, newName) => {
    if (!newName.trim()) return;
    const oldName = members[index];
    if (oldName === newName) return;

    const newMembers = [...members];
    newMembers[index] = newName;
    setMembers(newMembers);

    if (defaultPayer === oldName) setDefaultPayer(newName);

    setExpenses(expenses.map(exp => ({
      ...exp,
      payer: exp.payer === oldName ? newName : exp.payer,
      split: exp.split.map(m => m === oldName ? newName : m)
    })));
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('vi-VN').format(Math.round(num));
  };

  const formatMoney = (amount: number) => {
    return formatNumber(amount) + 'đ';
  };

  const handleAddExpense = (e) => {
    e.preventDefault();
    const totalAmount = parseFloat(newExp.amount);
    if (!newExp.desc || !newExp.amount || totalAmount <= 0) return;

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
      
      if (customSum === 0) return;
      // Actual split members are those with > 0 shares
      finalSplit = Object.keys(finalShares);
      
      // Basic validation: if sum doesn't match total, we adjust the total to match the sum of shares
      // or we can just use the sum as the actual bill amount. Let's stick to the sum.
      if (customSum !== totalAmount) {
        // Optional: show warning or auto-adjust total
      }
    } else {
      if (newExp.split.length === 0) return;
    }

    const expense = {
      ...newExp,
      id: Date.now(),
      amount: newExp.isCustom ? Object.values(finalShares!).reduce((a, b) => a + b, 0) : totalAmount,
      split: finalSplit,
      shares: finalShares
    };

    setExpenses([...expenses, expense]);
    setSelectedMonth(getMonthStr(newExp.date));
    setNewExp({ ...newExp, desc: '', amount: '', payer: defaultPayer, split: members, isCustom: false, customAmounts: {} });
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
      split: exp.split,
      isCustom: !!exp.shares,
      customAmounts: customAmts
    });
  };

  const handleSaveEdit = (id) => {
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

    setExpenses(expenses.map(exp => 
      exp.id === id 
        ? { 
            ...exp, 
            desc: editForm.desc, 
            amount: editForm.isCustom ? Object.values(finalShares!).reduce((a, b) => a + b, 0) : totalAmount, 
            payer: editForm.payer, 
            split: finalSplit,
            shares: finalShares
          }
        : exp
    ));
    setEditingId(null);
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
          if (bals[m]) bals[m].consumed += amt;
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
    link.download = `Thu_Chi_Lazaro_${selectedMonth}.csv`;
    link.click();
  };

  const totalMonthlySpend = filteredExpenses.reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 md:p-8 p-4 font-sans selection:bg-blue-100">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <input 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-3xl md:text-4xl font-extrabold tracking-tight bg-transparent border-none p-0 outline-none focus:ring-0 w-full"
            />
            <p className="text-slate-500 font-medium flex items-center gap-2">
              <Calendar size={16} />
              Quản lý chi tiêu nhà Lazaro theo từng tháng
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
                <span className="text-slate-400 font-bold text-xs uppercase tracking-widest">Thủ quỹ</span>
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl"><UserCog size={20} /></div>
              </div>
              <select 
                value={defaultPayer} 
                onChange={e => setDefaultPayer(e.target.value)}
                className="text-lg font-bold text-slate-900 bg-transparent outline-none cursor-pointer w-full"
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
                  <div className="md:col-span-5">
                    <label className="text-xs font-bold text-slate-400 uppercase ml-1 block mb-1.5">Nội dung chi tiêu</label>
                    <input 
                      placeholder="Mô tả khoản chi..." 
                      value={newExp.desc}
                      onChange={e => setNewExp({...newExp, desc: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-blue-500 bg-white transition-all outline-none text-sm placeholder:text-slate-300 shadow-sm"
                    />
                  </div>
                  <div className="md:col-span-3">
                    <label className="text-xs font-bold text-slate-400 uppercase ml-1 block mb-1.5">Số tiền (đ)</label>
                    <input 
                      type="number"
                      placeholder="0"
                      value={newExp.amount}
                      onChange={e => setNewExp({...newExp, amount: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-blue-500 bg-white transition-all outline-none text-sm font-bold shadow-sm"
                    />
                  </div>
                  <div className="md:col-span-4">
                    <label className="text-xs font-bold text-slate-400 uppercase ml-1 block mb-1.5">Người trả</label>
                    <select 
                      value={newExp.payer}
                      onChange={e => setNewExp({...newExp, payer: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-blue-500 bg-white transition-all outline-none text-sm font-bold cursor-pointer appearance-none shadow-sm"
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
                       <span className="text-[10px] font-black text-slate-400 uppercase">Tổng chia: {formatMoney(Object.values(newExp.customAmounts).reduce((a, b) => a + (parseFloat(b) || 0), 0))}</span>
                       {Math.abs(Object.values(newExp.customAmounts).reduce((a, b) => a + (parseFloat(b) || 0), 0) - (parseFloat(newExp.amount) || 0)) > 1 && (
                         <span className="text-[10px] font-bold text-rose-500 italic">Chưa khớp với tổng tiền ({formatMoney(parseFloat(newExp.amount) || 0)})</span>
                       )}
                    </div>
                  )}
                </div>

                <div className="flex justify-end pt-2">
                  <button type="submit" className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-2xl font-black transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-200 cursor-pointer active:scale-95 leading-none">
                    <Plus size={20} />
                    <span>THÊM KHOẢN CHI</span>
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
                               {isEditing ? (
                                 <div className="space-y-4">
                                   <div className="space-y-1">
                                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nội dung</span>
                                      <input 
                                        value={editForm.desc}
                                        onChange={e => setEditForm({...editForm, desc: e.target.value})}
                                        className="w-full bg-white border border-blue-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                                        placeholder="Mô tả..."
                                      />
                                   </div>
                                   <div className="flex items-center justify-between">
                                      <div className="space-y-1 flex-1 mr-4">
                                         <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Người trả</span>
                                         <select 
                                           value={editForm.payer}
                                           onChange={e => setEditForm({...editForm, payer: e.target.value})}
                                           className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold outline-none cursor-pointer"
                                         >
                                           {members.map(m => <option key={m} value={m}>{m}</option>)}
                                         </select>
                                      </div>
                                      <div className="mt-5">
                                         <div className="flex bg-slate-100 p-1 rounded-xl">
                                            <button 
                                              type="button"
                                              onClick={() => setEditForm({...editForm, isCustom: false})}
                                              className={`px-3 py-1.5 text-[8px] font-black uppercase rounded-lg transition-all ${!editForm.isCustom ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}
                                            >
                                              Đều
                                            </button>
                                            <button 
                                              type="button"
                                              onClick={() => setEditForm({...editForm, isCustom: true})}
                                              className={`px-3 py-1.5 text-[8px] font-black uppercase rounded-lg transition-all ${editForm.isCustom ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}
                                            >
                                              Tùy chỉnh
                                            </button>
                                         </div>
                                      </div>
                                   </div>
                                   {!editForm.isCustom && (
                                     <div className="space-y-1">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Chia cho</span>
                                        <div className="flex flex-wrap gap-1">
                                          {members.map(m => (
                                            <button
                                              key={m}
                                              type="button"
                                              onClick={() => toggleSplitEdit(m)}
                                              className={`text-[9px] px-2 py-1 rounded-lg border-2 transition-all font-black ${editForm.split.includes(m) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-300 border-slate-100'}`}
                                            >
                                              {m}
                                            </button>
                                          ))}
                                        </div>
                                     </div>
                                   )}
                                 </div>
                               ) : (
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
                               )}
                            </td>
                            <td className="py-4 px-6 text-right font-black text-slate-900">
                               {isEditing ? (
                                 <input 
                                   type="number"
                                   value={editForm.amount}
                                   onChange={e => setEditForm({...editForm, amount: e.target.value})}
                                   className="w-24 bg-white border border-blue-200 rounded-xl px-3 py-2 text-sm text-right outline-none focus:ring-2 focus:ring-blue-500 font-black"
                                 />
                               ) : (
                                 formatNumber(exp.amount)
                               )}
                            </td>
                            {members.map(m => (
                              <td 
                                key={m} 
                                onClick={() => isEditing && !editForm.isCustom && toggleSplitEdit(m)}
                                className={`py-4 px-6 text-center transition-all ${isEditing ? 'cursor-pointer hover:bg-slate-50' : ''} ${(exp.shares ? !!exp.shares[m] : exp.split.includes(m)) ? 'text-blue-600 font-black' : 'text-slate-200'}`}
                              >
                                {isEditing ? (
                                   <div className={`w-full h-full flex items-center justify-center`}>
                                      {editForm.isCustom ? (
                                        <div className="relative">
                                           <input 
                                             type="number"
                                             value={editForm.customAmounts[m] || ''}
                                             onChange={e => setEditForm({
                                               ...editForm,
                                               customAmounts: { ...editForm.customAmounts, [m]: e.target.value }
                                             })}
                                             className="w-20 bg-white border border-blue-100 rounded-lg px-2 py-1 text-[10px] font-black outline-none focus:ring-1 focus:ring-blue-500 text-right pr-5"
                                           />
                                           <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[8px] text-slate-300 font-bold">đ</span>
                                        </div>
                                      ) : (
                                        editForm.split.includes(m) ? (
                                          <div className="flex flex-col items-center">
                                            <Check size={14} className="text-emerald-500 mb-1" />
                                            <span className="text-[10px] text-blue-600 font-black">{formatNumber(parseFloat(editForm.amount) / (editForm.split.length || 1))}</span>
                                          </div>
                                        ) : (
                                          <X size={14} className="text-slate-200" />
                                        )
                                      )}
                                   </div>
                                ) : (
                                   (exp.shares ? !!exp.shares[m] : exp.split.includes(m)) ? formatNumber(exp.shares ? exp.shares[m] : share) : "-"
                                )}
                              </td>
                            ))}
                            <td className="py-4 px-6 text-center">
                               <div className="flex items-center justify-center gap-1">
                                  {isEditing ? (
                                    <>
                                      <button 
                                        onClick={() => handleSaveEdit(exp.id)}
                                        className="text-emerald-500 hover:bg-emerald-50 p-2 rounded-xl transition-all cursor-pointer"
                                        title="Lưu"
                                      >
                                        <Check size={18} />
                                      </button>
                                      <button 
                                        onClick={() => setEditingId(null)}
                                        className="text-slate-400 hover:bg-slate-100 p-2 rounded-xl transition-all cursor-pointer"
                                        title="Hủy"
                                      >
                                        <X size={18} />
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button 
                                        onClick={() => startEditing(exp)}
                                        className="text-slate-300 hover:text-blue-600 p-2 rounded-xl hover:bg-blue-50 transition-all cursor-pointer md:opacity-0 group-hover:opacity-100"
                                        title="Sửa"
                                      >
                                        <Pencil size={16} />
                                      </button>
                                      <button 
                                        onClick={() => setExpenses(expenses.filter(e => e.id !== exp.id))}
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
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        key={exp.id} 
                        className={`bg-white p-6 rounded-[32px] shadow-sm border transition-all relative ${isEditing ? 'border-blue-400 ring-4 ring-blue-50' : 'border-slate-200'}`}
                      >
                         <div className="absolute top-4 right-4 flex items-center gap-1">
                            {isEditing ? (
                              <>
                                <button 
                                  onClick={() => handleSaveEdit(exp.id)}
                                  className="text-emerald-500 p-2 bg-emerald-50 rounded-xl cursor-pointer"
                                >
                                  <Check size={18} />
                                </button>
                                <button 
                                  onClick={() => setEditingId(null)}
                                  className="text-slate-400 p-2 bg-slate-50 rounded-xl cursor-pointer"
                                >
                                  <X size={18} />
                                </button>
                              </>
                            ) : (
                              <>
                                <button 
                                  onClick={() => startEditing(exp)}
                                  className="text-slate-300 p-2 hover:text-blue-600 transition-all cursor-pointer"
                                >
                                  <Pencil size={16} />
                                </button>
                                <button 
                                  onClick={() => setExpenses(expenses.filter(e => e.id !== exp.id))}
                                  className="text-slate-300 p-2 hover:text-red-500 transition-all cursor-pointer"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </>
                            )}
                         </div>
                         <div className="flex flex-col gap-6">
                            <div className="flex justify-between items-start pt-1">
                               {isEditing ? (
                                 <div className="space-y-4 w-full mr-12">
                                    <div className="space-y-1">
                                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nội dung</span>
                                       <input 
                                         value={editForm.desc}
                                         onChange={e => setEditForm({...editForm, desc: e.target.value})}
                                         className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:bg-white focus:ring-2 focus:ring-blue-500"
                                       />
                                    </div>
                                    <div className="space-y-1">
                                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Người trả</span>
                                       <select 
                                         value={editForm.payer}
                                         onChange={e => setEditForm({...editForm, payer: e.target.value})}
                                         className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:bg-white focus:ring-2 focus:ring-blue-500"
                                       >
                                         {members.map(m => <option key={m} value={m}>{m}</option>)}
                                       </select>
                                    </div>
                                    <div className="space-y-1">
                                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Số tiền</span>
                                       <input 
                                         type="number"
                                         value={editForm.amount}
                                         onChange={e => setEditForm({...editForm, amount: e.target.value})}
                                         className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-lg font-black outline-none focus:bg-white focus:ring-2 focus:ring-blue-500"
                                       />
                                    </div>
                                 </div>
                               ) : (
                                 <div>
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">{exp.date.split('-').reverse().join('/')}</div>
                                    <div className="text-xl font-black text-slate-900 leading-tight">{exp.desc}</div>
                                    <div className="flex items-center gap-2 mt-2">
                                       <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-black uppercase">{exp.payer} chi</span>
                                    </div>
                                 </div>
                               )}
                               {!isEditing && <div className="text-2xl font-black text-slate-900">{formatMoney(exp.amount)}</div>}
                            </div>
                            
                             <div className="space-y-3 pt-4 border-t border-slate-50">
                               <div className="flex items-center justify-between">
                                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Chia sẻ cho:</div>
                                  {isEditing && (
                                     <div className="flex bg-slate-100 p-0.5 rounded-lg">
                                        <button 
                                          type="button" 
                                          onClick={() => setEditForm({...editForm, isCustom: false})}
                                          className={`px-2 py-1 text-[8px] font-black uppercase rounded ${!editForm.isCustom ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}
                                        >Đều</button>
                                        <button 
                                          type="button" 
                                          onClick={() => setEditForm({...editForm, isCustom: true})}
                                          className={`px-2 py-1 text-[8px] font-black uppercase rounded ${editForm.isCustom ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}
                                        >Tùy chỉnh</button>
                                     </div>
                                  )}
                               </div>
                               <div className="grid grid-cols-2 gap-2">
                                  {members.map(m => (
                                     <div key={m} className="relative">
                                        <button 
                                          disabled={!isEditing || editForm.isCustom}
                                          onClick={() => toggleSplitEdit(m)}
                                          className={`w-full px-3 py-2 rounded-2xl text-[10px] font-black flex justify-between items-center transition-all ${isEditing ? (editForm.isCustom ? 'bg-white border-2 border-slate-100' : editForm.split.includes(m) ? 'bg-blue-600 text-white border-2 border-blue-600' : 'bg-slate-50 text-slate-300 border-2 border-transparent') : (exp.shares ? !!exp.shares[m] : exp.split.includes(m)) ? 'bg-slate-50 text-slate-900 border-2 border-slate-100' : 'text-slate-200 border-2 border-slate-50/50'}`}
                                        >
                                          <span>{m}</span>
                                          {!isEditing && (exp.shares ? !!exp.shares[m] : exp.split.includes(m)) && (
                                            <span className="text-blue-600">{formatMoney(exp.shares ? exp.shares[m] : share)}</span>
                                          )}
                                          {isEditing && !editForm.isCustom && editForm.split.includes(m) && <Check size={12} />}
                                        </button>
                                        {isEditing && editForm.isCustom && (
                                          <input 
                                            type="number"
                                            value={editForm.customAmounts[m] || ''}
                                            onChange={e => setEditForm({...editForm, customAmounts: {...editForm.customAmounts, [m]: e.target.value}})}
                                            className="absolute inset-0 bg-transparent text-right px-3 py-2 text-[10px] font-black outline-none"
                                            placeholder="0"
                                          />
                                        )}
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

          </div>

          {/* Right Column: Settings & Settlement */}
          <div className="space-y-8">
            
            {/* Setting: Members */}
            <div className="bg-white p-7 rounded-[32px] shadow-sm border border-slate-200 space-y-6">
               <div className="flex items-center justify-between">
                  <h3 className="font-black text-slate-900 uppercase text-[10px] tracking-widest">Thành viên nhà</h3>
                  <button onClick={handleAddMember} className="bg-slate-50 hover:bg-slate-100 p-2.5 rounded-2xl transition-all cursor-pointer">
                    <UserPlus size={20} className="text-slate-600" />
                  </button>
               </div>
               <div className="space-y-3">
                  {members.map((m, idx) => (
                    <div key={idx} className="flex items-center gap-2 group">
                       <input 
                        value={m}
                        onChange={e => handleNameChange(idx, e.target.value)}
                        className="bg-slate-50 border-2 border-transparent rounded-2xl px-5 py-3 text-sm font-black w-full focus:bg-white focus:border-blue-100 outline-none transition-all shadow-sm"
                       />
                       <button onClick={() => handleRemoveMember(m)} className="text-slate-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all cursor-pointer p-1">
                        <UserMinus size={18} />
                       </button>
                    </div>
                  ))}
               </div>
            </div>

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
