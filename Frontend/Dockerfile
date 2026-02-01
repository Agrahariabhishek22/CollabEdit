FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Expose Vite's default port
EXPOSE 5173

# Run Vite with --host flag to allow access from browser
# CMD ["npm", "run", "dev", "--", "--host"]