#!/usr/bin/env bash
# exit on error
set -o errexit

echo "Installing frontend dependencies..."
npm install

echo "Building frontend..."
npm run build

echo "Installing backend dependencies..."
cd server
npm install
cd ..

echo "Build complete."
