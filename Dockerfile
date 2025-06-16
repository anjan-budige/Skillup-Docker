# Stage 1: Build the React application
FROM node:18-alpine AS build

WORKDIR /app

# Copy the frontend's package files
COPY package*.json ./

# Install frontend dependencies
RUN npm install

# Copy all frontend source code AND the entire backend folder
COPY . .

# Set the API URL build argument from docker-compose
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

# Run the production build for the frontend
RUN npm run build


# Stage 2: Serve the built static files with Nginx
FROM nginx:1.23-alpine

# Remove default Nginx content
RUN rm -rf /usr/share/nginx/html/*

# Copy the built React app from the 'build' stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy our custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]