FROM node:18-alpine

# Install Python and pip for yt-dlp
RUN apk add --no-cache python3 py3-pip curl

# Install yt-dlp
RUN pip3 install yt-dlp

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]