import React, { useEffect } from 'react';
import axios from 'axios';
const api_url = import.meta.env.VITE_API_URL || "http://localhost:3000/api";


const LocationTracker = () => {

  const sendLocationToBackend = () => {
    // 1. Check if Geolocation is supported
    if (!navigator.geolocation) {
      console.log("Geolocation is not supported by your browser");
      return;
    }

    // 2. Request current position
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        
        console.log(`Sending Location: Lat ${latitude}, Lon ${longitude}`);

        try { 
          // 3. API Call to backend
          await axios.post(`${api_url}/unlock/location`, {
            latitude,
            longitude,
          }, { withCredentials: true });
          
          console.log("Location updated successfully");
        } catch (error) {
          console.error("Error sending location:", error);
        }
      },
      (error) => {
        console.error("Location Permission Denied or Error:", error.message);
      },
      { enableHighAccuracy: true } // Behtar accuracy ke liye
    );
  };

  useEffect(() => {
    // Pehli baar call turant karo
    sendLocationToBackend();

    // trigger in every 5 minute (300,000 milliseconds) 
    const intervalId = setInterval(() => {
      sendLocationToBackend();
    }, 300000); 

    // Jab component unmount ho, toh interval saaf karo (Memory leak bachane ke liye)
    return () => clearInterval(intervalId);
  }, []);

  return null; // Ye sirf logic ke liye hai, kuch UI render nahi karega
};

export default LocationTracker;