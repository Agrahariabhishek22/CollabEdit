# Use Node.js as the base image
FROM node:20-bullseye

# Install compilers and runtimes for the 5 languages
RUN apt-get update && apt-get install -y \
    python3 python3-pip \
    default-jdk \
    golang-go \
    g++ gcc \
    && rm -rf /var/lib/apt/lists/*

# Install LSP servers globally (Example for Python and JS)
RUN npm install -g pyright typescript-language-server typescript

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the backend code
COPY . .

# Expose the Backend Port (Socket.io + API)
EXPOSE 5000

# Start the server
# CMD ["npm", "run", "dev"]