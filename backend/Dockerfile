# Use Node base image
FROM node:18

# Set working directory inside container
WORKDIR /app

# Copy only package files first (for layer caching)
COPY package*.json ./

# Install dependencies
RUN npm install
RUN npm install moment

# Copy the rest of the application
COPY . .

# Expose the port your app runs on
EXPOSE 5000

# Run the backend server
CMD ["node", "server.js"]
