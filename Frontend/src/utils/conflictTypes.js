/**
 * conflictTypes.js
 * 
 * Centralized definitions for conflict types and their visual properties
 * Maps backend conflict types to frontend UI styling
 */

export const CONFLICT_TYPES = {
  DUPLICATE_DECLARATION: "duplicate-declaration",
  FUNCTION_SIGNATURE_DRIFT: "function-signature-drift",
  CONST_MUTATION: "const-mutation",
  EXPORTED_API_CONTRACT: "exported-api-contract",
  SHADOWING: "shadowing",
  UNRESOLVED_IDENTIFIER: "unresolved-identifier",
};

export const CONFLICT_SEVERITY = {
  BLOCKING: "blocking",    // User MUST resolve
  WARNING: "warning",      // Advisory, system can handle
};

export const CONFLICT_UI_CONFIG = {
  [CONFLICT_TYPES.DUPLICATE_DECLARATION]: {
    label: "Duplicate Declaration",
    color: "red",
    bgColor: "bg-red-900/40",
    textColor: "text-red-300",
    icon: "🔴",
    description: "Variable/function declared twice. Choose which to keep.",
    resolutions: ["rename", "revert", "acknowledge"],
  },
  [CONFLICT_TYPES.CONST_MUTATION]: {
    label: "Const Mutation",
    color: "orange",
    bgColor: "bg-orange-900/40",
    textColor: "text-orange-300",
    icon: "🟠",
    description: "Constant value being modified. Convert to let or revert?",
    resolutions: ["convert-to-let", "revert", "rename"],
  },
  [CONFLICT_TYPES.UNRESOLVED_IDENTIFIER]: {
    label: "Unresolved Identifier",
    color: "yellow",
    bgColor: "bg-yellow-900/40",
    textColor: "text-yellow-300",
    icon: "🟡",
    description: "Variable or function not defined. Declare it?",
    resolutions: ["declare", "rename", "acknowledge"],
  },
  [CONFLICT_TYPES.FUNCTION_SIGNATURE_DRIFT]: {
    label: "Function Signature Drift",
    color: "purple",
    bgColor: "bg-purple-900/40",
    textColor: "text-purple-300",
    icon: "🟣",
    description: "Function signature changed. Update callers?",
    resolutions: ["rename", "revert", "acknowledge"],
  },
  [CONFLICT_TYPES.EXPORTED_API_CONTRACT]: {
    label: "Exported API Change",
    color: "indigo",
    bgColor: "bg-indigo-900/40",
    textColor: "text-indigo-300",
    icon: "🔷",
    description: "Public API signature changed.",
    resolutions: ["rename", "revert", "acknowledge"],
  },
  [CONFLICT_TYPES.SHADOWING]: {
    label: "Variable Shadowing",
    color: "blue",
    bgColor: "bg-blue-900/40",
    textColor: "text-blue-300",
    icon: "🔵",
    description: "Variable shadows outer scope. Rename it?",
    resolutions: ["rename", "acknowledge"],
  },
};

export const RESOLUTION_TYPES = {
  RENAME: "rename",
  REVERT: "revert",
  CONVERT_TO_LET: "convert-to-let",
  DECLARE: "declare",
  ACKNOWLEDGE: "acknowledge",
};

/**
 * Get UI config for a conflict type
 * Falls back to generic if not found
 */
export const getConflictConfig = (type) => {
  return (
    CONFLICT_UI_CONFIG[type] || {
      label: type,
      color: "gray",
      bgColor: "bg-gray-900/40",
      textColor: "text-gray-300",
      icon: "⚪",
      description: "Code modification detected.",
      resolutions: ["acknowledge"],
    }
  );
};

/**
 * Format conflict data for display
 */
export const formatConflict = (conflict) => {
  const config = getConflictConfig(conflict.type);
  
  return {
    ...conflict,
    ...config,
    locationString: `Line ${conflict.location.startLine + 1}`,
  };
};
