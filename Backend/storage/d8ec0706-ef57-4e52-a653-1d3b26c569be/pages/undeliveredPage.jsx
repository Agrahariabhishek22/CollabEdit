import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { RefreshCw } from 'lucide-react';
import UndeliveredCard from '../components/undeliveredCapsuleCard';

const api_url = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

const UndeliveredPage = () => {
  const [capsules, setCapsules] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchUndelivered = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${api_url}/capsules/undelivered`, {
        withCredentials: true
      });
      // Tumhare JSON structure ke hisaab se response.data.formattedCapsules access kar rahe hain
      setCapsules(response.data.formattedCapsules || []);
    } catch (error) {
      console.error("Error fetching undelivered capsules:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUndelivered();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10 text-black">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-10">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-3xl font-extrabold text-slate-800">Pending Capsules</h1>
              <p className="text-slate-500 text-sm">These capsules are waiting for their release trigger.</p>
            </div>
          </div>
          
          <button 
            onClick={fetchUndelivered}
            className="p-2 hover:bg-white rounded-full transition-all border border-transparent hover:border-slate-200"
          >
            <RefreshCw className={`w-5 h-5 text-slate-600 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <RefreshCw className="w-10 h-10 text-indigo-500 animate-spin" />
          </div>
        ) : capsules.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {capsules.map((cap) => (
              <UndeliveredCard key={cap.id} capsule={cap} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-white rounded-2xl border-2 border-dashed border-slate-200">
            <p className="text-slate-400 font-medium text-lg">No pending capsules found.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default UndeliveredPage;