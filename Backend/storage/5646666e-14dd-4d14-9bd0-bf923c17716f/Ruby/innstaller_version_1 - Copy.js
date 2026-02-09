function factorial(n) {
    // Input validation
    if (typeof n !== "number" || !Number.isInteger(n) || n < 0) {
        throw new Error("Input must be a non-negative integer.");
    }

    // Base case
    if (n === 0 || n === 1) return 1;

    // Recursive calculation
    return n * factorial(n - 1);
}

// Example usage:
try {
    console.log(factorial(5));  // 120
    console.log(factorial(0));  // 1
    console.log(factorial(10)); // 3628800
} catch (error) {
    console.error("Error:", error.message);
}