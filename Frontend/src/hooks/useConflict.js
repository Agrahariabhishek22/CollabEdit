/**
 * hooks/useConflict.jsx
 * 
 * Custom hook for accessing and managing conflicts
 * Simplifies component logic by wrapping ConflictContext usage
 */

import { useContext } from "react";
import { ConflictContext } from "../context/ConflictContext";

export const useConflict = () => {
  const context = useContext(ConflictContext);

  if (!context) {
    throw new Error(
      "useConflict must be used within a ConflictProvider. " +
      "Make sure ConflictProvider wraps your component hierarchy."
    );
  }

  return context;
};
