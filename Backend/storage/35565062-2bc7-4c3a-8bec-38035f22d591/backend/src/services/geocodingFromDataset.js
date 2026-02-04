import fs, { createReadStream } from "fs";
import csv from "csv-parser";

const getCoordinates = (cityName, countryName) => {
  return new Promise((resolve, reject) => {
    let found = false;
    fs.createReadStream("worldcities.csv")
      .pipe(csv())
      .on("data", (row) => {
        if (
          row.city.toLowerCase() === cityName.toLowerCase() &&
          row.country.toLowerCase() === countryName.toLowerCase()
        ) {
          found = true;
          resolve({
            lat: row.lat,
            lng: row.lng,
          });
        }
      })
      .on("end", () => {
        if (!found) {
          reject(new Error(`City '${cityName}' in '${countryName}' not found in our records.`));
        }
      })
      .on("error", (err) => reject(new Error("Database file reading error: " + err.message)));
  });
};
export default getCoordinates;