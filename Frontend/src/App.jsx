import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import 'prismjs/themes/prism-tomorrow.css';
import Signup from "./pages/SignUp";
import Login from "./pages/login";
import DashboardLayout from "./pages/DashboardLayout";
import { ToastContainer, toast } from "react-toastify";
import { SocketProvider } from "./context/SocketContext";
import { ConflictProvider } from "./context/ConflictContext"; // ✅ ADD-ON
import { useSocket } from "./hooks/useSocket"; // ✅ ADD-ON

// ✅ ADD-ON: Wrapper component to provide socket to ConflictProvider
function AppContent() {
  const { socket } = useSocket();

  return (
    <ConflictProvider socket={socket}>
      <Router>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/dashboard" element={<DashboardLayout />} />
        </Routes>
        <ToastContainer
          position="bottom-left"
          autoClose={2000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick={false}
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="dark"
        />
      </Router>
    </ConflictProvider>
  );
}

function App() {
  return (
    <SocketProvider>
      <AppContent />
    </SocketProvider>
  );
}

export default App;
