import React, { useState } from "react";
import { Mail, Lock, Eye, EyeOff, Loader2, Files } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import bcrypt from 'bcryptjs';
import API from "../api/axios"; // ✅ Apna axios instance import karna mat bhulna

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [credentials, setCredentials] = useState({ email: "", password: "" });
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setCredentials((prev) => ({ ...prev, [name]: value }));
  };

const handleLogin = async (e) => {
  e.preventDefault();
  if (!credentials.email || !credentials.password) return alert("Bhai, details to bhar de!");
  
  setIsLoading(true);
  try {
    // ❌ Bcrypt lines hata di hain
    // ✅ Seedha credentials bhej rahe hain (Jisme plain email aur password hai)
    const response = await API.post('/auth/login', credentials);
    
    if (response.data.success) {
      localStorage.setItem('token', response.data.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.data.user));
      
      console.log("Login Successful:", response.data.message);
      navigate('/dashboard');
    }
  } catch (error) {
    const errMsg = error.response?.data?.message || "Login failed";
    alert(errMsg); 
    console.error("Login Error:", errMsg);
  } finally {
    setIsLoading(false);
  }
};

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 selection:bg-indigo-500/30">
      <div className="w-full max-w-[400px]">
        {/* Brand Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-12 h-12 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-center justify-center mb-4">
            <Files className="text-indigo-500" size={28} />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tighter">CollabEdit</h1>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-1">Welcome Back Engineer</p>
        </div>

        <div className="bg-slate-900/40 border border-slate-800/50 p-8 rounded-2xl backdrop-blur-sm shadow-2xl">
          {/* ✅ Form onSubmit handle kiya gaya hai */}
          <form className="space-y-6" onSubmit={handleLogin}>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider ml-1">Email</label>
              <div className="relative group">
                <Mail className="absolute left-3 top-2.5 text-slate-600 group-focus-within:text-indigo-500 transition-colors" size={18} />
                <input
                  type="email"
                  name="email" // ✅ Name attribute added
                  value={credentials.email} // ✅ Value linked to state
                  onChange={handleChange} // ✅ OnChange added
                  required
                  className="w-full bg-slate-950 border border-slate-800/80 rounded-xl py-2 pl-10 pr-4 text-sm text-slate-200 placeholder:text-slate-700 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 outline-none transition-all font-medium"
                  placeholder="name@example.com"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center px-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Password</label>
                <button type="button" className="text-[10px] font-bold text-indigo-400/60 hover:text-indigo-400">RESET?</button>
              </div>
              <div className="relative group">
                <Lock className="absolute left-3 top-2.5 text-slate-600 group-focus-within:text-indigo-500 transition-colors" size={18} />
                <input
                  type={showPassword ? "text" : "password"}
                  name="password" // ✅ Name attribute added
                  value={credentials.password} // ✅ Value linked to state
                  onChange={handleChange} // ✅ OnChange added
                  required
                  className="w-full bg-slate-950 border border-slate-800/80 rounded-xl py-2 pl-10 pr-12 text-sm text-slate-200 placeholder:text-slate-700 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 outline-none transition-all font-medium"
                  placeholder="••••••••"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-2.5 text-slate-600 hover:text-slate-400">
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* ✅ Button handles loading state */}
            <button 
              disabled={isLoading}
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:cursor-not-allowed text-white text-xs font-black uppercase tracking-widest py-3 rounded-xl transition-all shadow-lg shadow-indigo-500/10 flex items-center justify-center gap-2"
            >
              {isLoading ? <Loader2 className="animate-spin" size={16} /> : "Secure Login"}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-800/50 text-center">
            <p className="text-[11px] font-bold text-slate-500">
              NEW TO THE SYSTEM?{" "}
              <Link to="/signup" className="text-indigo-400 hover:text-indigo-300 transition-colors ml-1 uppercase tracking-tighter">Sign up</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;