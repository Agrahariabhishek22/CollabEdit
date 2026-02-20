/**
 * Test File for Code Intelligence & Error Detection
 * Contains: Hard Syntax, Missing Tokens, and Structural Errors
 */

// --- 1. Hard Syntax Errors (ERROR nodes) ---

// Error 1: Incomplete Statement
const a =67 ;

// Error 2: Mismatched Brackets & Invalid Characters
function testError() {
    let invalidSymbol = "Bhai ye nahi chalega";
// Missing closing bracket for function

// --- 2. Missing Token Warnings (node.isMissing()) ---

// Warning 1: Missing Semicolon
const name = "Abhishek"

// Warning 2: Missing Comma in Object
const user = {
    age: 25,
    city: "Delhi"
};

// --- 3. Structural Errors (Smart Linting / Logic) ---

// Structure 1: Duplicate Keys in Object
const config = {
    theme: "dark",
    mode: "edit",
  //  theme: "light" // Duplicate key 'theme'
};

// Structure 2: Empty Blocks
if (true) {
    // Empty block - logic missing
// Empty function body   
}
// Structure 3: Unreachable Code
function calculate() {
    const result = 10 + 20;
    console.log("Ye kabhi print nahi hoga!"); // Unreachable
    const x = 50; // Unreachable
    return result;
   //console.log("i am done mera ho gya");
}

// Hard Syntax Error 2 (Closing bracket mismatch for )
};

if(a==b){
    console.log("i am done bro")
}
if(true){
  if(true){
    if(true){
      console.log("ok bro i am done");
      if(true){


        console.log("ok");
      } 
    }
  }
}


if(true){
  console.log("okay");
  
}


if(true){
      
  console.log("I am done");
    
}
 
if(true){
  console.log("okay");
  if(true){
    }
  
}
  


if(true){
  
}
function greet(){
  console.log("hghgdh");
}

   if(){
  
  
}
  
  
