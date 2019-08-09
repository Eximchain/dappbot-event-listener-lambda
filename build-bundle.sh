#!/bin/bash

BUNDLE_NAME=$1

# Install and copy over node_modules
npm install
rm -rf build/*
cp -R node_modules build/node_modules

# Build, enter, and zip
rm -f $BUNDLE_NAME

# npx makes command work even if tsc isn't installed
npx -p typescript tsc
cd build
zip -r ../$BUNDLE_NAME *
cd ..


