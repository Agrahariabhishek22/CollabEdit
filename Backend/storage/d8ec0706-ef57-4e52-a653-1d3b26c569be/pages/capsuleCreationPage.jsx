import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
const api_url = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

const CapsuleCreationPage = () => {
  const [loading, setLoading] = useState(false);
  const navigate=useNavigate();
  const [formData, setFormData] = useState({
    title: "",
    message: "",
    triggerType: "DATE_TIME",
    dateTime: "",
    // address: "",
    city: "",
    // state: "",
    country: "",
  });
  const [selectedFiles, setSelectedFiles] = useState([]);

  const handleFileChange = (e) => {
    setSelectedFiles([...e.target.files]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    // FormData create karna zaroori hai multipart/form-data ke liye
    const data = new FormData();
    data.append("title", formData.title);
    data.append("textMessage", formData.message);
    data.append("triggerType", formData.triggerType);

    if (formData.triggerType === "DATE_TIME")
      data.append("deliveryTime", formData.dateTime);
    if (formData.triggerType === "LOCATION") {
      data.append("city", formData.city);
      // data.append("address", formData.address);
      // data.append("state", formData.state);
      data.append("country", formData.country);
    }

    // Saari files ko append karna
    selectedFiles.forEach((file) => {
      data.append("files", file);
    });

    try {
      if (formData.triggerType === "DATE_TIME") {
        const response = await axios.post(`${api_url}/capsules/date`, data, {
          withCredentials: true,
          headers: { "Content-Type": "multipart/form-data" },
        });
      } else if (formData.triggerType === "LOCATION") {
        const response = await axios.post(
          `${api_url}/capsules/location`,
          data,
          {
            withCredentials: true,
            headers: { "Content-Type": "multipart/form-data" },
          }
        );
      } else if (formData.triggerType === "CUSTOM") {
        const response = await axios.post(`${api_url}/capsules/custom`, data, {
          withCredentials: true,
          headers: { "Content-Type": "multipart/form-data" },
        });
      }

      alert("Capsule Created Successfully!");
    } catch (error) {
      console.error("Error creating capsule:", error.message);
      alert("something went wrong",error.message);
    } finally {
      setLoading(false);
      navigate("/undelivered")
    }
  };

  // Aaj ki date aur time for validation
  const minDateTime = new Date().toISOString().slice(0, 16);

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-lg p-8 border border-gray-100">
        <h2 className="text-3xl font-bold text-indigo-700 mb-6">
          Create New Time Capsule
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-semibold text-gray-700">
              Capsule Title
            </label>
            <input
              type="text"
              required
              className="mt-1 w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 outline-none text-black"
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
            />
          </div>

          {/* Text Message */}
          <div>
            <label className="block text-sm font-semibold text-gray-700">
              Secret Message
            </label>
            <textarea
              rows="4"
              required
              className="mt-1 w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 outline-none text-black"
              onChange={(e) =>
                setFormData({ ...formData, message: e.target.value })
              }
            />
          </div>

          {/* File Upload */}
          <div>
            <label className="block text-sm font-semibold text-gray-700">
              Upload Photos/Files
            </label>
            <input
              type="file"
              multiple
              className="mt-1 w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
              onChange={handleFileChange}
            />
          </div>

          {/* Trigger Type Dropdown */}
          <div>
            <label className="block text-sm font-semibold text-gray-700">
              Choose Trigger Type
            </label>
            <select
              className="mt-1 w-full px-4 py-3 rounded-lg border border-gray-300 bg-white text-black"
              value={formData.triggerType}
              onChange={(e) =>
                setFormData({ ...formData, triggerType: e.target.value })
              }
            >
              <option value="DATE_TIME">Date & Time</option>
              <option value="LOCATION">Location Based</option>
              <option value="CUSTOM">Custom (Nothing)</option>
            </select>
          </div>

          {/* Conditional Inputs */}
          {formData.triggerType === "DATE_TIME" && (
            <div className="animate-fade-in">
              <label className="block text-sm font-semibold text-gray-700">
                Unlock Date & Time
              </label>
              <input
                type="datetime-local"
                required
                min={minDateTime}
                className="mt-1 w-full px-4 py-3 rounded-lg border border-indigo-300 text-black"
                onChange={(e) =>
                  setFormData({ ...formData, dateTime: e.target.value })
                }
              />
            </div>
          )}

          {formData.triggerType === "LOCATION" && (
            <div className="grid grid-cols-2 gap-4 animate-fade-in">
              {/* <div>
                <label className="block text-sm font-semibold text-gray-700">
                  Address
                </label>
                <input
                  type="text"
                  
                  className="mt-1 w-full px-4 py-3 rounded-lg border border-indigo-300 text-black"
                  onChange={(e) =>
                    setFormData({ ...formData, address: e.target.value })
                  }
                />
              </div> */}
              <div>
                <label className="block text-sm font-semibold text-gray-700">
                  City
                </label>
                <input
                  type="text"
                  required
                  className="mt-1 w-full px-4 py-3 rounded-lg border border-indigo-300 text-black"
                  onChange={(e) =>
                    setFormData({ ...formData, city: e.target.value })
                  }
                />
              </div>
              {/* <div>
                <label className="block text-sm font-semibold text-gray-700">
                  State
                </label>
                <input
                  type="text"
                  required
                  className="mt-1 w-full px-4 py-3 rounded-lg border border-indigo-300 text-black"
                  onChange={(e) =>
                    setFormData({ ...formData, state: e.target.value })
                  }
                />
              </div> */}
              <div>
                <label className="block text-sm font-semibold text-gray-700">
                  Country
                </label>
                <input
                  type="text"
                  required
                  className="mt-1 w-full px-4 py-3 rounded-lg border border-indigo-300 text-black"
                  onChange={(e) =>
                    setFormData({ ...formData, country: e.target.value })
                  }
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading} // Loading ke waqt button kaam nahi karega
            className={`w-full font-bold py-3 px-4 rounded-xl transition duration-300 shadow-lg ${
              loading
                ? "bg-gray-400 cursor-not-allowed" // Loading state styling
                : "bg-indigo-600 hover:bg-indigo-700 text-white"
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                Processing... 
              </span>
            ) : (
              "Create Capsule"
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CapsuleCreationPage;
