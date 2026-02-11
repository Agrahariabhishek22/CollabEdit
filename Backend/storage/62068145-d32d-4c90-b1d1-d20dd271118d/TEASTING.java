public class Main {

    // 1. Factorial Function (Static taaki seedha call ho sake)
    public static int factorial(int a) {
        // Base case: 0! aur 1! dono 1 hote hain
        if (a <= 1) {
            return 1;
        }
        return a * factorial(a - 1);
    }

    // 2. Add Function (Yahan parameters ke saath 'int' lagana padta hai)
    public static int add(int a, int b) {
        return a + b;
    }

    // 3. Print Function (Java mein void use hota hai jab kuch return na karna ho)
    public static void printHelloWorld() {
        System.out.println("Hello World");
    }

    // Main method: Jahan se program chalna shuru hota hai
    public static void main(String[] args) {
        int c = 5;

        // Test Factorial
        System.out.println("Factorial of " + c + " is: " + factorial(c));

        // Test Add
        int sum = add(10, 20);
        System.out.println("Sum is: " + sum);

        // Test Print
        printHelloWorld();
    }
}