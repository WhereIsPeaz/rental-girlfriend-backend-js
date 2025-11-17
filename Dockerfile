# Stage 1: Build the app
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# If you have a build step (like for TypeScript), run it here
# RUN npm run build

# Stage 2: Create the final production image
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --only=production

# Copy built files from the 'builder' stage
COPY --from=builder /app ./

EXPOSE 5003
CMD [ "node", "server.js" ]