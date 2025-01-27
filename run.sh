#!/bin/bash

echo "Starting script execution..."

# Update and install dependencies
echo "Updating and installing dependencies..."
sudo apt-get update
sudo apt-get install -y \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    libatspi2.0-0 \
    ca-certificates \
    fonts-liberation \
    libc6 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcursor1 \
    libxext6 \
    libxi6 \
    libxrender1 \
    libxtst6 \
    lsb-release \
    wget \
    xdg-utils

# Install Chrome for Puppeteer
echo "Installing Chrome for Puppeteer..."
npx puppeteer browsers install chrome

# Run index.js
echo "Running BuyBackBoss script..."
node index.js

# Check if index script was successful
if [ $? -ne 0 ]; then
    echo "BuyBackBoss script failed!"
    exit 1
fi

echo "Script execution completed successfully!"