import Parser from 'tree-sitter';
import JavaScript from 'tree-sitter-javascript';
import Python from 'tree-sitter-python';
import Java from 'tree-sitter-java';
import CPP from 'tree-sitter-cpp';
import Go from 'tree-sitter-go';

const parser = new Parser();

const testCases = [
  { name: 'JavaScript', lang: JavaScript, code: 'const a = 10; console.log(a);' },
  { name: 'Python', lang: Python, code: 'def hello():\n    print("world")' },
  { name: 'Java', lang: Java, code: 'public class Test { int x = 5; }' },
  { name: 'C++', lang: CPP, code: '#include <iostream>\nint main() { return 0; }' },
  { name: 'Go', lang: Go, code: 'package main\nimport "fmt"\nfunc main() { fmt.Println(1) }' }
];

console.log("🚀 Running ESM Parser Tests...\n");

for (const { name, lang, code } of testCases) {
  try {
    parser.setLanguage(lang);
    const tree = parser.parse(code);
    
    if (tree && tree.rootNode) {
      // Check if root node actually has children to ensure it parsed something
      const status = tree.rootNode.childCount > 0 ? "✅ Success" : "⚠️ Partial (Empty Tree)";
      console.log(`${status} | ${name.padEnd(12)} | Root Type: ${tree.rootNode.type}`);
    } else {
      console.error(`❌ ${name}: Failed to generate tree.`);
    }
  } catch (err) {
    console.error(`❌ ${name}: Crash! Error: ${err.message}`);
    console.log("Tip: Check if the parser version matches the tree-sitter core ABI.");
  }
}

console.log("\n-------------------------------------------");
console.log("Bhai agar sab ✅ hain, toh tension free code karo!");