import axios from 'axios';

const API = axios.create({
  baseURL: 'http://localhost:3000/api', // Tera backend URL
  withCredentials: true, // Cookies (token) handle karne ke liye bohot zaruri hai
});

export default API;