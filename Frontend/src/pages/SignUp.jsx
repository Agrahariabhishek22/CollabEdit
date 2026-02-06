import React, { useState } from "react";
import { Mail, Lock, User, Eye, EyeOff, Loader2, Files } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import API from "../api/axios";
import bcrypt from 'bcryptjs';

const Signup = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  // ✅ State updated with confirmPassword
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const navigate = useNavigate();

  // ✅ Common Change Handler
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

const handleSubmit = async (e) => {
  e.preventDefault();

  // ✅ Client-side check
  if (formData.password !== formData.confirmPassword) {
    return alert("Passwords match nahi ho rahe bhai!");
  }

  setIsLoading(true);
  try {
    // ❌ Bcrypt/Salt logic yahan se poori tarah khatam
    // ✅ Seedha formData bhej rahe hain
    const response = await API.post("/auth/signup", formData);

    if (response.data.success) {
      // Signup ke baad agar token mil raha hai toh save kar lo
      if (response.data.data?.token) {
        localStorage.setItem('token', response.data.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.data.user));
      }
      
      console.log("Signup Success:", response.data.message);
      alert("Account ban gaya!");
      navigate("/dashboard");
    }
  } catch (error) {
    const errMsg = error.response?.data?.message || "Signup failed";
    alert(errMsg);
    console.error("Signup Error:", errMsg);
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
          <h1 className="text-2xl font-black text-white tracking-tighter">
            CollabEdit
          </h1>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-1">
            Start Engineering Together
          </p>
        </div>

        <div className="bg-slate-900/40 border border-slate-800/50 p-8 rounded-2xl backdrop-blur-sm shadow-2xl">
          <form className="space-y-5" onSubmit={handleSubmit}>
            {/* Full Name */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider ml-1">
                Full Name
              </label>
              <div className="relative group">
                <User
                  className="absolute left-3 top-2.5 text-slate-600 group-focus-within:text-indigo-500 transition-colors"
                  size={18}
                />
                <input
                  type="text"
                  name="name" // ✅ Added name
                  value={formData.name} // ✅ Linked value
                  onChange={handleChange} // ✅ Linked handler
                  required
                  className="w-full bg-slate-950 border border-slate-800/80 rounded-xl py-2 pl-10 pr-4 text-sm text-slate-200 placeholder:text-slate-700 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 outline-none transition-all font-medium"
                  placeholder="John Doe"
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider ml-1">
                Email Address
              </label>
              <div className="relative group">
                <Mail
                  className="absolute left-3 top-2.5 text-slate-600 group-focus-within:text-indigo-500 transition-colors"
                  size={18}
                />
                <input
                  type="email"
                  name="email" // ✅ Added name
                  value={formData.email} // ✅ Linked value
                  onChange={handleChange} // ✅ Linked handler
                  required
                  className="w-full bg-slate-950 border border-slate-800/80 rounded-xl py-2 pl-10 pr-4 text-sm text-slate-200 placeholder:text-slate-700 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 outline-none transition-all font-medium"
                  placeholder="name@example.com"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider ml-1">
                Password
              </label>
              <div className="relative group">
                <Lock
                  className="absolute left-3 top-2.5 text-slate-600 group-focus-within:text-indigo-500 transition-colors"
                  size={18}
                />
                <input
                  type={showPassword ? "text" : "password"}
                  name="password" // ✅ Added name
                  value={formData.password} // ✅ Linked value
                  onChange={handleChange} // ✅ Linked handler
                  required
                  className="w-full bg-slate-950 border border-slate-800/80 rounded-xl py-2 pl-10 pr-12 text-sm text-slate-200 placeholder:text-slate-700 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 outline-none transition-all font-medium"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-600 hover:text-slate-400"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Confirm Password - ✅ New Field Added */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider ml-1">
                Confirm Password
              </label>
              <div className="relative group">
                <Lock
                  className="absolute left-3 top-2.5 text-slate-600 group-focus-within:text-indigo-500 transition-colors"
                  size={18}
                />
                <input
                  type={showPassword ? "text" : "password"}
                  name="confirmPassword" // ✅ Added name
                  value={formData.confirmPassword} // ✅ Linked value
                  onChange={handleChange} // ✅ Linked handler
                  required
                  className="w-full bg-slate-950 border border-slate-800/80 rounded-xl py-2 pl-10 pr-12 text-sm text-slate-200 placeholder:text-slate-700 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 outline-none transition-all font-medium"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:cursor-not-allowed text-white text-xs font-black uppercase tracking-widest py-3 rounded-xl transition-all shadow-lg shadow-indigo-500/10 flex items-center justify-center gap-2 mt-2"
            >
              {isLoading ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                "Create Account"
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-800/50 text-center">
            <p className="text-[11px] font-bold text-slate-500">
              ALREADY A MEMBER?{" "}
              <Link
                to="/login"
                className="text-indigo-400 hover:text-indigo-300 transition-colors ml-1 uppercase tracking-tighter"
              >
                Log in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Signup;
