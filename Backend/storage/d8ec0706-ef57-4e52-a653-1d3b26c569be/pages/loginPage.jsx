import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
const api_url = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

const Login = () => {
  const navigate=useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      // Backend call with credentials true
      const response = await axios.post(`${api_url}/auth/login`, 
        { email, password }, 
        { withCredentials: true } 
      );
      console.log("Login Success:", response.data);
      alert("Logged in Successfully");
      navigate('/dashboard');
    } catch (error) {
         
      console.error("Login Error:", error);
      alert("Login Failed");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-8">Login</h2>
        
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700">Email Address</label>
            <input
              type="email"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-black"
              placeholder="admin@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Password</label>
            <input
              type="password"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-black"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150"
          >
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
erehjjhjhhhhjkk
jhjdfhjdjfhandjfhdsnfkj
jbejbjnsjnjssa
 
hhfb
this is me bro whats matter

who r u bro