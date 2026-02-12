import { createSlice } from "@reduxjs/toolkit";

// Get customer details from localStorage (if exists)
const storedCustomer = JSON.parse(localStorage.getItem("customer")) || null;

const initialState = {
  customer: storedCustomer, // Store logged-in user data
  isAuthenticated: !!storedCustomer, // Check if user is logged in
  loading: false,
  error: null,
};

const customerSlice = createSlice({
  name: "customer",
  initialState,
  reducers: {
    loginSuccess: (state, action) => {
      state.customer = action.payload;
      state.isAuthenticated = true;
      state.loading = false;
      state.error = null;
      localStorage.setItem("customer", JSON.stringify(action.payload)); // Persist login
    },
    logoutSuccess: (state) => {
      state.customer = null;
      state.isAuthenticated = false;
      state.loading = false;
      state.error = null;
      localStorage.removeItem("customer"); 
    },
    setLoading: (state, action) => {
      state.loading = action.payload;
    },
    setError: (state, action) => {
      state.error = action.payload;
    },
    updateAddress:(state,action)=>{
      state.customer.address = state.customer.address.map((add)=>{
        return add._id === action.payload._id ? action.payload : add;
      })
    },
    addAddress:(state,action)=>{
      state.customer.address.push(action.payload)
    }
  },
});

export const { loginSuccess, logoutSuccess, setLoading, setError,updateAddress,addAddress } = customerSlice.actions;
export default customerSlice.reducer;
