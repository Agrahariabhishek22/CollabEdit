const getFibonacci = (n) => {
  const sequence = [0, 1];
  for (let i = 2; i < n; i++) {
    sequence.push(sequence[i - 1] + sequence[i - 2]);
  }
  return sequence.slice(0, n);
};

// 2. Factorial (Using Recursion)
const getFactorial = (num) => {
  if (num === 0 || num === 1) return 1;
  return num * getFactorial(num - 1);
  

};

// 3. Addition (Sum of all numbers in an array)
const sumArray = (arr) => {
  return arr.reduce((acc, curr) => acc + curr, 0);
};
const greet=(){
  }

  















