import axios from "axios";

export const geocodeLocation = async (city, country) => {
  const query = `${city}, ${country}`;

  const response = await axios.get(
    "https://nominatim.openstreetmap.org/search",
    {
      params: {
        q: query,
        format: "json",
        limit: 1,
      },
      headers: {
        "User-Agent": "digital-time-capsule-app",
      },
    }
  );

  if (!response.data.length) {
    throw new Error("Invalid location");
  }

  return {
    latitude: parseFloat(response.data[0].lat),
    longitude: parseFloat(response.data[0].lon),
  };
};
