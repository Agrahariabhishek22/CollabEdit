import React, { useState } from "react";
import axios from "axios";
import { Lock, Loader2 } from "lucide-react"; // Icons import kiye
import DeliveredCapsuleCard from "../components/deliveredCapsuleCards";
const api_url = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

const DeliveredPage = () => {
  const [capsules, setCapsules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [isAuthorized, setIsAuthorized] = useState(false);

  const fetchDeliveredCapsules = async () => {
    if (!password) {
      alert("Password is required to decrypt capsules!");
      return;
    }
    setLoading(true);
    try {
      const response = await axios.post(
        `${api_url}/capsules/delivered`,
        { password },
        { withCredentials: true }
      );

      if (response.data.success) {
        setCapsules(response.data.capsules);
        setIsAuthorized(true);
      }
    } catch (error) {
      console.error("Error fetching capsules:", error);
      alert("Incorrect password or server error!");
    } finally {
      setLoading(false);
    }
  };

  // Password Prompt UI (Agar authorized nahi hai)
  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 font-sans text-black">
        <div className="max-w-md w-full bg-white rounded-2xl p-8 shadow-xl border border-gray-100">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-slate-800">
              Security Check
            </h2>
            <p className="text-gray-500 text-sm mt-2">
              Enter your password to decrypt your delivered capsules safely.
            </p>
          </div>

          <div className="space-y-4">
            <input
              type="password"
              placeholder="Enter Decryption Password"
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-black"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchDeliveredCapsules()}
            />
            <button
              onClick={fetchDeliveredCapsules}
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold py-3 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 shadow-lg shadow-indigo-200"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Decrypting...
                </>
              ) : (
                <>Access Capsules</>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-10 font-sans text-black">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold text-slate-800">
              Delivered Capsules
            </h1>
          </div>

          <button
            onClick={() => {
              setIsAuthorized(false);
              setPassword("");
            }}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-rose-600 font-semibold hover:bg-rose-50 hover:border-rose-100 transition-all shadow-sm"
          >
            Lock Vault <Lock className="w-4 h-4" />
          </button>
        </div>

        {capsules.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {capsules.map((cap) => (
              <DeliveredCapsuleCard key={cap.id} capsule={cap} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
            <p className="text-gray-400 text-lg font-medium">
              No delivered capsules found in your vault.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DeliveredPage;
